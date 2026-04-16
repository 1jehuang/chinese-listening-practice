const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function makeElement(tagName = 'div') {
  const listeners = {};
  let classNameValue = '';
  return {
    tagName: String(tagName).toUpperCase(),
    style: {},
    dataset: {},
    children: [],
    childNodes: [],
    textContent: '',
    innerHTML: '',
    value: '',
    placeholder: '',
    attributes: {},
    listeners,
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
      }
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    removeEventListener(type) {
      delete listeners[type];
    },
    appendChild(child) {
      this.children.push(child);
      this.childNodes.push(child);
      child.parentNode = this;
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
    focus() { this.focused = true; },
    blur() { this.focused = false; },
    click() { if (typeof this.onclick === 'function') this.onclick(); },
  };
}

function createContext() {
  const elements = new Map([
    ['questionDisplay', makeElement('div')],
    ['audioSection', makeElement('div')],
    ['playAudioBtn', makeElement('button')],
    ['answerInput', makeElement('input')],
    ['typeMode', makeElement('div')],
    ['options', makeElement('div')],
    ['fuzzyOptions', makeElement('div')],
    ['fuzzyInput', makeElement('input')],
    ['fuzzyMode', makeElement('div')],
    ['choiceMode', makeElement('div')],
    ['hint', makeElement('div')],
    ['feedback', makeElement('div')],
    ['checkBtn', makeElement('button')],
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
  const answerInput = elements.get('answerInput');
  const typeMode = elements.get('typeMode');
  const hint = elements.get('hint');

  vm.runInContext(`
    mode = 'char-to-tones';
    answered = false;
    lastAnswerCorrect = false;
    currentQuestion = { char: '中国', pinyin: 'Zhōng.guó', meaning: 'China' };
    window.currentQuestion = currentQuestion;
    charToTonesMcUpcomingQuestion = { char: '美国', pinyin: 'Měi.guó', meaning: 'USA' };
    playPinyinAudio = () => {};
    playCorrectSound = () => {};
    playWrongSound = () => {};
    updateStats = () => {};
    markSchedulerOutcome = () => {};
    renderCharacterComponents = () => {};
    renderCharBreakdownSoon = () => {};
    scheduleNextQuestion = () => {};
    questionDisplay = document.getElementById('questionDisplay');
    answerInput = document.getElementById('answerInput');
    checkBtn = document.getElementById('checkBtn');
    feedback = document.getElementById('feedback');
    hint = document.getElementById('hint');
    typeMode = document.getElementById('typeMode');
    choiceMode = document.getElementById('choiceMode');
    audioSection = document.getElementById('audioSection');
    initCharToTonesMc();
    let __checkAnswerCalls = 0;
    checkAnswer = () => { __checkAnswerCalls += 1; };
    initQuizEventListeners();
  `, context);

  assert.strictEqual(typeMode.style.display, 'block', 'char-to-tones should show typing input');
  assert.strictEqual(answerInput.placeholder, 'Type tones (1-5)...', 'char-to-tones input should have tone placeholder');
  assert.strictEqual(answerInput.getAttribute('inputmode'), 'numeric', 'char-to-tones input should request numeric keyboard');
  assert.strictEqual(answerInput.getAttribute('pattern'), '[1-5]*', 'char-to-tones input should constrain to tone digits');
  assert.strictEqual(answerInput.getAttribute('maxlength'), '2', 'char-to-tones input should limit tone count to syllable count');

  const keydown = answerInput.listeners.keydown;
  const input = answerInput.listeners.input;
  assert.ok(typeof keydown === 'function', 'answer input keydown listener should be registered');
  assert.ok(typeof input === 'function', 'answer input input listener should be registered');

  const digitEvent = {
    key: '3',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    prevented: false,
    preventDefault() { this.prevented = true; }
  };
  keydown(digitEvent);
  assert.strictEqual(digitEvent.prevented, false, 'digit key should not be blocked in char-to-tones input');

  answerInput.value = '12x';
  input({});
  assert.strictEqual(answerInput.value, '12', 'char-to-tones input should filter non-tone characters');
  assert.strictEqual(vm.runInContext('enteredTones', context), '12', 'entered tones should track filtered numeric input');
  assert.strictEqual(hint.textContent, '12 (2/2)', 'typing tones should update progress hint');
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.strictEqual(vm.runInContext('__checkAnswerCalls', context), 1, 'typing full tone count should auto-submit once');

  vm.runInContext(`
    charToTonesMcIndex = 0;
    charToTonesMcExpected = ['1', '2'];
    charToTonesMcChars = ['中', '国'];
    charToTonesMcPinyin = ['Zhōng', 'guó'];
    charToTonesMcCompleted = [];
    answered = false;
    lastAnswerCorrect = false;
  `, context);
  answerInput.value = '';
  vm.runInContext('handleToneChoice("1");', context);
  assert.strictEqual(answerInput.value, '1', 'tone button / hotkey entry should sync into the typing input');

  const enterEvent = {
    key: 'Enter',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    prevented: false,
    preventDefault() { this.prevented = true; }
  };
  keydown(enterEvent);
  assert.strictEqual(enterEvent.prevented, true, 'Enter should still be handled explicitly in char-to-tones input');

  console.log('✓ Char-to-tones numeric typing test passed');
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
