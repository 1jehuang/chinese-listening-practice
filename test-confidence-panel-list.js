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
    renderConfidenceList = () => {};
    showMarkingToast = () => {};
    refreshMarkingIndicator = () => {};

    function __setConfidencePanelTestState(items) {
      originalQuizCharacters = items;
      quizCharacters = items;
      mode = 'char-to-meaning-type';
      confidenceFormula = CONFIDENCE_FORMULAS.BKT;
      schedulerStats = {};
      currentQuestion = items[0] || null;
      window.currentQuestion = currentQuestion;
      wordMarkings = {};
      items.forEach((item, index) => {
        const stats = getSchedulerStats(item.char);
        stats.served = 3;
        stats.correct = 2;
        stats.streak = 1;
        stats.bktPLearned = index / Math.max(1, items.length - 1);
      });
    }
    function __buildConfidencePanelViewModel() { return buildConfidencePanelViewModel(); }
    function __getConfidenceNavigationOrder() { return getConfidenceNavigationOrder(); }
    function __setCurrentQuestionChar(char) {
      currentQuestion = quizCharacters.find(item => item.char === char) || null;
      window.currentQuestion = currentQuestion;
    }
    function __toggleConfidencePracticeMark(char) { return toggleConfidencePracticeMark(char); }
    function __getWordMarking(char) { return getWordMarking(char); }
    function __moveConfidenceSelection(direction) {
      confidencePanelVisible = true;
      const originalSelect = selectConfidencePanelWord;
      let selectedChar = null;
      selectConfidencePanelWord = (char) => {
        selectedChar = char;
        return true;
      };
      const moved = moveConfidencePanelSelection(direction);
      selectConfidencePanelWord = originalSelect;
      return { moved, selectedChar };
    }
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
  ctx.__toggleConfidencePracticeMark('词3');
  ctx.__setCurrentQuestionChar('词5');

  const viewModel = ctx.__buildConfidencePanelViewModel();
  const orderedChars = ctx.__getConfidenceNavigationOrder();
  const rows = viewModel.sections[0].rows;
  const currentRow = rows.find((row) => row.charKey === '词5');
  const practiceRow = rows.find((row) => row.charKey === '词3');
  const moveNext = ctx.__moveConfidenceSelection(1);
  const movePrev = ctx.__moveConfidenceSelection(-1);

  assert.strictEqual(viewModel.pinnedLowest, null, 'full-list confidence view should not pin a separate lowest row');
  assert.strictEqual(viewModel.pinnedHighest, null, 'full-list confidence view should not pin a separate highest row');
  assert.strictEqual(viewModel.sections.length, 1, 'confidence panel should render as a single full section');
  assert.strictEqual(rows.length, 60, 'confidence panel should include all lesson words');
  assert.match(viewModel.summary, /60 words/i, 'summary should report the full lesson size');
  assert.strictEqual(orderedChars.length, 60, 'keyboard navigation order should cover the visible confidence list');
  assert.strictEqual(orderedChars[0], '词1', 'navigation order should start with the least-confident word');
  assert.strictEqual(orderedChars[orderedChars.length - 1], '词60', 'navigation order should end with the most-confident word');
  assert.ok(currentRow && currentRow.isCurrent, 'current question should be highlighted in the confidence panel');
  assert.ok(practiceRow && practiceRow.practiceActive, 'practice-marked word should be marked in the confidence panel');
  assert.strictEqual(moveNext.moved, true, 'arrow navigation should report a successful next move');
  assert.strictEqual(moveNext.selectedChar, '词6', 'arrow navigation should move to the next confidence row');
  assert.strictEqual(movePrev.moved, true, 'arrow navigation should report a successful previous move');
  assert.strictEqual(movePrev.selectedChar, '词4', 'arrow navigation should move to the previous confidence row');
  assert.strictEqual(ctx.__getWordMarking('词3'), 'needs-work', 'practice toggle should store needs-work marking');

  ctx.__toggleConfidencePracticeMark('词3');
  assert.strictEqual(ctx.__getWordMarking('词3'), null, 'practice toggle should remove needs-work marking on second click');

  console.log('✓ confidence panel view model includes selection, practice state, and navigation order');
})();
