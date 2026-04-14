const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function makeElement(tagName = 'div', id = '') {
  let classNameValue = '';
  const classSet = new Set();
  const element = {
    id,
    tagName: String(tagName).toUpperCase(),
    style: {},
    dataset: {},
    children: [],
    childNodes: [],
    parentNode: null,
    parentElement: null,
    textContent: '',
    value: '',
    disabled: false,
    _innerHTML: '',
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
    remove() {
      if (!this.parentNode) return;
      const siblings = this.parentNode.children || [];
      const childNodes = this.parentNode.childNodes || [];
      const siblingIndex = siblings.indexOf(this);
      const nodeIndex = childNodes.indexOf(this);
      if (siblingIndex >= 0) siblings.splice(siblingIndex, 1);
      if (nodeIndex >= 0) childNodes.splice(nodeIndex, 1);
      this.parentNode = null;
      this.parentElement = null;
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute(name, value) { this[name] = value; },
    getAttribute(name) { return this[name] ?? null; },
    removeAttribute(name) { delete this[name]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
    blur() {},
    click() {
      if (typeof this.onclick === 'function') {
        this.onclick({ preventDefault() {} });
      }
    },
    closest() { return null; },
    classList: {
      add(...names) {
        names.filter(Boolean).forEach((name) => classSet.add(name));
        classNameValue = Array.from(classSet).join(' ');
      },
      remove(...names) {
        names.filter(Boolean).forEach((name) => classSet.delete(name));
        classNameValue = Array.from(classSet).join(' ');
      },
      contains(name) {
        return classSet.has(name);
      },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classSet.has(name) : Boolean(force);
        if (shouldAdd) classSet.add(name);
        else classSet.delete(name);
        classNameValue = Array.from(classSet).join(' ');
        return shouldAdd;
      }
    }
  };

  Object.defineProperty(element, 'className', {
    get() {
      return classNameValue;
    },
    set(value) {
      classSet.clear();
      String(value || '').split(/\s+/).filter(Boolean).forEach((name) => classSet.add(name));
      classNameValue = Array.from(classSet).join(' ');
    }
  });

  Object.defineProperty(element, 'innerHTML', {
    get() {
      return this._innerHTML;
    },
    set(value) {
      this._innerHTML = String(value || '');
      if (value === '') {
        this.children = [];
        this.childNodes = [];
      }
    }
  });

  return element;
}

function createContext() {
  const elements = new Map();
  const register = (id, tag = 'div') => {
    const el = makeElement(tag, id);
    elements.set(id, el);
    return el;
  };

  register('ocrResult');
  register('feedback');
  register('hint');
  register('score');
  register('total');
  register('percentage');
  register('accuracy');

  const document = {
    readyState: 'loading',
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tagName) { return makeElement(tagName); },
    body: makeElement('body', 'body'),
    head: makeElement('head', 'head'),
    documentElement: { style: {} },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {}
  };

  const context = vm.createContext({
    console,
    document,
    window: null,
    globalThis: null,
    location: {
      pathname: '/lesson-1-quiz.html',
      href: 'http://localhost/lesson-1-quiz.html',
      hash: '',
      search: ''
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    speechSynthesis: {
      speak() {},
      cancel() {},
      getVoices() { return []; },
      addEventListener() {},
      removeEventListener() {}
    },
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
    alert() {}
  });

  context.window = context;
  context.globalThis = context;
  context.window.document = document;
  context.window.window = context.window;
  context.window.location = context.location;
  context.window.matchMedia = () => ({ matches: false, addEventListener() {} });
  context.window.addEventListener = () => {};
  context.window.__QUIZ_DEBUG__ = {};

  vm.runInContext('var chatPanelVisible = false; var chatPanel = null;', context);

  for (const relativePath of ['./js/utils.js', './js/pinyin-utils.js', './js/quiz-engine.js']) {
    const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
  }

  vm.runInContext(`
    function __prepareTrackpadDrawTest(question) {
      feedback = document.getElementById('feedback');
      hint = document.getElementById('hint');
      currentQuestion = question;
      window.currentQuestion = question;
      mode = 'trackpad-draw';
      answered = false;
      lastAnswerCorrect = false;
      score = 0;
      total = 0;
      questionAttemptRecorded = false;
      confidenceTrackingEnabled = false;
      drawMeaningChoices = [];
      drawSelectedMeaning = null;
      strokes = [{ x: [12, 30], y: [18, 36], t: [0, 12] }];
      currentStroke = null;
      canvas = { width: 400, height: 400 };
      playSubmitSound = function () {};
      playCorrectSound = function () {};
      playWrongSound = function () {};
      showDrawNextButton = function () {};
      hideDrawNextButton = function () {};
      renderPerCharMeaning = function () {};
      notifyChatQuestionChanged = function () {};
      updateCurrentWordConfidence = function () {};
      markSchedulerServed = function () {};
    }
    function __setDrawQuestionPoolState(chars, datasets) {
      quizCharacters = Array.isArray(chars) ? chars : [];
      window.__LESSON_DATASETS__ = datasets || {};
      buildLessonCharMap();
      currentQuestion = null;
      window.currentQuestion = null;
      mode = 'trackpad-draw';
      schedulerMode = 'random';
      recentCorrectChars = [];
    }
    function __getDrawQuestionPoolChars() {
      return getDrawQuestionPool().map(item => item.char);
    }
    function __selectTrackpadQuestion() {
      const next = selectNextQuestion();
      return next ? { char: next.char, pinyin: next.pinyin, meaning: next.meaning } : null;
    }
    function __getTrackpadDrawTestState() {
      return {
        score,
        total,
        answered,
        lastAnswerCorrect,
        feedback: document.getElementById('feedback')?.textContent || '',
        ocrResult: document.getElementById('ocrResult')?.textContent || ''
      };
    }
  `, context);

  return context;
}

async function main() {
  const ctx = createContext();
  const expected = { char: '学', pinyin: 'xué', meaning: 'study' };
  ctx.__prepareTrackpadDrawTest(expected);
  let fetchCalls = 0;
  ctx.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      async json() {
        return ['SUCCESS', [['handwriting', ['学', '字']]]];
      }
    };
  };

  await ctx.submitDrawing();

  const state = ctx.__getTrackpadDrawTestState();
  assert.strictEqual(fetchCalls, 1, 'submit should flush OCR when ink exists but OCR text is still empty');
  assert.strictEqual(state.ocrResult, '学', 'submit should populate OCR result before grading');
  assert.strictEqual(state.score, 1, 'correct OCR result should count as a correct answer');
  assert.strictEqual(state.total, 1, 'submit should record the attempt once');
  assert.strictEqual(state.answered, true, 'submit should mark the question answered');
  assert.strictEqual(state.lastAnswerCorrect, true, 'correct submission should mark lastAnswerCorrect');
  assert.match(state.feedback, /Correct! 学 \(xué\)/, 'feedback should show the recognized correct answer');

  console.log('✓ trackpad draw submit flushes pending OCR before grading');

  const combinedWords = [
    { char: '重视', pinyin: 'zhòngshì', meaning: 'to emphasize' },
    { char: '教育', pinyin: 'jiàoyù', meaning: 'education' }
  ];
  const datasets = {
    dushu: {
      charMap: [
        { char: '重', pinyin: 'zhòng', meaning: 'heavy; important' },
        { char: '视', pinyin: 'shì', meaning: 'to regard' },
        { char: '教', pinyin: 'jiào', meaning: 'to teach' },
        { char: '育', pinyin: 'yù', meaning: 'to educate' }
      ]
    }
  };

  ctx.__setDrawQuestionPoolState(combinedWords, datasets);
  const drawPoolChars = Array.from(ctx.__getDrawQuestionPoolChars());
  assert.deepStrictEqual(drawPoolChars, ['重', '视', '教', '育'], 'trackpad draw should expand combined vocab into per-character prompts');

  const selected = ctx.__selectTrackpadQuestion();
  assert.ok(selected, 'trackpad draw should still be able to select a question from combined vocab');
  assert.strictEqual(selected.char.length, 1, 'trackpad draw should select a single-character prompt on combined vocab pages');

  console.log('✓ trackpad draw uses per-character prompts for combined vocab pages');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
