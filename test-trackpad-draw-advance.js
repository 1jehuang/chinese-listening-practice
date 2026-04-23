const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function makeElement(tagName = 'div') {
  let classNameValue = '';
  return {
    tagName: String(tagName).toUpperCase(),
    style: {},
    dataset: {},
    textContent: '',
    innerHTML: '',
    children: [],
    childNodes: [],
    parentNode: null,
    parentElement: null,
    appendChild(child) {
      if (!child) return child;
      child.parentNode = this;
      child.parentElement = this;
      this.children.push(child);
      this.childNodes.push(child);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute(name, value) { this[name] = value; },
    getAttribute(name) { return this[name] ?? null; },
    blur() { this.blurred = true; },
    classList: {
      add(...names) {
        const set = new Set(String(classNameValue || '').split(/\s+/).filter(Boolean));
        names.filter(Boolean).forEach((name) => set.add(name));
        classNameValue = Array.from(set).join(' ');
      },
      remove(...names) {
        const set = new Set(String(classNameValue || '').split(/\s+/).filter(Boolean));
        names.filter(Boolean).forEach((name) => set.delete(name));
        classNameValue = Array.from(set).join(' ');
      },
      contains(name) {
        return String(classNameValue || '').split(/\s+/).includes(name);
      },
      toggle(name, force) {
        const set = new Set(String(classNameValue || '').split(/\s+/).filter(Boolean));
        const shouldAdd = force === undefined ? !set.has(name) : Boolean(force);
        if (shouldAdd) set.add(name); else set.delete(name);
        classNameValue = Array.from(set).join(' ');
        return shouldAdd;
      }
    }
  };
}

function createContext() {
  const elements = new Map([
    ['drawNextBtn', makeElement('button')]
  ]);

  const document = {
    readyState: 'complete',
    activeElement: makeElement('button'),
    getElementById(id) { return elements.get(id) || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tagName) { return makeElement(tagName); },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    body: makeElement('body'),
    head: makeElement('head'),
    documentElement: { style: {} },
  };

  const context = {
    console,
    window: null,
    document,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: { userAgent: '', clipboard: { writeText: () => Promise.resolve() } },
    location: { pathname: '/lesson-1-quiz.html', href: 'http://localhost/lesson-1-quiz.html', search: '', hash: '' },
    history: { replaceState() {} },
    fetch: () => Promise.resolve({ ok: false, json: async () => ({}) }),
    speechSynthesis: { speak() {}, cancel() {}, getVoices() { return []; }, addEventListener() {}, removeEventListener() {} },
    SpeechSynthesisUtterance: class {},
    Audio: class { play() { return Promise.resolve(); } pause() {} addEventListener() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    CustomEvent: class { constructor(type) { this.type = type; } },
    Event: class { constructor(type) { this.type = type; } },
    HTMLElement: class {},
    getComputedStyle: () => ({}),
    CSS: { supports: () => false },
    performance: { now: () => Date.now() },
    Date,
    Math,
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
    URL,
    URLSearchParams,
  };

  context.window = context;
  context.globalThis = context;
  vm.createContext(context);

  for (const file of ['./js/utils.js', './js/pinyin-utils.js', './js/quiz-engine.js']) {
    const source = fs.readFileSync(file, 'utf8');
    vm.runInContext(source, context, { filename: file });
  }

  return { context, elements, document };
}

function run() {
  const { context, elements, document } = createContext();

  vm.runInContext(`
    __clearCanvasCalls = 0;
    __generateQuestionCalls = 0;
    __nextFullscreenQuestionCalls = 0;
    clearCanvas = () => { __clearCanvasCalls += 1; };
    generateQuestion = () => { __generateQuestionCalls += 1; };
    nextFullscreenQuestion = () => { __nextFullscreenQuestionCalls += 1; };
    hideDrawNextButton = () => { document.getElementById('drawNextBtn').classList.add('hidden'); };
    drawAdvanceLockUntil = 0;
  `, context);

  document.activeElement = elements.get('drawNextBtn');
  vm.runInContext('advanceDrawQuestionOnce(false);', context);
  vm.runInContext('advanceDrawQuestionOnce(false);', context);

  assert.strictEqual(vm.runInContext('__clearCanvasCalls', context), 1, 'inline draw advance should clear once even if triggered twice rapidly');
  assert.strictEqual(vm.runInContext('__generateQuestionCalls', context), 1, 'inline draw advance should generate one next question even if triggered twice rapidly');
  assert.strictEqual(elements.get('drawNextBtn').classList.contains('hidden'), true, 'inline draw advance should hide the next button');
  assert.strictEqual(document.activeElement.blurred, true, 'inline draw advance should blur the active control to prevent duplicate space activation');

  vm.runInContext('drawAdvanceLockUntil = 0;', context);
  vm.runInContext('advanceDrawQuestionOnce(true);', context);
  vm.runInContext('advanceDrawQuestionOnce(true);', context);

  assert.strictEqual(vm.runInContext('__nextFullscreenQuestionCalls', context), 1, 'fullscreen draw advance should only trigger once per space press');

  console.log('✓ trackpad draw advance guard prevents double next-question jumps');
}

try {
  run();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
