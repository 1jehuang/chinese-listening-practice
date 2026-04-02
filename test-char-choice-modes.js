const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function makeElement(tagName = 'div') {
  const el = {
    tagName: String(tagName).toUpperCase(),
    style: {},
    dataset: {},
    children: [],
    childNodes: [],
    textContent: '',
    _innerHTML: '',
    classList: { add() {}, remove() {}, contains() { return false; } },
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
    remove() {},
    focus() {},
    blur() {},
    click() { if (typeof this.onclick === 'function') this.onclick(); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._innerHTML; },
    set(value) {
      this._innerHTML = value;
      if (value === '') {
        this.children = [];
        this.childNodes = [];
      }
    }
  });
  return el;
}

function createContext() {
  const storage = {};
  const optionsEl = makeElement('div');
  const elements = new Map([['options', optionsEl]]);
  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tagName) { return makeElement(tagName); },
    body: makeElement('body'),
    head: makeElement('head'),
    documentElement: { style: {} },
    addEventListener() {},
    dispatchEvent() {},
  };

  const ctx = vm.createContext({
    window: {
      location: { pathname: '/test-page.html' },
      innerWidth: 1200,
      __QUIZ_DEBUG__: {},
      addEventListener() {},
      matchMedia: () => ({ matches: false, addEventListener() {} })
    },
    document,
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
    encodeURIComponent,
    decodeURIComponent,
    URL,
    URLSearchParams,
  });

  ctx.window.document = document;
  ctx.window.window = ctx.window;
  vm.runInContext('var chatPanelVisible = false; var chatPanel = null;', ctx);

  for (const file of ['./js/utils.js', './js/pinyin-utils.js', './js/quiz-engine.js']) {
    const source = fs.readFileSync(file, 'utf8');
    vm.runInContext(source, ctx, { filename: file });
  }

  vm.runInContext(`
    function __setQuizCharacters(chars) { quizCharacters = chars; }
    function __setCurrentQuestion(q) { currentQuestion = q; window.currentQuestion = q; }
    function __setMode(m) { mode = m; }
    function __getOptionData() {
      const options = document.getElementById('options');
      return (options?.children || []).map(btn => ({
        char: btn.dataset.char || btn.textContent,
        pinyin: btn.dataset.pinyin || '',
        meaning: btn.dataset.meaning || '',
        textContent: btn.textContent || '',
        innerHTML: btn.innerHTML || ''
      }));
    }
  `, ctx);

  return { ctx, optionsEl };
}

function withRandomSequence(ctx, values, fn) {
  const original = ctx.Math.random;
  let index = 0;
  ctx.Math.random = () => {
    const value = values[index];
    index += 1;
    return value ?? 0.99;
  };
  try {
    fn();
  } finally {
    ctx.Math.random = original;
  }
}

const vocab = [
  { char: '中', pinyin: 'zhōng', meaning: 'middle' },
  { char: '忠', pinyin: 'zhōng', meaning: 'loyal' },
  { char: '国', pinyin: 'guó', meaning: 'country' },
  { char: '人', pinyin: 'rén', meaning: 'person' },
  { char: '大', pinyin: 'dà', meaning: 'big' },
  { char: '宏', pinyin: 'hóng', meaning: 'big' },
  { char: '学', pinyin: 'xué', meaning: 'study' },
];

(function testPinyinToCharFiltersDuplicatePinyinAndShowsMeaning() {
  const { ctx } = createContext();
  ctx.__setQuizCharacters(vocab);
  ctx.__setMode('pinyin-to-char');
  ctx.__setCurrentQuestion(vocab[0]);

  withRandomSequence(ctx, [0.20, 0.35, 0.50, 0.80, 0.95], () => {
    ctx.generateCharOptions();
  });

  const options = ctx.__getOptionData();
  assert.strictEqual(options.length, 4, 'pinyin-to-char should render four choices');
  assert.ok(options.some(option => option.char === '中'), 'correct character should be present');
  assert.ok(!options.some(option => option.char === '忠'), 'same-pinyin distractor should be excluded');
  const correctOption = options.find(option => option.char === '中');
  assert.ok(correctOption.innerHTML.includes('middle'), 'pinyin-to-char options should show meaning metadata');
  console.log('✓ pinyin-to-char excludes same-pinyin distractors and shows meaning');
})();

(function testMeaningToCharFiltersDuplicateMeaningAndShowsPinyin() {
  const { ctx } = createContext();
  ctx.__setQuizCharacters(vocab);
  ctx.__setMode('meaning-to-char');
  ctx.__setCurrentQuestion(vocab[4]);

  withRandomSequence(ctx, [0.75, 0.00, 0.15, 0.30, 0.95], () => {
    ctx.generateCharOptions();
  });

  const options = ctx.__getOptionData();
  assert.strictEqual(options.length, 4, 'meaning-to-char should render four choices');
  assert.ok(options.some(option => option.char === '大'), 'correct character should be present');
  assert.ok(!options.some(option => option.char === '宏'), 'same-meaning distractor should be excluded');
  const correctOption = options.find(option => option.char === '大');
  assert.ok(correctOption.innerHTML.includes('dà'), 'meaning-to-char options should show pinyin metadata');
  console.log('✓ meaning-to-char excludes same-meaning distractors and shows pinyin');
})();


(function testBlendDirectionsUseAudioMeaningButNotAudioPinyin() {
  const { ctx } = createContext();

  const blendDirections = Array.from(ctx.getBlendDirectionsForMode('blend'));
  assert.deepStrictEqual(
    blendDirections,
    ['char-to-meaning', 'char-to-pinyin', 'audio-to-meaning'],
    'blend should include audio-to-meaning but never audio-to-pinyin'
  );

  const blendMcDirections = Array.from(ctx.getBlendDirectionsForMode('blend-mc'));
  assert.deepStrictEqual(
    blendMcDirections,
    ['char-to-meaning', 'char-to-pinyin'],
    'blend-mc should remain the no-audio blend mode'
  );

  console.log('✓ blend directions exclude audio-to-pinyin and preserve no-audio blend mode');
})();
