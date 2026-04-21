const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function makeFakeElement(tagName = 'div') {
  let classNameValue = '';
  const getClassSet = () => new Set(String(classNameValue || '').split(/\s+/).filter(Boolean));
  const setClassSet = (classSet) => {
    classNameValue = Array.from(classSet).join(' ');
  };

  const el = {
    tagName: String(tagName).toUpperCase(),
    style: {},
    dataset: {},
    children: [],
    childNodes: [],
    parentNode: null,
    parentElement: null,
    textContent: '',
    innerText: '',
    _innerHTML: '',
    classList: {
      add(...names) {
        const classSet = getClassSet();
        names.filter(Boolean).forEach((name) => classSet.add(name));
        setClassSet(classSet);
      },
      remove(...names) {
        const classSet = getClassSet();
        names.filter(Boolean).forEach((name) => classSet.delete(name));
        setClassSet(classSet);
      },
      contains(name) {
        return getClassSet().has(name);
      },
      toggle(name, force) {
        const classSet = getClassSet();
        const shouldAdd = force === undefined ? !classSet.has(name) : Boolean(force);
        if (shouldAdd) classSet.add(name);
        else classSet.delete(name);
        setClassSet(classSet);
        return shouldAdd;
      }
    },
    appendChild(child) {
      if (!child) return child;
      child.parentNode = this;
      child.parentElement = this;
      this.children.push(child);
      this.childNodes.push(child);
      return child;
    },
    insertBefore(child, referenceChild) {
      if (!child) return child;
      child.parentNode = this;
      child.parentElement = this;
      const refIndex = this.children.indexOf(referenceChild);
      if (refIndex === -1) {
        this.children.push(child);
        this.childNodes.push(child);
      } else {
        this.children.splice(refIndex, 0, child);
        this.childNodes.splice(refIndex, 0, child);
      }
      return child;
    },
    prepend(child) {
      return this.insertBefore(child, this.children[0] || null);
    },
    append(...nodes) {
      nodes.forEach((node) => this.appendChild(node));
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute(name, value) { this[name] = value; },
    getAttribute(name) { return this[name] ?? null; },
    removeAttribute(name) { delete this[name]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    remove() {},
    focus() {},
    blur() {},
    click() { if (typeof this.onclick === 'function') this.onclick(); },
    cloneNode() { return makeFakeElement(tagName); },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 };
    },
    offsetWidth: 0,
    offsetHeight: 0,
    scrollHeight: 0,
    scrollTop: 0,
  };

  Object.defineProperty(el, 'className', {
    get() { return classNameValue; },
    set(value) { classNameValue = String(value || '').trim().replace(/\s+/g, ' '); }
  });

  Object.defineProperty(el, 'innerHTML', {
    get() { return this._innerHTML; },
    set(value) {
      this._innerHTML = String(value || '');
      if (value === '') {
        this.children = [];
        this.childNodes = [];
      }
    }
  });

  return el;
}

function createHarness(vocab) {
  const storage = {};
  const math = Object.create(Math);
  math.random = () => 0.5;

  const elements = new Map([
    ['feedModeStatus', makeFakeElement('div')],
    ['schedulerToolbar', makeFakeElement('div')],
    ['questionDisplay', makeFakeElement('div')],
    ['answerInput', makeFakeElement('input')],
    ['checkBtn', makeFakeElement('button')],
    ['feedback', makeFakeElement('div')],
    ['hint', makeFakeElement('div')],
    ['typeMode', makeFakeElement('div')],
    ['choiceMode', makeFakeElement('div')],
    ['fuzzyMode', makeFakeElement('div')],
    ['fuzzyInput', makeFakeElement('input')],
    ['strokeOrderMode', makeFakeElement('div')],
    ['handwritingMode', makeFakeElement('div')],
    ['drawCharMode', makeFakeElement('div')],
    ['studyMode', makeFakeElement('div')],
    ['audioSection', makeFakeElement('div')],
    ['options', makeFakeElement('div')],
    ['fuzzyOptions', makeFakeElement('div')],
  ]);

  const body = makeFakeElement('body');
  const head = makeFakeElement('head');
  const location = {
    pathname: '/test-page.html',
    search: '',
    hash: '',
    origin: 'https://example.test',
    href: 'https://example.test/test-page.html'
  };

  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tagName) { return makeFakeElement(tagName); },
    body,
    head,
    documentElement: { style: {} },
    addEventListener() {},
    dispatchEvent() {},
  };

  const ctx = vm.createContext({
    window: {
      location,
      innerWidth: 1200,
      __QUIZ_DEBUG__: {},
      addEventListener() {},
      removeEventListener() {},
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    },
    document,
    history: { replaceState() {} },
    localStorage: {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    speechSynthesis: { speak() {}, cancel() {}, getVoices() { return []; } },
    SpeechSynthesisUtterance: class {},
    Audio: class { play() { return Promise.resolve(); } pause() {} addEventListener() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    CustomEvent: class { constructor(type) { this.type = type; } },
    Event: class { constructor(type) { this.type = type; } },
    HTMLElement: class {},
    getComputedStyle: () => ({}),
    navigator: { userAgent: '', clipboard: { writeText: () => Promise.resolve() } },
    CSS: { supports: () => false },
    performance: { now: () => Date.now() },
    console,
    Date,
    Math: math,
    JSON,
    Number,
    Array,
    Object,
    String,
    Boolean,
    Set,
    Map,
    Promise,
    Error,
    TypeError,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Infinity,
    NaN,
    undefined,
    encodeURIComponent,
    decodeURIComponent,
    URL,
    URLSearchParams,
  });

  vm.runInContext(`
    var chatPanelVisible = false;
    var chatPanel = null;
  `, ctx);

  const code = fs.readFileSync('./js/quiz-engine.js', 'utf8');
  vm.runInContext(code, ctx, { filename: 'quiz-engine.js' });

  vm.runInContext(`
    function __setQuizCharacters(chars) { originalQuizCharacters = chars; quizCharacters = chars; }
    function __setModeForTest(value) { mode = value; }
    function __setCurrentQuestionForTest(question) { currentQuestion = question; }
    function __setFeedModeStateForTest(state) { feedModeState = state; }
    function __getFeedModeStateForTest() { return feedModeState; }
    function __setBatchModeStateForTest(state) { batchModeState = state; }
    function __getBatchModeStateForTest() { return batchModeState; }
    function __setWordMarkingsForTest(markings) { wordMarkings = markings || {}; }
    function __setRecentCorrectForTest(chars) { recentCorrectChars = Array.isArray(chars) ? chars.slice() : []; }
    function __setConfidenceFormulaForTest(value) { confidenceFormula = value; }
    function __getSchedulerStatsForTest(char, skillKey) { return getSchedulerStats(char, skillKey); }
    function __getElementsForTest() { return 0; }
  `, ctx);

  ctx.initQuizPersistentState(vocab, {});
  ctx.__setQuizCharacters(vocab);
  ctx.__setModeForTest('char-to-meaning-type');
  ctx.__elements = elements;
  ctx.__storage = storage;
  return { ctx, elements, storage };
}

function buildVocab(chars) {
  return chars.map((char, index) => ({ char, pinyin: `p${index}`, meaning: `meaning ${index}` }));
}

function setBktStat(ctx, char, { score, served = 0, correct = 0, wrong = 0, streak = 0 } = {}) {
  const stats = ctx.__getSchedulerStatsForTest(char, 'meaning');
  stats.served = served;
  stats.correct = correct;
  stats.wrong = wrong;
  stats.streak = streak;
  stats.bktPLearned = score;
  return stats;
}

function setHeuristicStat(ctx, char, { served = 0, correct = 0, wrong = 0, streak = 0, lastWrong = 0 } = {}) {
  const stats = ctx.__getSchedulerStatsForTest(char, 'meaning');
  stats.served = served;
  stats.correct = correct;
  stats.wrong = wrong;
  stats.streak = streak;
  stats.lastWrong = lastWrong;
  return stats;
}

function sortChars(items) {
  return items.map((item) => item.char).sort();
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

test('selectLeastConfident uses BKT scores to choose the weakest items', () => {
  const vocab = buildVocab(['甲', '乙', '丙']);
  const { ctx } = createHarness(vocab);
  ctx.__setConfidenceFormulaForTest('bkt');
  setBktStat(ctx, '甲', { score: 0.92, served: 5, correct: 5, streak: 5 });
  setBktStat(ctx, '乙', { score: 0.21, served: 3, correct: 1, wrong: 2 });
  setBktStat(ctx, '丙', { score: 0.44, served: 4, correct: 2, wrong: 2 });

  const chosen = ctx.selectLeastConfident(vocab, 2);
  assert.deepStrictEqual(sortChars(chosen), ['丙', '乙'].sort());
});

test('selectLeastConfident uses heuristic scores when heuristic confidence is active', () => {
  const vocab = buildVocab(['甲', '乙', '丙']);
  const { ctx } = createHarness(vocab);
  ctx.__setConfidenceFormulaForTest('heuristic');
  const now = Date.now();
  setHeuristicStat(ctx, '甲', { served: 8, correct: 8, wrong: 0, streak: 8, lastWrong: now - 3600_000 });
  setHeuristicStat(ctx, '乙', { served: 6, correct: 2, wrong: 4, streak: 0, lastWrong: now - 5_000 });
  setHeuristicStat(ctx, '丙', { served: 4, correct: 2, wrong: 2, streak: 1, lastWrong: now - 60_000 });

  const chosen = ctx.selectLeastConfident(vocab, 2);
  assert.deepStrictEqual(sortChars(chosen), ['丙', '乙'].sort());
});

test('later batch cycles load the least-confident next set', () => {
  const vocab = buildVocab(['甲', '乙', '丙', '丁', '戊', '己']);
  const { ctx } = createHarness(vocab);
  ctx.__setConfidenceFormulaForTest('bkt');
  ctx.setSchedulerMode('batch-2');

  setBktStat(ctx, '甲', { score: 0.10, served: 3, correct: 0, wrong: 3 });
  setBktStat(ctx, '乙', { score: 0.20, served: 3, correct: 1, wrong: 2 });
  setBktStat(ctx, '丙', { score: 0.30, served: 3, correct: 1, wrong: 2 });
  setBktStat(ctx, '丁', { score: 0.40, served: 3, correct: 2, wrong: 1 });
  setBktStat(ctx, '戊', { score: 0.80, served: 3, correct: 3, wrong: 0 });
  setBktStat(ctx, '己', { score: 0.95, served: 3, correct: 3, wrong: 0 });

  ctx.__setBatchModeStateForTest({
    activeBatch: [],
    usedChars: vocab.map((item) => item.char),
    batchIndex: 0,
    cycleCount: 0,
    seenInBatch: [],
    lastStartedAt: Date.now()
  });

  ctx.startNewBatch();
  const activeBatch = ctx.__getBatchModeStateForTest().activeBatch.slice().sort();
  assert.deepStrictEqual(activeBatch, ['丁', '丙', '乙', '甲'].sort());
});

test('batch selection only serves questions from the active batch', () => {
  const vocab = buildVocab(['甲', '乙', '丙', '丁']);
  const { ctx } = createHarness(vocab);
  ctx.setSchedulerMode('batch-2');
  ctx.__setBatchModeStateForTest({
    activeBatch: ['乙', '丁'],
    usedChars: ['乙', '丁'],
    batchIndex: 1,
    cycleCount: 0,
    seenInBatch: [],
    lastStartedAt: Date.now()
  });
  ctx.Math.random = () => 0.99;

  for (let i = 0; i < 8; i += 1) {
    const next = ctx.selectNextQuestion();
    assert.ok(next);
    assert.ok(['乙', '丁'].includes(next.char), `picked ${next.char} from active batch`);
  }
});

test('feed-sr selection prioritizes the weakest feed-hand card', () => {
  const vocab = buildVocab(['甲', '乙']);
  const { ctx } = createHarness(vocab);
  ctx.__setConfidenceFormulaForTest('bkt');
  ctx.setSchedulerMode('feed-sr');
  ctx.Math.random = () => 0.99;

  setBktStat(ctx, '甲', { score: 0.18, served: 4, correct: 1, wrong: 3, streak: 0 });
  setBktStat(ctx, '乙', { score: 0.94, served: 3, correct: 3, wrong: 0, streak: 3 });

  ctx.__setFeedModeStateForTest({
    hand: ['甲', '乙'],
    seen: {
      '甲': { attempts: 4, correct: 1, streak: 0, lastSeen: Date.now() - 60_000, halfLifeHours: 0.02, lastResponseMs: null, avgResponseMs: 5000 },
      '乙': { attempts: 3, correct: 3, streak: 3, lastSeen: Date.now() - 60_000, halfLifeHours: 20, lastResponseMs: null, avgResponseMs: 900 },
    },
    totalPulls: 25
  });

  const next = ctx.selectNextQuestion();
  assert.ok(next);
  assert.strictEqual(next.char, '甲');
});

test('feed-eeg selection follows feed priority instead of falling back to random', () => {
  const vocab = buildVocab(['甲', '乙']);
  const { ctx } = createHarness(vocab);
  ctx.__setConfidenceFormulaForTest('bkt');
  ctx.setSchedulerMode('feed-eeg');
  ctx.Math.random = () => 0.99;

  setBktStat(ctx, '甲', { score: 0.18, served: 4, correct: 1, wrong: 3, streak: 0 });
  setBktStat(ctx, '乙', { score: 0.94, served: 3, correct: 3, wrong: 0, streak: 3 });

  ctx.__setFeedModeStateForTest({
    hand: ['甲', '乙'],
    seen: {
      '甲': { attempts: 4, correct: 1, streak: 0, lastSeen: Date.now() - 60_000, halfLifeHours: 0.02, lastResponseMs: null, avgResponseMs: 5000 },
      '乙': { attempts: 3, correct: 3, streak: 3, lastSeen: Date.now() - 60_000, halfLifeHours: 20, lastResponseMs: null, avgResponseMs: 900 },
    },
    totalPulls: 25
  });

  const next = ctx.selectNextQuestion();
  assert.ok(next);
  assert.strictEqual(next.char, '甲');
});

test('feed-eeg display score includes SR confidence weighting just like feed-sr', () => {
  const vocab = buildVocab(['甲']);
  const { ctx } = createHarness(vocab);
  ctx.__setConfidenceFormulaForTest('bkt');

  setBktStat(ctx, '甲', { score: 0.20, served: 4, correct: 1, wrong: 3, streak: 0 });
  ctx.__setFeedModeStateForTest({
    hand: ['甲'],
    seen: {
      '甲': { attempts: 4, correct: 1, streak: 0, lastSeen: Date.now() - 60_000, halfLifeHours: 0.02, lastResponseMs: null, avgResponseMs: 5000 },
    },
    totalPulls: 25
  });

  ctx.setSchedulerMode('feed-sr');
  const srDisplayScore = ctx.getFeedUCBScoreForDisplay('甲');

  ctx.setSchedulerMode('feed-eeg');
  const eegDisplayScore = ctx.getFeedUCBScoreForDisplay('甲');

  assert.ok(Math.abs(srDisplayScore - eegDisplayScore) < 1e-9, `expected equal display scores, got ${srDisplayScore} vs ${eegDisplayScore}`);
});

test('feed-eeg status panel stays active and labels the mode correctly', () => {
  const vocab = buildVocab(['甲', '乙']);
  const { ctx, elements } = createHarness(vocab);
  ctx.__setConfidenceFormulaForTest('bkt');
  ctx.setSchedulerMode('feed-eeg');
  setBktStat(ctx, '甲', { score: 0.20, served: 4, correct: 1, wrong: 3, streak: 0 });
  setBktStat(ctx, '乙', { score: 0.92, served: 4, correct: 4, wrong: 0, streak: 4 });
  ctx.__setFeedModeStateForTest({
    hand: ['甲', '乙'],
    seen: {
      '甲': { attempts: 4, correct: 1, streak: 0, lastSeen: Date.now() - 60_000, halfLifeHours: 0.02, lastResponseMs: null, avgResponseMs: 5000 },
      '乙': { attempts: 4, correct: 4, streak: 4, lastSeen: Date.now() - 60_000, halfLifeHours: 0.5, lastResponseMs: null, avgResponseMs: 900 },
    },
    totalPulls: 25
  });

  ctx.updateFeedStatusDisplay();
  const statusEl = elements.get('feedModeStatus');
  assert.ok(statusEl.innerHTML.includes('Feed+EEG Mode'));
  assert.ok(!String(statusEl.className || '').includes('hidden'));
});

test('recent-correct exclusion avoids recently correct cards when alternatives exist', () => {
  const vocab = buildVocab(['甲', '乙', '丙']);
  const { ctx } = createHarness(vocab);
  ctx.setSchedulerMode('random');
  ctx.__setRecentCorrectForTest(['甲', '乙']);
  ctx.Math.random = () => 0.99;

  const next = ctx.selectNextQuestion();
  assert.ok(next);
  assert.strictEqual(next.char, '丙');
});

test('recent-correct exclusion never eliminates the final available choice', () => {
  const vocab = buildVocab(['甲']);
  const { ctx } = createHarness(vocab);
  ctx.setSchedulerMode('random');
  ctx.__setRecentCorrectForTest(['甲']);

  const next = ctx.selectNextQuestion();
  assert.ok(next);
  assert.strictEqual(next.char, '甲');
});

test('needs-work markings focus selection onto marked words when possible', () => {
  const vocab = buildVocab(['甲', '乙', '丙']);
  const { ctx } = createHarness(vocab);
  ctx.__setWordMarkingsForTest({ '乙': 'needs-work' });
  ctx.Math.random = () => 0.99;

  for (let i = 0; i < 5; i += 1) {
    const next = ctx.selectNextQuestion();
    assert.ok(next);
    assert.strictEqual(next.char, '乙');
  }
});

test('selectNextQuestion respects explicit exclusion lists before applying randomness', () => {
  const vocab = buildVocab(['甲', '乙']);
  const { ctx } = createHarness(vocab);
  ctx.Math.random = () => 0.99;

  const next = ctx.selectNextQuestion(['乙']);
  assert.ok(next);
  assert.strictEqual(next.char, '甲');
});

console.log(`\nTotal: ${passed + failed} tests, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
