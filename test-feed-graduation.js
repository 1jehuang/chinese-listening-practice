// Test: Feed Graduate mode actually graduates words
// Run with: node test-feed-graduation.js

const fs = require('fs');
const vm = require('vm');

const storage = {};
function makeFakeElement() {
    const el = {
        style: {}, cssText: '',
        classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
        addEventListener(){}, appendChild(){}, insertBefore(){}, prepend(){}, append(){},
        setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
        querySelector(){ return null; }, querySelectorAll(){ return []; },
        closest(){ return null; },
        dataset: {}, innerHTML: '', textContent: '', innerText: '',
        remove(){}, cloneNode(){ return makeFakeElement(); },
        parentElement: null, parentNode: null,
        children: [], childNodes: [],
        getBoundingClientRect(){ return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 }; },
        offsetWidth: 0, offsetHeight: 0,
        scrollHeight: 0, scrollTop: 0,
        focus(){}, blur(){}, click(){},
    };
    return el;
}

const ctx = vm.createContext({
    window: { location: { pathname: '/test-page.html' }, innerWidth: 1200, __QUIZ_DEBUG__: {}, addEventListener: () => {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => makeFakeElement(), body: { classList: { add(){}, remove(){}, contains(){ return false; } }, style: {}, appendChild(){}, insertBefore(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }, dispatchEvent: () => {}, addEventListener: () => {}, head: { appendChild(){} }, documentElement: { style: {} } },
    localStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    speechSynthesis: { speak(){}, cancel(){}, getVoices(){ return []; } },
    SpeechSynthesisUtterance: class {},
    Audio: class { play(){ return Promise.resolve(); } pause(){} addEventListener(){} },
    MutationObserver: class { observe(){} disconnect(){} },
    IntersectionObserver: class { observe(){} disconnect(){} },
    ResizeObserver: class { observe(){} disconnect(){} },
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: () => {},
    setTimeout, setInterval, clearInterval, clearTimeout,
    CustomEvent: class { constructor(t){ this.type = t; } },
    Event: class { constructor(t){ this.type = t; } },
    HTMLElement: class {},
    getComputedStyle: () => ({}),
    matchMedia: () => ({ matches: false, addEventListener(){} }),
    navigator: { userAgent: '', clipboard: { writeText: () => Promise.resolve() } },
    CSS: { supports: () => false },
    performance: { now: () => Date.now() },
    console, Date, Math, JSON, Number, Array, Object, String, Boolean, Set, Map, Promise, Error, TypeError, RegExp,
    parseInt, parseFloat, isNaN, isFinite, Infinity, NaN, undefined,
    encodeURIComponent, decodeURIComponent,
    URL, URLSearchParams,
});

// Inject variables from other engine files that quiz-engine.js references
vm.runInContext(`
    var chatPanelVisible = false;
    var chatPanel = null;
`, ctx);

// Load quiz-engine.js
const code = fs.readFileSync('./js/quiz-engine.js', 'utf-8');
vm.runInContext(code, ctx, { filename: 'quiz-engine.js' });

// Inject test accessor functions (let/const vars aren't context properties in vm)
vm.runInContext(`
    function __getSchedulerMode() { return schedulerMode; }
    function __getFeedModeState() { return feedModeState; }
    function __getCurrentQuestion() { return currentQuestion; }
    function __setCurrentQuestion(q) { currentQuestion = q; }
    function __resetOutcomeGuard() { schedulerOutcomeRecordedChar = null; }
    function __clearStorage() {
        feedModeState = { hand: [], seen: {}, totalPulls: 0 };
        schedulerStats = {};
    }
`, ctx);

let passed = 0;
let failed = 0;

function assert(condition, msg) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${msg}`);
    } else {
        failed++;
        console.log(`  ✗ ${msg}`);
    }
}

function resetAndInit(vocabPool) {
    for (const k of Object.keys(storage)) delete storage[k];
    ctx.__clearStorage();
    ctx.initQuizPersistentState(vocabPool, {});
}

const vocab = [];
for (let i = 0; i < 8; i++) {
    vocab.push({ char: `word${i}`, pinyin: `pin${i}`, meaning: `meaning ${i}` });
}

function simulateCorrectAnswers(charName, count) {
    const q = vocab.find(v => v.char === charName);
    for (let i = 0; i < count; i++) {
        ctx.__setCurrentQuestion(q);
        ctx.__resetOutcomeGuard();
        ctx.markSchedulerServed(q);
        ctx.markSchedulerOutcome(true);
    }
}

// ============================================================
// Test 1: Words graduate and stay out of the hand
// ============================================================
console.log('\n=== Test 1: Feed SR graduation removes words from hand ===\n');

resetAndInit(vocab);
ctx.setSchedulerMode('feed-sr');
assert(ctx.__getSchedulerMode() === 'feed-sr', 'Scheduler mode is feed-sr');

ctx.ensureFeedHand();
const state1 = ctx.__getFeedModeState();
const initialHand = [...state1.hand];
assert(initialHand.length > 0, `Initial hand has ${initialHand.length} cards`);

const targetWord = initialHand[0];
simulateCorrectAnswers(targetWord, 5);

const bktScore = ctx.getBKTScore(targetWord);
assert(bktScore >= 0.85, `BKT score for ${targetWord} is ${bktScore.toFixed(3)} (>= 0.85)`);

const feedStats = ctx.__getFeedModeState().seen[targetWord];
assert(feedStats && feedStats.attempts >= 2, `Feed attempts for ${targetWord}: ${feedStats?.attempts} (>= 2)`);

ctx.ensureFeedHand();
const handAfterGrad = [...ctx.__getFeedModeState().hand];
assert(!handAfterGrad.includes(targetWord), `${targetWord} is NOT in hand after graduation`);

const graduatedSet = ctx.getFeedGraduatedSet();
assert(graduatedSet.has(targetWord), `${targetWord} IS in graduated set`);

// ============================================================
// Test 2: Graduated words don't come back when hand is refilled
// ============================================================
console.log('\n=== Test 2: Graduated words stay out after hand refill ===\n');

for (let i = 0; i < 5; i++) {
    ctx.ensureFeedHand();
}
const handAfterRefills = [...ctx.__getFeedModeState().hand];
assert(!handAfterRefills.includes(targetWord), `${targetWord} still NOT in hand after 5 refills`);

// ============================================================
// Test 3: Graduate multiple words, hand shrinks to empty
// ============================================================
console.log('\n=== Test 3: All words graduate -> empty hand ===\n');

for (const word of vocab) {
    simulateCorrectAnswers(word.char, 6);
}

ctx.ensureFeedHand();
const gradSetFinal = ctx.getFeedGraduatedSet();
assert(gradSetFinal.size === vocab.length, `All ${vocab.length} words graduated (got ${gradSetFinal.size})`);

const finalHand = [...ctx.__getFeedModeState().hand];
assert(finalHand.length === 0, `Hand is empty after all words graduated (got ${finalHand.length})`);

// ============================================================
// Test 4: getFeedQuestionPool returns empty when all graduated
// ============================================================
console.log('\n=== Test 4: Question pool empty when all graduated ===\n');

const pool = ctx.getFeedQuestionPool();
assert(pool.length === 0, `Question pool is empty (got ${pool.length})`);

// ============================================================
// Test 5: Target hand size capped by non-graduated cards
// ============================================================
console.log('\n=== Test 5: Target hand size capped by non-graduated count ===\n');

resetAndInit(vocab);
ctx.setSchedulerMode('feed-sr');

for (let i = 0; i < 6; i++) {
    simulateCorrectAnswers(vocab[i].char, 6);
}

ctx.ensureFeedHand();
const gradSet5 = ctx.getFeedGraduatedSet();
assert(gradSet5.size === 6, `6 words graduated (got ${gradSet5.size})`);

const targetSize = ctx.getFeedTargetHandSize();
assert(targetSize <= 2, `Target hand size <= 2 (got ${targetSize})`);

const hand5 = [...ctx.__getFeedModeState().hand];
const hasGraduated = hand5.some(c => gradSet5.has(c));
assert(!hasGraduated, `Hand contains no graduated words`);

// ============================================================
// Test 6: Regular Feed mode (streak-based) also graduates
// ============================================================
console.log('\n=== Test 6: Regular Feed mode streak-based graduation ===\n');

resetAndInit(vocab);
ctx.setSchedulerMode('feed');

ctx.ensureFeedHand();
const feedWord = ctx.__getFeedModeState().hand[0];

simulateCorrectAnswers(feedWord, 4);

ctx.ensureFeedHand();
const feedGradSet = ctx.getFeedGraduatedSet();
const feedHandAfter = [...ctx.__getFeedModeState().hand];

assert(feedGradSet.has(feedWord), `${feedWord} graduated in regular feed mode`);
assert(!feedHandAfter.includes(feedWord), `${feedWord} NOT in hand in regular feed mode`);

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(50));
console.log(`\nTotal: ${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.log('\nSOME TESTS FAILED');
    process.exit(1);
} else {
    console.log('\nALL TESTS PASSED ✓');
}
process.exit(failed > 0 ? 1 : 0);
