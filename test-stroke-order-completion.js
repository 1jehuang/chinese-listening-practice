const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function makeElement(tagName = 'div') {
  let classNameValue = '';
  return {
    tagName: String(tagName).toUpperCase(),
    style: {},
    dataset: {},
    attributes: {},
    children: [],
    childNodes: [],
    textContent: '',
    innerHTML: '',
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
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      this[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    click() { if (typeof this.onclick === 'function') this.onclick(); },
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
    ['questionDisplay', makeElement('div')],
    ['strokeOrderMode', makeElement('div')],
    ['strokeOrderWriter', makeElement('div')],
    ['feedback', makeElement('div')],
    ['hint', makeElement('div')],
    ['score', makeElement('span')],
    ['total', makeElement('span')],
    ['accuracy', makeElement('span')],
    ['percentage', makeElement('span')],
  ]);

  const document = {
    readyState: 'complete',
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

  document.body.appendChild(elements.get('questionDisplay'));
  document.body.appendChild(elements.get('strokeOrderMode'));
  elements.get('strokeOrderMode').appendChild(elements.get('strokeOrderWriter'));
  document.body.appendChild(elements.get('feedback'));
  document.body.appendChild(elements.get('hint'));

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

  return { context, elements };
}

async function run() {
  const { context, elements } = createContext();

  vm.runInContext(`
    mode = 'stroke-order';
    currentQuestion = { char: '年', pinyin: 'nián', meaning: 'year' };
    window.currentQuestion = currentQuestion;
    questionDisplay = document.getElementById('questionDisplay');
    feedback = document.getElementById('feedback');
    hint = document.getElementById('hint');
    strokeOrderMode = document.getElementById('strokeOrderMode');
    score = 0;
    total = 0;
    answered = false;
    lastAnswerCorrect = false;
    __markSchedulerOutcomeCalls = [];
    __scheduledDelay = null;
    __updateStatsCalls = 0;
    playCorrectSound = () => {};
    markSchedulerOutcome = (value) => { __markSchedulerOutcomeCalls.push(value); };
    scheduleNextQuestion = (delay) => { __scheduledDelay = delay; };
    updateStats = () => { __updateStatsCalls += 1; };
    HanziWriter = {
      create(target, char) {
        return {
          cancelQuiz() {},
          quiz(options) {
            __capturedQuizOptions = options;
            __capturedQuizChar = char;
            return Promise.resolve();
          }
        };
      }
    };
  `, context);

  await vm.runInContext('initStrokeOrder()', context);

  assert.strictEqual(vm.runInContext('__capturedQuizChar', context), '年', 'stroke-order quiz should initialize HanziWriter with the current character');
  assert.ok(vm.runInContext('__capturedQuizOptions && typeof __capturedQuizOptions.onComplete === "function"', context), 'stroke-order quiz should register an onComplete callback');

  vm.runInContext('__capturedQuizOptions.onComplete();', context);

  assert.strictEqual(vm.runInContext('answered', context), true, 'stroke-order completion should mark the question answered');
  assert.strictEqual(vm.runInContext('lastAnswerCorrect', context), true, 'stroke-order completion should mark the answer correct');
  assert.strictEqual(vm.runInContext('score', context), 1, 'stroke-order completion should increment score');
  assert.strictEqual(vm.runInContext('total', context), 1, 'stroke-order completion should increment total');
  assert.strictEqual(vm.runInContext('__markSchedulerOutcomeCalls.length', context), 1, 'stroke-order completion should record one scheduler outcome');
  assert.strictEqual(vm.runInContext('__markSchedulerOutcomeCalls[0]', context), true, 'stroke-order completion should mark the scheduler outcome as correct');
  assert.strictEqual(vm.runInContext('__updateStatsCalls', context), 1, 'stroke-order completion should refresh visible stats');
  assert.strictEqual(vm.runInContext('__scheduledDelay', context), 1500, 'stroke-order completion should schedule the next question');
  assert.match(elements.get('feedback').textContent, /Great job! 年/, 'stroke-order completion should show success feedback');
  assert.strictEqual(elements.get('hint').textContent, 'Meaning: year', 'stroke-order completion should show the meaning hint');

  console.log('✓ Stroke-order completion counts as correct');
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
