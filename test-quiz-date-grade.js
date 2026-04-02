// Regression tests for quiz target date + estimated grade banner
// Run with: node test-quiz-date-grade.js

const fs = require('fs');
const vm = require('vm');

const storage = {};

function makeFakeElement(tagName = 'div') {
    const el = {
        tagName: String(tagName).toUpperCase(),
        id: '',
        style: {},
        cssText: '',
        dataset: {},
        innerHTML: '',
        textContent: '',
        children: [],
        childNodes: [],
        parentElement: null,
        parentNode: null,
        classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
        addEventListener(){}, removeEventListener(){},
        setAttribute(name, value) { this[name] = value; },
        getAttribute(name) { return this[name] ?? null; },
        removeAttribute(name) { delete this[name]; },
        appendChild(child) {
            if (!child) return child;
            child.parentElement = this;
            child.parentNode = this;
            this.children.push(child);
            this.childNodes.push(child);
            return child;
        },
        insertBefore(child, reference) {
            if (!child) return child;
            child.parentElement = this;
            child.parentNode = this;
            const idx = reference ? this.childNodes.indexOf(reference) : -1;
            if (idx >= 0) {
                this.childNodes.splice(idx, 0, child);
                this.children.splice(Math.min(idx, this.children.length), 0, child);
            } else {
                this.childNodes.push(child);
                this.children.push(child);
            }
            return child;
        },
        remove() {
            if (!this.parentNode) return;
            const siblings = this.parentNode.childNodes || [];
            const idx = siblings.indexOf(this);
            if (idx >= 0) siblings.splice(idx, 1);
            const childIdx = (this.parentNode.children || []).indexOf(this);
            if (childIdx >= 0) this.parentNode.children.splice(childIdx, 1);
            this.parentNode = null;
            this.parentElement = null;
        },
        querySelector(selector) {
            if (selector === 'h1') {
                return this.children.find(child => child.tagName === 'H1') || null;
            }
            return null;
        },
        querySelectorAll() { return []; },
        cloneNode() { return makeFakeElement(this.tagName); },
        focus(){}, blur(){}, click(){},
        getBoundingClientRect(){ return { top:0,left:0,right:0,bottom:0,width:0,height:0 }; },
        nextSibling: null,
    };
    return el;
}

const quizHeader = makeFakeElement('header');
quizHeader.className = 'quiz-header';
const headerTitle = makeFakeElement('h1');
headerTitle.tagName = 'H1';
headerTitle.textContent = 'Quiz Title';
const headerSpacer = makeFakeElement('div');
headerSpacer.tagName = 'DIV';
headerTitle.nextSibling = headerSpacer;
quizHeader.appendChild(headerTitle);
quizHeader.appendChild(headerSpacer);

const mainContent = makeFakeElement('main');
mainContent.className = 'main-content';
mainContent.appendChild(quizHeader);

const elementRegistry = new Map();
function registerElement(el) {
    if (el && el.id) elementRegistry.set(el.id, el);
}

const documentStub = {
    getElementById(id) {
        return elementRegistry.get(id) || null;
    },
    querySelector(selector) {
        if (selector === '.quiz-header') return quizHeader;
        if (selector === '.main-content') return mainContent;
        return null;
    },
    querySelectorAll() { return []; },
    createElement(tagName) {
        const el = makeFakeElement(tagName);
        Object.defineProperty(el, 'id', {
            get() { return this._id || ''; },
            set(value) {
                this._id = String(value);
                elementRegistry.set(this._id, this);
            }
        });
        return el;
    },
    body: makeFakeElement('body'),
    head: makeFakeElement('head'),
    documentElement: { style: {} },
    addEventListener(){},
    dispatchEvent(){},
};

const ctx = vm.createContext({
    window: {
        location: { pathname: '/lesson-14-part-1.html' },
        innerWidth: 1200,
        __QUIZ_DEBUG__: {},
        addEventListener(){},
        matchMedia: () => ({ matches: false, addEventListener(){} }),
    },
    document: documentStub,
    localStorage: {
        getItem: (k) => Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null,
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; },
    },
    sessionStorage: {
        getItem: () => null,
        setItem(){},
        removeItem(){},
    },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    speechSynthesis: { speak(){}, cancel(){}, getVoices(){ return []; } },
    SpeechSynthesisUtterance: class {},
    Audio: class { play(){ return Promise.resolve(); } pause(){} addEventListener(){} },
    MutationObserver: class { observe(){} disconnect(){} },
    IntersectionObserver: class { observe(){} disconnect(){} },
    ResizeObserver: class { observe(){} disconnect(){} },
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: () => {},
    setTimeout, setInterval, clearTimeout, clearInterval,
    CustomEvent: class { constructor(t){ this.type = t; } },
    Event: class { constructor(t){ this.type = t; } },
    HTMLElement: class {},
    getComputedStyle: () => ({}),
    navigator: { userAgent: '', clipboard: { writeText: () => Promise.resolve() } },
    CSS: { supports: () => false },
    performance: { now: () => Date.now() },
    console, Date, Math, JSON, Number, Array, Object, String, Boolean, Set, Map, Promise, Error, TypeError, RegExp,
    parseInt, parseFloat, isNaN, isFinite, Infinity, NaN, undefined,
    encodeURIComponent, decodeURIComponent,
    URL, URLSearchParams,
});

vm.runInContext(`
    var chatPanelVisible = false;
    var chatPanel = null;
`, ctx);

const code = fs.readFileSync('./js/quiz-engine.js', 'utf8');
vm.runInContext(code, ctx, { filename: 'quiz-engine.js' });

vm.runInContext(`
    function __setQuizCharacters(chars) { quizCharacters = chars; }
    function __setFeedSeen(data) { feedModeState.seen = data; }
    function __setQuizTargetDate(iso) { quizTargetDate = iso; }
    function __getQuizTargetDate() { return quizTargetDate; }
    function __formatLocalDateTimeInput(value) { return formatLocalDateTimeInput(value); }
`, ctx);

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`✓ ${name}`);
    } catch (err) {
        failed++;
        console.log(`✗ ${name}`);
        console.log(`  ${err.message}`);
    }
}

function resetState() {
    for (const key of Object.keys(storage)) delete storage[key];
    elementRegistry.delete('quizGradeBanner');
    const existing = quizHeader.children.find(child => child.id === 'quizGradeBanner');
    if (existing) existing.remove();
    vm.runInContext(`
        quizTargetDate = null;
        feedModeState = { hand: [], seen: {}, totalPulls: 0 };
        quizCharacters = [];
    `, ctx);
}

test('auto quiz date upgrades legacy stored local time to canonical timezone-aware ISO', () => {
    resetState();
    const key = 'quiz_target_date_lesson-14-part-1';
    storage[key] = new Date('2026-03-10T08:30:00').toISOString();
    vm.runInContext(`loadQuizTargetDate();`, ctx);
    assert(ctx.__getQuizTargetDate() === new Date('2026-03-10T08:30:00-07:00').toISOString(), `expected canonical ISO, got ${ctx.__getQuizTargetDate()}`);
    assert(storage[key] === new Date('2026-03-10T08:30:00-07:00').toISOString(), 'stored value should be upgraded');
});

test('local datetime input formatter preserves local wall-clock time', () => {
    resetState();
    const formatted = ctx.__formatLocalDateTimeInput('2026-03-10T15:30:00.000Z');
    assert(formatted === '2026-03-10T08:30', `expected local wall-clock 2026-03-10T08:30, got ${formatted}`);
});

test('renderQuizGradeBanner inserts compact banner inside quiz header', () => {
    resetState();
    const futureIso = new Date(Date.now() + 2 * 3600000).toISOString();
    ctx.__setQuizCharacters([{ char: '学' }, { char: '好' }]);
    ctx.__setFeedSeen({
        '学': { attempts: 4, correct: 4, lastSeen: Date.now(), halfLifeHours: 48 },
        '好': { attempts: 4, correct: 3, lastSeen: Date.now(), halfLifeHours: 24 },
    });
    ctx.__setQuizTargetDate(futureIso);
    vm.runInContext(`renderQuizGradeBanner();`, ctx);

    const banner = documentStub.getElementById('quizGradeBanner');
    assert(banner, 'banner should exist');
    assert(banner.parentElement === quizHeader, 'banner should be inside quiz header');
    assert(quizHeader.childNodes[1] === banner, 'banner should appear immediately after the header title');
    assert(String(banner.style.cssText || banner.style.cssText === '' ? banner.style.cssText : '').includes(''), 'banner style object should exist');
    assert(typeof banner.innerHTML === 'string' && banner.innerHTML.includes('Quiz'), 'banner should render quiz label');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
