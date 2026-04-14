const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function makeContext() {
  const document = {
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { style: {}, className: '', appendChild() {}, remove() {} }; },
    body: { appendChild() {}, children: [] },
    head: { appendChild() {} },
    documentElement: { style: {} },
    addEventListener() {},
    removeEventListener() {},
  };

  const ctx = vm.createContext({
    console,
    document,
    window: null,
    globalThis: null,
    location: { pathname: '/dushu-vocab.html', href: 'http://localhost/dushu-vocab.html', search: '', hash: '' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    speechSynthesis: { speak() {}, cancel() {}, getVoices() { return []; }, addEventListener() {}, removeEventListener() {} },
    SpeechSynthesisUtterance: class {},
    Audio: class { play() { return Promise.resolve(); } pause() {} addEventListener() {} removeEventListener() {} },
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

  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.window.document = document;
  ctx.window.window = ctx.window;
  ctx.window.location = ctx.location;
  ctx.window.matchMedia = () => ({ matches: false, addEventListener() {} });
  ctx.window.addEventListener = () => {};
  ctx.window.__QUIZ_DEBUG__ = {};

  vm.runInContext('var chatPanelVisible = false; var chatPanel = null;', ctx);

  for (const relativePath of ['./js/utils.js', './js/pinyin-utils.js', './js/quiz-engine.js']) {
    const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
    vm.runInContext(source, ctx, { filename: relativePath });
  }

  vm.runInContext(`
    function __setConfidencePanelTestState(items) {
      originalQuizCharacters = items;
      quizCharacters = items;
      mode = 'char-to-meaning-type';
      confidenceFormula = CONFIDENCE_FORMULAS.BKT;
      schedulerStats = {};
      items.forEach((item, index) => {
        const stats = getSchedulerStats(item.char);
        stats.served = 3;
        stats.correct = 2;
        stats.streak = 1;
        stats.bktPLearned = index / Math.max(1, items.length - 1);
      });
    }
    function __buildConfidencePanelViewModel() { return buildConfidencePanelViewModel(); }
  `, ctx);

  return ctx;
}

(function main() {
  const ctx = makeContext();
  const items = Array.from({ length: 60 }, (_, index) => ({
    char: `词${index + 1}`,
    pinyin: `ci${index + 1}`,
    meaning: `meaning ${index + 1}`
  }));

  ctx.__setConfidencePanelTestState(items);
  const viewModel = ctx.__buildConfidencePanelViewModel();

  assert.strictEqual(viewModel.pinnedLowest, null, 'full-list confidence view should not pin a separate lowest row');
  assert.strictEqual(viewModel.pinnedHighest, null, 'full-list confidence view should not pin a separate highest row');
  assert.strictEqual(viewModel.sections.length, 1, 'confidence panel should render as a single full section');
  assert.strictEqual(viewModel.sections[0].rows.length, 60, 'confidence panel should include all lesson words');
  assert.match(viewModel.summary, /60 words/i, 'summary should report the full lesson size');

  console.log('✓ confidence panel view model includes the full lesson list');
})();
