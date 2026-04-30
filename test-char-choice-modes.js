const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function makeElement(tagName = 'div') {
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
    textContent: '',
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
        if (shouldAdd) {
          classSet.add(name);
        } else {
          classSet.delete(name);
        }
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
  Object.defineProperty(el, 'className', {
    get() { return classNameValue; },
    set(value) { classNameValue = String(value || '').trim().replace(/\s+/g, ' '); }
  });
  Object.defineProperty(el, 'options', {
    get() { return this.children; }
  });
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
  const location = {
    pathname: '/test-page.html',
    search: '',
    hash: '',
    origin: 'https://example.test',
    href: 'https://example.test/test-page.html'
  };
  const inputSectionEl = makeElement('div');
  const questionDisplayEl = makeElement('div');
  const audioSectionEl = makeElement('div');
  const playAudioBtnEl = makeElement('button');
  const answerInputEl = makeElement('input');
  const typeModeEl = makeElement('div');
  const optionsEl = makeElement('div');
  const fuzzyOptionsEl = makeElement('div');
  const fuzzyInputEl = makeElement('input');
  const fuzzyModeEl = makeElement('div');
  const choiceModeEl = makeElement('div');
  const hintEl = makeElement('div');
  const feedbackEl = makeElement('div');
  inputSectionEl.appendChild(typeModeEl);
  inputSectionEl.appendChild(choiceModeEl);
  inputSectionEl.appendChild(fuzzyModeEl);
  const elements = new Map([
    ['questionDisplay', questionDisplayEl],
    ['audioSection', audioSectionEl],
    ['playAudioBtn', playAudioBtnEl],
    ['answerInput', answerInputEl],
    ['typeMode', typeModeEl],
    ['options', optionsEl],
    ['fuzzyOptions', fuzzyOptionsEl],
    ['fuzzyInput', fuzzyInputEl],
    ['fuzzyMode', fuzzyModeEl],
    ['choiceMode', choiceModeEl],
    ['hint', hintEl],
    ['feedback', feedbackEl],
  ]);
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
      location,
      innerWidth: 1200,
      __QUIZ_DEBUG__: {},
      addEventListener() {},
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      AudioContext: class {
        constructor() { this.destination = {}; this.currentTime = 0; }
        createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      },
      webkitAudioContext: class {
        constructor() { this.destination = {}; this.currentTime = 0; }
        createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      }
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
    history: {
      replaceState(_state, _title, nextUrl) {
        const parsed = new URL(String(nextUrl), location.origin);
        location.pathname = parsed.pathname;
        location.search = parsed.search;
        location.hash = parsed.hash;
        location.href = parsed.toString();
      }
    },
  });

  document.body.appendChild(questionDisplayEl);

  ctx.window.document = document;
  ctx.window.window = ctx.window;
  vm.runInContext(`
    var chatPanelVisible = false;
    var chatPanel = null;
    var dictationChatMode = null;
    var dictationChatAudioSlot = null;
    var dictationChatAudioHome = null;
    var dictationChatAudioHomeNext = null;
  `, ctx);

  for (const file of ['./js/utils.js', './js/pinyin-utils.js', './js/quiz-engine.js']) {
    const source = fs.readFileSync(file, 'utf8');
    vm.runInContext(source, ctx, { filename: file });
  }

  vm.runInContext(`
    function __setQuizCharacters(chars) { quizCharacters = chars; }
    function __setCurrentQuestion(q) { currentQuestion = q; window.currentQuestion = q; }
    function __setPreviousQuestion(q) { previousQuestion = q; }
    function __setPreviousQuestionResult(result) { previousQuestionResult = result; }
    function __setUpcomingQuestion(q) { upcomingQuestion = q; }
    function __setMode(m) { mode = m; }
    function __setBlendDirection(dir) { blendDirection = dir; }
    function __setSentenceModeDataset(items) { sentenceModeDataset = items; }
    function __configureSentenceMode(nextConfig, items) {
      config = nextConfig || {};
      sentenceModeDataset = Array.isArray(items) ? items : [];
      sentenceModeDifficultyOptions = [];
      refreshSentenceModeDifficultyOptions();
      loadSentenceModeDifficultyPreference();
    }
    function __getSentenceModeUiState() {
      return JSON.parse(JSON.stringify(sentenceModeUiState));
    }
    function __handleSentenceModeInput(value) { handleSentenceModeInput(value); }
    function __initTestDomRefs() {
      questionDisplay = document.getElementById('questionDisplay');
      answerInput = document.getElementById('answerInput');
      typeMode = document.getElementById('typeMode');
      choiceMode = document.getElementById('choiceMode');
      fuzzyMode = document.getElementById('fuzzyMode');
      fuzzyInput = document.getElementById('fuzzyInput');
      audioSection = document.getElementById('audioSection');
      hint = document.getElementById('hint');
      feedback = document.getElementById('feedback');
    }
    function __getNoTonePinyinWord() { return getNoTonePinyinWord(currentQuestion); }
    function __getToneFlowExpectedNoTone() { return toneFlowExpectedNoTone; }
    function __getToneFlowExpected() { return Array.from(toneFlowExpected); }
    function __getToneFlowIndex() { return toneFlowIndex; }
    function __getToneFlowBaseSyllable(index) { return getToneFlowBaseSyllable(index); }
    function __getToneFlowCompletedSyllables() { return Array.from(toneFlowCompletedSyllables); }
    function __handleToneFlowPinyinChoiceSingle(choice) { handleToneFlowPinyinChoiceSingle(choice, null); }
    function __handleToneFlowToneChoice(choice) { handleToneFlowToneChoice(choice, null); }
    function __formatTonePatternLabel(pattern) { return formatTonePatternLabel(pattern); }
    function __generateTonePatternChoices(pattern) { return generateTonePatternChoices(pattern).map(item => item.join('-')); }
    function __getWordToneFlowOptions() { return getToneFlowWordPinyinOptions(); }
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
    function __getFuzzyOptionData() {
      const options = document.getElementById('fuzzyOptions');
      return (options?.children || []).map(btn => ({
        textContent: btn.textContent || '',
        innerHTML: btn.innerHTML || '',
        pattern: btn.dataset.pattern || '',
        normalized: btn.dataset.normalized || '',
        tone: btn.dataset.tone || '',
        syllable: btn.dataset.syllable || ''
      }));
    }
    function __getCurrentWordConfidenceHtml() {
      const indicator = (document.body.children || []).find(child => child && child.id === 'currentWordConfidence');
      return indicator ? (indicator.innerHTML || '') : '';
    }
    function __getCurrentMode() { return mode; }
    function __setStoredQuizMode(storedMode) { localStorage.setItem(getQuizModeKey(), storedMode); }
    function __loadQuizMode() { loadQuizMode(); }
    function __setUrlModeHash(modeName) {
      window.location.search = '';
      window.location.hash = modeName ? ('#mode=' + encodeURIComponent(modeName)) : '';
      window.location.href = window.location.origin + window.location.pathname + window.location.search + window.location.hash;
    }
    function __getCurrentQuestionChar() { return currentQuestion ? currentQuestion.char : null; }
    function __getUpcomingQuestionChar() { return upcomingQuestion ? upcomingQuestion.char : null; }
    function __markWord(char, marking) { markWord(char, marking); }
    function __getWordMarking(char) { return getWordMarking(char); }
    function __getLatestMarkingToastText() {
      const toast = (document.body.children || []).find(child => child && String(child.className || '').includes('marking-toast'));
      return toast ? (toast.textContent || '') : '';
    }
    function __pressQuizHotkey(key, extra = {}) {
      let prevented = false;
      handleQuizHotkeys({
        key,
        code: extra.code || '',
        target: extra.target || null,
        altKey: Boolean(extra.altKey),
        ctrlKey: Boolean(extra.ctrlKey),
        metaKey: Boolean(extra.metaKey),
        shiftKey: Boolean(extra.shiftKey),
        preventDefault() { prevented = true; }
      });
      return prevented;
    }
    function __getPinyinMeaningStage() { return pinyinMeaningStage; }
    function __playMeaningFeedbackAudio(delay) { return playMeaningFeedbackAudio(currentQuestion, { delay: delay == null ? 0 : delay }); }
    function __highlightSentenceModeTarget(sentence, target) { return highlightSentenceModeTarget(sentence, target); }
    function __getDrawQuestionPool(pool, options) { return getDrawQuestionPool(pool, options); }
    function __buildDrawPromptHtml(question, subtitleHtml) { return buildDrawPromptHtml(question, subtitleHtml); }
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

const multiSyllableWord = { char: '态度', pinyin: 'tài dù', meaning: 'attitude' };

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

(function testQuestionPromptEscapesDynamicMeaningHtml() {
  const { ctx } = createContext();
  const unsafe = { char: '恶', pinyin: 'è', meaning: '<img src=x onerror=alert(1)>' };
  ctx.__initTestDomRefs();
  ctx.__setQuizCharacters([unsafe, ...vocab]);
  ctx.__setMode('meaning-to-char');
  ctx.__setCurrentQuestion(unsafe);

  withRandomSequence(ctx, [0.75, 0.00, 0.15, 0.30, 0.95], () => {
    ctx.renderQuestionUiForChoiceModes();
  });

  const html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'dynamic meaning should be escaped in question prompt HTML');
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'raw HTML should not be injected into the question prompt');
  console.log('✓ question prompt escapes dynamic meaning HTML');
})();

(function testChoiceModeStaysInMainPanelByDefault() {
  const { ctx } = createContext();
  ctx.__initTestDomRefs();

  const choiceModeEl = ctx.document.getElementById('choiceMode');
  const originalParent = choiceModeEl.parentElement;

  ctx.attachChoiceModeToSidebar();

  assert.strictEqual(choiceModeEl.parentElement, originalParent, 'choice mode should stay in its original container unless sidebar attachment is explicitly enabled');
  console.log('✓ choice mode stays in the main panel by default');
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

(function testLivePinyinProgressDetectsPartialFirstSyllable() {
  const { ctx } = createContext();
  ctx.__setCurrentQuestion(multiSyllableWord);

  const state = ctx.getLivePinyinProgressState('ta', multiSyllableWord);

  assert.strictEqual(state.matchedCount, 0, 'partial first syllable should not count as fully matched yet');
  assert.strictEqual(state.activeIndex, 0, 'partial input should activate the first syllable/character');
  console.log('✓ live pinyin progress marks the first character during partial first-syllable input');
})();

(function testLivePinyinProgressAdvancesAcrossCharacters() {
  const { ctx } = createContext();
  ctx.__setCurrentQuestion(multiSyllableWord);

  const state = ctx.getLivePinyinProgressState('taid', multiSyllableWord);

  assert.strictEqual(state.matchedCount, 1, 'finished first syllable should be counted as matched');
  assert.strictEqual(state.activeIndex, 1, 'remaining partial input should activate the second syllable/character');
  console.log('✓ live pinyin progress carries partial matching forward to the next character');
})();

(function testCharToPinyinTypeLayoutShowsLiveCharacterProgress() {
  const { ctx } = createContext();
  ctx.__initTestDomRefs();
  ctx.__setCurrentQuestion(multiSyllableWord);
  ctx.__setUpcomingQuestion(vocab[0]);
  ctx.__setMode('char-to-pinyin-type');
  ctx.document.getElementById('fuzzyInput').value = 'ta';

  ctx.renderThreeColumnPinyinLayout();

  const html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.match(html, /pinyin-progress-segment is-active[^"]*"[^>]*>态<\/span>/, 'layout should highlight the first character while its syllable is being typed');
  assert.doesNotMatch(html, /pinyin-progress-segment is-active[^"]*"[^>]*>度<\/span>/, 'layout should not highlight later characters too early');
  console.log('✓ char-to-pinyin fuzzy layout shows live per-character pinyin progress');
})();

(function testPrepareUiStopsExistingPromptAudio() {
  const { ctx } = createContext();
  ctx.__initTestDomRefs();

  let cancelCount = 0;
  ctx.speechSynthesis.cancel = () => { cancelCount += 1; };
  ctx.window.currentAudioPlayFunc = () => {};

  const activeAudio = {
    paused: false,
    currentTime: 12,
    pauseCalled: false,
    pause() {
      this.pauseCalled = true;
      this.paused = true;
    },
    addEventListener() {},
    removeEventListener() {},
  };

  ctx.setActiveAudio(activeAudio);
  ctx.prepareUiForNewQuestion('');

  assert.strictEqual(activeAudio.pauseCalled, true, 'question transitions should stop active audio immediately');
  assert.strictEqual(activeAudio.currentTime, 0, 'active audio should rewind when changing questions');
  assert.strictEqual(ctx.window.currentAudioPlayFunc, null, 'question transitions should clear the stale prompt replay handler');
  assert.ok(cancelCount >= 1, 'question transitions should cancel any active speech synthesis');
  console.log('✓ question transitions stop existing audio and clear stale replay handlers');
})();

(function testRegisterCurrentPromptAudioWarmsCurrentAndUpcomingPrompt() {
  const { ctx } = createContext();
  const warmed = [];
  ctx.preloadPromptAudio = (question) => warmed.push(question.char);
  ctx.__setMode('audio-to-meaning');
  ctx.__setCurrentQuestion(vocab[0]);
  ctx.__setUpcomingQuestion(vocab[2]);

  ctx.registerCurrentPromptAudio();

  assert.deepStrictEqual(warmed, ['中', '国'], 'prompt registration should preload both current and upcoming audio');
  console.log('✓ prompt registration preloads current and upcoming audio');
})();

(function testPromptAudioModeDetection() {
  const { ctx } = createContext();
  ctx.__setMode('audio-to-meaning');
  assert.strictEqual(ctx.modeUsesPromptAudio(), true, 'audio-to-meaning should be recognized as a prompt-audio mode');

  ctx.__setMode('char-to-meaning');
  assert.strictEqual(ctx.modeUsesPromptAudio(), false, 'char-to-meaning should not be treated as a prompt-audio mode');

  ctx.__setMode('blend');
  ctx.__setBlendDirection('audio-to-meaning');
  assert.strictEqual(ctx.modeUsesPromptAudio(), true, 'blend audio directions should be treated as prompt-audio modes');
  console.log('✓ prompt-audio mode detection matches audio quiz modes');
})();

(function testWarmPromptHelpersRespectCurrentMode() {
  const { ctx } = createContext();
  const warmed = [];
  ctx.preloadPromptAudio = (question) => warmed.push(question.char);
  ctx.__setCurrentQuestion(vocab[0]);
  ctx.__setUpcomingQuestion(vocab[2]);

  ctx.__setMode('char-to-meaning');
  ctx.warmPromptAudioForCurrentMode();
  ctx.warmUpcomingPromptAudioForCurrentMode();
  assert.deepStrictEqual(warmed, [], 'non-audio modes should not prewarm prompt audio');

  ctx.__setMode('audio-to-meaning');
  ctx.warmPromptAudioForCurrentMode();
  ctx.warmUpcomingPromptAudioForCurrentMode();
  assert.deepStrictEqual(warmed, ['中', '国'], 'audio prompt helpers should warm both current and upcoming prompts');
  console.log('✓ prompt warmup helpers only preload audio-capable modes');
})();

(function testNeedsWorkHotkeyMarksCurrentWordAndShowsToast() {
  const { ctx } = createContext();
  ctx.__setCurrentQuestion(vocab[0]);

  const prevented = ctx.__pressQuizHotkey('w');

  assert.strictEqual(prevented, true, 'needs-work hotkey should prevent default browser behavior');
  assert.strictEqual(ctx.__getWordMarking('中'), 'needs-work', 'needs-work hotkey should mark the current word');
  assert.match(ctx.__getLatestMarkingToastText(), /needs work/i, 'needs-work hotkey should show a visible confirmation toast');
  console.log('✓ needs-work hotkey marks the current word and shows a toast');
})();

(function testTabHotkeyGivesUpAndShowsAnswerInQuizInput() {
  const { ctx } = createContext();
  ctx.__setCurrentQuestion(vocab[0]);
  ctx.__setMode('char-to-pinyin');
  ctx.__initTestDomRefs();
  const answerInput = ctx.document.getElementById('answerInput');
  answerInput.value = 'zh';

  const prevented = ctx.__pressQuizHotkey('Tab', { target: answerInput });

  assert.strictEqual(prevented, true, 'Tab give-up hotkey should prevent focus from leaving the quiz input');
  assert.strictEqual(
    ctx.document.getElementById('feedback').textContent,
    '✗ Wrong. The answer is: zhōng',
    'Tab give-up hotkey should reveal the answer for the current quiz card'
  );
  console.log('✓ Tab hotkey gives up and reveals the answer from the quiz input');
})();

(function testBracketLeftHotkeyMarksNeedsWorkByCode() {
  const { ctx } = createContext();
  ctx.__setCurrentQuestion(vocab[0]);

  const prevented = ctx.__pressQuizHotkey('{', { code: 'BracketLeft' });

  assert.strictEqual(prevented, true, 'BracketLeft should prevent default browser behavior');
  assert.strictEqual(ctx.__getWordMarking('中'), 'needs-work', 'BracketLeft should mark the current word as needs work even when key text varies');
  console.log('✓ BracketLeft hotkey marks needs work by keycode');
})();

(function testMetaBracketLeftHotkeyOverridesBrowserBack() {
  const { ctx } = createContext();
  ctx.__setCurrentQuestion(vocab[0]);

  const prevented = ctx.__pressQuizHotkey('[', { code: 'BracketLeft', metaKey: true });

  assert.strictEqual(prevented, true, 'Meta+BracketLeft should prevent browser back navigation');
  assert.strictEqual(ctx.__getWordMarking('中'), 'needs-work', 'Meta+BracketLeft should still mark needs work');
  console.log('✓ Meta+BracketLeft marks needs work instead of navigating back');
})();

(function testNeedsWorkMarksFocusQuizSelectionPool() {
  const { ctx } = createContext();
  ctx.__setQuizCharacters(vocab);
  ctx.__setMode('char-to-meaning');
  ctx.__markWord('国', 'needs-work');
  ctx.__markWord('人', 'learned');

  const picked = ctx.selectNextQuestion();
  assert.strictEqual(picked.char, '国', 'quiz selection should focus on needs-work words before unmarked or learned words');

  const repeated = ctx.selectNextQuestion(['国']);
  assert.strictEqual(repeated.char, '国', 'focused needs-work pools should still work even when the current word would normally be excluded');
  console.log('✓ needs-work marks focus the main quiz selection pool');
})();

(function testNeedsWorkMarksFocusSentenceModePool() {
  const { ctx } = createContext();
  const sentencePool = [
    { target: '中', sentence: '我在中间。', meaning: 'I am in the middle.', difficulty: 'standard' },
    { target: '国', sentence: '我的国家很大。', meaning: 'My country is big.', difficulty: 'standard' }
  ];
  ctx.__configureSentenceMode({}, sentencePool);
  ctx.__setQuizCharacters(vocab);
  ctx.__setMode('sentence');
  ctx.__markWord('国', 'needs-work');

  const pool = Array.from(ctx.getSentenceModeQuestionPool());
  assert.strictEqual(pool.length, 1, 'sentence mode should narrow to needs-work targets when any are marked');
  assert.strictEqual(pool[0].target, '国', 'sentence mode should keep only needs-work targets');
  console.log('✓ needs-work marks focus the sentence-mode question pool');
})();

(function testStoredQuizModeLoadsWithoutModeButtonsPresent() {
  const { ctx } = createContext();
  ctx.__setMode('char-to-meaning-type');
  ctx.__setStoredQuizMode('audio-to-meaning');

  ctx.__loadQuizMode();

  assert.strictEqual(ctx.__getCurrentMode(), 'audio-to-meaning', 'saved quiz mode should restore even before mode buttons are mounted');
  console.log('✓ saved quiz mode restores on refresh without requiring mounted mode buttons');
})();

(function testUrlHashModeLoadsWithoutModeButtonsPresent() {
  const { ctx } = createContext();
  ctx.__setMode('char-to-meaning-type');
  ctx.__setUrlModeHash('trackpad-draw');

  ctx.__loadQuizMode();

  assert.strictEqual(ctx.__getCurrentMode(), 'trackpad-draw', 'URL hash mode should restore on hard refresh even before mode buttons are mounted');
  console.log('✓ URL hash mode restores on refresh without requiring mounted mode buttons');
})();

(function testCombinedTrackpadDrawPromptShowsFullSourceWord() {
  const { ctx } = createContext();
  const html = ctx.buildDrawPromptHtml({
    char: '茶',
    pinyin: 'chá',
    meaning: 'tea',
    sourceWord: '茶叶蛋',
    sourcePinyin: 'chá yè dàn',
    sourceMeaning: 'tea egg',
    sourceCharIndex: 0,
    sourceCharCount: 3
  }, '<div class="text-sm text-gray-500 mt-1">Native absolute trackpad mode</div>');

  assert.ok(html.includes('茶叶蛋'), 'combined draw prompt should show the full source vocab word');
  assert.ok(html.includes('chá yè dàn'), 'combined draw prompt should show the source-word pinyin');
  assert.ok(html.includes('tea egg'), 'combined draw prompt should show the source-word meaning');
  assert.ok(html.includes('Character 1 of 3'), 'combined draw prompt should still clarify which character to draw');
  assert.ok(html.includes('茶'), 'combined draw prompt should still include the actual draw target character');
  console.log('✓ combined trackpad draw prompts show the full source word context');
})();

(function testMeaningFeedbackAudioSpeaksEnglishMeaning() {
  const { ctx } = createContext();
  const spoken = [];
  ctx.__setCurrentQuestion(vocab[0]);
  ctx.window.playEnglishTTS = (text) => {
    spoken.push(text);
    return true;
  };

  const started = ctx.__playMeaningFeedbackAudio(0);

  assert.strictEqual(started, true, 'meaning feedback audio should start when English TTS is available');
  assert.deepStrictEqual(spoken, ['middle'], 'meaning feedback audio should speak the English meaning');
  console.log('✓ meaning feedback audio speaks the English meaning');
})();

(function testAudioMeaningWrongAnswerSpeaksEnglishMeaning() {
  const { ctx } = createContext();
  const spoken = [];
  ctx.__initTestDomRefs();
  ctx.__setQuizCharacters(vocab);
  ctx.__setCurrentQuestion(vocab[0]);
  ctx.__setUpcomingQuestion(vocab[2]);
  ctx.__setMode('audio-to-meaning');
  ctx.window.playEnglishTTS = (text) => {
    spoken.push(text);
    return true;
  };
  ctx.setTimeout = (fn) => {
    fn();
    return 1;
  };
  ctx.clearTimeout = () => {};

  ctx.checkFuzzyAnswer('person');

  assert.deepStrictEqual(spoken, ['middle'], 'audio-to-meaning wrong answers should speak the English meaning');
  console.log('✓ audio-to-meaning wrong answers speak the English meaning');
})();

(function testAudioMeaningWrongAnswerRepeatsSameWordNext() {
  const { ctx } = createContext();
  const spoken = [];
  ctx.__initTestDomRefs();
  ctx.__setQuizCharacters(vocab);
  ctx.__setCurrentQuestion(vocab[0]);
  ctx.__setUpcomingQuestion(vocab[2]);
  ctx.__setMode('audio-to-meaning');
  ctx.window.playEnglishTTS = (text) => {
    spoken.push(text);
    return true;
  };
  ctx.setTimeout = (fn) => {
    fn();
    return 1;
  };
  ctx.clearTimeout = () => {};

  ctx.checkFuzzyAnswer('person');
  assert.strictEqual(ctx.__getUpcomingQuestionChar(), '中', 'audio-to-meaning wrong answers should reserve the same word as the upcoming repeat');

  ctx.checkFuzzyAnswer('middle');
  assert.strictEqual(ctx.__getCurrentQuestionChar(), '中', 'after a wrong answer, the next audio-to-meaning card should repeat the same word');
  assert.deepStrictEqual(spoken, ['middle'], 'wrong-answer repeat flow should still speak the English meaning once');
  console.log('✓ audio-to-meaning wrong answers repeat the same word next');
})();

(function testEnsureAudioOriginsPreconnectedAddsRemoteHintsOnce() {
  const { ctx } = createContext();
  const appended = [];
  ctx.document.head.appendChild = (node) => {
    appended.push({ rel: node.rel, href: node.href, crossOrigin: node.crossOrigin || '' });
    return node;
  };
  ctx.document.querySelector = () => null;

  ctx.ensureAudioOriginsPreconnected();
  ctx.ensureAudioOriginsPreconnected();

  assert.strictEqual(appended.length, 6, 'audio preconnect should add one preconnect and dns-prefetch per remote origin only once');
  assert.ok(appended.some(item => item.rel === 'preconnect' && item.href === 'https://www.purpleculture.net'), 'should preconnect to Purple Culture audio host');
  assert.ok(appended.some(item => item.rel === 'preconnect' && item.href === 'https://fanyi.baidu.com'), 'should preconnect to Baidu TTS host');
  console.log('✓ audio hosts are preconnected once during startup');
})();

(function testAudioMeaningLayoutUsesInlinePromptControlSlot() {
  const { ctx } = createContext();
  ctx.__initTestDomRefs();
  ctx.__setCurrentQuestion(vocab[0]);
  ctx.__setUpcomingQuestion(vocab[2]);
  ctx.__setMode('audio-to-meaning');

  ctx.renderThreeColumnMeaningLayout();

  const html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(html.includes('inlinePromptAudioSlot'), 'audio-to-meaning should reserve an inline slot for the shared audio controls');
  assert.ok(!html.includes('onclick="if(window.currentAudioPlayFunc) window.currentAudioPlayFunc();"'), 'audio-to-meaning should not use the old oversized inline speaker icon');
  console.log('✓ audio-to-meaning layout uses inline shared audio controls');
})();

(function testBlendAudioPromptUsesInlinePromptControlSlot() {
  const { ctx } = createContext();
  ctx.__initTestDomRefs();
  ctx.__setCurrentQuestion(vocab[0]);
  ctx.__setUpcomingQuestion(vocab[2]);
  ctx.__setMode('blend');
  ctx.__setBlendDirection('audio-to-meaning');

  ctx.renderBlendLayout();

  const html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(html.includes('inlinePromptAudioSlot'), 'blend audio prompts should reuse the inline audio slot');
  console.log('✓ blend audio prompts use inline shared audio controls');
})();

(function testSentenceModeDatasetHasExpectedShape() {
  const dataset = JSON.parse(fs.readFileSync('./data/sentence-mode.json', 'utf8'));
  assert.ok(dataset.length >= 5, 'sentence mode dataset should include the easy prompt set');
  dataset.forEach((item) => {
    assert.ok(item.sentence && item.meaning, 'sentence mode entries need sentence and meaning');
    assert.ok(Array.isArray(item.acceptedAnswers) && item.acceptedAnswers.length >= 1, 'sentence mode entries should include accepted answers');
  });
  console.log('✓ sentence mode dataset includes easy full-sentence prompts');
})();

(function testSentenceModeOptionsComeFromSentencePool() {
  const { ctx } = createContext();
  const sentencePool = [
    { sentence: '老师让我们把作业在星期五前交上去。', prompt: 'What does the whole sentence mean?', char: '老师让我们把作业在星期五前交上去。', meaning: 'The teacher told us to hand in the homework before Friday.' },
    { sentence: '她从地上捡起那枚硬币，小心地放进口袋。', prompt: 'What does the whole sentence mean?', char: '她从地上捡起那枚硬币，小心地放进口袋。', meaning: 'She picked the coin up from the ground and carefully put it into her pocket.' },
    { sentence: '会议推迟到下周二举行了。', prompt: 'What does the whole sentence mean?', char: '会议推迟到下周二举行了。', meaning: 'The meeting has been postponed until next Tuesday.' },
    { sentence: '我们昨天沿着河边散步到了很晚。', prompt: 'What does the whole sentence mean?', char: '我们昨天沿着河边散步到了很晚。', meaning: 'We strolled along the riverbank until late last night.' },
    { sentence: '别忘了把灯关掉再走。', prompt: 'What does the whole sentence mean?', char: '别忘了把灯关掉再走。', meaning: "Don't forget to turn off the light before you leave." },
  ];

  ctx.__initTestDomRefs();
  ctx.__setMode('sentence');
  ctx.__setSentenceModeDataset(sentencePool);
  ctx.__setCurrentQuestion(sentencePool[0]);

  withRandomSequence(ctx, [0.24, 0.49, 0.74, 0.99], () => {
    ctx.generateFuzzySentenceModeOptions();
  });

  const options = ctx.__getFuzzyOptionData();
  assert.strictEqual(options.length, 4, 'sentence mode should render four fuzzy choices');
  assert.ok(options.some(option => option.textContent === 'The teacher told us to hand in the homework before Friday.'), 'sentence mode should include the whole-sentence meaning');
  assert.ok(options.every(option => option.textContent), 'sentence mode options should render readable text');
  console.log('✓ sentence mode builds fuzzy choices from whole-sentence meanings');
})();

(function testSentenceModeUsesMeaningSkillKey() {
  const { ctx } = createContext();
  assert.strictEqual(ctx.getCurrentSkillKey('sentence'), 'meaning', 'sentence mode should track contextual meaning skill');
  console.log('✓ sentence mode maps to meaning skill tracking');
})();

(function testAudioMeaningUsesIndependentSkillKey() {
  const { ctx } = createContext();
  assert.strictEqual(ctx.getCurrentSkillKey('audio-to-meaning'), 'audio-meaning', 'audio-to-meaning should track its own confidence bucket');
  ctx.__setMode('blend');
  ctx.__setBlendDirection('audio-to-meaning');
  assert.strictEqual(ctx.getCurrentSkillKey('blend'), 'audio-meaning', 'blend audio-to-meaning direction should reuse the audio-meaning confidence bucket');
  console.log('✓ audio-to-meaning uses an independent skill key');
})();

(function testSentenceModeDifficultyFilteringRespectsCurrentLessonPool() {
  const { ctx } = createContext();
  const sentencePool = [
    { difficulty: 'starter', target: '特别', sentence: '这个学科特别难。', meaning: 'This subject is especially hard.' },
    { difficulty: 'starter', target: '找到', sentence: '我找到钥匙了。', meaning: 'I found the keys.' },
    { difficulty: 'starter', target: '数学', sentence: '我弟弟不喜欢数学。', meaning: 'My younger brother does not like math.' },
    { difficulty: 'starter', target: '怕', sentence: '你别怕，我们一起去。', meaning: 'Do not be afraid, we will go together.' },
    { difficulty: 'dialogue', target: '学科', sentence: '进大学以后，我发现自己最喜欢的学科不是数学，而是音乐。', meaning: 'After entering college, I realized the subject I like most is not math but music.' },
    { difficulty: 'dialogue', target: '送', sentence: '爸妈送她进大学，是希望她将来找到好工作。', meaning: 'Her parents sent her to college hoping she will find a good job in the future.' },
    { difficulty: 'dialogue', target: '钢琴', sentence: '从六岁起学钢琴以后，钢琴已经成了她生活的一部分。', meaning: 'Since starting piano at age six, the piano has become part of her life.' },
    { difficulty: 'dialogue', target: '重要', sentence: '她觉得学自己真正感兴趣的东西比找工作更重要。', meaning: 'She thinks studying something she is truly interested in is more important than finding a job.' },
    { difficulty: 'starter', target: '文学院', sentence: '她在文学院上课。', meaning: 'She is taking classes in the school of liberal arts.' }
  ];

  ctx.__setQuizCharacters([
    { char: '特别' },
    { char: '找到' },
    { char: '数学' },
    { char: '怕' },
    { char: '学科' },
    { char: '送' },
    { char: '钢琴' },
    { char: '重要' }
  ]);
  ctx.__configureSentenceMode({
    sentenceModeFilterToQuizCharacters: true,
    sentenceModeDifficulties: [
      { id: 'starter', label: 'Starter' },
      { id: 'dialogue', label: 'Dialogue' }
    ],
    defaultSentenceDifficulty: 'starter'
  }, sentencePool);

  let pool = Array.from(ctx.getSentenceModeQuestionPool());
  assert.strictEqual(pool.length, 4, 'starter pool should keep only the current lesson targets');
  assert.ok(pool.every(item => item.difficulty === 'starter'), 'starter pool should only contain starter prompts');
  assert.ok(!pool.some(item => item.target === '文学院'), 'starter pool should exclude targets outside the current lesson subset');

  ctx.setSentenceModeDifficulty('dialogue', { refresh: false });
  pool = Array.from(ctx.getSentenceModeQuestionPool());
  assert.strictEqual(pool.length, 4, 'dialogue pool should switch to the selected difficulty');
  assert.ok(pool.every(item => item.difficulty === 'dialogue'), 'dialogue pool should only contain dialogue prompts');
  console.log('✓ sentence mode difficulty filtering respects selected lesson targets');
})();

(function testSentenceModeUiStateTracksHighlightAndFeedback() {
  const { ctx } = createContext();
  const sentencePool = [
    { sentence: '老师让我们把作业在星期五前交上去。', prompt: 'What does the whole sentence mean?', char: '老师让我们把作业在星期五前交上去。', meaning: 'The teacher told us to hand in the homework before Friday.' },
    { sentence: '她从地上捡起那枚硬币，小心地放进口袋。', prompt: 'What does the whole sentence mean?', char: '她从地上捡起那枚硬币，小心地放进口袋。', meaning: 'She picked the coin up from the ground and carefully put it into her pocket.' },
    { sentence: '会议推迟到下周二举行了。', prompt: 'What does the whole sentence mean?', char: '会议推迟到下周二举行了。', meaning: 'The meeting has been postponed until next Tuesday.' },
    { sentence: '我们昨天沿着河边散步到了很晚。', prompt: 'What does the whole sentence mean?', char: '我们昨天沿着河边散步到了很晚。', meaning: 'We strolled along the riverbank until late last night.' }
  ];

  ctx.__initTestDomRefs();
  ctx.__setMode('sentence');
  ctx.__setSentenceModeDataset(sentencePool);
  ctx.__setCurrentQuestion(sentencePool[0]);

  withRandomSequence(ctx, [0.24, 0.49, 0.74, 0.99], () => {
    ctx.generateFuzzySentenceModeOptions();
  });

  ctx.__handleSentenceModeInput('teacher hand in homework friday');
  let state = ctx.__getSentenceModeUiState();
  assert.ok(state.highlightedIndex >= 0, 'sentence mode should highlight a best fuzzy match');
  assert.strictEqual(state.options[state.highlightedIndex], 'The teacher told us to hand in the homework before Friday.', 'sentence mode should highlight the intended answer');

  ctx.submitSentenceModeAnswer('The teacher told us to hand in the homework before Friday.');
  state = ctx.__getSentenceModeUiState();
  assert.strictEqual(state.locked, true, 'sentence mode should lock after submitting');
  assert.strictEqual(state.feedback.type, 'correct', 'sentence mode should store correct feedback in UI state');
  ctx.clearPendingNextQuestion();
  console.log('✓ sentence mode Preact state tracks highlight and submission feedback');
})();

(function testSentenceModeWrongAnswerSpeaksEnglishMeaning() {
  const { ctx } = createContext();
  const spoken = [];
  const sentencePool = [
    { sentence: '老师让我们把作业在星期五前交上去。', target: '交', prompt: 'What does the whole sentence mean?', char: '交', meaning: 'The teacher told us to hand in the homework before Friday.' },
    { sentence: '她从地上捡起那枚硬币，小心地放进口袋。', target: '捡起', prompt: 'What does the whole sentence mean?', char: '捡起', meaning: 'She picked the coin up from the ground and carefully put it into her pocket.' }
  ];

  ctx.__initTestDomRefs();
  ctx.__setMode('sentence');
  ctx.__setSentenceModeDataset(sentencePool);
  ctx.__setCurrentQuestion(sentencePool[0]);
  ctx.window.playEnglishTTS = (text) => {
    spoken.push(text);
    return true;
  };

  ctx.submitSentenceModeAnswer('She picked the coin up from the ground and carefully put it into her pocket.');

  const state = ctx.__getSentenceModeUiState();
  assert.strictEqual(state.feedback.type, 'incorrect', 'sentence mode should record incorrect feedback after a wrong answer');
  assert.deepStrictEqual(
    spoken,
    ['The teacher told us to hand in the homework before Friday.'],
    'sentence mode wrong answers should speak the English answer immediately'
  );
  ctx.clearPendingNextQuestion();
  console.log('✓ sentence mode wrong answers speak the English answer');
})();

(function testAudioSentenceMeaningLayoutShowsSentenceInPreviousNowUpcoming() {
  const { ctx } = createContext();
  const previous = {
    char: '交',
    target: '交',
    pinyin: 'jiāo',
    meaning: 'hand in',
    sentence: '老师让我们把作业在星期五前交上去。'
  };
  const current = {
    char: '捡起',
    target: '捡起',
    pinyin: 'jiǎnqǐ',
    meaning: 'pick up',
    sentence: '她从地上捡起那枚硬币，小心地放进口袋。'
  };
  const upcoming = {
    char: '关掉',
    target: '关掉',
    pinyin: 'guāndiào',
    meaning: 'turn off',
    sentence: '别忘了把灯关掉再走。'
  };

  ctx.__initTestDomRefs();
  ctx.__setMode('audio-sentence-to-meaning');
  ctx.__setPreviousQuestion(previous);
  ctx.__setPreviousQuestionResult('incorrect');
  ctx.__setCurrentQuestion(current);
  ctx.__setUpcomingQuestion(upcoming);

  ctx.renderThreeColumnMeaningLayout();

  const html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(html.includes('老师让我们把作业在星期五前'), 'audio sentence meaning layout should show the previous sentence in the preview strip');
  assert.ok(html.includes('她从地上'), 'audio sentence meaning layout should show the current sentence in the center card');
  assert.ok(html.includes('别忘了把灯'), 'audio sentence meaning layout should show the upcoming sentence in the preview strip');
  assert.ok(html.includes('inlinePromptAudioSlot'), 'audio sentence meaning layout should still keep the shared audio control slot');
  console.log('✓ audio sentence meaning layout shows sentences in previous, now, and upcoming cards');
})();

(function testWordUsageHintMapsGrammarCategories() {
  const { ctx } = createContext();
  const verbHint = ctx.getWordUsageHint({ category: 'Common Verbs' });
  const nounHint = ctx.getWordUsageHint({ category: 'Nouns' });
  const pronounHint = ctx.getWordUsageHint({ category: 'Pronouns' });

  assert.strictEqual(verbHint.label, 'VERB');
  assert.strictEqual(verbHint.before, 'wǒ');
  assert.strictEqual(nounHint.label, 'NOUN');
  assert.strictEqual(nounHint.before, 'wǒ xǐhuan');
  assert.strictEqual(pronounHint.label, 'PRONOUN');
  assert.strictEqual(pronounHint.after, 'xǐhuan chá');
  console.log('✓ word usage hints map categories to compact grammar cues');
})();

(function testMeaningLayoutFallbackShowsUsageHint() {
  const { ctx } = createContext();
  ctx.__initTestDomRefs();
  ctx.__setCurrentQuestion({ char: '喜欢', pinyin: 'xǐhuān', meaning: 'like', category: 'Common Verbs' });
  ctx.__setMode('char-to-meaning');

  ctx.renderMeaningQuestionLayout();

  let html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(!html.includes('Tiny usage'), 'meaning layout should hide the tiny usage example before an attempt');

  ctx.checkMultipleChoice('wrong');

  html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(html.includes('Tiny usage'), 'meaning layout should show the tiny usage example after an attempt');
  assert.ok(/我们[\s\S]*喜欢/.test(html), 'meaning layout should show a short word-specific example sentence after an attempt');
  assert.ok(html.includes('Common Verbs'), 'meaning layout should show the source grammar category after an attempt');
  ctx.clearPendingNextQuestion();
  console.log('✓ meaning layout shows tiny usage examples only after an attempt');
})();

(function testThreeColumnMeaningHidesUsageUntilTypedAttempt() {
  const { ctx } = createContext();
  ctx.__initTestDomRefs();
  ctx.__setCurrentQuestion({ char: '尽力', pinyin: 'jìnlì', meaning: 'to do one’s best', category: 'Common Verbs' });
  ctx.__setQuizCharacters([
    { char: '尽力', pinyin: 'jìnlì', meaning: 'to do one’s best', category: 'Common Verbs' },
    { char: '成功', pinyin: 'chénggōng', meaning: 'success', category: 'Nouns' }
  ]);
  ctx.__setMode('char-to-meaning-type');

  ctx.renderThreeColumnMeaningLayout();
  let html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(!html.includes('Tiny usage'), 'three-column meaning layout should hide tiny usage before a typed attempt');

  ctx.checkFuzzyAnswer('wrong');

  html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(html.includes('Tiny usage'), 'three-column meaning layout should show tiny usage after a typed attempt');
  assert.ok(/我们[\s\S]*尽力/.test(html), 'three-column meaning layout should show a short word-specific example after a typed attempt');
  ctx.clearPendingNextQuestion();
  console.log('✓ three-column meaning layout reveals tiny usage after a typed attempt');
})();

(function testTutorialModeUsesMeaningSkillKey() {
  const { ctx } = createContext();
  assert.strictEqual(ctx.getCurrentSkillKey('tutorial'), 'meaning', 'tutorial mode should track meaning skill');
  console.log('✓ tutorial mode maps to meaning skill tracking');
})();

(function testTutorialModeFallbackShowsStructureAndExample() {
  const { ctx } = createContext();
  const word = { char: '数学', pinyin: 'shùxué', meaning: 'math', category: 'Nouns' };
  const sentencePool = [
    { target: '数学', sentence: '我弟弟不喜欢数学。', meaning: 'My younger brother does not like math.' },
    { target: '数学', sentence: '我学数学。', meaning: 'I study math.' },
    { target: '数学', sentence: '数学有时候很难。', meaning: 'Math is sometimes hard.' }
  ];

  ctx.__initTestDomRefs();
  ctx.__configureSentenceMode({}, sentencePool);
  ctx.__setCurrentQuestion(word);
  ctx.__setMode('tutorial');

  ctx.renderTutorialModeLayout();

  const html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(html.includes('Tutorial Mode'), 'tutorial mode should render its title');
  assert.ok(html.includes('Noun'), 'tutorial mode should show a human-readable word type');
  assert.ok(html.includes('Tiny sentence'), 'tutorial mode should foreground a tiny sentence first');
  assert.ok(/我学[\s\S]*数学/.test(html), 'tutorial mode should prefer the shortest matching example sentence');
  assert.ok(html.includes('I study math.'), 'tutorial mode should show the shortest example translation');
  assert.ok(html.includes('Use it like this'), 'tutorial mode should show a compact usage section');
  assert.ok(html.includes('Remember it'), 'tutorial mode should show a compact memory clue section');
  assert.ok(!html.includes('My younger brother does not like math.'), 'tutorial mode should avoid showing the longer example when a tiny one exists');
  console.log('✓ tutorial mode fallback shows structure and matched sentence examples');
})();

(function testTutorialModeWordTypeHelperIsReadable() {
  const { ctx } = createContext();
  const wordType = ctx.getTutorialWordType({ category: 'Common Verbs' });
  const inferred = ctx.getTutorialWordType({ meaning: 'even if' });

  assert.strictEqual(wordType.shortLabel, 'Verb', 'tutorial mode should expose a readable word type label');
  assert.strictEqual(wordType.sourceLabel, 'Common Verbs', 'tutorial mode should preserve the source category label');
  assert.strictEqual(inferred.shortLabel, 'Connector', 'tutorial mode should infer connector-like words from meaning when metadata is missing');
  assert.strictEqual(inferred.sourceLabel, 'Inferred from meaning', 'tutorial mode should disclose when the word type is inferred');
  console.log('✓ tutorial mode exposes readable word type labels');
})();

(function testTutorialModeGeneratesTinyExampleWhenDatasetMissing() {
  const { ctx } = createContext();
  ctx.__initTestDomRefs();
  ctx.__setCurrentQuestion({ char: '制度', pinyin: 'zhìdù', meaning: 'system; institution', category: 'Nouns' });
  ctx.__setMode('tutorial');

  ctx.renderTutorialModeLayout();

  const html = ctx.document.getElementById('questionDisplay').innerHTML;
  assert.ok(html.includes('Tiny sentence'), 'tutorial mode should show a tiny sentence section even without the sentence dataset');
  assert.ok(/这是[\s\S]*制度/.test(html), 'tutorial mode should generate a tiny fallback example when no real match exists');
  console.log('✓ tutorial mode generates a tiny fallback example when dataset matches are unavailable');
})();

(function testSentenceHighlightBoldsTargetWord() {
  const { ctx } = createContext();
  const html = ctx.__highlightSentenceModeTarget('中国人都很重视教育。', '重视');
  assert.ok(html.includes('<strong'), 'sentence highlighting should use bold emphasis');
  assert.ok(html.includes('重视'), 'sentence highlighting should keep the target word visible');
  console.log('✓ sentence mode bolds the target word inside the sentence');
})();

(function testTrackpadDrawPoolKeepsWholeWords() {
  const { ctx } = createContext();
  const pool = ctx.__getDrawQuestionPool([
    { char: '读书', pinyin: 'dúshū', meaning: 'to study' },
    { char: '重视', pinyin: 'zhòngshì', meaning: 'to value highly' }
  ], { splitMultiCharWords: false });
  assert.deepStrictEqual(Array.from(pool, item => item.char), ['读书', '重视'], 'trackpad draw should keep whole words instead of splitting them into characters');
  console.log('✓ trackpad draw question pool keeps full words');
})();

(function testTrackpadPromptShowsMeaningWithoutPerCharacterStep() {
  const { ctx } = createContext();
  ctx.__setMode('trackpad-draw');
  const html = ctx.__buildDrawPromptHtml(
    { char: '读书', pinyin: 'dúshū', meaning: 'to study' },
    '<div class="text-sm text-gray-500 mt-1">Native absolute trackpad mode</div>'
  );
  assert.ok(html.includes('to study'), 'trackpad prompt should show the meaning cue for the full target word');
  assert.ok(html.includes('dúshū'), 'trackpad prompt should show the full-word pinyin cue');
  assert.ok(html.includes('Native absolute trackpad mode'), 'trackpad prompt should include the trackpad mode subtitle');
  assert.ok(!html.includes('character 1 of 2'), 'trackpad prompt should not show per-character progress text');
  console.log('✓ trackpad draw prompt shows whole-word cues without per-character progress');
})();

(function testTutorialModeGenerateQuestionRendersTutorialCard() {
  const { ctx } = createContext();
  const word = { char: '喜欢', pinyin: 'xǐhuān', meaning: 'like', category: 'Common Verbs' };

  ctx.__initTestDomRefs();
  ctx.__setQuizCharacters([word]);
  ctx.__setMode('tutorial');

  ctx.generateQuestion();

  const html = ctx.document.getElementById('questionDisplay').innerHTML;
  const audioSection = ctx.document.getElementById('audioSection');
  assert.ok(html.includes('Tutorial Mode'), 'generateQuestion should render the tutorial mode card');
  assert.strictEqual(audioSection.classList.contains('hidden'), false, 'tutorial mode should show shared audio controls');
  console.log('✓ tutorial mode generateQuestion renders the tutorial card with audio controls');
})();

(function testTutorialModeAssessmentLocksAndSchedulesAdvance() {
  const { ctx } = createContext();
  ctx.__initTestDomRefs();
  ctx.__setCurrentQuestion({ char: '喜欢', pinyin: 'xǐhuān', meaning: 'like', category: 'Common Verbs' });
  ctx.__setMode('tutorial');

  ctx.renderTutorialModeLayout();
  ctx.submitTutorialModeAssessment(true);

  const state = ctx.getTutorialModeUiState();
  assert.strictEqual(state.locked, true, 'tutorial mode should lock after self-rating');
  assert.strictEqual(state.feedback.type, 'correct', 'tutorial mode should store success feedback after a positive self-rating');
  ctx.clearPendingNextQuestion();
  console.log('✓ tutorial mode self-rating locks the card and records feedback');
})();

(function testToneMcUsesWholeWordPinyinWithoutToneMarks() {
  const { ctx } = createContext();
  const word = { char: '好天', pinyin: 'hǎo tiān', meaning: 'good weather' };
  const pool = [
    word,
    { char: '老师', pinyin: 'lǎo shī', meaning: 'teacher' },
    { char: '明天', pinyin: 'míng tiān', meaning: 'tomorrow' },
    { char: '水果', pinyin: 'shuǐ guǒ', meaning: 'fruit' },
    { char: '朋友', pinyin: 'péng yǒu', meaning: 'friend' },
  ];
  ctx.__setQuizCharacters(pool);
  ctx.__setCurrentQuestion(word);
  ctx.__setMode('char-to-pinyin-tones-mc');
  ctx.__initTestDomRefs();

  ctx.startPinyinToneMcFlow(true);

  assert.strictEqual(ctx.__getNoTonePinyinWord(), 'hao tian', 'phase 1 should use full-word pinyin without tones');
  assert.strictEqual(ctx.__getToneFlowExpectedNoTone(), 'hao tian', 'tone flow should store full-word no-tone pinyin');
  assert.deepStrictEqual(Array.from(ctx.__getToneFlowExpected()), [3, 1], 'tone flow should still track the full tone pattern');

  const options = Array.from(ctx.__getWordToneFlowOptions());
  assert.ok(options.includes('hao tian'), 'phase 1 options should include the whole-word pinyin');
  assert.ok(!options.includes('hao'), 'phase 1 should not offer per-syllable pinyin');
  console.log('✓ char-to-pinyin-tones-mc phase 1 uses whole-word pinyin without tones');
})();

(function testPinyinMeaningModeStartsOnPinyinStep() {
  const { ctx } = createContext();
  const word = { char: '好天', pinyin: 'hǎo tiān', meaning: 'good weather' };
  ctx.__setQuizCharacters([
    word,
    { char: '老师', pinyin: 'lǎo shī', meaning: 'teacher' },
    { char: '明天', pinyin: 'míng tiān', meaning: 'tomorrow' },
    { char: '水果', pinyin: 'shuǐ guǒ', meaning: 'fruit' },
  ]);
  ctx.__setCurrentQuestion(word);
  ctx.__setMode('char-to-pinyin-meaning');
  ctx.__initTestDomRefs();

  ctx.renderQuestionUiForChoiceModes();

  assert.strictEqual(ctx.__getPinyinMeaningStage(), 'pinyin', 'new mode should begin on the pinyin step');
  assert.strictEqual(ctx.document.getElementById('fuzzyInput').placeholder, 'Type pinyin to filter choices...', 'new mode should prompt for pinyin first');
  const options = Array.from(ctx.__getFuzzyOptionData());
  assert.ok(options.some(option => option.textContent === 'hǎo tiān'), 'pinyin step should include pinyin options');
  console.log('✓ char-to-pinyin-meaning starts on the pinyin step');
})();

(function testPinyinMeaningModeTransitionsToMeaningOnCorrectPinyin() {
  const { ctx } = createContext();
  const word = { char: '好天', pinyin: 'hǎo tiān', meaning: 'good weather' };
  ctx.__setQuizCharacters([
    word,
    { char: '老师', pinyin: 'lǎo shī', meaning: 'teacher' },
    { char: '明天', pinyin: 'míng tiān', meaning: 'tomorrow' },
    { char: '水果', pinyin: 'shuǐ guǒ', meaning: 'fruit' },
  ]);
  ctx.__setCurrentQuestion(word);
  ctx.__setMode('char-to-pinyin-meaning');
  ctx.__initTestDomRefs();

  ctx.renderQuestionUiForChoiceModes();
  ctx.checkFuzzyPinyinAnswer('hǎo tiān');

  assert.strictEqual(ctx.__getPinyinMeaningStage(), 'meaning', 'correct pinyin should advance to the meaning step');
  assert.strictEqual(ctx.window.currentQuestion.char, '好天', 'correct pinyin should keep the same word active');
  assert.strictEqual(ctx.document.getElementById('fuzzyInput').placeholder, 'Type meaning to filter choices...', 'meaning step should prompt for meaning');
  const options = Array.from(ctx.__getFuzzyOptionData());
  assert.ok(options.some(option => option.textContent === 'good weather'), 'meaning step should include meaning options for the same word');
  console.log('✓ char-to-pinyin-meaning moves to meaning after correct pinyin');
})();

(function testPinyinMeaningModeAdvancesOnlyAfterMeaningStep() {
  const { ctx } = createContext();
  const word = { char: '好天', pinyin: 'hǎo tiān', meaning: 'good weather' };
  const nextWord = { char: '老师', pinyin: 'lǎo shī', meaning: 'teacher' };
  ctx.__setQuizCharacters([
    word,
    nextWord,
    { char: '明天', pinyin: 'míng tiān', meaning: 'tomorrow' },
    { char: '水果', pinyin: 'shuǐ guǒ', meaning: 'fruit' },
  ]);
  ctx.__setCurrentQuestion(word);
  ctx.__setUpcomingQuestion(nextWord);
  ctx.__setMode('char-to-pinyin-meaning');
  ctx.__initTestDomRefs();

  ctx.renderQuestionUiForChoiceModes();
  ctx.checkFuzzyPinyinAnswer('hǎo tiān');
  assert.strictEqual(ctx.window.currentQuestion.char, '好天', 'mode should not advance after just the pinyin step');

  ctx.checkFuzzyAnswer('good weather');

  assert.strictEqual(ctx.window.currentQuestion.char, '老师', 'mode should advance only after the meaning step is completed');
  assert.strictEqual(ctx.__getPinyinMeaningStage(), 'pinyin', 'next card should reset back to the pinyin step');
  console.log('✓ char-to-pinyin-meaning advances only after meaning is correct');
})();

(function testToneMcUsesOneToneMarkedSyllableAtATime() {
  const { ctx } = createContext();
  const word = { char: '好天', pinyin: 'hǎo tiān', meaning: 'good weather' };
  ctx.__setQuizCharacters([
    word,
    { char: '老师', pinyin: 'lǎo shī', meaning: 'teacher' },
    { char: '明天', pinyin: 'míng tiān', meaning: 'tomorrow' },
    { char: '水果', pinyin: 'shuǐ guǒ', meaning: 'fruit' },
    { char: '朋友', pinyin: 'péng yǒu', meaning: 'friend' },
  ]);
  ctx.__setCurrentQuestion(word);
  ctx.__setMode('char-to-pinyin-tones-mc');
  ctx.__initTestDomRefs();

  ctx.startPinyinToneMcFlow(true);
  ctx.__handleToneFlowPinyinChoiceSingle('hao tian');

  assert.strictEqual(ctx.__getToneFlowIndex(), 0, 'tone flow should start on the first syllable');
  assert.strictEqual(ctx.__getToneFlowBaseSyllable(0), 'hao', 'tone flow should prompt the current syllable without tones');

  const options = Array.from(ctx.__getFuzzyOptionData());
  const syllables = options.map(option => option.syllable).sort();
  assert.deepStrictEqual(
    syllables,
    ['hāo', 'háo', 'hǎo', 'hào', 'hao'].sort(),
    'tone options should be the five tone-mark variants for the current syllable'
  );
  console.log('✓ char-to-pinyin-tones-mc phase 2 uses one tone-marked syllable at a time');
})();

(function testToneMcWrongPinyinStaysOnSameWordForRetry() {
  const { ctx } = createContext();
  const word = { char: '好天', pinyin: 'hǎo tiān', meaning: 'good weather' };
  ctx.__setQuizCharacters([
    word,
    { char: '老师', pinyin: 'lǎo shī', meaning: 'teacher' },
    { char: '明天', pinyin: 'míng tiān', meaning: 'tomorrow' },
    { char: '水果', pinyin: 'shuǐ guǒ', meaning: 'fruit' },
    { char: '朋友', pinyin: 'péng yǒu', meaning: 'friend' },
  ]);
  ctx.__setCurrentQuestion(word);
  ctx.__setMode('char-to-pinyin-tones-mc');
  ctx.__initTestDomRefs();

  ctx.startPinyinToneMcFlow(true);
  ctx.__handleToneFlowPinyinChoiceSingle('lao shi');

  assert.strictEqual(ctx.__getToneFlowIndex(), 0, 'wrong pinyin should not advance into the tone phase');
  assert.strictEqual(ctx.__getToneFlowExpectedNoTone(), 'hao tian', 'wrong pinyin should keep the same target word active');
  assert.strictEqual(ctx.window.currentQuestion.char, '好天', 'wrong pinyin should keep the same question instead of advancing');
  assert.strictEqual(
    ctx.document.getElementById('feedback').textContent,
    '✗ Not quite. Try the same word again.',
    'wrong pinyin should prompt a retry on the same word'
  );
  console.log('✓ char-to-pinyin-tones-mc wrong pinyin stays on the same word for retry');
})();

(function testCharToPinyinRetryRefreshesConfidenceIndicator() {
  const { ctx } = createContext();
  const word = { char: '好天', pinyin: 'hǎo tiān', meaning: 'good weather' };
  ctx.__setQuizCharacters([word]);
  ctx.__setCurrentQuestion(word);
  ctx.__setMode('char-to-pinyin');
  ctx.__initTestDomRefs();
  ctx.document.getElementById('answerInput').value = 'wrong';

  ctx.checkAnswer();

  const confidenceHtml = ctx.__getCurrentWordConfidenceHtml();
  assert.ok(confidenceHtml.includes('20%'), 'wrong retry path should refresh the confidence indicator to the updated BKT score');
  console.log('✓ char-to-pinyin retry path refreshes confidence indicator after wrong answers');
})();

(function testToneMcOnlyAdvancesOnCorrectToneChoice() {
  const { ctx } = createContext();
  const word = { char: '好天', pinyin: 'hǎo tiān', meaning: 'good weather' };
  ctx.__setQuizCharacters([
    word,
    { char: '老师', pinyin: 'lǎo shī', meaning: 'teacher' },
    { char: '明天', pinyin: 'míng tiān', meaning: 'tomorrow' },
    { char: '水果', pinyin: 'shuǐ guǒ', meaning: 'fruit' },
    { char: '朋友', pinyin: 'péng yǒu', meaning: 'friend' },
  ]);
  ctx.__setCurrentQuestion(word);
  ctx.__setMode('char-to-pinyin-tones-mc');
  ctx.__initTestDomRefs();

  ctx.startPinyinToneMcFlow(true);
  ctx.__handleToneFlowPinyinChoiceSingle('hao tian');

  ctx.__handleToneFlowToneChoice(2);
  assert.strictEqual(ctx.__getToneFlowIndex(), 0, 'wrong tone should not advance to the next syllable');
  assert.deepStrictEqual(Array.from(ctx.__getToneFlowCompletedSyllables()), [], 'wrong tone should not mark a syllable complete');

  ctx.__handleToneFlowToneChoice(3);
  assert.strictEqual(ctx.__getToneFlowIndex(), 1, 'correct tone should advance to the next syllable');
  assert.deepStrictEqual(Array.from(ctx.__getToneFlowCompletedSyllables()), ['hǎo'], 'correct tone should store the completed toned syllable');
  console.log('✓ char-to-pinyin-tones-mc only advances after a correct tone choice');
})();

(function testToneMcIgnoresOptionalParentheticalPinyin() {
  const { ctx } = createContext();
  const word = { char: '经济(学)', pinyin: 'jīngjì(xué)', meaning: 'economics' };
  ctx.__setCurrentQuestion(word);

  assert.strictEqual(ctx.__getNoTonePinyinWord(), 'jing ji', 'optional parenthetical pinyin should be ignored in no-tone word parsing');

  ctx.__setQuizCharacters([
    word,
    { char: '顺利', pinyin: 'shùn lì', meaning: 'smooth' },
    { char: '可能', pinyin: 'kě néng', meaning: 'possible' },
    { char: '音乐', pinyin: 'yīn yuè', meaning: 'music' },
  ]);
  ctx.__setMode('char-to-pinyin-tones-mc');
  ctx.__initTestDomRefs();
  ctx.startPinyinToneMcFlow(true);

  assert.deepStrictEqual(Array.from(ctx.__getToneFlowExpected()), [1, 4], 'tone flow should ignore optional parenthetical syllables');
  console.log('✓ char-to-pinyin-tones-mc ignores optional parenthetical pinyin segments');
})();

process.exit(0);
