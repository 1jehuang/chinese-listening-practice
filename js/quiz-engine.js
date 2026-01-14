// Shared Quiz Engine
// Used by all quiz pages (character sheets, lessons, practice tests)
// Each page only needs to define characters array and call initQuiz()

// Quiz state
let currentQuestion = null;
let mode = 'char-to-meaning-type';
let answered = false;
let score = 0;
let total = 0;
let enteredSyllables = [];
let enteredTones = '';
let quizCharacters = [];
let originalQuizCharacters = []; // Store original characters array
let config = {};
let nextAnswerBuffer = ''; // carry typed text into the next question after showing feedback

const debugState = {
    events: [],
    maxEvents: 200
};

function logDebugEvent(type, detail = {}) {
    if (!config?.debug) return;
    const event = { ts: new Date().toISOString(), type, detail };
    debugState.events.push(event);
    if (debugState.events.length > debugState.maxEvents) {
        debugState.events.shift();
    }
    if (config.debugConsole) {
        console.debug('[Quiz]', type, detail);
    }
}

function initQuizDebugInterface() {
    window.__QUIZ_DEBUG__ = {
        events: debugState.events,
        log: logDebugEvent,
        clearEvents: () => { debugState.events.length = 0; },
        snapshot: () => ({
            mode,
            schedulerMode,
            currentQuestion,
            score,
            total,
            answered,
            config: {
                debug: Boolean(config?.debug),
                debugConsole: Boolean(config?.debugConsole)
            },
            schedulerStatsKey,
            adaptiveDeckState,
            batchModeState,
            feedModeState
        }),
        getSchedulerStats: (char, skillKey) => getSchedulerStats(char, skillKey || getCurrentSkillKey()),
        resetSchedulerStats: () => {
            schedulerStats = {};
            saveSchedulerStats();
        }
    };
}

// 3-column layout state for char-to-meaning-type mode
let previousQuestion = null;
let previousQuestionResult = null; // 'correct' or 'incorrect'
let upcomingQuestion = null;
let threeColumnInlineFeedback = null; // { message, type: 'correct' | 'incorrect' }

// 3-column layout state for translation modes (audio-to-meaning, text-to-meaning)
let translationPreviousQuestion = null;
let translationPreviousResult = null; // { grade: number, explanation: string, userAnswer: string }
let translationUpcomingQuestion = null;
let translationInlineFeedback = null; // { message, type: 'correct' | 'incorrect' }

// 3-column layout state for pinyin dictation modes (audio-to-pinyin, char-to-pinyin)
let pinyinDictationPreviousQuestion = null;
let pinyinDictationPreviousResult = null; // 'correct' | 'incorrect'
let pinyinDictationPreviousUserAnswer = null;
let pinyinDictationUpcomingQuestion = null;

// 3-column layout state for chunks modes (audio-to-meaning-chunks, text-to-meaning-chunks)
let chunksPreviousChunk = null;
let chunksPreviousResult = null; // { grade: number, userAnswer: string, colorCodedAnswer: string }
let chunksUpcomingChunk = null; // pre-computed next chunk

// DOM elements (initialized in initQuiz)
let questionDisplay, answerInput, checkBtn, feedback, hint, componentBreakdown;
let typeMode, choiceMode, fuzzyMode, fuzzyInput, strokeOrderMode, handwritingMode, drawCharMode, studyMode, radicalPracticeMode;
let audioSection;
let ttsSpeedSelect = null;
let radicalSelectedAnswers = [];
let questionAttemptRecorded = false;
let lastAnswerCorrect = false;
let showComponentBreakdown = true;
let componentPreferenceLoaded = false;
const COMPONENT_PREF_KEY = 'componentHintsEnabled';
let pendingNextQuestionTimeout = null;
let toneCyclerEnabled = true;
let toneCyclerStatusTimeout = null;
let componentPanelsHaveContent = false;
let previewQueueEnabled = false;
let previewQueue = [];
let previewQueueSize = 3;
let previewElement = null;
let previewListElement = null;
let previewApplicableModes = null;
let dictationParts = [];
let dictationPartElements = [];
let dictationTotalSyllables = 0;
let dictationMatchedSyllables = 0;
let dictationPrimaryPinyin = '';
let toneFlowStage = null;           // 'pinyin' | 'tone'
let toneFlowExpected = [];          // array of expected tone numbers
let toneFlowSyllables = [];         // array of pinyin syllables (e.g., ['tóng', 'zhù'])
let toneFlowChars = [];             // array of characters (e.g., ['同', '住'])
let toneFlowIndex = 0;              // current syllable index
let toneFlowUseFuzzy = false;
let toneFlowCompleted = [];         // tracks completed tones for progress display
let toneFlowCompletedPinyin = [];   // tracks completed pinyin for progress display

// Char-to-tones MC mode state (three-column layout with tone buttons)
let charToTonesMcIndex = 0;             // current character index
let charToTonesMcExpected = [];         // array of expected tone numbers (as strings)
let charToTonesMcChars = [];            // array of characters
let charToTonesMcPinyin = [];           // array of pinyin syllables
let charToTonesMcCompleted = [];        // completed tones so far
let charToTonesMcPreviousQuestion = null;
let charToTonesMcPreviousResult = null;  // 'correct' | 'incorrect'
let charToTonesMcUpcomingQuestion = null;
let charToTonesMcInlineFeedback = null;
let handwritingAnswerShown = false;
let handwritingSpaceDownTime = null;
let handwritingHoldTimeout = null;
let studyModeInitialized = false;
let drawModeInitialized = false;
let fullscreenDrawInitialized = false;

// Chunk mode state (audio-to-meaning-chunks)
let sentenceChunks = [];           // array of chunk objects { char, meaning (optional) }
let currentChunkIndex = 0;
let currentFullSentence = null;    // the full sentence object being chunked
const studyModeState = {
    searchRaw: '',
    searchQuery: '',
    sortBy: 'original',
    shuffleOrder: null
};

// Word marking state
// Markings: { [char]: 'learned' | 'needs-work' }
// Stored in localStorage per-page
let wordMarkings = {};
const WORD_MARKINGS_KEY_PREFIX = 'wordMarkings_';

function getWordMarkingsKey() {
    // Use page identifier from config or pathname
    const pageId = config?.pageId || window.location.pathname.replace(/\//g, '_').replace('.html', '');
    return WORD_MARKINGS_KEY_PREFIX + pageId;
}

function loadWordMarkings() {
    try {
        const key = getWordMarkingsKey();
        const stored = localStorage.getItem(key);
        if (stored) {
            wordMarkings = JSON.parse(stored);
        } else {
            wordMarkings = {};
        }
    } catch (e) {
        console.warn('Failed to load word markings:', e);
        wordMarkings = {};
    }
}

function saveWordMarkings() {
    try {
        const key = getWordMarkingsKey();
        localStorage.setItem(key, JSON.stringify(wordMarkings));
    } catch (e) {
        console.warn('Failed to save word markings:', e);
    }
}

function markWord(char, marking) {
    if (!char) return;
    if (marking === null || marking === undefined) {
        delete wordMarkings[char];
    } else {
        wordMarkings[char] = marking;
    }
    saveWordMarkings();
    // Refresh UI to show marking indicator
    refreshMarkingIndicator();
}

function getWordMarking(char) {
    return wordMarkings[char] || null;
}

function refreshMarkingIndicator() {
    // Update the marking indicator in the current question display
    const indicator = document.querySelector('.word-marking-indicator');
    if (!indicator && currentQuestion) {
        // Will be added when question is rendered
        return;
    }
    if (indicator && currentQuestion) {
        const marking = getWordMarking(currentQuestion.char);
        if (marking === 'learned') {
            indicator.textContent = '✓ Learned';
            indicator.className = 'word-marking-indicator marking-learned';
            indicator.style.display = 'inline-block';
        } else if (marking === 'needs-work') {
            indicator.textContent = '⚠ Needs Work';
            indicator.className = 'word-marking-indicator marking-needs-work';
            indicator.style.display = 'inline-block';
        } else {
            indicator.style.display = 'none';
        }
    }
}

function showMarkingToast(message, type = 'info') {
    // Show a brief toast notification for marking actions
    let toast = document.querySelector('.marking-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'marking-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `marking-toast toast-${type}`;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 1500);
}

// Composer (multi-stage) mode state
let composerEnabled = false;
let composerStageIndex = 0;
let composerPipeline = [];

// Ensure a mode button exists; if missing, append one using an existing button as a style template
function ensureModeButton(mode, label) {
    if (!mode) return;
    const existing = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
    if (existing) return;

    const container = document.querySelector('.sidebar nav') ||
        document.querySelector('nav') ||
        document.querySelector('.flex.flex-col.gap-2') ||
        document.querySelector('.flex.flex-wrap.gap-2');
    if (!container) return;

    const template = document.querySelector('.mode-btn');
    const btn = document.createElement('button');
    btn.className = template
        ? template.className.replace(/\bactive\b/g, '')
        : 'mode-btn px-3 py-2 rounded-lg border-2 border-gray-300 hover:bg-gray-100 transition text-left text-sm';
    btn.dataset.mode = mode;
    btn.textContent = label || mode;
    container.appendChild(btn);
}

// Composer helpers -----------------------------------------------------------
const DEFAULT_COMPOSER_PIPELINE = [
    { mode: 'char-to-meaning-type', label: 'Meaning (type)' },
    { mode: 'char-to-pinyin-type', label: 'Pinyin (MC)' },
    { mode: 'char-to-pinyin-tones-mc', label: 'Pinyin → Tones' },
    { mode: 'audio-to-meaning', label: 'Audio → Meaning' },
    { mode: 'char-to-tones', label: 'Char → Tones' }
];

function getComposerStageKey() {
    return `composerStage::${getAdaptivePageKey()}`;
}

function getComposerEnabledKey() {
    return `composerEnabled::${getAdaptivePageKey()}`;
}

function loadComposerState() {
    try {
        composerEnabled = localStorage.getItem(getComposerEnabledKey()) === '1';
        const stage = parseInt(localStorage.getItem(getComposerStageKey()), 10);
        composerStageIndex = Number.isFinite(stage) ? Math.max(0, stage) : 0;
    } catch (e) {
        composerEnabled = false;
        composerStageIndex = 0;
    }
}

function saveComposerState() {
    try {
        localStorage.setItem(getComposerEnabledKey(), composerEnabled ? '1' : '0');
        localStorage.setItem(getComposerStageKey(), String(composerStageIndex));
    } catch (e) {}
}

function buildComposerPipeline() {
    const availableModes = new Set(Array.from(document.querySelectorAll('.mode-btn[data-mode]')).map(b => b.dataset.mode));
    composerPipeline = DEFAULT_COMPOSER_PIPELINE.filter(step => availableModes.has(step.mode));
    if (!composerPipeline.length && DEFAULT_COMPOSER_PIPELINE.length) {
        composerPipeline = DEFAULT_COMPOSER_PIPELINE.slice(0, 1);
    }
    composerStageIndex = Math.min(composerStageIndex, Math.max(0, composerPipeline.length - 1));
}

function getComposerCurrentStage() {
    if (!composerPipeline.length) return null;
    return composerPipeline[Math.min(composerStageIndex, composerPipeline.length - 1)];
}

function setComposerEnabled(enabled) {
    composerEnabled = enabled;
    saveComposerState();
    updateComposerStatusDisplay();
}

function syncModeLayoutState() {
    const root = document.body;
    if (!root) return;
    const layout = getModeConfig().layout;
    root.classList.toggle('study-mode-active', layout === 'study');
    root.classList.toggle('dictation-chat-active', layout === 'chat');
}

// Timer state
let timerEnabled = false;
let timerSeconds = 10;
let timerIntervalId = null;
let timerRemainingSeconds = 0;
const TIMER_ENABLED_KEY = 'quizTimerEnabled';
const TIMER_SECONDS_KEY = 'quizTimerSeconds';

let charGlossMap = null;
let charGlossLoaded = false;
let charGlossPromise = null;

// Scheduler state (session-level ordering)
const SCHEDULER_MODE_KEY = 'quiz_scheduler_mode';
const SCHEDULER_MODES = {
    RANDOM: 'random',
    WEIGHTED: 'weighted',
    ADAPTIVE_5: 'adaptive-5',
    BATCH_5: 'batch-5',
    BATCH_2: 'batch-2',
    ORDERED: 'ordered',
    FEED: 'feed',
    FEED_SR: 'feed-sr'
};
let schedulerMode = SCHEDULER_MODES.WEIGHTED;
let schedulerStats = {}; // per-char-per-skill data (persisted to localStorage)
let schedulerStatsKey = ''; // localStorage key for schedulerStats
const SCHEDULER_STATS_KEY_PREFIX = 'quiz_scheduler_stats_';
let schedulerOutcomeRecordedChar = null;
let schedulerOrderedIndex = 0;
const BATCH_STATE_KEY_PREFIX = 'quiz_batch_state_';
const BATCH_INITIAL_SIZE = 5;
const BATCH_COMBINED_SIZE = 10;
const BATCH_2_INITIAL_SIZE = 2;
const BATCH_2_COMBINED_SIZE = 4;
const BATCH_TOAST_ID = 'batchModeToast';
let confettiStyleInjected = false;
const BATCH_MASTER_MIN_STREAK = 2;
const BATCH_MASTER_MIN_ACCURACY = 0.72;
const BATCH_MASTER_MIN_SEEN = 3;
const CONFIDENCE_GOAL = 5; // target confidence to celebrate across all words
const BATCH_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12; // reset batch runs after 12h
const BATCH_DEFAULT_STATE = {
    activeBatch: [],
    usedChars: [],
    batchIndex: 0,
    cycleCount: 0,
    seenInBatch: [],
    lastStartedAt: 0
};
let batchStateKey = '';
let batchModeState = {
    activeBatch: [],
    usedChars: [],
    batchIndex: 0,
    cycleCount: 0,
    seenInBatch: [] // chars served at least once in the current batch
};

// Visual celebration timers
let correctFlashTimeout = null;
let correctToastTimeout = null;

// Adaptive rolling 5-card deck state
const ADAPTIVE_STATE_KEY_PREFIX = 'quiz_adaptive_state_';
const ADAPTIVE_DECK_SIZE = 5;
const ADAPTIVE_MIN_DECK_SIZE = 3;  // minimum cards to keep variety, pulls from mastered if needed
const ADAPTIVE_GRAD_CONFIDENCE = 4.2;
const ADAPTIVE_GRAD_MIN_SERVED = 3;
const ADAPTIVE_GRAD_MIN_STREAK = 2;
let adaptiveStateKey = '';
let adaptiveDeckState = {
    deck: [],
    mastered: [],
    cycleCount: 0
};

// Feed mode state (explore/exploit with flexible hand)
const FEED_STATE_KEY_PREFIX = 'quiz_feed_state_';
const FEED_UCB_C = 1.5;                    // exploration constant for UCB
const FEED_MIN_HAND_SIZE = 3;              // minimum cards in hand
const FEED_MAX_HAND_SIZE = 10;             // maximum cards in hand
const FEED_DEFAULT_HAND_SIZE = 5;          // target when balanced
const FEED_STREAK_TO_REMOVE = 2;           // correct streak to remove from hand
const FEED_WEAK_THRESHOLD = 0.6;           // confidence below this = "weak"
const FEED_SR_MIN_SESSION_ATTEMPTS = 2;    // minimum attempts this session before SR graduation
let feedStateKey = '';
let feedModeState = {
    hand: [],                              // current active cards (flexible size)
    seen: {},                              // { char: { attempts, correct, streak, lastSeen } }
    totalPulls: 0                          // total questions asked
};

// Confidence sidebar state
const CONFIDENCE_PANEL_KEY = 'quiz_confidence_panel_visible';

// Quiz mode persistence (per-page)
const QUIZ_MODE_KEY_PREFIX = 'quiz_mode_';
const HIDE_MEANING_CHOICES_KEY = 'quiz_hide_meaning_choices';
const CONFIDENCE_TRACKING_ENABLED_KEY = 'quiz_confidence_tracking_enabled';
const CONFIDENCE_FORMULA_KEY = 'quiz_confidence_formula';
const CONFIDENCE_RENDER_LIMIT = 150;          // cap list rendering to avoid huge DOM on big decks
const CONFIDENCE_AUTO_HIDE_THRESHOLD = 400;   // default-hide tracker when deck exceeds this size
let confidencePanel = null;
let confidenceListElement = null;
let confidenceSummaryElement = null;
let confidencePanelVisible = true;
let hideMeaningChoices = false;
let confidenceTrackingEnabled = true;

// Confidence formula modes
const CONFIDENCE_FORMULAS = {
    HEURISTIC: 'heuristic',  // Original ad-hoc formula
    BKT: 'bkt'               // Bayesian Knowledge Tracing
};
let confidenceFormula = CONFIDENCE_FORMULAS.BKT;


const MODE_CONFIG = {
    'study': { layout: 'study' },
    'dictation-chat': { layout: 'chat' },
    'missing-component': { deferServing: true, customQuestion: true },
    'draw-missing-component': { deferServing: true, customQuestion: true },
    'char-building': { deferServing: true, customQuestion: true },
    'radical-practice': { deferServing: true, customQuestion: true }
};

function getModeConfig(activeMode = mode) {
    return MODE_CONFIG[activeMode] || {};
}

// BKT (Bayesian Knowledge Tracing) parameters
// These model within-session learning probability
const BKT_PARAMS = {
    P_L0: 0.0,    // Prior: probability of knowing before any exposure
    P_T: 0.2,     // Transit: probability of learning per attempt
    P_G: 0.25,    // Guess: probability of correct answer without knowing (1/4 for 4 choices)
    P_S: 0.08     // Slip: probability of wrong answer despite knowing
};
const BKT_MASTERY_THRESHOLD = 0.85;  // P(Learned) >= this means "mastered"

// Hanzi Writer
let writer = null;
const HANZI_WRITER_CDN = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';
let hanziWriterReadyPromise = null;

function ensureHanziWriterLoaded() {
    if (typeof HanziWriter !== 'undefined') return Promise.resolve();
    if (hanziWriterReadyPromise) return hanziWriterReadyPromise;

    hanziWriterReadyPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = HANZI_WRITER_CDN;
        script.async = true;
        script.onload = () => {
            if (typeof HanziWriter !== 'undefined') {
                resolve();
            } else {
                reject(new Error('Hanzi Writer script loaded but window.HanziWriter is missing'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load Hanzi Writer script'));
        document.head.appendChild(script);
    });

    return hanziWriterReadyPromise;
}

// Canvas drawing variables
let canvas, ctx;
let isDrawing = false;
let lastX, lastY;
let strokes = [];
let undoneStrokes = [];
let currentStroke = null;
let ocrTimeout = null;
let drawStartTime = null;
let canvasScale = 1;
let canvasOffsetX = 0;
let canvasOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// Missing Component mode state
let missingComponentMode = null;
let currentMissingComponent = null;

// Character decomposition database for missing component quiz
// Each entry: char -> { components: [{ char, pinyin, meaning }], type: 'lr'|'tb'|'surround'|'other' }
// type: lr = left-right, tb = top-bottom, surround = enclosure, other = complex
const CHARACTER_DECOMPOSITIONS = {
    // Common radicals/components for distractors
    '_radicals': [
        { char: '亻', pinyin: 'rén', meaning: 'person' },
        { char: '氵', pinyin: 'shuǐ', meaning: 'water' },
        { char: '扌', pinyin: 'shǒu', meaning: 'hand' },
        { char: '口', pinyin: 'kǒu', meaning: 'mouth' },
        { char: '木', pinyin: 'mù', meaning: 'wood' },
        { char: '火', pinyin: 'huǒ', meaning: 'fire' },
        { char: '土', pinyin: 'tǔ', meaning: 'earth' },
        { char: '金', pinyin: 'jīn', meaning: 'metal' },
        { char: '日', pinyin: 'rì', meaning: 'sun' },
        { char: '月', pinyin: 'yuè', meaning: 'moon' },
        { char: '心', pinyin: 'xīn', meaning: 'heart' },
        { char: '女', pinyin: 'nǚ', meaning: 'woman' },
        { char: '子', pinyin: 'zǐ', meaning: 'child' },
        { char: '宀', pinyin: 'mián', meaning: 'roof' },
        { char: '门', pinyin: 'mén', meaning: 'door' },
        { char: '讠', pinyin: 'yán', meaning: 'speech' },
        { char: '饣', pinyin: 'shí', meaning: 'food' },
        { char: '车', pinyin: 'chē', meaning: 'vehicle' },
        { char: '艹', pinyin: 'cǎo', meaning: 'grass' },
        { char: '竹', pinyin: 'zhú', meaning: 'bamboo' },
        { char: '力', pinyin: 'lì', meaning: 'power' },
        { char: '工', pinyin: 'gōng', meaning: 'work' },
        { char: '贝', pinyin: 'bèi', meaning: 'shell' },
        { char: '页', pinyin: 'yè', meaning: 'page' },
        { char: '走', pinyin: 'zǒu', meaning: 'walk' },
        { char: '足', pinyin: 'zú', meaning: 'foot' },
        { char: '目', pinyin: 'mù', meaning: 'eye' },
        { char: '耳', pinyin: 'ěr', meaning: 'ear' },
        { char: '田', pinyin: 'tián', meaning: 'field' },
        { char: '石', pinyin: 'shí', meaning: 'stone' },
        { char: '山', pinyin: 'shān', meaning: 'mountain' },
        { char: '禾', pinyin: 'hé', meaning: 'grain' },
        { char: '米', pinyin: 'mǐ', meaning: 'rice' },
        { char: '糸', pinyin: 'sī', meaning: 'silk' },
        { char: '言', pinyin: 'yán', meaning: 'speech' },
        { char: '食', pinyin: 'shí', meaning: 'food' },
        { char: '衣', pinyin: 'yī', meaning: 'clothing' },
        { char: '刂', pinyin: 'dāo', meaning: 'knife' },
        { char: '阝', pinyin: 'fù', meaning: 'mound' },
        { char: '冖', pinyin: 'mì', meaning: 'cover' },
        { char: '厂', pinyin: 'chǎng', meaning: 'factory' },
        { char: '广', pinyin: 'guǎng', meaning: 'wide' },
        { char: '户', pinyin: 'hù', meaning: 'door' },
        { char: '尸', pinyin: 'shī', meaning: 'corpse' },
        { char: '王', pinyin: 'wáng', meaning: 'king' },
        { char: '大', pinyin: 'dà', meaning: 'big' },
        { char: '小', pinyin: 'xiǎo', meaning: 'small' },
        { char: '人', pinyin: 'rén', meaning: 'person' },
        { char: '八', pinyin: 'bā', meaning: 'eight' },
        { char: '十', pinyin: 'shí', meaning: 'ten' },
        { char: '一', pinyin: 'yī', meaning: 'one' }
    ],
    // Lesson 7 characters with decompositions and stroke matches
    // matches: array where each element indicates which component (0 or 1) that stroke belongs to
    '住': {
        components: [
            { char: '亻', pinyin: 'rén', meaning: 'person' },
            { char: '主', pinyin: 'zhǔ', meaning: 'master' }
        ],
        type: 'lr',
        matches: [0,0,1,1,1,1,1]
    },
    '同': {
        components: [
            { char: '冂', pinyin: 'jiōng', meaning: 'borders' },
            { char: '口', pinyin: 'kǒu', meaning: 'mouth' }
        ],
        type: 'surround',
        matches: [0,0,0,1,1,1]
    },
    '起': {
        components: [
            { char: '走', pinyin: 'zǒu', meaning: 'walk' },
            { char: '己', pinyin: 'jǐ', meaning: 'self' }
        ],
        type: 'other',
        matches: [0,0,0,0,0,0,0,1,1,1]
    },
    '期': {
        components: [
            { char: '其', pinyin: 'qí', meaning: 'its' },
            { char: '月', pinyin: 'yuè', meaning: 'moon' }
        ],
        type: 'lr',
        matches: [0,0,0,0,0,0,0,0,1,1,1,1]
    },
    '寓': {
        components: [
            { char: '宀', pinyin: 'mián', meaning: 'roof' },
            { char: '禺', pinyin: 'yú', meaning: 'area' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1,1,1,1,1,1,1]
    },
    '宿': {
        components: [
            { char: '宀', pinyin: 'mián', meaning: 'roof' },
            { char: '佰', pinyin: 'bǎi', meaning: 'hundred' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1,1,1,1,1,1]
    },
    '舍': {
        components: [
            { char: '人', pinyin: 'rén', meaning: 'person' },
            { char: '舌', pinyin: 'shé', meaning: 'tongue' }
        ],
        type: 'tb',
        matches: [0,0,1,1,1,1,1,1]
    },
    '便': {
        components: [
            { char: '亻', pinyin: 'rén', meaning: 'person' },
            { char: '更', pinyin: 'gēng', meaning: 'change' }
        ],
        type: 'lr',
        matches: [0,0,1,1,1,1,1,1,1]
    },
    '搬': {
        components: [
            { char: '扌', pinyin: 'shǒu', meaning: 'hand' },
            { char: '般', pinyin: 'bān', meaning: 'sort' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1,1,1,1,1,1,1,1]
    },
    '吃': {
        components: [
            { char: '口', pinyin: 'kǒu', meaning: 'mouth' },
            { char: '乞', pinyin: 'qǐ', meaning: 'beg' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1]
    },
    '饭': {
        components: [
            { char: '饣', pinyin: 'shí', meaning: 'food' },
            { char: '反', pinyin: 'fǎn', meaning: 'opposite' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1,1]
    },
    '问': {
        components: [
            { char: '门', pinyin: 'mén', meaning: 'door' },
            { char: '口', pinyin: 'kǒu', meaning: 'mouth' }
        ],
        type: 'surround',
        matches: [0,0,0,1,1,1]
    },
    '题': {
        components: [
            { char: '是', pinyin: 'shì', meaning: 'is' },
            { char: '页', pinyin: 'yè', meaning: 'page' }
        ],
        type: 'lr',
        matches: [0,0,0,0,0,0,0,0,0,1,1,1,1,1,1]
    },
    '厨': {
        components: [
            { char: '厂', pinyin: 'chǎng', meaning: 'factory' },
            { char: '寸', pinyin: 'cùn', meaning: 'inch' }
        ],
        type: 'other'
        // Complex matches with nested components - skip for now
    },
    '房': {
        components: [
            { char: '户', pinyin: 'hù', meaning: 'door' },
            { char: '方', pinyin: 'fāng', meaning: 'square' }
        ],
        type: 'other',
        matches: [0,0,0,0,1,1,1,1]
    },
    '定': {
        components: [
            { char: '宀', pinyin: 'mián', meaning: 'roof' },
            { char: '正', pinyin: 'zhèng', meaning: 'correct' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1,1,1]
    },
    '堂': {
        components: [
            { char: '尚', pinyin: 'shàng', meaning: 'still' },
            { char: '土', pinyin: 'tǔ', meaning: 'earth' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,0,0,0,1,1,1]
    },
    '贵': {
        components: [
            { char: '中', pinyin: 'zhōng', meaning: 'middle' },
            { char: '贝', pinyin: 'bèi', meaning: 'shell' }
        ],
        type: 'tb'
        // Complex nested matches - skip for now
    },
    '好': {
        components: [
            { char: '女', pinyin: 'nǚ', meaning: 'woman' },
            { char: '子', pinyin: 'zǐ', meaning: 'child' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1]
    },
    '每': {
        components: [
            { char: '人', pinyin: 'rén', meaning: 'person' },
            { char: '母', pinyin: 'mǔ', meaning: 'mother' }
        ],
        type: 'tb'
        // Has null values in matches - skip for now
    },
    '天': {
        components: [
            { char: '一', pinyin: 'yī', meaning: 'one' },
            { char: '大', pinyin: 'dà', meaning: 'big' }
        ],
        type: 'tb',
        matches: [0,1,1,1]
    },
    '挑': {
        components: [
            { char: '扌', pinyin: 'shǒu', meaning: 'hand' },
            { char: '兆', pinyin: 'zhào', meaning: 'omen' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1,1,1,1]
    },
    '剔': {
        components: [
            { char: '易', pinyin: 'yì', meaning: 'easy' },
            { char: '刂', pinyin: 'dāo', meaning: 'knife' }
        ],
        type: 'lr',
        matches: [0,0,0,0,0,0,0,0,1,1]
    },
    '功': {
        components: [
            { char: '工', pinyin: 'gōng', meaning: 'work' },
            { char: '力', pinyin: 'lì', meaning: 'power' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1]
    },
    '课': {
        components: [
            { char: '讠', pinyin: 'yán', meaning: 'speech' },
            { char: '果', pinyin: 'guǒ', meaning: 'fruit' }
        ],
        type: 'lr',
        matches: [0,0,1,1,1,1,1,1,1,1]
    },
    '怎': {
        components: [
            { char: '乍', pinyin: 'zhà', meaning: 'suddenly' },
            { char: '心', pinyin: 'xīn', meaning: 'heart' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,1,1,1,1]
    },
    '时': {
        components: [
            { char: '日', pinyin: 'rì', meaning: 'sun' },
            { char: '寸', pinyin: 'cùn', meaning: 'inch' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1]
    },
    '间': {
        components: [
            { char: '门', pinyin: 'mén', meaning: 'door' },
            { char: '日', pinyin: 'rì', meaning: 'sun' }
        ],
        type: 'surround',
        matches: [0,0,0,1,1,1,1]
    },
    '菜': {
        components: [
            { char: '艹', pinyin: 'cǎo', meaning: 'grass' },
            { char: '采', pinyin: 'cǎi', meaning: 'pick' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1,1,1,1,1,1]
    },
    '轮': {
        components: [
            { char: '车', pinyin: 'chē', meaning: 'vehicle' },
            { char: '仑', pinyin: 'lún', meaning: 'order' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1,1]
    },
    '流': {
        components: [
            { char: '氵', pinyin: 'shuǐ', meaning: 'water' },
            { char: '㐬', pinyin: 'liú', meaning: 'flow' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1,1,1,1,1]
    },
    '晚': {
        components: [
            { char: '日', pinyin: 'rì', meaning: 'sun' },
            { char: '免', pinyin: 'miǎn', meaning: 'exempt' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1,1,1,1,1]
    },
    '早': {
        components: [
            { char: '日', pinyin: 'rì', meaning: 'sun' },
            { char: '十', pinyin: 'shí', meaning: 'ten' }
        ],
        type: 'tb',
        matches: [0,0,0,0,1,1]
    },
    '明': {
        components: [
            { char: '日', pinyin: 'rì', meaning: 'sun' },
            { char: '月', pinyin: 'yuè', meaning: 'moon' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1,1]
    },
    '治': {
        components: [
            { char: '氵', pinyin: 'shuǐ', meaning: 'water' },
            { char: '台', pinyin: 'tái', meaning: 'platform' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1,1,1]
    },
    '简': {
        components: [
            { char: '竹', pinyin: 'zhú', meaning: 'bamboo' },
            { char: '间', pinyin: 'jiān', meaning: 'between' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,0,1,1,1,1,1,1,1]
    },
    '单': {
        components: [
            { char: '丷', pinyin: 'bā', meaning: 'eight' },
            { char: '甲', pinyin: 'jiǎ', meaning: 'armor' }
        ],
        type: 'tb',
        matches: [0,0,1,1,1,1,1,1]
    },
    // Additional characters for better coverage
    '从': {
        components: [
            { char: '人', pinyin: 'rén', meaning: 'person' },
            { char: '人', pinyin: 'rén', meaning: 'person' }
        ],
        type: 'lr',
        matches: [0,0,1,1]
    },
    '学': {
        components: [
            { char: '⺍', pinyin: 'xuě', meaning: 'cover' },
            { char: '子', pinyin: 'zǐ', meaning: 'child' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,1,1,1]
    },
    '公': {
        components: [
            { char: '八', pinyin: 'bā', meaning: 'eight' },
            { char: '厶', pinyin: 'sī', meaning: 'private' }
        ],
        type: 'tb',
        matches: [0,0,1,1]
    },
    '方': {
        components: [
            { char: '丶', pinyin: 'diǎn', meaning: 'dot' },
            { char: '万', pinyin: 'wàn', meaning: 'ten thousand' }
        ],
        type: 'tb',
        matches: [0,1,1,1]
    },
    '出': {
        components: [
            { char: '山', pinyin: 'shān', meaning: 'mountain' },
            { char: '凵', pinyin: 'kǎn', meaning: 'container' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1]
    },
    '去': {
        components: [
            { char: '土', pinyin: 'tǔ', meaning: 'earth' },
            { char: '厶', pinyin: 'sī', meaning: 'private' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1]
    },
    '食': {
        components: [
            { char: '人', pinyin: 'rén', meaning: 'person' },
            { char: '良', pinyin: 'liáng', meaning: 'good' }
        ],
        type: 'tb',
        matches: [0,0,1,1,1,1,1,1,1]
    },
    '贵': {
        components: [
            { char: '中', pinyin: 'zhōng', meaning: 'middle' },
            { char: '贝', pinyin: 'bèi', meaning: 'shell' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,1,1,1,1]
    },
    '每': {
        components: [
            { char: '𠂉', pinyin: 'piě', meaning: 'slash' },
            { char: '母', pinyin: 'mǔ', meaning: 'mother' }
        ],
        type: 'tb',
        matches: [0,1,1,1,1,1,1]
    },
    '买': {
        components: [
            { char: '乛', pinyin: 'yǐ', meaning: 'twist' },
            { char: '头', pinyin: 'tóu', meaning: 'head' }
        ],
        type: 'tb',
        matches: [0,1,1,1,1,1]
    },
    '受': {
        components: [
            { char: '爫', pinyin: 'zhǎo', meaning: 'claw' },
            { char: '又', pinyin: 'yòu', meaning: 'again' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1,1,1]
    },
    '不': {
        components: [
            { char: '一', pinyin: 'yī', meaning: 'one' },
            { char: '卜', pinyin: 'bǔ', meaning: 'divine' }
        ],
        type: 'tb',
        matches: [0,1,1,1]
    },
    '了': {
        components: [
            { char: '乛', pinyin: 'yǐ', meaning: 'twist' },
            { char: '亅', pinyin: 'jué', meaning: 'hook' }
        ],
        type: 'tb',
        matches: [0,1]
    },
    '么': {
        components: [
            { char: '丿', pinyin: 'piě', meaning: 'slash' },
            { char: '厶', pinyin: 'sī', meaning: 'private' }
        ],
        type: 'tb',
        matches: [0,1,1]
    },
    '中': {
        components: [
            { char: '口', pinyin: 'kǒu', meaning: 'mouth' },
            { char: '丨', pinyin: 'gǔn', meaning: 'line' }
        ],
        type: 'other',
        matches: [0,0,0,1]
    },
    '三': {
        components: [
            { char: '一', pinyin: 'yī', meaning: 'one' },
            { char: '二', pinyin: 'èr', meaning: 'two' }
        ],
        type: 'tb',
        matches: [0,1,1]
    },
    '厨': {
        components: [
            { char: '厂', pinyin: 'chǎng', meaning: 'cliff' },
            { char: '豆', pinyin: 'dòu', meaning: 'bean' }
        ],
        type: 'other',
        matches: [0,1,1,1,1,1,1,1,1,1,1,1]
    },
    // Lesson 7 Part 2 characters
    '容': {
        components: [
            { char: '宀', pinyin: 'mián', meaning: 'roof' },
            { char: '谷', pinyin: 'gǔ', meaning: 'valley' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1,1,1,1,1]
    },
    '易': {
        components: [
            { char: '日', pinyin: 'rì', meaning: 'sun' },
            { char: '勿', pinyin: 'wù', meaning: 'not' }
        ],
        type: 'tb',
        matches: [0,0,0,0,1,1,1,1]
    },
    '决': {
        components: [
            { char: '冫', pinyin: 'bīng', meaning: 'ice' },
            { char: '夬', pinyin: 'guài', meaning: 'decisive' }
        ],
        type: 'lr',
        matches: [0,0,1,1,1,1]
    },
    '带': {
        components: [
            { char: '卅', pinyin: 'sà', meaning: 'thirty' },
            { char: '巾', pinyin: 'jīn', meaning: 'cloth' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,0,1,1,1]
    },
    '样': {
        components: [
            { char: '木', pinyin: 'mù', meaning: 'wood' },
            { char: '羊', pinyin: 'yáng', meaning: 'sheep' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1,1,1,1]
    },
    '用': {
        components: [
            { char: '冂', pinyin: 'jiōng', meaning: 'borders' },
            { char: '卜', pinyin: 'bǔ', meaning: 'divine' }
        ],
        type: 'other',
        matches: [0,0,1,1,1]
    },
    '具': {
        components: [
            { char: '目', pinyin: 'mù', meaning: 'eye' },
            { char: '八', pinyin: 'bā', meaning: 'eight' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,1,1,1]
    },
    '微': {
        components: [
            { char: '彳', pinyin: 'chì', meaning: 'step' },
            { char: '攵', pinyin: 'pū', meaning: 'strike' }
        ],
        type: 'other',
        matches: [0,0,0,1,1,1,1,1,1,1,1,1,1]
    },
    '波': {
        components: [
            { char: '氵', pinyin: 'shuǐ', meaning: 'water' },
            { char: '皮', pinyin: 'pí', meaning: 'skin' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1,1,1]
    },
    '炉': {
        components: [
            { char: '火', pinyin: 'huǒ', meaning: 'fire' },
            { char: '户', pinyin: 'hù', meaning: 'door' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1,1]
    },
    '行': {
        components: [
            { char: '彳', pinyin: 'chì', meaning: 'step' },
            { char: '亍', pinyin: 'chù', meaning: 'step' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1]
    },
    '久': {
        components: [
            { char: '丿', pinyin: 'piě', meaning: 'slash' },
            { char: '乂', pinyin: 'yì', meaning: 'govern' }
        ],
        type: 'other',
        matches: [0,1,1]
    },
    '坏': {
        components: [
            { char: '土', pinyin: 'tǔ', meaning: 'earth' },
            { char: '不', pinyin: 'bù', meaning: 'not' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1,1]
    },
    '家': {
        components: [
            { char: '宀', pinyin: 'mián', meaning: 'roof' },
            { char: '豕', pinyin: 'shǐ', meaning: 'pig' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1,1,1,1,1]
    },
    '床': {
        components: [
            { char: '广', pinyin: 'guǎng', meaning: 'wide' },
            { char: '木', pinyin: 'mù', meaning: 'wood' }
        ],
        type: 'other',
        matches: [0,0,0,1,1,1,1]
    },
    '桌': {
        components: [
            { char: '卜', pinyin: 'bǔ', meaning: 'divine' },
            { char: '木', pinyin: 'mù', meaning: 'wood' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,0,1,1,1,1]
    },
    '书': {
        components: [
            { char: '乛', pinyin: 'yǐ', meaning: 'twist' },
            { char: '丶', pinyin: 'diǎn', meaning: 'dot' }
        ],
        type: 'other',
        matches: [0,0,0,1]
    },
    '架': {
        components: [
            { char: '加', pinyin: 'jiā', meaning: 'add' },
            { char: '木', pinyin: 'mù', meaning: 'wood' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,1,1,1,1]
    },
    '把': {
        components: [
            { char: '扌', pinyin: 'shǒu', meaning: 'hand' },
            { char: '巴', pinyin: 'bā', meaning: 'hope' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1,1]
    },
    '椅': {
        components: [
            { char: '木', pinyin: 'mù', meaning: 'wood' },
            { char: '奇', pinyin: 'qí', meaning: 'strange' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1,1,1,1,1,1]
    },
    '台': {
        components: [
            { char: '厶', pinyin: 'sī', meaning: 'private' },
            { char: '口', pinyin: 'kǒu', meaning: 'mouth' }
        ],
        type: 'tb',
        matches: [0,0,1,1,1]
    },
    '灯': {
        components: [
            { char: '火', pinyin: 'huǒ', meaning: 'fire' },
            { char: '丁', pinyin: 'dīng', meaning: 'nail' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1]
    },
    '地': {
        components: [
            { char: '土', pinyin: 'tǔ', meaning: 'earth' },
            { char: '也', pinyin: 'yě', meaning: 'also' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1]
    },
    '毯': {
        components: [
            { char: '毛', pinyin: 'máo', meaning: 'fur' },
            { char: '炎', pinyin: 'yán', meaning: 'flame' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1,1,1,1,1,1]
    },
    '要': {
        components: [
            { char: '覀', pinyin: 'xī', meaning: 'west' },
            { char: '女', pinyin: 'nǚ', meaning: 'woman' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,0,1,1,1]
    },
    '紧': {
        components: [
            { char: '臤', pinyin: 'qiān', meaning: 'firm' },
            { char: '糸', pinyin: 'sī', meaning: 'silk' }
        ],
        type: 'tb',
        matches: [0,0,0,0,0,0,0,1,1,1]
    },
    '对': {
        components: [
            { char: '又', pinyin: 'yòu', meaning: 'again' },
            { char: '寸', pinyin: 'cùn', meaning: 'inch' }
        ],
        type: 'lr',
        matches: [0,0,1,1,1]
    },
    '合': {
        components: [
            { char: '人', pinyin: 'rén', meaning: 'person' },
            { char: '口', pinyin: 'kǒu', meaning: 'mouth' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1]
    },
    '认': {
        components: [
            { char: '讠', pinyin: 'yán', meaning: 'speech' },
            { char: '人', pinyin: 'rén', meaning: 'person' }
        ],
        type: 'lr',
        matches: [0,0,1,1]
    },
    '识': {
        components: [
            { char: '讠', pinyin: 'yán', meaning: 'speech' },
            { char: '只', pinyin: 'zhī', meaning: 'only' }
        ],
        type: 'lr',
        matches: [0,0,1,1,1,1,1]
    },
    '年': {
        components: [
            { char: '丿', pinyin: 'piě', meaning: 'slash' },
            { char: '干', pinyin: 'gān', meaning: 'dry' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1]
    },
    '级': {
        components: [
            { char: '纟', pinyin: 'sī', meaning: 'silk' },
            { char: '及', pinyin: 'jí', meaning: 'reach' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1]
    },
    '太': {
        components: [
            { char: '大', pinyin: 'dà', meaning: 'big' },
            { char: '丶', pinyin: 'diǎn', meaning: 'dot' }
        ],
        type: 'other',
        matches: [0,0,0,1]
    },
    '浴': {
        components: [
            { char: '氵', pinyin: 'shuǐ', meaning: 'water' },
            { char: '谷', pinyin: 'gǔ', meaning: 'valley' }
        ],
        type: 'lr',
        matches: [0,0,0,1,1,1,1,1,1,1]
    },
    '室': {
        components: [
            { char: '宀', pinyin: 'mián', meaning: 'roof' },
            { char: '至', pinyin: 'zhì', meaning: 'arrive' }
        ],
        type: 'tb',
        matches: [0,0,0,1,1,1,1,1,1]
    },
    '厕': {
        components: [
            { char: '厂', pinyin: 'chǎng', meaning: 'cliff' },
            { char: '则', pinyin: 'zé', meaning: 'rule' }
        ],
        type: 'other',
        matches: [0,1,1,1,1,1,1,1]
    },
    '所': {
        components: [
            { char: '户', pinyin: 'hù', meaning: 'door' },
            { char: '斤', pinyin: 'jīn', meaning: 'axe' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1,1]
    },
    '最': {
        components: [
            { char: '日', pinyin: 'rì', meaning: 'sun' },
            { char: '取', pinyin: 'qǔ', meaning: 'take' }
        ],
        type: 'tb',
        matches: [0,0,0,0,1,1,1,1,1,1,1,1]
    },
    '考': {
        components: [
            { char: '耂', pinyin: 'lǎo', meaning: 'old' },
            { char: '丂', pinyin: 'kǎo', meaning: 'breath' }
        ],
        type: 'tb',
        matches: [0,0,0,0,1,1]
    },
    '虑': {
        components: [
            { char: '虍', pinyin: 'hū', meaning: 'tiger' },
            { char: '思', pinyin: 'sī', meaning: 'think' }
        ],
        type: 'other',
        matches: [0,0,0,0,0,0,1,1,1,1]
    },
    '层': {
        components: [
            { char: '尸', pinyin: 'shī', meaning: 'corpse' },
            { char: '云', pinyin: 'yún', meaning: 'cloud' }
        ],
        type: 'other',
        matches: [0,0,0,1,1,1,1]
    },
    '楼': {
        components: [
            { char: '木', pinyin: 'mù', meaning: 'wood' },
            { char: '娄', pinyin: 'lóu', meaning: 'weak' }
        ],
        type: 'lr',
        matches: [0,0,0,0,1,1,1,1,1,1,1,1,1]
    },
    '可': {
        components: [
            { char: '丁', pinyin: 'dīng', meaning: 'nail' },
            { char: '口', pinyin: 'kǒu', meaning: 'mouth' }
        ],
        type: 'other',
        matches: [0,0,1,1,1]
    }
};

// Decomposition data loading state
let decompositionsLoaded = false;
let decompositionsLoading = false;
let decompositionsLoadPromise = null;

// Load character decompositions from external JSON file
async function loadDecompositionsData() {
    if (decompositionsLoaded) return;
    if (decompositionsLoading) {
        return decompositionsLoadPromise;
    }

    decompositionsLoading = true;
    decompositionsLoadPromise = (async () => {
        try {
            const response = await fetch('data/decompositions.json');
            if (!response.ok) {
                console.warn('Could not load decompositions.json:', response.status);
                return;
            }
            const data = await response.json();

            // Merge loaded data with existing inline data
            // Inline data takes precedence (for manual overrides)
            let count = 0;
            for (const [char, decomp] of Object.entries(data)) {
                if (char === '_radicals') continue; // Don't override radicals
                if (!CHARACTER_DECOMPOSITIONS[char]) {
                    CHARACTER_DECOMPOSITIONS[char] = decomp;
                    count++;
                }
            }
            console.log(`Loaded ${count} character decompositions from JSON`);
            decompositionsLoaded = true;
        } catch (err) {
            console.warn('Error loading decompositions data:', err);
        } finally {
            decompositionsLoading = false;
        }
    })();

    return decompositionsLoadPromise;
}

// Layout upgrade state
let lessonLayoutStylesInjected = false;
let legacyLessonLayoutUpgraded = false;

function injectLessonLayoutStyles() {
    if (lessonLayoutStylesInjected) return;
    const existing = document.querySelector('link[href$="lesson-layout.css"]');
    if (existing) {
        lessonLayoutStylesInjected = true;
        return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/lesson-layout.css';
    document.head.appendChild(link);
    lessonLayoutStylesInjected = true;
}

function upgradeLegacyLessonLayoutIfNeeded() {
    if (legacyLessonLayoutUpgraded) return;
    const body = document.body;
    if (!body) return;

    const alreadyExperimental = body.classList.contains('experimental-layout') || document.querySelector('.app-container');
    if (alreadyExperimental) {
        legacyLessonLayoutUpgraded = true;
        return;
    }

    const lessonMatch = (document.title || '').match(/Lesson\s+([1-6])/i);
    if (!lessonMatch) return;

    const question = document.getElementById('questionDisplay');
    const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
    if (!question || !modeButtons.length) return;

    const flexContainer = document.querySelector('.flex.min-h-screen') || document.querySelector('body > .flex');
    const sidebarWrapper = document.querySelector('.w-64 .mode-btn')?.closest('.w-64');
    const contentCard = question.closest('.max-w-3xl') || question.closest('.quiz-shell') || question.parentElement;

    injectLessonLayoutStyles();
    legacyLessonLayoutUpgraded = true;

    const fullscreenDrawContainer = document.getElementById('fullscreenDrawContainer');

    // Standardize body + home button styling
    const homeLink = document.querySelector('a[href="home.html"]');
    if (homeLink) {
        homeLink.className = 'home-btn';
    }

    body.classList.remove('bg-gray-100', 'min-h-screen', 'p-4', 'md:p-8');
    body.classList.add('experimental-layout');
    document.documentElement.style.height = '100%';
    body.style.height = '100%';

    const appContainer = document.createElement('div');
    appContainer.className = 'app-container';

    const aside = document.createElement('aside');
    aside.className = 'sidebar w-52 bg-white shadow-lg text-sm';

    let sidebarTitle = sidebarWrapper?.querySelector('h2');
    if (sidebarTitle) {
        sidebarTitle.remove();
    } else {
        sidebarTitle = document.createElement('h2');
        sidebarTitle.textContent = 'Quiz Modes';
    }
    aside.appendChild(sidebarTitle);

    const desc = document.createElement('p');
    desc.className = 'mode-desc';
    desc.textContent = 'Choose a mode, then answer in the panel to the right.';
    aside.appendChild(desc);

    const nav = document.createElement('nav');
    modeButtons.forEach(btn => {
        btn.className = 'mode-btn';
        if (btn.parentElement) btn.parentElement.removeChild(btn);
        nav.appendChild(btn);
    });
    aside.appendChild(nav);

    const main = document.createElement('main');
    main.className = 'main-content';

    const header = document.createElement('header');
    header.className = 'quiz-header';
    let existingTitle = contentCard?.querySelector('h1') || document.querySelector('h1');
    if (existingTitle) {
        existingTitle.remove();
        existingTitle.removeAttribute('class');
        header.appendChild(existingTitle);
    } else {
        const fallback = document.createElement('h1');
        fallback.textContent = document.title || 'Lesson';
        header.appendChild(fallback);
    }

    const headerDescription = contentCard
        ? Array.from(contentCard.children).find(el => el.tagName === 'P' && !el.querySelector('.mode-btn'))
        : null;
    if (headerDescription) {
        headerDescription.remove();
        headerDescription.className = 'text-sm text-gray-500 mt-1 text-center';
        header.appendChild(headerDescription);
    }
    main.appendChild(header);

    const quizDisplay = document.createElement('section');
    quizDisplay.className = 'quiz-display';
    ['questionDisplay', 'upcomingCharacters', 'hint', 'audioSection', 'componentBreakdown', 'questionPreview'].forEach(id => {
        const el = document.getElementById(id);
        if (el) quizDisplay.appendChild(el);
    });
    main.appendChild(quizDisplay);

    const inputSection = document.createElement('section');
    inputSection.className = 'input-section';
    ['typeMode', 'choiceMode', 'fuzzyMode', 'strokeOrderMode', 'handwritingMode', 'drawCharMode', 'studyMode', 'radicalPracticeMode', 'missingComponentMode', 'charBuildingMode'].forEach(id => {
        const el = document.getElementById(id);
        if (el) inputSection.appendChild(el);
    });
    const feedbackEl = document.getElementById('feedback');
    if (feedbackEl) inputSection.appendChild(feedbackEl);
    main.appendChild(inputSection);

    const stats = document.getElementById('stats');
    if (stats) {
        stats.className = 'stats-bar';
        main.appendChild(stats);
    }

    appContainer.appendChild(aside);
    appContainer.appendChild(main);

    const legacyRoot = flexContainer || contentCard;
    if (legacyRoot && legacyRoot !== body && legacyRoot !== document.documentElement && legacyRoot.parentElement) {
        legacyRoot.replaceWith(appContainer);
    } else {
        body.appendChild(appContainer);
    }

    if (fullscreenDrawContainer) {
        document.body.appendChild(fullscreenDrawContainer);
    }
}

// =============================================================================
// PINYIN UTILITIES - Now loaded from js/pinyin-utils.js
// =============================================================================
// (Functions: convertPinyinToToneNumbers, splitPinyinSyllables, etc.)

function handleToneCyclerKeydown(event) {
    if (event.key !== 'Tab') return false;
    if (event.altKey || event.ctrlKey || event.metaKey) return false;
    if (!toneCyclerEnabled) return false;
    if (!(mode === 'char-to-pinyin' || mode === 'audio-to-pinyin')) return false;
    if (!answerInput || event.target !== answerInput) return false;

    const direction = event.shiftKey ? -1 : 1;
    const cycled = cycleToneForInputField(answerInput, direction);
    if (!cycled) return false;

    event.preventDefault();
    event.stopPropagation();
    updatePartialProgress();
    return true;
}

function toggleToneCycler() {
    toneCyclerEnabled = !toneCyclerEnabled;
    showToneCyclerStatus();
}

function showToneCyclerStatus() {
    const message = toneCyclerEnabled
        ? 'Tab tone cycling enabled (Tab=next tone, Shift+Tab=previous tone)'
        : 'Tab tone cycling disabled';

    console.log(message);

    if (!hint) return;

    if (toneCyclerStatusTimeout) {
        clearTimeout(toneCyclerStatusTimeout);
        toneCyclerStatusTimeout = null;
    }

    const previousText = hint.textContent;
    const previousClass = hint.className;

    hint.textContent = message;
    hint.className = 'text-center text-xl font-semibold my-4 text-purple-600';

    toneCyclerStatusTimeout = setTimeout(() => {
        if (hint && hint.textContent === message) {
            hint.textContent = previousText;
            hint.className = previousClass;
        }
        toneCyclerStatusTimeout = null;
    }, 1600);
}

function ensureCharGlossesLoaded() {
    if (charGlossLoaded) return Promise.resolve(charGlossMap);
    if (charGlossPromise) return charGlossPromise;
    charGlossPromise = Promise.all([
        fetch('data/common-2500-etymology.json').then(res => res.ok ? res.json() : {}).catch(() => ({})),
        fetch('data/lesson1-2-etymology.json').then(res => res.ok ? res.json() : {}).catch(() => ({})),
        fetch('data/lesson3-etymology.json').then(res => res.ok ? res.json() : {}).catch(() => ({})),
        fetch('data/lesson7-etymology.json').then(res => res.ok ? res.json() : {}).catch(() => ({}))
    ])
        .then(([common, l12, l3, l7]) => {
            charGlossMap = { ...(common || {}), ...(l12 || {}), ...(l3 || {}), ...(l7 || {}) };
            charGlossLoaded = true;
            return charGlossMap;
        })
        .catch(err => {
            console.warn('Failed to load char gloss data', err);
            return {};
        });
    return charGlossPromise;
}

function loadSchedulerMode() {
    try {
        const stored = localStorage.getItem(SCHEDULER_MODE_KEY);
        if (stored && Object.values(SCHEDULER_MODES).includes(stored)) {
            schedulerMode = stored;
        } else if (stored === 'fast-loop') {
            // Legacy mode: map old Fast Loop to weighted scheduler
            schedulerMode = SCHEDULER_MODES.WEIGHTED;
        } else {
            schedulerMode = SCHEDULER_MODES.WEIGHTED;
        }
    } catch (e) {
        console.warn('Failed to load scheduler mode', e);
        schedulerMode = SCHEDULER_MODES.WEIGHTED;
    }
}

function saveSchedulerMode(mode) {
    try {
        localStorage.setItem(SCHEDULER_MODE_KEY, mode);
    } catch (e) {
        console.warn('Failed to save scheduler mode', e);
    }
}

function getQuizModeKey() {
    const path = window.location.pathname || '';
    const pageName = path.substring(path.lastIndexOf('/') + 1).replace('.html', '') || 'home';
    return QUIZ_MODE_KEY_PREFIX + pageName;
}

function getModeFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('mode');
    } catch (e) {
        return null;
    }
}

function updateUrlWithMode(newMode) {
    try {
        const url = new URL(window.location);
        if (newMode) {
            url.searchParams.set('mode', newMode);
        } else {
            url.searchParams.delete('mode');
        }
        history.replaceState({}, '', url);
    } catch (e) {
        console.warn('Failed to update URL with mode', e);
    }
}

function loadQuizMode() {
    try {
        // URL parameter takes priority over localStorage
        const urlMode = getModeFromUrl();
        if (urlMode) {
            const btn = document.querySelector(`[data-mode="${urlMode}"]`);
            if (btn) {
                if (urlMode === 'composer') {
                    composerEnabled = true;
                    saveComposerState();
                    const stage = getComposerCurrentStage();
                    mode = stage ? stage.mode : mode;
                } else {
                    mode = urlMode;
                    composerEnabled = false;
                    saveComposerState();
                }
                return; // URL mode found and valid
            }
        }

        // Fall back to localStorage
        const stored = localStorage.getItem(getQuizModeKey());
        if (stored) {
            // Verify the mode button exists on this page
            const btn = document.querySelector(`[data-mode="${stored}"]`);
            if (btn) {
                if (stored === 'composer') {
                    composerEnabled = true;
                    saveComposerState();
                    const stage = getComposerCurrentStage();
                    mode = stage ? stage.mode : mode;
                } else {
                    mode = stored;
                    composerEnabled = false;
                    saveComposerState();
                }
            }
        }
    } catch (e) {
        console.warn('Failed to load quiz mode', e);
    }

    // Update URL to reflect current mode (after a short delay to let page settle)
    setTimeout(() => updateUrlWithMode(mode), 100);
}

function saveQuizMode(newMode) {
    try {
        localStorage.setItem(getQuizModeKey(), newMode);
        updateUrlWithMode(newMode);
    } catch (e) {
        console.warn('Failed to save quiz mode', e);
    }
}

function getSchedulerModeLabel(mode = schedulerMode) {
    switch (mode) {
        case SCHEDULER_MODES.WEIGHTED:
            return 'Confidence-weighted (recency + errors)';
        case SCHEDULER_MODES.ADAPTIVE_5:
            return 'Adaptive 5-card lane';
        case SCHEDULER_MODES.FEED:
            return 'Feed (explore/exploit)';
        case SCHEDULER_MODES.FEED_SR:
            return 'Feed Graduate';
        case SCHEDULER_MODES.BATCH_5:
            return 'Batch sets (5 → 10 after full pass)';
        case SCHEDULER_MODES.BATCH_2:
            return 'Batch sets (2 → 4 after full pass)';
        case SCHEDULER_MODES.ORDERED:
            return 'In order (top-to-bottom)';
        case SCHEDULER_MODES.RANDOM:
        default:
            return 'Random shuffle';
    }
}

function getSchedulerModeDescription(mode = schedulerMode) {
    switch (mode) {
        case SCHEDULER_MODES.WEIGHTED:
            return 'Scores cards by recency + mistakes; picks proportionally to need.';
        case SCHEDULER_MODES.ADAPTIVE_5:
            return 'Rolling 5-card lane; graduate confident cards while sticky ones stay until solid.';
        case SCHEDULER_MODES.FEED:
            return 'Explore/exploit balance via UCB; flexible hand size adapts to your progress.';
        case SCHEDULER_MODES.FEED_SR:
            return 'Feed mode with graduation; cards leave hand when confidence is high enough.';
        case SCHEDULER_MODES.BATCH_5:
            return 'Disjoint 5-card sets until every word is seen, then 10-card sets for combined practice.';
        case SCHEDULER_MODES.BATCH_2:
            return 'Disjoint 2-card sets until every word is seen, then 4-card sets for combined practice.';
        case SCHEDULER_MODES.ORDERED:
            return 'Walk through the list in defined order and wrap.';
        case SCHEDULER_MODES.RANDOM:
        default:
            return 'Pure shuffle from the current pool.';
    }
}

function getCurrentSkillKey(customMode = mode) {
    const m = customMode;
    if (m === 'char-to-meaning' || m === 'char-to-meaning-type' || m === 'meaning-to-char' || m === 'audio-to-meaning' || m === 'dictation-chat') {
        return 'meaning';
    }
    if (m === 'char-to-pinyin' || m === 'char-to-pinyin-mc' || m === 'char-to-pinyin-tones-mc' || m === 'char-to-pinyin-type' || m === 'pinyin-to-char' || m === 'audio-to-pinyin' || m === 'char-to-tones') {
        return 'pinyin';
    }
    if (m === 'stroke-order' || m === 'handwriting' || m === 'draw-char' || m === 'draw-missing-component') {
        return 'writing';
    }
    return 'general';
}

function getSchedulerStatsPageKey() {
    const path = window.location.pathname || '';
    const pageName = path.substring(path.lastIndexOf('/') + 1).replace('.html', '') || 'home';
    return SCHEDULER_STATS_KEY_PREFIX + pageName;
}

function loadSchedulerStats() {
    try {
        schedulerStatsKey = getSchedulerStatsPageKey();
        const data = localStorage.getItem(schedulerStatsKey);
        schedulerStats = data ? JSON.parse(data) : {};
    } catch (e) {
        console.warn('Failed to load scheduler stats', e);
        schedulerStats = {};
    }
}

function saveSchedulerStats() {
    try {
        if (!schedulerStatsKey) {
            schedulerStatsKey = getSchedulerStatsPageKey();
        }
        localStorage.setItem(schedulerStatsKey, JSON.stringify(schedulerStats));
    } catch (e) {
        console.warn('Failed to save scheduler stats', e);
    }
}

function getSchedulerStats(char, skillKey = getCurrentSkillKey()) {
    const key = `${char}::${skillKey}`;
    if (!schedulerStats[key]) {
        schedulerStats[key] = {
            served: 0,
            correct: 0,
            wrong: 0,
            lastServed: 0,
            lastCorrect: 0,
            lastWrong: 0,
            streak: 0
        };
    }
    return schedulerStats[key];
}

function markSchedulerServed(question) {
    if (!question || !question.char) return;
    if (!confidenceTrackingEnabled) return;
    const stats = getSchedulerStats(question.char);
    stats.served += 1;
    stats.lastServed = Date.now();
    schedulerOutcomeRecordedChar = null;
    logDebugEvent('scheduler-served', {
        char: question.char,
        skill: getCurrentSkillKey(),
        served: stats.served,
        mode: schedulerMode
    });
    saveSchedulerStats();
    renderConfidenceList();

    if (isBatchMode()) {
        markBatchSeen(question.char);
    }
    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        updateAdaptiveStatusDisplay();
    }
}

function markSchedulerOutcome(correct) {
    if (!currentQuestion || !currentQuestion.char) return;
    if (!confidenceTrackingEnabled) return;
    const char = currentQuestion.char;
    if (schedulerOutcomeRecordedChar === char) return;
    schedulerOutcomeRecordedChar = char;
    const stats = getSchedulerStats(char);
    const now = Date.now();
    if (correct) {
        stats.correct += 1;
        stats.lastCorrect = now;
        stats.streak = (stats.streak || 0) + 1;
    } else {
        stats.wrong += 1;
        stats.lastWrong = now;
        stats.streak = 0;
    }

    // Update BKT probability (always, so it's available if user switches formulas)
    updateBKT(char, correct);

    logDebugEvent('scheduler-outcome', {
        char,
        correct: Boolean(correct),
        skill: getCurrentSkillKey(),
        served: stats.served,
        correctCount: stats.correct,
        wrong: stats.wrong,
        streak: stats.streak,
        mode: schedulerMode
    });

    saveSchedulerStats();

    if (isBatchMode()) {
        maybeAdvanceBatchAfterAnswer();
    }

    renderConfidenceList();

    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        prepareAdaptiveForNextQuestion();
    }

    if (schedulerMode === SCHEDULER_MODES.FEED || schedulerMode === SCHEDULER_MODES.FEED_SR) {
        recordFeedOutcome(char, correct);
        prepareFeedForNextQuestion();
    }
}

function markBatchSeen(char) {
    if (!char) return;
    if (!Array.isArray(batchModeState.seenInBatch)) {
        batchModeState.seenInBatch = [];
    }
    if (!batchModeState.seenInBatch.includes(char)) {
        batchModeState.seenInBatch.push(char);
        saveBatchState();
    }
}

function getBatchPageKey() {
    const path = window.location.pathname || '';
    const filename = path.substring(path.lastIndexOf('/') + 1) || '';
    const base = filename.replace('.html', '') || 'default';
    return base;
}

function getBatchStorageKey() {
    if (batchStateKey) return batchStateKey;
    batchStateKey = `${BATCH_STATE_KEY_PREFIX}${getBatchPageKey()}`;
    return batchStateKey;
}

function loadBatchState() {
    batchModeState = { ...BATCH_DEFAULT_STATE };
    const key = getBatchStorageKey();
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                batchModeState.activeBatch = Array.isArray(parsed.activeBatch) ? parsed.activeBatch.filter(Boolean) : [];
                batchModeState.usedChars = Array.isArray(parsed.usedChars) ? parsed.usedChars.filter(Boolean) : [];
                batchModeState.batchIndex = Number.isFinite(parsed.batchIndex) ? parsed.batchIndex : 0;
                batchModeState.cycleCount = Number.isFinite(parsed.cycleCount) ? parsed.cycleCount : 0;
                batchModeState.seenInBatch = Array.isArray(parsed.seenInBatch) ? parsed.seenInBatch.filter(Boolean) : [];
                batchModeState.lastStartedAt = Number.isFinite(parsed.lastStartedAt) ? parsed.lastStartedAt : 0;
            }
        }
    } catch (e) {
        console.warn('Failed to load batch mode state', e);
    }

    batchModeState.activeBatch = Array.from(new Set(batchModeState.activeBatch));
    batchModeState.usedChars = Array.from(new Set(batchModeState.usedChars));
    batchModeState.seenInBatch = Array.from(new Set(batchModeState.seenInBatch));
    maybeResetStaleBatchState();
}

function saveBatchState() {
    const key = getBatchStorageKey();
    try {
        localStorage.setItem(key, JSON.stringify(batchModeState));
    } catch (e) {
        console.warn('Failed to save batch mode state', e);
    }
}

function resetBatchState(options = {}) {
    batchModeState = { ...BATCH_DEFAULT_STATE };
    saveBatchState();
    if (options.refresh !== false) {
        previewQueue = [];
        updatePreviewDisplay();
        updateBatchStatusDisplay();
    }
}

function maybeResetStaleBatchState() {
    const last = Number.isFinite(batchModeState.lastStartedAt) ? batchModeState.lastStartedAt : 0;
    const age = Date.now() - last;
    if (!last || age > BATCH_SESSION_MAX_AGE_MS) {
        resetBatchState({ refresh: false });
    }
}

function getActiveBatchQuestions() {
    if (!Array.isArray(batchModeState.activeBatch)) {
        batchModeState.activeBatch = [];
    }

    const availableMap = new Map((Array.isArray(quizCharacters) ? quizCharacters : []).map(item => [item.char, item]));
    const resolved = batchModeState.activeBatch.map(char => availableMap.get(char)).filter(Boolean);

    if (resolved.length !== batchModeState.activeBatch.length) {
        batchModeState.activeBatch = resolved.map(item => item.char);
        saveBatchState();
    }

    return resolved;
}

function reconcileBatchStateWithQueue() {
    const knownSource = Array.isArray(originalQuizCharacters) && originalQuizCharacters.length
        ? originalQuizCharacters
        : quizCharacters;
    const knownChars = new Set((knownSource || []).map(item => item.char));

    const activeBefore = Array.isArray(batchModeState.activeBatch) ? batchModeState.activeBatch.length : 0;
    batchModeState.activeBatch = (batchModeState.activeBatch || []).filter(char => knownChars.has(char));
    batchModeState.usedChars = (batchModeState.usedChars || []).filter(char => knownChars.has(char));
    batchModeState.seenInBatch = (batchModeState.seenInBatch || []).filter(char => knownChars.has(char));

    if (batchModeState.activeBatch.length !== activeBefore) {
        saveBatchState();
    }
}

function isBatchCharMastered(char) {
    const stats = getSchedulerStats(char);
    if (!stats) return false;

    // Confidence-based graduation (respects heuristic vs BKT formulas)
    const confidenceMastered = (stats.served || 0) > 0 && isConfidenceHighEnough(char);
    if (confidenceMastered) return true;

    const accuracy = stats.served > 0 ? (stats.correct / stats.served) : 0;
    const streak = stats.streak || 0;
    const seenEnough = stats.served >= BATCH_MASTER_MIN_SEEN;

    return seenEnough && streak >= BATCH_MASTER_MIN_STREAK && accuracy >= BATCH_MASTER_MIN_ACCURACY;
}

function getBatchMasteryProgress() {
    const active = getActiveBatchQuestions();
    const seenSet = new Set(Array.isArray(batchModeState.seenInBatch) ? batchModeState.seenInBatch : []);
    const mastered = active.filter(item => seenSet.has(item.char) && isBatchCharMastered(item.char));
    const seenCount = active.filter(item => seenSet.has(item.char)).length;
    return {
        active,
        masteredCount: mastered.length,
        seenCount,
        total: active.length
    };
}

// Adaptive rolling 5-card deck helpers
function getAdaptivePageKey() {
    const path = window.location.pathname || '';
    const filename = path.substring(path.lastIndexOf('/') + 1) || '';
    const base = filename.replace('.html', '') || 'default';
    return base;
}

function getAdaptiveStorageKey() {
    if (adaptiveStateKey) return adaptiveStateKey;
    adaptiveStateKey = `${ADAPTIVE_STATE_KEY_PREFIX}${getAdaptivePageKey()}`;
    return adaptiveStateKey;
}

function getFeedStorageKey() {
    if (feedStateKey) return feedStateKey;
    feedStateKey = `${FEED_STATE_KEY_PREFIX}${getAdaptivePageKey()}`;
    return feedStateKey;
}

function loadAdaptiveState() {
    const defaults = { deck: [], mastered: [], cycleCount: 0 };
    adaptiveDeckState = { ...defaults };
    const key = getAdaptiveStorageKey();
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                adaptiveDeckState.deck = Array.isArray(parsed.deck) ? parsed.deck.filter(Boolean) : [];
                adaptiveDeckState.mastered = Array.isArray(parsed.mastered) ? parsed.mastered.filter(Boolean) : [];
                adaptiveDeckState.cycleCount = Number.isFinite(parsed.cycleCount) ? parsed.cycleCount : 0;
            }
        }
    } catch (e) {
        console.warn('Failed to load adaptive deck state', e);
    }

    adaptiveDeckState.deck = Array.from(new Set(adaptiveDeckState.deck));
    adaptiveDeckState.mastered = Array.from(new Set(adaptiveDeckState.mastered));
    if (!Number.isFinite(adaptiveDeckState.cycleCount)) {
        adaptiveDeckState.cycleCount = 0;
    }
}

function saveAdaptiveState() {
    const key = getAdaptiveStorageKey();
    try {
        localStorage.setItem(key, JSON.stringify(adaptiveDeckState));
    } catch (e) {
        console.warn('Failed to save adaptive deck state', e);
    }
}

// Feed mode persistence
function loadFeedState() {
    const defaults = { hand: [], seen: {}, totalPulls: 0 };
    feedModeState = { ...defaults };
    const key = getFeedStorageKey();
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                feedModeState.hand = Array.isArray(parsed.hand) ? parsed.hand.filter(Boolean) : [];
                feedModeState.seen = (parsed.seen && typeof parsed.seen === 'object') ? parsed.seen : {};
                feedModeState.totalPulls = Number.isFinite(parsed.totalPulls) ? parsed.totalPulls : 0;
            }
        }
    } catch (e) {
        console.warn('Failed to load feed mode state', e);
    }
    feedModeState.hand = Array.from(new Set(feedModeState.hand));
}

function saveFeedState() {
    const key = getFeedStorageKey();
    try {
        localStorage.setItem(key, JSON.stringify(feedModeState));
    } catch (e) {
        console.warn('Failed to save feed mode state', e);
    }
}

function reconcileFeedStateWithPool(source = quizCharacters) {
    const knownChars = new Set((Array.isArray(source) ? source : []).map(item => item.char));
    // Remove cards from hand that are no longer in pool
    feedModeState.hand = (feedModeState.hand || []).filter(char => knownChars.has(char));
    // Clean up seen stats for cards no longer in pool
    const newSeen = {};
    for (const char of Object.keys(feedModeState.seen || {})) {
        if (knownChars.has(char)) {
            newSeen[char] = feedModeState.seen[char];
        }
    }
    feedModeState.seen = newSeen;
}

function resetFeedState() {
    feedModeState = { hand: [], seen: {}, totalPulls: 0 };
    saveFeedState();
}

function reconcileAdaptiveStateWithPool(source = quizCharacters) {
    const knownChars = new Set((Array.isArray(source) ? source : []).map(item => item.char));
    const beforeDeck = Array.isArray(adaptiveDeckState.deck) ? adaptiveDeckState.deck.length : 0;
    adaptiveDeckState.deck = (adaptiveDeckState.deck || []).filter(char => knownChars.has(char));
    adaptiveDeckState.mastered = (adaptiveDeckState.mastered || []).filter(char => knownChars.has(char));
    if (!Number.isFinite(adaptiveDeckState.cycleCount)) {
        adaptiveDeckState.cycleCount = 0;
    }
    if (adaptiveDeckState.deck.length !== beforeDeck) {
        saveAdaptiveState();
    }
}

function shouldGraduateAdaptiveChar(char) {
    if (!char) return false;
    const stats = getSchedulerStats(char);
    const served = stats.served || 0;
    const streak = stats.streak || 0;
    const confidenceOk = isConfidenceHighEnough(char);

    if (served < ADAPTIVE_GRAD_MIN_SERVED) return false;
    if (streak < ADAPTIVE_GRAD_MIN_STREAK) return false;
    if (!confidenceOk) return false;
    return true;
}

// Return detailed readiness so we can surface why graduation is blocked
function getAdaptiveReadiness(char) {
    const stats = getSchedulerStats(char);
    const served = stats.served || 0;
    const streak = stats.streak || 0;
    const score = getConfidenceScore(char);
    const threshold = getConfidenceMasteryThreshold();

    const servedOk = served >= ADAPTIVE_GRAD_MIN_SERVED;
    const streakOk = streak >= ADAPTIVE_GRAD_MIN_STREAK;
    const confidenceOk = score >= threshold;

    return {
        served, streak, score, threshold,
        servedOk, streakOk, confidenceOk,
        ready: servedOk && streakOk && confidenceOk
    };
}

// Composer progression helpers (per-mode mastery)
function isCharMasteredForMode(char, modeName) {
    if (!char || !modeName) return false;
    const skillKey = getCurrentSkillKey(modeName);
    const stats = getSchedulerStats(char, skillKey);
    const served = stats.served || 0;
    const streak = stats.streak || 0;
    const score = getConfidenceScoreForMode(char, modeName);
    const threshold = getConfidenceMasteryThreshold();
    const servedOk = served >= ADAPTIVE_GRAD_MIN_SERVED;
    const streakOk = streak >= ADAPTIVE_GRAD_MIN_STREAK;
    const confidenceOk = Number.isFinite(score) && score >= threshold;
    return servedOk && streakOk && confidenceOk;
}

function isModeFullyMastered(modeName) {
    if (!modeName || !Array.isArray(quizCharacters)) return false;
    if (!quizCharacters.length) return false;
    return quizCharacters.every(q => isCharMasteredForMode(q.char, modeName));
}

// Debug function - call debugAdaptiveGraduation() in console to see why cards aren't graduating
function debugAdaptiveGraduation() {
    const deck = Array.isArray(adaptiveDeckState.deck) ? adaptiveDeckState.deck : [];
    const skillKey = getCurrentSkillKey();
    const isBKT = confidenceFormula === CONFIDENCE_FORMULAS.BKT;
    const threshold = getConfidenceMasteryThreshold();

    console.log('=== Adaptive Graduation Debug ===');
    console.log('Current skill:', skillKey);
    console.log('Confidence formula:', isBKT ? 'BKT' : 'Heuristic');
    console.log('Confidence threshold:', threshold);
    console.log('Min served:', ADAPTIVE_GRAD_MIN_SERVED);
    console.log('Min streak:', ADAPTIVE_GRAD_MIN_STREAK);
    console.log('');

    deck.forEach(char => {
        const stats = getSchedulerStats(char);
        const score = getConfidenceScore(char);
        const checks = {
            served: (stats.served || 0) >= ADAPTIVE_GRAD_MIN_SERVED,
            streak: (stats.streak || 0) >= ADAPTIVE_GRAD_MIN_STREAK,
            confidence: score >= threshold
        };
        const wouldGraduate = checks.served && checks.streak && checks.confidence;

        console.log(`${char}: served=${stats.served || 0}, streak=${stats.streak || 0}, score=${score.toFixed(2)}`);
        console.log(`  Checks: served=${checks.served}, streak=${checks.streak}, confidence=${checks.confidence}`);
        console.log(`  Would graduate: ${wouldGraduate}`);
    });

    console.log('');
    console.log('Mastered so far:', adaptiveDeckState.mastered?.length || 0, 'words');
}
window.debugAdaptiveGraduation = debugAdaptiveGraduation;

function maybeGraduateAdaptiveDeck() {
    if (schedulerMode !== SCHEDULER_MODES.ADAPTIVE_5) return false;
    let changed = false;
    const deck = Array.isArray(adaptiveDeckState.deck) ? adaptiveDeckState.deck.slice() : [];
    const masteredSet = new Set(adaptiveDeckState.mastered || []);

    deck.forEach(char => {
        if (shouldGraduateAdaptiveChar(char)) {
            console.log(`🎓 Graduating "${char}" from adaptive deck!`);
            masteredSet.add(char);
            adaptiveDeckState.deck = adaptiveDeckState.deck.filter(c => c !== char);
            changed = true;
        }
    });

    if (changed) {
        adaptiveDeckState.mastered = Array.from(masteredSet);
        saveAdaptiveState();
        console.log(`Adaptive deck now has ${adaptiveDeckState.deck.length} cards, ${adaptiveDeckState.mastered.length} mastered`);
    }
    return changed;
}

function getAdaptiveSourcePool() {
    const masteredSet = new Set(adaptiveDeckState.mastered || []);
    return (Array.isArray(quizCharacters) ? quizCharacters : []).filter(item => item && !masteredSet.has(item.char));
}

function ensureAdaptiveDeck() {
    if (schedulerMode !== SCHEDULER_MODES.ADAPTIVE_5) return;
    reconcileAdaptiveStateWithPool();

    const fullPool = Array.isArray(quizCharacters) ? quizCharacters.slice() : [];
    if (!fullPool.length) {
        adaptiveDeckState.deck = [];
        saveAdaptiveState();
        return;
    }

    let masteredSet = new Set(adaptiveDeckState.mastered || []);
    let pool = fullPool.filter(item => !masteredSet.has(item.char));

    if (!pool.length) {
        adaptiveDeckState.mastered = [];
        masteredSet = new Set();
        adaptiveDeckState.cycleCount = Math.max(0, (adaptiveDeckState.cycleCount || 0)) + 1;
        pool = fullPool.slice();
    }

    const availableSet = new Set(pool.map(item => item.char));
    adaptiveDeckState.deck = (adaptiveDeckState.deck || []).filter(char => availableSet.has(char));

    // First, fill from unmastered pool up to ADAPTIVE_DECK_SIZE
    while (adaptiveDeckState.deck.length < ADAPTIVE_DECK_SIZE && pool.length) {
        const candidates = pool.filter(item => !adaptiveDeckState.deck.includes(item.char));
        if (!candidates.length) break;
        const chosen = (selectLeastConfident(candidates, 1)[0]) || selectRandom(candidates);
        if (!chosen) break;
        adaptiveDeckState.deck.push(chosen.char);
    }

    // If deck is still below minimum, pull from mastered cards to maintain variety
    if (adaptiveDeckState.deck.length < ADAPTIVE_MIN_DECK_SIZE && masteredSet.size > 0) {
        const masteredChars = Array.from(masteredSet);
        const masteredItems = fullPool.filter(item => masteredChars.includes(item.char));

        while (adaptiveDeckState.deck.length < ADAPTIVE_MIN_DECK_SIZE && masteredItems.length) {
            const candidates = masteredItems.filter(item => !adaptiveDeckState.deck.includes(item.char));
            if (!candidates.length) break;
            // Pick least confident among mastered cards
            const chosen = (selectLeastConfident(candidates, 1)[0]) || selectRandom(candidates);
            if (!chosen) break;
            adaptiveDeckState.deck.push(chosen.char);
        }
    }

    adaptiveDeckState.deck = Array.from(new Set(adaptiveDeckState.deck));
    saveAdaptiveState();
}

function getAdaptiveQuestionPool() {
    if (schedulerMode !== SCHEDULER_MODES.ADAPTIVE_5) {
        return Array.isArray(quizCharacters) ? quizCharacters : [];
    }
    ensureAdaptiveDeck();
    const availableMap = new Map((Array.isArray(quizCharacters) ? quizCharacters : []).map(item => [item.char, item]));
    return (adaptiveDeckState.deck || []).map(char => availableMap.get(char)).filter(Boolean);
}

function prepareAdaptiveForNextQuestion() {
    if (schedulerMode !== SCHEDULER_MODES.ADAPTIVE_5) return;
    reconcileAdaptiveStateWithPool();
    maybeGraduateAdaptiveDeck();
    ensureAdaptiveDeck();
    updateAdaptiveStatusDisplay();
    if (previewQueueEnabled) {
        reconcilePreviewQueue();
        ensurePreviewQueue();
        updatePreviewDisplay();
    }
}

// =====================
// Feed Mode Functions
// =====================

function getFeedUCBScore(char) {
    const stats = feedModeState.seen[char];
    const totalPulls = feedModeState.totalPulls || 1;
    const useSRConfidence = schedulerMode === SCHEDULER_MODES.FEED_SR;

    // Get user word marking for this character
    const marking = getWordMarking(char);
    const MARKING_NEEDS_WORK_BOOST = 1.5;  // Boost score for needs-work words
    const MARKING_LEARNED_PENALTY = 2.0;   // Reduce score for learned words

    if (!stats || stats.attempts === 0) {
        // Unseen cards get high priority, especially early on
        // Score scales with how much we've explored - less explored = higher unseen priority
        const explorationRatio = getFeedExplorationRatio();
        let baseScore = explorationRatio < 0.5 ? 3.0 : 2.0;

        // In Feed Graduate mode, boost priority for low-confidence cards we haven't seen this session
        if (useSRConfidence) {
            const srScore = getConfidenceScore(char);
            const threshold = getConfidenceMasteryThreshold();
            // Low SR confidence = higher priority
            const srBoost = Math.max(0, (threshold - srScore) / threshold);
            baseScore += srBoost * 1.5;
        }

        // Apply user marking modifiers
        if (marking === 'needs-work') {
            baseScore += MARKING_NEEDS_WORK_BOOST;
        } else if (marking === 'learned') {
            baseScore -= MARKING_LEARNED_PENALTY;
        }

        return baseScore + Math.random() * 0.5;
    }

    const sessionConfidence = stats.correct / stats.attempts;
    const explorationBonus = FEED_UCB_C * Math.sqrt(Math.log(totalPulls) / stats.attempts);

    // Higher score = more likely to pick
    // Low confidence OR rarely seen = high score
    let score = (1 - sessionConfidence) + explorationBonus;

    // In Feed Graduate mode, also factor in persistent confidence score
    if (useSRConfidence) {
        const srScore = getConfidenceScore(char);
        const threshold = getConfidenceMasteryThreshold();
        // Low SR confidence = higher priority (boost score)
        const srBoost = Math.max(0, (threshold - srScore) / threshold);
        score += srBoost * 0.5;
    }

    // Apply user marking modifiers
    if (marking === 'needs-work') {
        score += MARKING_NEEDS_WORK_BOOST;
    } else if (marking === 'learned') {
        score -= MARKING_LEARNED_PENALTY;
    }

    return score;
}

function getFeedExplorationRatio() {
    // What fraction of the pool have we seen?
    const poolSize = Array.isArray(quizCharacters) ? quizCharacters.length : 0;
    if (poolSize === 0) return 0;
    const seenCount = Object.keys(feedModeState.seen || {}).length;
    return seenCount / poolSize;
}

function getFeedTargetHandSize() {
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR) {
        return FEED_DEFAULT_HAND_SIZE;
    }

    const poolSize = Array.isArray(quizCharacters) ? quizCharacters.length : 0;
    if (poolSize === 0) return FEED_DEFAULT_HAND_SIZE;

    const explorationRatio = getFeedExplorationRatio();
    const seenCount = Object.keys(feedModeState.seen || {}).length;

    // Count weak cards (cards we've seen but have low confidence on)
    let weakCount = 0;
    for (const char of Object.keys(feedModeState.seen || {})) {
        const stats = feedModeState.seen[char];
        if (stats && stats.attempts > 0) {
            const confidence = stats.correct / stats.attempts;
            if (confidence < FEED_WEAK_THRESHOLD) {
                weakCount++;
            }
        }
    }

    // Start small like 5-card sets: begin with 2 cards, expand as you learn
    if (seenCount < 2) {
        // Very beginning - start with just 2 cards
        return 2;
    } else if (explorationRatio < 0.15) {
        // Early phase - small sets of 3-4
        return Math.min(4, Math.max(2, weakCount + 2));
    } else if (explorationRatio < 0.3) {
        // Growing phase - expand to 5-6
        return Math.min(6, Math.max(3, weakCount + 2));
    } else if (explorationRatio < 0.6) {
        // Middle phase - moderate hand size
        return Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_DEFAULT_HAND_SIZE + 2, weakCount + 3));
    } else {
        // Explored most of the deck - shrink to focus on weak cards
        return Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_DEFAULT_HAND_SIZE, weakCount + 2));
    }
}

function ensureFeedHand() {
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR) return;
    reconcileFeedStateWithPool();

    const fullPool = Array.isArray(quizCharacters) ? quizCharacters.slice() : [];
    if (!fullPool.length) {
        feedModeState.hand = [];
        saveFeedState();
        return;
    }

    const targetSize = getFeedTargetHandSize();
    const useSRGraduation = schedulerMode === SCHEDULER_MODES.FEED_SR;

    // Remove cards from hand that have graduated
    feedModeState.hand = feedModeState.hand.filter(char => {
        const stats = feedModeState.seen[char];
        if (!stats) return true; // keep if never seen (shouldn't happen)

        if (useSRGraduation) {
            // Feed Graduate: graduate when confidence is high enough AND we've seen it this session
            const sessionAttempts = stats.attempts || 0;
            if (sessionAttempts < FEED_SR_MIN_SESSION_ATTEMPTS) return true; // keep until we've tested it
            return !isConfidenceHighEnough(char);
        } else {
            // Regular Feed: graduate on streak
            return (stats.streak || 0) < FEED_STREAK_TO_REMOVE;
        }
    });

    // Force exploration: ensure at least 1 unseen card in hand until 80% explored
    const unseenCards = fullPool.filter(item =>
        !feedModeState.hand.includes(item.char) &&
        (!feedModeState.seen[item.char] || feedModeState.seen[item.char].attempts === 0)
    );
    const explorationRatio = getFeedExplorationRatio();

    // Check if hand already has unseen cards
    const handHasUnseen = feedModeState.hand.some(char =>
        !feedModeState.seen[char] || feedModeState.seen[char].attempts === 0
    );

    // If under 80% explored and no unseen in hand, kick out lowest-priority seen card and add unseen
    if (explorationRatio < 0.8 && unseenCards.length > 0 && !handHasUnseen && feedModeState.hand.length > 0) {
        // Find the card with highest confidence (least needed) to remove
        let worstIdx = 0;
        let worstScore = Infinity;
        for (let i = 0; i < feedModeState.hand.length; i++) {
            const score = getFeedUCBScore(feedModeState.hand[i]);
            if (score < worstScore) {
                worstScore = score;
                worstIdx = i;
            }
        }
        feedModeState.hand.splice(worstIdx, 1);
    }

    // Add unseen cards to fill reserved slots
    const reservedSlots = explorationRatio < 0.8 && unseenCards.length > 0 ? Math.min(2, Math.ceil(targetSize * 0.3)) : 0;
    for (let i = 0; i < reservedSlots && feedModeState.hand.length < targetSize && unseenCards.length > 0; i++) {
        const idx = Math.floor(Math.random() * unseenCards.length);
        const randomUnseen = unseenCards[idx];
        if (randomUnseen && !feedModeState.hand.includes(randomUnseen.char)) {
            feedModeState.hand.push(randomUnseen.char);
            unseenCards.splice(idx, 1);
        }
    }

    // Fill hand up to target size using UCB scores
    while (feedModeState.hand.length < targetSize && feedModeState.hand.length < fullPool.length) {
        // Get all candidates not in hand
        const candidates = fullPool.filter(item => !feedModeState.hand.includes(item.char));
        if (!candidates.length) break;

        // Pick the one with highest UCB score
        let bestChar = null;
        let bestScore = -Infinity;

        for (const item of candidates) {
            const score = getFeedUCBScore(item.char);
            if (score > bestScore) {
                bestScore = score;
                bestChar = item.char;
            }
        }

        if (!bestChar) break;
        feedModeState.hand.push(bestChar);
    }

    feedModeState.hand = Array.from(new Set(feedModeState.hand));
    saveFeedState();
}

function getFeedQuestionPool() {
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR) {
        return Array.isArray(quizCharacters) ? quizCharacters : [];
    }
    ensureFeedHand();
    const availableMap = new Map((Array.isArray(quizCharacters) ? quizCharacters : []).map(item => [item.char, item]));
    return (feedModeState.hand || []).map(char => availableMap.get(char)).filter(Boolean);
}

function selectFeedQuestion(excludeChars = []) {
    const hand = getFeedQuestionPool();
    if (!hand.length) return null;

    const candidates = hand.filter(item => !excludeChars.includes(item.char));
    if (!candidates.length) return selectRandom(hand);

    // Pick from hand - prioritize weakest cards
    let bestItem = null;
    let bestScore = -Infinity;

    for (const item of candidates) {
        const score = getFeedUCBScore(item.char);
        // Add small random factor to avoid always picking the same card
        const jitteredScore = score + Math.random() * 0.1;
        if (jitteredScore > bestScore) {
            bestScore = jitteredScore;
            bestItem = item;
        }
    }

    return bestItem || selectRandom(candidates);
}

function recordFeedOutcome(char, correct) {
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR) return;
    if (!char) return;

    feedModeState.totalPulls = (feedModeState.totalPulls || 0) + 1;

    if (!feedModeState.seen[char]) {
        feedModeState.seen[char] = { attempts: 0, correct: 0, streak: 0, lastSeen: Date.now() };
    }

    const stats = feedModeState.seen[char];
    stats.attempts += 1;
    stats.lastSeen = Date.now();

    if (correct) {
        stats.correct += 1;
        stats.streak = (stats.streak || 0) + 1;
    } else {
        stats.streak = 0;
    }

    saveFeedState();

    // After recording, refresh hand (may remove/add cards)
    ensureFeedHand();
}

function prepareFeedForNextQuestion() {
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR) return;
    reconcileFeedStateWithPool();
    ensureFeedHand();
    updateFeedStatusDisplay();
}

function updateFeedStatusDisplay() {
    const statusEl = document.getElementById('feedModeStatus');
    if (!statusEl) return;
    const isFeedSR = schedulerMode === SCHEDULER_MODES.FEED_SR;
    const isFeed = schedulerMode === SCHEDULER_MODES.FEED;
    if (!isFeed && !isFeedSR) {
        // Clear feed display if we're in a different mode
        statusEl.innerHTML = '';
        statusEl.className = 'hidden';
        return;
    }

    const hand = feedModeState.hand || [];
    const seenKeys = Object.keys(feedModeState.seen || {});
    const seenCount = seenKeys.length;
    const poolSize = Array.isArray(quizCharacters) ? quizCharacters.length : 0;
    const explorationPct = poolSize > 0 ? Math.round((seenCount / poolSize) * 100) : 0;
    const threshold = getConfidenceMasteryThreshold();

    // Count weak cards and mastered cards
    let weakCount = 0;
    let masteredCount = 0;
    for (const char of seenKeys) {
        const stats = feedModeState.seen[char];
        if (stats && stats.attempts > 0 && (stats.correct / stats.attempts) < FEED_WEAK_THRESHOLD) {
            weakCount++;
        }
        if (isFeedSR && isConfidenceHighEnough(char)) {
            masteredCount++;
        }
    }

    const handBadges = hand.map(char => {
        const stats = feedModeState.seen[char];
        const sessionConf = stats && stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : 0;

        if (isFeedSR) {
            // Show confidence score for Feed Graduate mode
            const srScore = getConfidenceScore(char);
            const isMastered = srScore >= threshold;
            const srPct = confidenceFormula === CONFIDENCE_FORMULAS.BKT
                ? Math.round(srScore * 100)
                : Math.round((srScore / 6) * 100);
            const icon = isMastered ? '✓' : '';
            return `<span class="inline-block px-1.5 py-0.5 rounded text-xs ${isMastered ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}">${char} ${srPct}%${icon}</span>`;
        } else {
            // Show streak for regular Feed mode
            const streak = stats?.streak || 0;
            const streakIcon = streak >= FEED_STREAK_TO_REMOVE ? '✓' : (streak > 0 ? `×${streak}` : '');
            return `<span class="inline-block px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-800">${char} ${sessionConf}%${streakIcon}</span>`;
        }
    }).join(' ');

    const modeLabel = isFeedSR ? 'Feed Graduate Mode' : 'Feed Mode';
    const statsLine = isFeedSR
        ? `${explorationPct}% explored · ${masteredCount} ready ≥ ${threshold.toFixed(2)} · ${weakCount} weak · ${feedModeState.totalPulls || 0} pulls`
        : `${explorationPct}% explored · ${weakCount} weak · ${feedModeState.totalPulls || 0} pulls`;

    statusEl.className = 'mt-1 text-xs text-purple-800';
    statusEl.innerHTML = `
        <div class="text-[11px] font-semibold uppercase tracking-[0.25em] text-purple-500">${modeLabel}</div>
        <div class="text-sm text-purple-900">Hand (${hand.length}): ${handBadges || '<em>empty</em>'}</div>
        <div class="text-[11px] text-purple-700">${statsLine}</div>
        ${isFeedSR ? `<div class="text-[11px] text-purple-700">Graduation: ready ${masteredCount}/${seenCount || 1} (confidence ≥ ${threshold.toFixed(2)})</div>` : ''}
    `;
}

function refreshAdaptiveDeckNow(regenerate = false) {
    if (schedulerMode !== SCHEDULER_MODES.ADAPTIVE_5) {
        setSchedulerMode(SCHEDULER_MODES.ADAPTIVE_5);
    }
    prepareAdaptiveForNextQuestion();
    if (regenerate && typeof generateQuestion === 'function') {
        generateQuestion();
    }
}

function getConfidenceScore(char) {
    if (confidenceFormula === CONFIDENCE_FORMULAS.BKT) {
        return getBKTScore(char);
    }
    return getHeuristicConfidenceScore(char);
}

function getConfidenceScoreForMode(char, modeName) {
    const skillKey = getCurrentSkillKey(modeName);
    const stats = getSchedulerStats(char, skillKey);
    if (confidenceFormula === CONFIDENCE_FORMULAS.BKT) {
        return stats.bktPLearned ?? BKT_PARAMS.P_L0;
    }
    return getHeuristicConfidenceScoreFromStats(stats);
}

function getConfidenceMasteryThreshold() {
    return confidenceFormula === CONFIDENCE_FORMULAS.BKT
        ? BKT_MASTERY_THRESHOLD
        : ADAPTIVE_GRAD_CONFIDENCE;
}

function isConfidenceHighEnough(char) {
    const score = getConfidenceScore(char);
    const threshold = getConfidenceMasteryThreshold();
    return Number.isFinite(score) && score >= threshold;
}

function isConfidenceHighEnoughForMode(char, modeName) {
    const score = getConfidenceScoreForMode(char, modeName);
    const threshold = getConfidenceMasteryThreshold();
    return Number.isFinite(score) && score >= threshold;
}

function getHeuristicConfidenceScore(char) {
    const stats = getSchedulerStats(char);
    return getHeuristicConfidenceScoreFromStats(stats);
}

function getHeuristicConfidenceScoreFromStats(stats) {
    const served = stats.served || 0;
    const correct = stats.correct || 0;
    const wrong = stats.wrong || 0;
    const accuracy = served > 0 ? correct / served : 0;
    const lastWrongAgo = stats.lastWrong ? (Date.now() - stats.lastWrong) / 1000 : Infinity;
    const streak = stats.streak || 0;

    // Higher score = more confident
    const recencyBonus = Math.min(1.5, lastWrongAgo / 300); // cap after 5 minutes without wrong
    const volumeBonus = Math.log10(1 + served) * 0.4;
    const streakBonus = Math.min(1.5, streak * 0.15);
    return accuracy * 2.5 + recencyBonus + volumeBonus + streakBonus - wrong * 0.05;
}

// =============================================================================
// BKT (Bayesian Knowledge Tracing) - Within-session learning model
// =============================================================================

function getBKTScore(char) {
    const stats = getSchedulerStats(char);
    // P_L is stored in stats.bktPLearned, default to P_L0
    return stats.bktPLearned ?? BKT_PARAMS.P_L0;
}

function updateBKT(char, wasCorrect) {
    if (!char) return;
    const stats = getSchedulerStats(char);
    const P_T = BKT_PARAMS.P_T;
    const P_G = BKT_PARAMS.P_G;
    const P_S = BKT_PARAMS.P_S;

    // Current P(Learned), default to prior
    let P_L = stats.bktPLearned ?? BKT_PARAMS.P_L0;

    // Bayesian update based on observation
    if (wasCorrect) {
        // P(L | correct) = P(correct | L) * P(L) / P(correct)
        // P(correct | L) = 1 - P(S), P(correct | ~L) = P(G)
        const pCorrectGivenL = 1 - P_S;
        const pCorrectGivenNotL = P_G;
        const pCorrect = P_L * pCorrectGivenL + (1 - P_L) * pCorrectGivenNotL;
        P_L = (P_L * pCorrectGivenL) / pCorrect;
    } else {
        // P(L | wrong) = P(wrong | L) * P(L) / P(wrong)
        // P(wrong | L) = P(S), P(wrong | ~L) = 1 - P(G)
        const pWrongGivenL = P_S;
        const pWrongGivenNotL = 1 - P_G;
        const pWrong = P_L * pWrongGivenL + (1 - P_L) * pWrongGivenNotL;
        P_L = (P_L * pWrongGivenL) / pWrong;
    }

    // Learning transition: even if not yet learned, there's a chance of learning
    // P(L_new) = P(L | obs) + (1 - P(L | obs)) * P(T)
    P_L = P_L + (1 - P_L) * P_T;

    // Clamp to [0, 1] for safety
    P_L = Math.max(0, Math.min(1, P_L));

    stats.bktPLearned = P_L;
    // Note: caller (markSchedulerOutcome) handles saveSchedulerStats()

    return P_L;
}

function resetBKTForChar(char) {
    if (!char) return;
    const stats = getSchedulerStats(char);
    stats.bktPLearned = BKT_PARAMS.P_L0;
    saveSchedulerStats();
}

function resetAllBKT() {
    const pool = (Array.isArray(originalQuizCharacters) && originalQuizCharacters.length)
        ? originalQuizCharacters
        : (Array.isArray(quizCharacters) ? quizCharacters : []);
    pool.forEach(item => {
        if (item && item.char) {
            const stats = getSchedulerStats(item.char);
            stats.bktPLearned = BKT_PARAMS.P_L0;
        }
    });
    saveSchedulerStats();
    renderConfidenceList();
}

function loadConfidenceFormula() {
    try {
        const stored = localStorage.getItem(CONFIDENCE_FORMULA_KEY);
        if (stored === CONFIDENCE_FORMULAS.HEURISTIC) {
            confidenceFormula = CONFIDENCE_FORMULAS.HEURISTIC;
        } else {
            confidenceFormula = CONFIDENCE_FORMULAS.BKT;
        }
    } catch (e) {
        console.warn('Failed to load confidence formula', e);
    }
}

function saveConfidenceFormula() {
    try {
        localStorage.setItem(CONFIDENCE_FORMULA_KEY, confidenceFormula);
    } catch (e) {
        console.warn('Failed to save confidence formula', e);
    }
}

function setConfidenceFormula(formula) {
    if (formula === CONFIDENCE_FORMULAS.BKT || formula === CONFIDENCE_FORMULAS.HEURISTIC) {
        confidenceFormula = formula;
        saveConfidenceFormula();
        renderConfidenceList();
    }
}

function selectLeastConfident(pool, size) {
    if (!Array.isArray(pool) || !pool.length) return [];
    const scored = pool.map(item => ({ item, score: getConfidenceScore(item.char) }));
    scored.sort((a, b) => a.score - b.score); // lowest confidence first
    const chosen = scored.slice(0, Math.min(size, scored.length)).map(entry => entry.item);
    // Shuffle within the chosen set so order stays unpredictable
    return chosen.sort(() => Math.random() - 0.5);
}

function loadConfidencePanelVisibility() {
    try {
        const stored = localStorage.getItem(CONFIDENCE_PANEL_KEY);
        if (stored === 'false') {
            confidencePanelVisible = false;
        } else if (stored === 'true') {
            confidencePanelVisible = true;
        } else {
            const deckSize = Array.isArray(originalQuizCharacters)
                ? originalQuizCharacters.length
                : Array.isArray(quizCharacters)
                    ? quizCharacters.length
                    : 0;
            confidencePanelVisible = deckSize <= CONFIDENCE_AUTO_HIDE_THRESHOLD && !isNarrowViewport();
        }
    } catch (e) {
        console.warn('Failed to load confidence panel visibility', e);
    }
}

function loadConfidenceTrackingEnabled() {
    try {
        const stored = localStorage.getItem(CONFIDENCE_TRACKING_ENABLED_KEY);
        // Default to enabled if not set
        confidenceTrackingEnabled = stored === null || stored === 'true';
    } catch (e) {
        console.warn('Failed to load confidence tracking enabled', e);
    }
}

function saveConfidenceTrackingEnabled() {
    try {
        localStorage.setItem(CONFIDENCE_TRACKING_ENABLED_KEY, confidenceTrackingEnabled.toString());
    } catch (e) {
        console.warn('Failed to save confidence tracking enabled', e);
    }
}

function setConfidenceTrackingEnabled(enabled) {
    confidenceTrackingEnabled = Boolean(enabled);
    saveConfidenceTrackingEnabled();
    updateConfidenceTrackingUI();
}

function toggleConfidenceTracking() {
    setConfidenceTrackingEnabled(!confidenceTrackingEnabled);
}

function updateConfidenceTrackingUI() {
    const liveLabel = document.getElementById('confidenceLiveLabel');
    const trackingToggle = document.getElementById('confidenceTrackingToggle');
    if (liveLabel) {
        liveLabel.classList.toggle('text-gray-300', !confidenceTrackingEnabled);
        liveLabel.classList.toggle('line-through', !confidenceTrackingEnabled);
    }
    if (trackingToggle) {
        trackingToggle.textContent = confidenceTrackingEnabled ? 'On' : 'Off';
        trackingToggle.classList.toggle('text-gray-400', !confidenceTrackingEnabled);
        trackingToggle.classList.toggle('text-green-600', confidenceTrackingEnabled);
    }
}

function loadHideMeaningChoices() {
    try {
        const stored = localStorage.getItem(HIDE_MEANING_CHOICES_KEY);
        hideMeaningChoices = stored === 'true';
    } catch (e) {
        console.warn('Failed to load meaning choice visibility', e);
    }
}

function saveHideMeaningChoices() {
    try {
        localStorage.setItem(HIDE_MEANING_CHOICES_KEY, hideMeaningChoices.toString());
    } catch (e) {
        console.warn('Failed to save meaning choice visibility', e);
    }
}

function saveConfidencePanelVisibility() {
    try {
        localStorage.setItem(CONFIDENCE_PANEL_KEY, confidencePanelVisible.toString());
    } catch (e) {
        console.warn('Failed to save confidence panel visibility', e);
    }
}

function isNarrowViewport() {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function') {
        return window.matchMedia('(max-width: 1024px)').matches;
    }
    return (window.innerWidth || 0) <= 1024;
}

function getMeasuredWidth(element) {
    if (!element) return 0;
    try {
        const rect = element.getBoundingClientRect?.();
        const width = rect?.width ?? 0;
        if (width > 0) return Math.round(width);
    } catch {
        // ignore measurement errors
    }
    const fallback = element.offsetWidth || 0;
    return fallback > 0 ? Math.round(fallback) : 0;
}

function updateRightSideSpacing() {
    const appContainer = document.querySelector('.app-container');
    const mainContent = document.querySelector('.main-content');
    if (!appContainer) return;
    const gutter = 16;

    if (document.body?.classList?.contains('study-mode-active') || isNarrowViewport()) {
        appContainer.style.paddingRight = '0px';
        return;
    }

    // Clear any leftover margin from old approach
    if (mainContent) {
        mainContent.style.marginRight = '';
    }

    // Chat panel takes priority when visible
    if (chatPanelVisible) {
        const chatPanelWidth = 320; // w-80 = 20rem
        appContainer.style.paddingRight = `${chatPanelWidth + gutter}px`;
    } else if (confidencePanelVisible) {
        const panelWidth = getMeasuredWidth(confidencePanel);
        appContainer.style.paddingRight = panelWidth ? `${panelWidth + gutter}px` : '0px';
    } else {
        appContainer.style.paddingRight = '0px';
    }
}

// Keep this for backward compatibility
function updateConfidenceLayoutSpacing(panelWidth) {
    updateRightSideSpacing();
}

function positionConfidencePullTab() {
    const pullTab = document.getElementById('confidencePullTab');
    if (!pullTab) return;
    const panelWidth = getMeasuredWidth(confidencePanel);
    pullTab.style.right = (confidencePanelVisible && panelWidth) ? `${panelWidth}px` : '0';
}

function setConfidencePanelVisible(visible) {
    confidencePanelVisible = Boolean(visible);
    const pullTab = document.getElementById('confidencePullTab');
    const content = document.getElementById('confidencePanelContent');

    if (confidencePanelVisible) {
        // Show panel
        if (confidencePanel) {
            confidencePanel.style.display = 'flex';
            confidencePanel.style.transform = 'translateX(0)';
            confidencePanel.style.visibility = 'visible';
        }
        if (pullTab) {
            positionConfidencePullTab();
            pullTab.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>';
        }
        if (content) content.classList.remove('hidden');
    } else {
        // Hide panel
        if (confidencePanel) {
            confidencePanel.style.display = 'flex';
            confidencePanel.style.transform = 'translateX(100%)';
            confidencePanel.style.visibility = 'hidden';
        }
        if (pullTab) {
            pullTab.style.right = '0';
            pullTab.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>';
        }
        if (content) content.classList.add('hidden');
    }

    updateRightSideSpacing();
    saveConfidencePanelVisibility();
}

function toggleConfidencePanel() {
    setConfidencePanelVisible(!confidencePanelVisible);
}

function setHideMeaningChoices(value, options = {}) {
    hideMeaningChoices = Boolean(value);
    saveHideMeaningChoices();
    if (options.refresh !== false) {
        updateMeaningChoicesVisibility();
    }
}

function toggleHideMeaningChoices() {
    setHideMeaningChoices(!hideMeaningChoices);
}

// Setup keyboard shortcut hints that appear when inputs are not focused
function setupInputShortcutHints() {
    const inputs = [
        document.getElementById('answerInput'),
        document.getElementById('fuzzyInput')
    ].filter(Boolean);

    inputs.forEach(input => {
        if (input.dataset.hintSetup) return;
        input.dataset.hintSetup = 'true';

        const originalPlaceholder = input.placeholder || 'Type your answer...';

        input.addEventListener('focus', () => {
            input.placeholder = originalPlaceholder;
        });

        input.addEventListener('blur', () => {
            if (!input.value.trim()) {
                input.placeholder = `${originalPlaceholder} (press / to focus)`;
            }
        });

        // Set initial state if not focused
        if (document.activeElement !== input && !input.value.trim()) {
            input.placeholder = `${originalPlaceholder} (press / to focus)`;
        }
    });
}

function ensureConfidencePanel() {
    if (typeof document === 'undefined') return;
    if (confidencePanel && confidenceListElement && confidenceSummaryElement) return;

    let panel = document.getElementById('confidencePanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'confidencePanel';
        // Fixed right-side panel styling
        panel.className = 'fixed top-0 right-0 bottom-0 w-52 bg-white border-l border-gray-200 shadow-lg p-3 flex flex-col z-40';
        panel.style.cssText = 'background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); font-size: 0.8rem; transition: transform 0.2s ease;';
        panel.innerHTML = `
            <div id="confidencePanelContent">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <div>
                        <div class="text-[11px] uppercase tracking-[0.28em] text-gray-400">Confidence</div>
                        <div class="text-sm font-semibold text-gray-900">Least → Most sure</div>
                        <div id="confidenceGoalBadge" class="hidden inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">All ≥ ${CONFIDENCE_GOAL}</div>
                    </div>
                </div>
                <div id="confidenceSummary" class="text-xs text-gray-500 mb-2"></div>
                <div id="confidenceList" class="space-y-1 flex-1 overflow-y-auto pr-1"></div>
            </div>
        `;
        document.body.appendChild(panel);

        // Create pull tab as separate fixed element
        const pullTab = document.createElement('button');
        pullTab.id = 'confidencePullTab';
        pullTab.type = 'button';
        pullTab.className = 'fixed top-1/2 -translate-y-1/2 w-5 h-16 bg-white border border-gray-200 rounded-l-md shadow-sm hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 z-50';
        pullTab.style.cssText = 'right: 13rem; transition: right 0.2s ease;';
        pullTab.title = 'Toggle confidence panel';
        pullTab.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>';
        document.body.appendChild(pullTab);
    }

    confidencePanel = panel;
    confidenceListElement = panel.querySelector('#confidenceList');
    confidenceSummaryElement = panel.querySelector('#confidenceSummary');

    const pullTab = document.getElementById('confidencePullTab');
    if (pullTab && !pullTab.dataset.bound) {
        pullTab.dataset.bound = 'true';
        pullTab.addEventListener('click', toggleConfidencePanel);
    }

    if (typeof window !== 'undefined' && !window.__confidencePanelResizeBound) {
        window.__confidencePanelResizeBound = true;
        let resizeRaf = null;
        window.addEventListener('resize', () => {
            if (resizeRaf) cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(() => {
                resizeRaf = null;
                updateRightSideSpacing();
                positionConfidencePullTab();
            });
        });
    }

    const trackingToggle = document.getElementById('confidenceTrackingToggle');
    if (trackingToggle && !trackingToggle.dataset.bound) {
        trackingToggle.dataset.bound = 'true';
        trackingToggle.addEventListener('click', toggleConfidenceTracking);
    }

    // Apply persisted visibility and tracking state
    setConfidencePanelVisible(confidencePanelVisible);
    updateConfidenceTrackingUI();
}

const CONFIDENCE_SECTIONED_THRESHOLD = 50; // use 3-section layout when deck exceeds this size
const CONFIDENCE_SECTION_SIZE = 10;        // number of items per section in sectioned view

function renderConfidenceRow(entry, isBKT, minScore, maxScore) {
    const { item, stats, score } = entry;
    const served = stats.served || 0;
    const correct = stats.correct || 0;
    const accPct = served ? Math.round((correct / served) * 100) : 0;
    const pinyin = item.pinyin ? item.pinyin.split('/')[0].trim() : '';
    const span = Math.max(0.0001, maxScore - minScore);

    let pct, barColor, scoreDisplay;
    if (isBKT) {
        pct = Math.max(0, Math.min(100, Math.round(score * 100)));
        barColor = score >= BKT_MASTERY_THRESHOLD ? 'bg-emerald-500' : (score >= 0.5 ? 'bg-yellow-500' : 'bg-amber-500');
        scoreDisplay = `${pct}%`;
    } else {
        const normalized = (score - minScore) / span;
        pct = Math.max(0, Math.min(100, Math.round(normalized * 100)));
        barColor = pct < 35 ? 'bg-amber-500' : (pct < 70 ? 'bg-yellow-500' : 'bg-emerald-500');
        scoreDisplay = score.toFixed(2);
    }

    const masteredBadge = isBKT && score >= BKT_MASTERY_THRESHOLD
        ? '<span class="ml-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">✓</span>'
        : '';

    // For long text (sentences), use smaller font and truncate
    const charText = item.char || '?';
    const isLongText = charText.length > 6;
    const displayChar = isLongText ? charText.slice(0, 12) + (charText.length > 12 ? '…' : '') : charText;
    const charClass = isLongText ? 'text-sm' : 'text-2xl';

    return `
        <div class="flex items-center justify-between gap-2 px-2 py-1 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition">
            <div class="flex items-center gap-2 min-w-0 overflow-hidden">
                <span class="${charClass} font-semibold text-gray-900 truncate" title="${escapeHtml(charText)}">${escapeHtml(displayChar)}</span>
                <div class="min-w-0 shrink-0">
                    ${pinyin ? `<div class="text-xs text-gray-600 truncate max-w-[60px]">${escapeHtml(pinyin.slice(0, 8))}${pinyin.length > 8 ? '…' : ''}</div>` : ''}
                    <div class="text-[11px] text-gray-500 whitespace-nowrap">${served ? `${accPct}% · ${served}` : 'new'}</div>
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <div class="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full ${barColor}" style="width: ${pct}%;"></div>
                </div>
                <span class="text-[10px] font-semibold text-gray-700">${scoreDisplay}${masteredBadge}</span>
            </div>
        </div>
    `;
}

function renderConfidenceSection(title, entries, isBKT, minScore, maxScore, colorClass) {
    if (!entries.length) return '';
    const rows = entries.map(e => renderConfidenceRow(e, isBKT, minScore, maxScore)).join('');
    return `
        <div class="mb-4">
            <div class="text-xs font-semibold uppercase tracking-wide ${colorClass} mb-2 px-2">${title}</div>
            ${rows}
        </div>
    `;
}

function renderConfidenceList() {
    if (typeof document === 'undefined') return;
    ensureConfidencePanel();
    if (!confidenceListElement) return;

    if (!confidencePanelVisible) return;

    const pool = (Array.isArray(originalQuizCharacters) && originalQuizCharacters.length)
        ? originalQuizCharacters
        : (Array.isArray(quizCharacters) ? quizCharacters : []);

    if (!pool.length) {
        confidenceListElement.innerHTML = '<div class="text-xs text-gray-500">No words loaded yet.</div>';
        if (confidenceSummaryElement) confidenceSummaryElement.textContent = '';
        return;
    }

    const isBKT = confidenceFormula === CONFIDENCE_FORMULAS.BKT;
    const goalThreshold = isBKT ? BKT_MASTERY_THRESHOLD : CONFIDENCE_GOAL;

    const scored = pool.map(item => {
        const stats = getSchedulerStats(item.char);
        return {
            item,
            stats,
            score: getConfidenceScore(item.char)
        };
    });

    scored.sort((a, b) => a.score - b.score);
    const totalCount = scored.length;
    const allScores = scored.map(s => s.score);
    const minScore = Math.min(...allScores);
    const maxScore = Math.max(...allScores);
    const skillLabel = getCurrentSkillKey();
    const allAboveGoal = scored.length > 0 && scored.every(s => s.score >= goalThreshold);

    // Use sectioned view for large decks
    if (totalCount > CONFIDENCE_SECTIONED_THRESHOLD) {
        const sectionSize = CONFIDENCE_SECTION_SIZE;
        const lowest = scored.slice(0, sectionSize);
        const middleStart = Math.floor((totalCount - sectionSize) / 2);
        const middle = scored.slice(middleStart, middleStart + sectionSize);
        const highest = scored.slice(-sectionSize).reverse(); // reverse so highest first

        const html =
            renderConfidenceSection(`Lowest Confidence (${sectionSize})`, lowest, isBKT, minScore, maxScore, 'text-amber-600') +
            renderConfidenceSection(`Middle (${sectionSize})`, middle, isBKT, minScore, maxScore, 'text-yellow-600') +
            renderConfidenceSection(`Highest Confidence (${sectionSize})`, highest, isBKT, minScore, maxScore, 'text-emerald-600');

        confidenceListElement.innerHTML = html;

        if (confidenceSummaryElement) {
            const formulaLabel = isBKT ? 'BKT' : 'heuristic';
            const goalText = allAboveGoal ? (isBKT ? ' · all mastered 🎉' : ` · all ≥ ${CONFIDENCE_GOAL} 🎉`) : '';
            confidenceSummaryElement.textContent = `${totalCount} words (sectioned view) · ${formulaLabel}${goalText} · skill: ${skillLabel}`;
        }
    } else {
        // Original flat view for smaller decks
        const renderCount = Math.min(CONFIDENCE_RENDER_LIMIT, totalCount);
        const visible = scored.slice(0, renderCount);

        const rows = visible.map(entry => renderConfidenceRow(entry, isBKT, minScore, maxScore)).join('');

        confidenceListElement.innerHTML = rows;
        if (confidenceSummaryElement) {
            const formulaLabel = isBKT ? 'BKT' : 'heuristic';
            const goalText = allAboveGoal ? (isBKT ? ' · all mastered 🎉' : ` · all ≥ ${CONFIDENCE_GOAL} 🎉`) : '';
            const scopeText = renderCount < totalCount
                ? `Showing lowest ${renderCount}/${totalCount}`
                : `${totalCount} words`;
            confidenceSummaryElement.textContent = `${scopeText} · ${formulaLabel}${goalText} · skill: ${skillLabel}`;
        }
    }

    const goalBadge = document.getElementById('confidenceGoalBadge');
    if (goalBadge) {
        goalBadge.classList.toggle('hidden', !allAboveGoal);
    }
}

function ensureConfettiStyles() {
    if (confettiStyleInjected || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.id = 'quizConfettiStyles';
    style.textContent = `
        @keyframes quiz-confetti-fall {
            0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
            100% { transform: translate3d(0, 80vh, 0) rotate(360deg); opacity: 0; }
        }
        .quiz-confetti-piece {
            position: fixed;
            top: 0;
            width: 10px;
            height: 14px;
            border-radius: 2px;
            will-change: transform, opacity;
            pointer-events: none;
            z-index: 70;
            opacity: 0;
        }
    `;
    document.head.appendChild(style);
    confettiStyleInjected = true;
}

function fireConfettiBurst(pieces = 60) {
    if (typeof document === 'undefined') return;
    ensureConfettiStyles();
    const colors = ['#22d3ee', '#10b981', '#f97316', '#eab308', '#3b82f6', '#a855f7', '#ef4444'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < pieces; i++) {
        const div = document.createElement('div');
        div.className = 'quiz-confetti-piece';
        const left = Math.random() * 100;
        const delay = Math.random() * 0.2;
        const duration = 1 + Math.random() * 0.9;
        const rotate = (Math.random() * 720 - 360).toFixed(1);
        const size = 8 + Math.random() * 6;
        div.style.left = `${left}vw`;
        div.style.background = colors[Math.floor(Math.random() * colors.length)];
        div.style.animation = `quiz-confetti-fall ${duration}s ease-out ${delay}s forwards`;
        div.style.transform = `rotate(${rotate}deg)`;
        div.style.width = `${size}px`;
        div.style.height = `${size + 4}px`;
        div.addEventListener('animationend', () => div.remove());
        frag.appendChild(div);
    }
    document.body.appendChild(frag);
}

function showBatchCompletionToast(setLabel, cycleNumber, setSize) {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById(BATCH_TOAST_ID);
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = BATCH_TOAST_ID;
    toast.className = 'command-palette-toast';
    const cycleText = cycleNumber > 1 ? ` · cycle ${cycleNumber}` : '';
    toast.innerHTML = `
        <span class="font-semibold text-blue-900">Set ${setLabel} mastered</span>
        <span class="text-gray-700 text-sm">${setSize}-card set${cycleText} complete. Loading the next set…</span>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('command-palette-toast-show'));

    setTimeout(() => {
        toast.classList.remove('command-palette-toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 2600);
}

function showBatchSwapToast(setLabel, cycleNumber, setSize) {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById(BATCH_TOAST_ID);
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = BATCH_TOAST_ID;
    toast.className = 'command-palette-toast';
    const cycleText = cycleNumber > 1 ? ` · cycle ${cycleNumber}` : '';
    toast.innerHTML = `
        <span class="font-semibold text-blue-900">New set loaded</span>
        <span class="text-gray-700 text-sm">Set ${setLabel}${cycleText} · ${setSize}-card set ready.</span>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('command-palette-toast-show'));

    setTimeout(() => {
        toast.classList.remove('command-palette-toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function getCurrentBatchSize() {
    const cycle = Number.isFinite(batchModeState?.cycleCount) ? batchModeState.cycleCount : 0;
    if (schedulerMode === SCHEDULER_MODES.BATCH_2) {
        return cycle > 0 ? BATCH_2_COMBINED_SIZE : BATCH_2_INITIAL_SIZE;
    }
    return cycle > 0 ? BATCH_COMBINED_SIZE : BATCH_INITIAL_SIZE;
}

function isBatchMode() {
    return schedulerMode === SCHEDULER_MODES.BATCH_5 || schedulerMode === SCHEDULER_MODES.BATCH_2;
}

function selectBatchFromPool(pool, size) {
    const targetSize = Number.isFinite(size) ? size : getCurrentBatchSize();
    if (!Array.isArray(pool) || !pool.length) return [];
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(targetSize, shuffled.length));
}

function startNewBatch() {
    if (!isBatchMode()) return;

    const available = Array.isArray(quizCharacters) ? quizCharacters.slice() : [];
    if (!available.length) {
        batchModeState.activeBatch = [];
        updateBatchStatusDisplay();
        return;
    }

    const usedSet = new Set(Array.isArray(batchModeState.usedChars) ? batchModeState.usedChars : []);
    let pool = available.filter(item => !usedSet.has(item.char));

    if (!pool.length) {
        usedSet.clear();
        batchModeState.usedChars = [];
        batchModeState.cycleCount = (batchModeState.cycleCount || 0) + 1;
        pool = available.slice();
    }

    const batchSize = getCurrentBatchSize();
    const nextBatch = (batchModeState.cycleCount > 0)
        ? selectLeastConfident(pool, batchSize)
        : selectBatchFromPool(pool, batchSize);
    if (!nextBatch.length) return;

    batchModeState.activeBatch = nextBatch.map(item => item.char);
    nextBatch.forEach(item => usedSet.add(item.char));
    batchModeState.usedChars = Array.from(usedSet);
    batchModeState.batchIndex = Math.max(1, (batchModeState.batchIndex || 0) + 1);
    batchModeState.seenInBatch = [];
    batchModeState.lastStartedAt = Date.now();
    saveBatchState();

    previewQueue = [];
    ensurePreviewQueue();
    updatePreviewDisplay();
    updateBatchStatusDisplay();
}

function advanceBatchSetNow() {
    // Force-load the next batch set (used by command palette)
    if (!isBatchMode()) {
        setSchedulerMode(SCHEDULER_MODES.BATCH_5);
    }

    // Mark current set as completed and clear it
    batchModeState.activeBatch = [];
    saveBatchState();

    startNewBatch();
    const setLabel = Math.max(1, batchModeState.batchIndex || 1);
    const cycleNumber = Math.max(1, (batchModeState.cycleCount || 0) + 1);
    const setSize = getCurrentBatchSize();
    showBatchCompletionToast(setLabel - 1, cycleNumber, setSize);
    showBatchSwapToast(setLabel, cycleNumber, setSize);

    // Move to a question from the new set immediately
    generateQuestion();
}

function getBatchQuestionPool() {
    if (!isBatchMode()) {
        return Array.isArray(quizCharacters) ? quizCharacters : [];
    }

    const active = getActiveBatchQuestions();
    if (active.length) {
        return active;
    }

    startNewBatch();
    return getActiveBatchQuestions();
}

function prepareBatchForNextQuestion() {
    if (!isBatchMode()) return;
    reconcileBatchStateWithQueue();
    const progress = getBatchMasteryProgress();

    const allSeen = progress.seenCount === progress.total;

    if (!progress.total || (allSeen && progress.masteredCount === progress.total)) {
        startNewBatch();
    } else {
        updateBatchStatusDisplay();
    }
}

function maybeAdvanceBatchAfterAnswer() {
    if (!isBatchMode()) return;
    const progress = getBatchMasteryProgress();
    const allSeen = progress.seenCount === progress.total;
    if (!progress.total) {
        startNewBatch();
        return;
    }
    if (allSeen && progress.masteredCount === progress.total) {
        const setLabel = Math.max(1, batchModeState.batchIndex || 1);
        const cycleNumber = Math.max(1, (batchModeState.cycleCount || 0) + 1);
        showBatchCompletionToast(setLabel, cycleNumber, progress.total);
        fireConfettiBurst();
        startNewBatch();
    } else {
        updateBatchStatusDisplay();
    }
}

function updateBatchStatusDisplay() {
    const statusEl = document.getElementById('batchModeStatus');
    if (!statusEl) return;

    if (!isBatchMode()) {
        statusEl.innerHTML = '';
        statusEl.className = 'hidden';
        return;
    }

    const progress = getBatchMasteryProgress();
    const active = progress.active;
    const masteredCount = progress.masteredCount;
    const totalAvailable = Array.isArray(quizCharacters) ? quizCharacters.length : active.length;
    const usedCount = Array.isArray(batchModeState.usedChars) ? batchModeState.usedChars.length : 0;
    const remaining = Math.max(0, totalAvailable - usedCount);
    const cycleNumber = Math.max(1, (batchModeState.cycleCount || 0) + 1);
    const cycleLabel = `cycle ${cycleNumber}`;
    const setLabel = Math.max(1, batchModeState.batchIndex || 1);
    const currentBatchSize = getCurrentBatchSize();

    statusEl.className = 'mt-1 text-xs text-blue-800';

    if (!active.length) {
        statusEl.textContent = `Batch mode active: preparing a ${currentBatchSize}-card set.`;
        return;
    }

    const charBadges = active.map(item => {
        const mastered = isBatchCharMastered(item.char);
        const cls = mastered ? 'text-green-700 font-semibold' : 'text-gray-900';
        return `<span class="${cls}">${escapeHtml(item.char)}</span>`;
    }).join(' ');

    statusEl.innerHTML = `
        <div class="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-500">Batch Mode</div>
        <div class="text-sm text-blue-900">Set ${setLabel} · ${cycleLabel} · ${currentBatchSize}-card set: ${charBadges}</div>
        <div class="text-[11px] text-blue-800">${masteredCount}/${active.length} mastered · ${remaining} unused left</div>
    `;
}

function updateAdaptiveStatusDisplay() {
    const statusEl = document.getElementById('adaptiveModeStatus');
    if (!statusEl) return;

    if (schedulerMode !== SCHEDULER_MODES.ADAPTIVE_5) {
        statusEl.innerHTML = '';
        statusEl.className = 'hidden';
        return;
    }

    const deckItems = getAdaptiveQuestionPool();
    const masteredCount = Array.isArray(adaptiveDeckState.mastered) ? adaptiveDeckState.mastered.length : 0;
    const totalAvailable = Array.isArray(quizCharacters) ? quizCharacters.length : deckItems.length;
    const remaining = getAdaptiveSourcePool().length;
    const cycleNumber = Math.max(1, (adaptiveDeckState.cycleCount || 0) + 1);

    const deckBadges = deckItems.length
        ? deckItems.map(item => {
            const r = getAdaptiveReadiness(item.char);
            const statusColor = r.ready ? 'text-emerald-700 font-semibold' : 'text-gray-900';
            const pill = `
                <div class="adaptive-pill">
                    <span class="${statusColor}">${escapeHtml(item.char)}</span>
                    <span class="${r.servedOk ? 'badge-ok' : 'badge-miss'}">Seen ${r.served}/${ADAPTIVE_GRAD_MIN_SERVED}</span>
                    <span class="${r.streakOk ? 'badge-ok' : 'badge-miss'}">Streak ${r.streak}/${ADAPTIVE_GRAD_MIN_STREAK}</span>
                    <span class="${r.confidenceOk ? 'badge-ok' : 'badge-miss'}">Conf ${r.score.toFixed(2)}/${r.threshold.toFixed(2)}</span>
                </div>`;
            return pill;
        }).join('')
        : '<div class="text-gray-500">—</div>';

    const readyCount = deckItems.filter(item => getAdaptiveReadiness(item.char).ready).length;

    statusEl.className = 'mt-1 text-xs text-indigo-800';
    statusEl.innerHTML = `
        <div class="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-500">Adaptive 5</div>
        <div class="text-sm text-indigo-900">Deck ${deckItems.length}/${ADAPTIVE_DECK_SIZE} · Ready ${readyCount}/${deckItems.length}</div>
        <div class="text-[11px] text-indigo-700">${masteredCount} graduated · ${remaining} remaining · cycle ${cycleNumber}</div>
        <div class="adaptive-pill-wrap">${deckBadges}</div>
    `;
}

function updateComposerStatusDisplay() {
    const statusEl = document.getElementById('composerModeStatus');
    if (!statusEl) return;

    if (!composerEnabled || !composerPipeline.length) {
        statusEl.innerHTML = '';
        statusEl.className = 'hidden';
        return;
    }

    const currentStage = getComposerCurrentStage();
    const total = composerPipeline.length;
    const itemsHtml = composerPipeline.map((step, idx) => {
        const mastered = isModeFullyMastered(step.mode);
        const active = idx === composerStageIndex;
        const cls = mastered ? 'composer-step mastered' : active ? 'composer-step active' : 'composer-step';
        const readyIcon = mastered ? '✓' : active ? '›' : '';
        return `<div class="${cls}"><span class="composer-step-icon">${readyIcon}</span><span class="composer-step-label">${step.label}</span></div>`;
    }).join('');

    // Progress for current stage
    let masteredCount = 0;
    let totalChars = Array.isArray(quizCharacters) ? quizCharacters.length : 0;
    if (currentStage && totalChars) {
        masteredCount = quizCharacters.filter(q => isCharMasteredForMode(q.char, currentStage.mode)).length;
    }

    statusEl.className = 'mt-1 text-xs text-emerald-800';
    statusEl.innerHTML = `
        <div class="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-500">Composer</div>
        <div class="text-sm text-emerald-900">Stage ${composerStageIndex + 1}/${total}: ${currentStage ? currentStage.label : ''}</div>
        <div class="text-[11px] text-emerald-700">Mastered ${masteredCount}/${totalChars}</div>
        <div class="composer-steps">${itemsHtml}</div>
    `;
}

function checkComposerAdvance() {
    if (!composerEnabled) return;
    const currentStage = getComposerCurrentStage();
    if (!currentStage) return;

    if (isModeFullyMastered(currentStage.mode)) {
        if (composerStageIndex < composerPipeline.length - 1) {
            composerStageIndex++;
            saveComposerState();
            const nextStage = getComposerCurrentStage();
            if (nextStage) {
                mode = nextStage.mode;
                saveQuizMode('composer');
                updateComposerStatusDisplay();
                // keep composer button highlighted; regenerate
                generateQuestion();
                // Give user a visual cue
                hint.textContent = `Composer → ${nextStage.label}`;
                hint.className = 'text-center text-lg font-semibold my-2 text-emerald-600';
            }
        } else {
            // Completed all stages
            updateComposerStatusDisplay();
            if (hint) {
                hint.textContent = 'Composer complete — all stages mastered!';
                hint.className = 'text-center text-lg font-semibold my-2 text-emerald-600';
            }
        }
    } else {
        updateComposerStatusDisplay();
    }
}

function setSchedulerMode(mode) {
    if (!Object.values(SCHEDULER_MODES).includes(mode)) return;
    const switchingToBatch = (mode === SCHEDULER_MODES.BATCH_5 || mode === SCHEDULER_MODES.BATCH_2) && !isBatchMode();
    schedulerMode = mode;
    saveSchedulerMode(mode);
    if (switchingToBatch) {
        resetBatchState({ refresh: false });
    }
    updateSchedulerToolbar();
    if (isBatchMode()) {
        batchModeState.activeBatch = [];
        prepareBatchForNextQuestion();
    } else {
        updateBatchStatusDisplay();
    }
    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        prepareAdaptiveForNextQuestion();
    } else {
        updateAdaptiveStatusDisplay();
    }
    if (schedulerMode === SCHEDULER_MODES.FEED || schedulerMode === SCHEDULER_MODES.FEED_SR) {
        loadFeedState();
        prepareFeedForNextQuestion();
    } else {
        updateFeedStatusDisplay();
    }
    if (schedulerMode === SCHEDULER_MODES.ORDERED) {
        schedulerOrderedIndex = 0;
    }
    // Refresh queues to reflect new ordering
    previewQueue = [];
    ensurePreviewQueue();
    updatePreviewDisplay();
    updateFullscreenQueueDisplay();
}

function getFullscreenQueueCandidates() {
    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        const deckPool = getAdaptiveQuestionPool();
        if (isPreviewModeActive() && Array.isArray(previewQueue) && previewQueue.length) {
            const previewChars = previewQueue.map(item => item && item.char);
            const remainder = (Array.isArray(deckPool) ? deckPool : []).filter(item => !previewChars.includes(item?.char));
            return [...previewQueue, ...remainder];
        }
        return Array.isArray(deckPool) ? deckPool.slice() : [];
    }
    if (isBatchMode()) {
        const batchPool = getBatchQuestionPool();
        if (isPreviewModeActive() && Array.isArray(previewQueue) && previewQueue.length) {
            const previewChars = previewQueue.map(item => item && item.char);
            const remainder = (Array.isArray(batchPool) ? batchPool : []).filter(item => !previewChars.includes(item?.char));
            return [...previewQueue, ...remainder];
        }
        return Array.isArray(batchPool) ? batchPool.slice() : [];
    }
    if (schedulerMode === SCHEDULER_MODES.FEED || schedulerMode === SCHEDULER_MODES.FEED_SR) {
        const feedPool = getFeedQuestionPool();
        if (isPreviewModeActive() && Array.isArray(previewQueue) && previewQueue.length) {
            const previewChars = previewQueue.map(item => item && item.char);
            const remainder = (Array.isArray(feedPool) ? feedPool : []).filter(item => !previewChars.includes(item?.char));
            return [...previewQueue, ...remainder];
        }
        return Array.isArray(feedPool) ? feedPool.slice() : [];
    }
    if (schedulerMode === SCHEDULER_MODES.ORDERED) {
        // Ordered uses current pool order directly
        return Array.isArray(quizCharacters) ? quizCharacters.slice() : [];
    }

    // Prefer the preview queue if it is active (closest to the actual next set)
    if (isPreviewModeActive() && Array.isArray(previewQueue) && previewQueue.length) {
        const previewChars = previewQueue.map(item => item && item.char);
        const remainder = (Array.isArray(quizCharacters) ? quizCharacters : []).filter(item => !previewChars.includes(item?.char));
        return [...previewQueue, ...remainder];
    }

    // Fallback: show the full current quiz pool in order
    return Array.isArray(quizCharacters) ? quizCharacters.slice() : [];
}

function updateFullscreenQueueDisplay() {
    const queueEl = document.getElementById('fullscreenSrQueue');
    if (!queueEl) return;

    const queue = getFullscreenQueueCandidates();

    if (!queue.length) {
        queueEl.innerHTML = `<li class="text-sm text-gray-500">Queue will appear once characters load.</li>`;
        return;
    }

    const items = queue.map((item, idx) => {
        const pinyin = item.pinyin ? item.pinyin.split('/')[0].trim() : '';
        const isCurrent = currentQuestion && currentQuestion.char === item.char;
        return `
            <li class="flex items-center justify-between gap-3 border ${isCurrent ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-transparent'} rounded-lg px-3 py-2">
                <div class="flex items-center gap-3">
                    <span class="text-xs font-semibold text-gray-500">#${idx + 1}</span>
                    <span class="text-2xl font-bold text-gray-900">${escapeHtml(item.char || '?')}</span>
                    <span class="text-sm text-gray-500">${escapeHtml(pinyin)}</span>
                </div>
            </li>
        `;
    }).join('');

    queueEl.innerHTML = items;
}

function ensureSchedulerToolbar() {
    // For experimental layout, insert after quiz-header; otherwise use legacy container
    const quizHeader = document.querySelector('.quiz-header');
    const isExperimentalLayout = document.body.classList.contains('experimental-layout');

    const container = isExperimentalLayout
        ? (quizHeader?.parentElement || document.querySelector('.main-content'))
        : (document.querySelector('.quiz-shell') ||
           document.querySelector('.max-w-3xl') ||
           document.getElementById('questionDisplay')?.parentElement);

    const insertAfter = isExperimentalLayout ? quizHeader : null;
    const question = document.getElementById('questionDisplay');
    if (!container) return;

    let bar = document.getElementById('schedulerToolbar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'schedulerToolbar';
        bar.className = 'mb-2 flex flex-col items-center gap-1';
        bar.innerHTML = `
            <div id="schedulerModeLabel" class="hidden"></div>
            <div id="schedulerModeDescription" class="hidden"></div>
            <div id="batchModeStatus" class="hidden"></div>
            <div id="adaptiveModeStatus" class="hidden"></div>
            <div id="composerModeStatus" class="hidden"></div>
            <div id="feedModeStatus" class="hidden"></div>
            <div class="flex flex-nowrap gap-1 justify-center items-center overflow-x-auto max-w-full px-2" style="scrollbar-width: none; -ms-overflow-style: none;">
                <button id="schedulerRandomBtn" type="button" class="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:border-blue-400 hover:text-blue-600 transition whitespace-nowrap flex-shrink-0">Random</button>
                <button id="schedulerWeightedBtn" type="button" class="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:border-blue-400 hover:text-blue-600 transition whitespace-nowrap flex-shrink-0">Confidence</button>
                <button id="schedulerAdaptiveBtn" type="button" class="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:border-blue-400 hover:text-blue-600 transition whitespace-nowrap flex-shrink-0">Adaptive 5</button>
                <button id="schedulerFeedBtn" type="button" class="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:border-blue-400 hover:text-blue-600 transition whitespace-nowrap flex-shrink-0">Feed</button>
                <button id="schedulerFeedSRBtn" type="button" class="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:border-blue-400 hover:text-blue-600 transition whitespace-nowrap flex-shrink-0">Feed Grad</button>
                <button id="schedulerBatchBtn" type="button" class="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:border-blue-400 hover:text-blue-600 transition whitespace-nowrap flex-shrink-0">5-Card Sets</button>
                <button id="schedulerBatch2Btn" type="button" class="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:border-blue-400 hover:text-blue-600 transition whitespace-nowrap flex-shrink-0">2-Card Sets</button>
                <button id="schedulerOrderedBtn" type="button" class="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:border-blue-400 hover:text-blue-600 transition whitespace-nowrap flex-shrink-0">In Order</button>
            </div>
        `;
        // Insert after header on experimental layout, or before question on legacy
        if (insertAfter && insertAfter.nextSibling) {
            container.insertBefore(bar, insertAfter.nextSibling);
        } else if (insertAfter) {
            container.appendChild(bar);
        } else if (question) {
            container.insertBefore(bar, question);
        } else {
            container.appendChild(bar);
        }
    }

    const randomBtn = document.getElementById('schedulerRandomBtn');
    const weightedBtn = document.getElementById('schedulerWeightedBtn');
    const adaptiveBtn = document.getElementById('schedulerAdaptiveBtn');
    const feedBtn = document.getElementById('schedulerFeedBtn');
    const feedSRBtn = document.getElementById('schedulerFeedSRBtn');
    const batchBtn = document.getElementById('schedulerBatchBtn');
    const batch2Btn = document.getElementById('schedulerBatch2Btn');
    const orderedBtn = document.getElementById('schedulerOrderedBtn');

    if (randomBtn && !randomBtn.dataset.bound) {
        randomBtn.dataset.bound = 'true';
        randomBtn.onclick = () => setSchedulerMode(SCHEDULER_MODES.RANDOM);
    }
    if (weightedBtn && !weightedBtn.dataset.bound) {
        weightedBtn.dataset.bound = 'true';
        weightedBtn.onclick = () => setSchedulerMode(SCHEDULER_MODES.WEIGHTED);
    }
    if (adaptiveBtn && !adaptiveBtn.dataset.bound) {
        adaptiveBtn.dataset.bound = 'true';
        adaptiveBtn.onclick = () => setSchedulerMode(SCHEDULER_MODES.ADAPTIVE_5);
    }
    if (feedBtn && !feedBtn.dataset.bound) {
        feedBtn.dataset.bound = 'true';
        feedBtn.onclick = () => setSchedulerMode(SCHEDULER_MODES.FEED);
    }
    if (feedSRBtn && !feedSRBtn.dataset.bound) {
        feedSRBtn.dataset.bound = 'true';
        feedSRBtn.onclick = () => setSchedulerMode(SCHEDULER_MODES.FEED_SR);
    }
    if (batchBtn && !batchBtn.dataset.bound) {
        batchBtn.dataset.bound = 'true';
        batchBtn.onclick = () => setSchedulerMode(SCHEDULER_MODES.BATCH_5);
    }
    if (batch2Btn && !batch2Btn.dataset.bound) {
        batch2Btn.dataset.bound = 'true';
        batch2Btn.onclick = () => setSchedulerMode(SCHEDULER_MODES.BATCH_2);
    }
    if (orderedBtn && !orderedBtn.dataset.bound) {
        orderedBtn.dataset.bound = 'true';
        orderedBtn.onclick = () => setSchedulerMode(SCHEDULER_MODES.ORDERED);
    }

    updateSchedulerToolbar();
}

function updateSchedulerToolbar() {
    const labelEl = document.getElementById('schedulerModeLabel');
    const descEl = document.getElementById('schedulerModeDescription');

    if (labelEl) labelEl.textContent = `Next item: ${getSchedulerModeLabel()}`;
    if (descEl) descEl.textContent = getSchedulerModeDescription();

    const btns = [
        { id: 'schedulerRandomBtn', mode: SCHEDULER_MODES.RANDOM },
        { id: 'schedulerWeightedBtn', mode: SCHEDULER_MODES.WEIGHTED },
        { id: 'schedulerAdaptiveBtn', mode: SCHEDULER_MODES.ADAPTIVE_5 },
        { id: 'schedulerFeedBtn', mode: SCHEDULER_MODES.FEED },
        { id: 'schedulerFeedSRBtn', mode: SCHEDULER_MODES.FEED_SR },
        { id: 'schedulerBatchBtn', mode: SCHEDULER_MODES.BATCH_5 },
        { id: 'schedulerBatch2Btn', mode: SCHEDULER_MODES.BATCH_2 },
        { id: 'schedulerOrderedBtn', mode: SCHEDULER_MODES.ORDERED }
    ];
    btns.forEach(({ id, mode }) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const active = schedulerMode === mode;
        btn.className = active
            ? 'px-3 py-2 rounded-lg border border-blue-500 text-white font-semibold bg-blue-500 shadow-sm'
            : 'px-3 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition';
    });

    updateBatchStatusDisplay();
    updateAdaptiveStatusDisplay();
    updateComposerStatusDisplay();
    updateFeedStatusDisplay();
    updateFullscreenNextSetButton();
}

function updateFullscreenNextSetButton() {
    const btn = document.getElementById('fullscreenNextSetBtn');
    if (!btn) return;

    const inBatchMode = isBatchMode();
    btn.disabled = !inBatchMode;
    btn.className = inBatchMode
        ? 'px-4 py-2 rounded-xl border border-amber-200 text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100 transition'
        : 'px-4 py-2 rounded-xl border border-gray-200 text-gray-400 font-semibold bg-gray-50 cursor-not-allowed transition';
    btn.title = inBatchMode ? 'Load a fresh batch set now' : 'Switch to a Batch mode to use this';
}

function getRandomQuestion() {
    if (!Array.isArray(quizCharacters) || quizCharacters.length === 0) return null;
    const index = Math.floor(Math.random() * quizCharacters.length);
    return quizCharacters[index];
}

function selectRandom(pool) {
    if (!pool.length) return null;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
}

function selectOrdered(pool, exclusionSet = new Set()) {
    if (!pool.length) return null;
    if (!Number.isFinite(schedulerOrderedIndex)) {
        schedulerOrderedIndex = 0;
    }
    const n = pool.length;
    schedulerOrderedIndex = ((schedulerOrderedIndex % n) + n) % n;
    for (let i = 0; i < n; i++) {
        const idx = (schedulerOrderedIndex + i) % n;
        const candidate = pool[idx];
        if (candidate && !exclusionSet.has(candidate.char)) {
            schedulerOrderedIndex = (idx + 1) % n;
            return candidate;
        }
    }
    return null;
}

function selectWeighted(pool) {
    const now = Date.now();
    const weights = pool.map(item => {
        const stats = getSchedulerStats(item.char);
        const lastServed = stats.lastServed || 0;
        const served = stats.served || 0;
        const lastWrong = stats.lastWrong || 0;
        const ageSec = Math.max(5, (now - lastServed) / 1000);
        const wrongBonus = lastWrong > 0 && (now - lastWrong) < 300000 ? 2.5 : (stats.wrong > 0 ? 1.4 : 1.0);
        const exposureFactor = 1 / (0.7 + 0.3 * Math.max(1, served));
        const confidenceScore = getConfidenceScore(item.char);
        // Lower confidence → higher multiplier; taper as confidence grows
        const confidenceBoost = Math.pow(Math.max(0.35, 2.8 - confidenceScore), 1.6);
        const weight = Math.pow(ageSec + 15, 1.3) * wrongBonus * exposureFactor * confidenceBoost;
        return { item, weight };
    }).filter(entry => entry.weight > 0);

    const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return selectRandom(pool);

    let r = Math.random() * totalWeight;
    for (const entry of weights) {
        r -= entry.weight;
        if (r <= 0) {
            return entry.item;
        }
    }
    return weights[weights.length - 1]?.item || selectRandom(pool);
}

function selectNextQuestion(exclusions = []) {
    const exclusionSet = new Set(exclusions || []);
    let sourcePool = quizCharacters;
    if (isBatchMode()) {
        sourcePool = getBatchQuestionPool();
    } else if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        sourcePool = getAdaptiveQuestionPool();
    } else if (schedulerMode === SCHEDULER_MODES.FEED || schedulerMode === SCHEDULER_MODES.FEED_SR) {
        sourcePool = getFeedQuestionPool();
    }
    const pool = (Array.isArray(sourcePool) ? sourcePool : []).filter(item => item && !exclusionSet.has(item.char));
    if (!pool.length) return null;

    switch (schedulerMode) {
        case SCHEDULER_MODES.ORDERED:
            return selectOrdered(pool, exclusionSet) || selectRandom(pool);
        case SCHEDULER_MODES.BATCH_5:
        case SCHEDULER_MODES.BATCH_2:
            return selectRandom(pool);
        case SCHEDULER_MODES.ADAPTIVE_5:
            return selectWeighted(pool) || selectRandom(pool);
        case SCHEDULER_MODES.FEED:
        case SCHEDULER_MODES.FEED_SR:
            return selectFeedQuestion(Array.from(exclusionSet)) || selectRandom(pool);
        case SCHEDULER_MODES.WEIGHTED:
            return selectWeighted(pool) || selectRandom(pool);
        case SCHEDULER_MODES.RANDOM:
        default:
            return selectRandom(pool);
    }
}

function isPreviewModeActive() {
    if (!previewQueueEnabled || !previewElement) return false;
    if (!Array.isArray(quizCharacters) || quizCharacters.length === 0) return false;
    if (Array.isArray(previewApplicableModes) && previewApplicableModes.length > 0) {
        return previewApplicableModes.includes(mode);
    }
    return true;
}

function reconcilePreviewQueue(pool = quizCharacters) {
    if (!previewQueueEnabled) return;
    if (!Array.isArray(previewQueue)) {
        previewQueue = [];
    }
    const poolMap = new Map((Array.isArray(pool) ? pool : []).map(item => [item.char, item]));
    // Preserve already-announced upcoming items when they still exist
    previewQueue = previewQueue
        .map(entry => poolMap.get(entry?.char))
        .filter(Boolean)
        .slice(0, previewQueueSize);
}

function triggerCorrectFlash() {
    const root = document.body;
    if (!root) return;
    root.classList.add('flash-correct');
    if (correctFlashTimeout) clearTimeout(correctFlashTimeout);
    correctFlashTimeout = setTimeout(() => {
        root.classList.remove('flash-correct');
        correctFlashTimeout = null;
    }, 650);
}

function showCorrectToast(message = '✓ Correct!') {
    let toast = document.getElementById('correctToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'correctToast';
        toast.className = 'correct-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    if (correctToastTimeout) clearTimeout(correctToastTimeout);
    correctToastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
    }, 1200);
}

function ensurePreviewQueue() {
    if (!previewQueueEnabled || !previewElement) return;
    if (!Array.isArray(previewQueue)) {
        previewQueue = [];
    }
    // Keep the existing "upcoming" items stable before topping up
    reconcilePreviewQueue();
    while (previewQueue.length < previewQueueSize) {
        // Exclude both preview queue items AND the current question
        const excludeChars = previewQueue.map(item => item?.char).filter(Boolean);
        if (currentQuestion?.char) {
            excludeChars.push(currentQuestion.char);
        }
        const candidate = selectNextQuestion(excludeChars);
        if (!candidate) break;
        previewQueue.push(candidate);
        if (quizCharacters.length <= 1) break;
    }
}

function updatePreviewDisplay() {
    if (!previewElement) return;
    const active = isPreviewModeActive();
    if (!active || !previewQueue.length) {
        previewElement.classList.add('hidden');
        if (previewListElement) {
            previewListElement.innerHTML = '';
        }
        updateFullscreenQueueDisplay();
        return;
    }

    previewElement.classList.remove('hidden');
    if (!previewListElement) return;

    previewListElement.innerHTML = previewQueue.map(item => {
        if (!item) return '';
        const char = escapeHtml(item.char || '?');
        const primaryPinyin = item.pinyin ? item.pinyin.split('/')[0].trim() : '';
        const pinyin = primaryPinyin ? `<span class="text-xs text-gray-400">${escapeHtml(primaryPinyin)}</span>` : '';
        const rank = typeof item.rank === 'number'
            ? `<span class="text-[10px] uppercase tracking-widest text-gray-300">#${item.rank}</span>`
            : '';
        return `<div class="flex flex-col items-center gap-1 px-1">
                    <span class="text-4xl text-gray-300">${char}</span>
                    ${pinyin}
                    ${rank}
                </div>`;
    }).join('');

    updateFullscreenQueueDisplay();
}

function renderCharBreakdown() {
    if (!questionDisplay) return;
    const existing = document.getElementById('charBreakdown');
    if (existing) existing.remove();

    if (!currentQuestion || !currentQuestion.char || currentQuestion.char.length <= 1) {
        return;
    }

    const chars = Array.from(currentQuestion.char);
    let pinyinSyllables = [];
    if (typeof splitPinyinSyllables === 'function') {
        pinyinSyllables = splitPinyinSyllables((currentQuestion.pinyin || '').replace(/\//g, ' '));
    }

    let hasGloss = false;
    const parts = chars.map((c, idx) => {
        const py = pinyinSyllables[idx] || '';
        const gloss = (charGlossMap && charGlossMap[c]) ? charGlossMap[c] : '';
        if (gloss) hasGloss = true;
        const glossText = gloss ? gloss : '';
        return `
            <div class="flex items-start gap-3 py-1 border-t border-gray-100 first:border-t-0">
                <div class="text-3xl font-bold text-gray-800 leading-none">${c}</div>
                <div class="flex-1 leading-snug">
                    ${py ? `<div class="text-xs uppercase tracking-wide text-gray-500">${py}</div>` : ''}
                    ${glossText ? `<div class="text-sm text-gray-700">${glossText}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    if (!hasGloss) return;

    const block = `
        <div id="charBreakdown" class="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div class="text-xs font-semibold text-gray-500 uppercase mb-2">Character glosses</div>
            ${parts}
        </div>
    `;

    questionDisplay.insertAdjacentHTML('beforeend', block);
}

function renderCharBreakdownSoon() {
    ensureCharGlossesLoaded().then(() => renderCharBreakdown());
}

function setPreviewQueueEnabled(enabled) {
    const shouldEnable = Boolean(enabled && previewElement);
    previewQueueEnabled = shouldEnable;
    if (!shouldEnable) {
        previewQueue = [];
        updatePreviewDisplay();
        return;
    }
    previewQueue = [];
    ensurePreviewQueue();
    updatePreviewDisplay();
}

function togglePreviewQueue() {
    setPreviewQueueEnabled(!previewQueueEnabled);
}

function checkPinyinMatch(userAnswer, correct) {
    const user = userAnswer.toLowerCase().trim();
    const correctLower = correct.toLowerCase().trim();

    // Handle multiple pronunciations (e.g., "cháng/zhǎng")
    if (correctLower.includes('/')) {
        const options = correctLower.split('/').map(o => o.trim());
        return options.some(option => checkPinyinMatch(user, option));
    }

    // Direct match first (covers identical formatting, tone marks, etc.)
    if (user === correctLower) return true;

    // Convert both to normalized forms for comparison
    const userNormalized = normalizePinyin(user);
    const correctNormalized = normalizePinyin(correctLower);

    const userTones = extractToneSequence(user);
    const correctTones = extractToneSequence(correctLower);

    const baseMatches = userNormalized === correctNormalized;
    const toneMatches = userTones === correctTones && userTones.length === correctTones.length;

    if (baseMatches && toneMatches) return true;

    return false;
}

// Split a Chinese sentence into manageable chunks by punctuation
function splitSentenceIntoChunks(sentence) {
    if (!sentence || !sentence.char) return [];

    const text = sentence.char;
    // Split by Chinese punctuation: comma, period, question mark, exclamation, semicolon, colon
    // Also handle ellipsis and quotes
    const chunks = text.split(/([，。？！；：、…]+|[,.?!;:]+)/g)
        .filter(chunk => chunk.trim().length > 0)
        .reduce((acc, chunk, i, arr) => {
            // Merge punctuation back onto previous chunk
            if (/^[，。？！；：、…,.?!;:]+$/.test(chunk)) {
                if (acc.length > 0) {
                    acc[acc.length - 1] += chunk;
                }
            } else {
                acc.push(chunk);
            }
            return acc;
        }, []);

    // Filter out chunks that are too short (just punctuation or single chars)
    // and create chunk objects
    return chunks
        .filter(chunk => {
            const textOnly = chunk.replace(/[，。？！；：、…,.?!;:\s""''「」『』【】]/g, '');
            return textOnly.length >= 2; // At least 2 characters of actual text
        })
        .map(chunk => ({
            char: chunk.trim(),
            pinyin: '', // Will be generated by TTS
            meaning: '' // Will be graded by Groq
        }));
}

function getPartialMatch(userAnswer, correct) {
    const user = userAnswer.toLowerCase().trim();
    const correctLower = correct.toLowerCase().trim();
    const correctWithNumbers = convertPinyinToToneNumbers(correctLower);

    // Split into syllables (handles both spaced and non-spaced)
    const correctSyllables = splitPinyinSyllables(correctLower);
    const correctNumberSyllables = splitPinyinSyllables(correctWithNumbers);
    const userSyllables = splitPinyinSyllables(user);

    let matched = [];
    let allCorrect = true;

    for (let i = 0; i < userSyllables.length; i++) {
        if (i >= correctSyllables.length) {
            allCorrect = false;
            break;
        }

        const userSyl = userSyllables[i];
        const correctSyl = correctSyllables[i];
        const correctNumSyl = correctNumberSyllables[i];

        if (userSyl === correctSyl || userSyl === correctNumSyl) {
            matched.push(correctSyl);
        } else {
            allCorrect = false;
            break;
        }
    }

    return {
        matched,
        isComplete: matched.length === correctSyllables.length && allCorrect,
        isPartialCorrect: matched.length > 0 && allCorrect,
        totalSyllables: correctSyllables.length
    };
}

function updatePartialProgress() {
    // Disable live preview feedback for char-to-pinyin - only show feedback after Enter
    if (mode === 'char-to-pinyin') return;
    if (mode !== 'audio-to-pinyin' || answered) return;

    const userAnswer = answerInput.value.trim();
    if (!userAnswer) {
        hint.textContent = '';
        hint.className = 'text-center text-2xl font-semibold my-4';
        return;
    }

    const pinyinOptions = currentQuestion.pinyin.split('/').map(p => p.trim());

    for (const option of pinyinOptions) {
        const partial = getPartialMatch(userAnswer, option);

        if (partial.isPartialCorrect) {
            const remaining = option.split(/\s+/).slice(partial.matched.length).join(' ');
            hint.textContent = `✓ ${partial.matched.join(' ')}${remaining ? ' | ' + remaining : ''}`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-blue-600';
            return;
        }
    }

    hint.textContent = '';
    hint.className = 'text-center text-2xl font-semibold my-4';
}

function resetDictationState() {
    dictationParts = [];
    dictationPartElements = [];
    dictationTotalSyllables = 0;
    dictationMatchedSyllables = 0;
    dictationPrimaryPinyin = '';
}

function isDictationSyllableChar(char) {
    if (!char) return false;
    const code = char.codePointAt(0);
    if (code >= 0x3400 && code <= 0x9FFF) return true;
    if (code >= 0xF900 && code <= 0xFAFF) return true;
    if (/[A-Za-z0-9]/.test(char)) return true;
    return false;
}

function getPinyinWordSyllableCounts(pinyin) {
    if (!pinyin) return [];
    return pinyin
        .split(PINYIN_WORD_SEPARATOR_REGEX)
        .filter(Boolean)
        .map(token => {
            const syllableCount = splitPinyinSyllables(token).length;
            return syllableCount > 0 ? syllableCount : 1;
        });
}

function buildDictationParts(question) {
    const text = Array.from(question?.char || '');
    const primaryPinyin = (question?.pinyin || '').split('/')[0]?.trim() || '';
    const syllables = splitPinyinSyllables(primaryPinyin);
    const wordSyllableCounts = getPinyinWordSyllableCounts(primaryPinyin);

    const parts = [];
    let currentPart = null;
    let syllableCursor = 0;
    let wordIndex = 0;
    let charactersAssignedToWord = 0;
    let targetSyllablesForWord = wordSyllableCounts[wordIndex] || 1;

    const finalizeCurrentPart = () => {
        if (!currentPart) return;
        const syllableCount = currentPart.syllables.filter(Boolean).length;
        currentPart.endIndex = currentPart.startIndex + syllableCount;
        currentPart.index = parts.length;
        parts.push(currentPart);
        currentPart = null;
        charactersAssignedToWord = 0;
        wordIndex++;
        targetSyllablesForWord = wordSyllableCounts[wordIndex] || 1;
    };

    for (const char of text) {
        if (isDictationSyllableChar(char)) {
            if (!currentPart) {
                currentPart = {
                    text: '',
                    syllables: [],
                    startIndex: syllableCursor,
                    isDelimiter: false
                };
                charactersAssignedToWord = 0;
                targetSyllablesForWord = wordSyllableCounts[wordIndex] || 1;
            }

            currentPart.text += char;
            if (syllableCursor < syllables.length) {
                currentPart.syllables.push(syllables[syllableCursor]);
            } else {
                currentPart.syllables.push('');
            }
            syllableCursor++;
            charactersAssignedToWord++;

            if (charactersAssignedToWord >= targetSyllablesForWord) {
                finalizeCurrentPart();
            }
        } else {
            if (currentPart) {
                currentPart.text += char;
            } else if (parts.length) {
                parts[parts.length - 1].text += char;
            } else {
                parts.push({
                    text: char,
                    syllables: [],
                    startIndex: syllableCursor,
                    endIndex: syllableCursor,
                    isDelimiter: true,
                    index: 0
                });
            }
        }
    }

    finalizeCurrentPart();

    const totalSyllables = syllables.length;
    parts.forEach((part, idx) => {
        if (typeof part.endIndex !== 'number') {
            const syllableCount = part.syllables.filter(Boolean).length;
            part.endIndex = part.startIndex + syllableCount;
        }
        part.index = idx;
    });

    return {
        parts,
        primaryPinyin,
        totalSyllables
    };
}

function renderDictationSentence(question) {
    const { parts, primaryPinyin, totalSyllables } = buildDictationParts(question);
    dictationParts = parts;
    dictationPrimaryPinyin = primaryPinyin;
    dictationTotalSyllables = totalSyllables;
    dictationMatchedSyllables = 0;

    const sentenceHtml = parts.map(part => {
        const classes = ['dictation-part'];
        if (!part.syllables.length) {
            classes.push('dictation-part-delimiter');
        }
        return `<span class="${classes.join(' ')}" data-part-index="${part.index}" data-syllables="${part.syllables.length}">${escapeHtml(part.text)}</span>`;
    }).join('');

    const meaningHtml = question.meaning ? `
        <div class="text-center text-2xl text-gray-600 mb-4">
            ${escapeHtml(question.meaning)}
        </div>
    ` : '';

    questionDisplay.innerHTML = `
        <div class="dictation-sentence text-center text-5xl md:text-6xl my-8 font-normal text-gray-800 leading-snug">
            ${sentenceHtml}
        </div>
        ${meaningHtml}
        <div class="dictation-controls text-center text-sm text-gray-500 -mt-4 mb-4">
            Type with tone marks (mǎ) or numbers (ma3). Click any segment to replay it. Space = play current part · Ctrl+Space = play full sentence · Shift+Space inserts a space.
        </div>
    `;

    dictationPartElements = Array.from(questionDisplay.querySelectorAll('.dictation-part'));
    dictationPartElements.forEach(el => {
        const index = Number(el.dataset.partIndex);
        if (!Number.isFinite(index)) return;
        el.addEventListener('click', () => {
            const part = dictationParts[index];
            if (!part || !part.syllables.length) return;
            playDictationPart(part);
        });
    });

    updateDictationProgress(0);
}

function updateDictationProgress(matchedSyllables) {
    dictationMatchedSyllables = Math.max(0, Math.min(matchedSyllables || 0, dictationTotalSyllables || 0));

    if (!Array.isArray(dictationPartElements) || !dictationPartElements.length) return;

    const activeIndex = getDictationPartIndexForMatched(dictationMatchedSyllables);

    dictationPartElements.forEach((el, idx) => {
        const part = dictationParts[idx];
        if (!part) return;

        el.classList.remove('dictation-part-current', 'dictation-part-complete');

        if (!part.syllables.length) return;

        if (dictationMatchedSyllables >= part.endIndex) {
            el.classList.add('dictation-part-complete');
        } else if (idx === activeIndex) {
            el.classList.add('dictation-part-current');
        }
    });
}

function getDictationPartIndexForMatched(matchedSyllables) {
    if (!Array.isArray(dictationParts) || !dictationParts.length) return -1;
    for (const part of dictationParts) {
        if (!part || !part.syllables.length) continue;
        if (matchedSyllables < part.endIndex) {
            return part.index;
        }
    }
    return -1;
}

function playDictationPart(part) {
    if (!part || !currentQuestion) return;

    const textToPlay = (part.text || '').trim();
    const pinyinToPlay = part.syllables.filter(Boolean).join(' ');

    if (!textToPlay) {
        playFullDictationSentence();
        return;
    }

    const fallbackPinyin = dictationPrimaryPinyin || currentQuestion.pinyin.split('/')[0].trim();
    playPinyinAudio(pinyinToPlay || fallbackPinyin, textToPlay);
}

function playCurrentDictationPart() {
    if (mode !== 'char-to-pinyin') return;
    const targetIndex = getDictationPartIndexForMatched(dictationMatchedSyllables);
    let part = null;

    if (targetIndex === -1) {
        for (let i = dictationParts.length - 1; i >= 0; i--) {
            if (dictationParts[i]?.syllables?.length) {
                part = dictationParts[i];
                break;
            }
        }
    } else {
        part = dictationParts[targetIndex];
    }

    if (!part && dictationParts.length) {
        part = dictationParts.find(p => p.syllables && p.syllables.length);
    }

    if (!part) {
        playFullDictationSentence();
        return;
    }

    playDictationPart(part);
}

function playFullDictationSentence() {
    if (!currentQuestion) return;
    const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
    playPinyinAudio(firstPinyin, currentQuestion.char);
}

// =============================================================================
// QUIZ LOGIC
// =============================================================================

function getPrefillAnswerForNextQuestion(options = {}) {
    return (options && typeof options.prefillAnswer === 'string')
        ? options.prefillAnswer
        : (typeof nextAnswerBuffer === 'string' ? nextAnswerBuffer : '');
}

function resetForNextQuestion(prefillAnswer) {
    clearPendingNextQuestion();
    stopTimer();
    enteredSyllables = [];
    enteredTones = '';
    toneFlowStage = null;
    toneFlowExpected = [];
    toneFlowIndex = 0;
    answered = false;
    feedback.textContent = '';
    hint.textContent = '';
    hint.className = 'text-center text-2xl font-semibold my-4';
    threeColumnInlineFeedback = null;
    translationInlineFeedback = null;
    if (answerInput) {
        // Don't prefill for char-to-tones mode - tones from previous answer don't carry over
        answerInput.value = (mode === 'char-to-tones') ? '' : prefillAnswer;
    }
    questionAttemptRecorded = false;
    handwritingAnswerShown = false; // Reset handwriting answer shown state
    handwritingSpaceDownTime = null; // Reset space key timing
    if (handwritingHoldTimeout) {
        clearTimeout(handwritingHoldTimeout);
        handwritingHoldTimeout = null;
    }
    lastAnswerCorrect = false;
    clearComponentBreakdown();
    hideDrawNextButton();
    syncModeLayoutState();
}

function prepareSchedulerForNextQuestion() {
    if (isBatchMode()) {
        prepareBatchForNextQuestion();
    }
    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        prepareAdaptiveForNextQuestion();
    }
}

function maybeGenerateChunksQuestion() {
    // Handle chunk modes - iterate through sentence chunks
    if (mode !== 'audio-to-meaning-chunks' && mode !== 'text-to-meaning-chunks') {
        return false;
    }

    // Check if we need a new sentence or can use the next chunk
    if (sentenceChunks.length === 0 || currentChunkIndex >= sentenceChunks.length) {
        // Need a new sentence - select one and split into chunks
        const exclusions = currentFullSentence?.char ? [currentFullSentence.char] : [];
        const nextSentence = selectNextQuestion(exclusions);
        if (nextSentence) {
            currentFullSentence = nextSentence;
            sentenceChunks = splitSentenceIntoChunks(nextSentence);
            currentChunkIndex = 0;
        }
    }

    if (!(sentenceChunks.length > 0 && currentChunkIndex < sentenceChunks.length)) {
        return false;
    }

    currentQuestion = sentenceChunks[currentChunkIndex];
    window.currentQuestion = currentQuestion;

    // Pre-compute upcoming chunk for three-column layout
    if (currentChunkIndex + 1 < sentenceChunks.length) {
        chunksUpcomingChunk = sentenceChunks[currentChunkIndex + 1];
    } else {
        chunksUpcomingChunk = null;
    }

    // Render three-column layout
    if (mode === 'audio-to-meaning-chunks') {
        renderThreeColumnChunksLayout(true);
        if (audioSection) audioSection.classList.remove('hidden');
        setupChunkAudioMode(currentQuestion.char);
    } else {
        // text-to-meaning-chunks
        renderThreeColumnChunksLayout(false);
    }

    if (typeMode) typeMode.style.display = 'block';
    if (answerInput) {
        answerInput.placeholder = 'Type your translation...';
        setTimeout(() => answerInput.focus(), 100);
    }

    startTimer();
    return true;
}

function selectNextQuizQuestion() {
    const previewActive = isPreviewModeActive();
    let nextQuestion = null;

    if (previewActive) {
        ensurePreviewQueue();
        if (previewQueue.length) {
            nextQuestion = previewQueue.shift();
        }
        // Set currentQuestion BEFORE refilling so it gets excluded
        if (nextQuestion) {
            currentQuestion = nextQuestion;
        }
        ensurePreviewQueue();
    }

    if (!nextQuestion) {
        // Exclude the current question to avoid showing the same word twice in a row
        const exclusions = currentQuestion?.char ? [currentQuestion.char] : [];
        nextQuestion = selectNextQuestion(exclusions);
    }

    return nextQuestion;
}

function clearPreviousQuestionBreakdown() {
    // Clear any previous per-character breakdown
    const prevBreakdown = document.getElementById('charBreakdown');
    if (prevBreakdown) prevBreakdown.remove();
}

function prefillQuestionInputs(prefillAnswer) {
    // Clear input fields to prevent autofilled values (e.g., "yi dian er ling" from TTS speed)
    if (answerInput) {
        answerInput.value = prefillAnswer;
    }
    if (fuzzyInput) {
        // Also prefill fuzzyInput for char-to-meaning-type mode prefiring
        fuzzyInput.value = prefillAnswer;
    }
}

function getModeContainers() {
    return [
        typeMode,
        choiceMode,
        fuzzyMode,
        strokeOrderMode,
        handwritingMode,
        drawCharMode,
        studyMode,
        dictationChatMode,
        radicalPracticeMode,
        missingComponentMode,
        charBuildingMode
    ].filter(Boolean);
}

function hideAllModeContainersForNewQuestion() {
    getModeContainers().forEach((container) => {
        container.style.display = 'none';
    });
    if (audioSection) audioSection.classList.add('hidden');
    resetDictationState();
}

function updateSchedulerToolbarVisibility() {
    // Show scheduler toolbar for quiz modes (hide for study/non-quiz modes)
    const schedulerBar = document.getElementById('schedulerToolbar');
    if (schedulerBar) {
        schedulerBar.style.display = (mode === 'study') ? 'none' : '';
    }
}

function prepareUiForNewQuestion(prefillAnswer) {
    clearPreviousQuestionBreakdown();
    prefillQuestionInputs(prefillAnswer);
    hideAllModeContainersForNewQuestion();
    updateSchedulerToolbarVisibility();
}

function ensureDecompositionsLoadedOrDefer(targetMode) {
    if (decompositionsLoaded) return true;

    questionDisplay.innerHTML = `<div class="text-center text-xl my-8 text-gray-500">Loading component data...</div>`;
    loadDecompositionsData().then(() => {
        if (mode === targetMode) {
            generateQuestion();
        }
    });
    return false;
}

function renderQuestionUiForTypingModes() {
    if (mode !== 'dictation-chat') {
        restoreDictationChatAudio();
    }
    if (mode === 'dictation-chat') {
        renderDictationChatQuestion({ reset: true });
        return true;
    }

    if (mode === 'char-to-pinyin') {
        renderThreeColumnPinyinDictationLayout(false); // false = text mode
        typeMode.style.display = 'block';
        if (answerInput) answerInput.placeholder = 'Type pinyin...';
        setTimeout(() => answerInput.focus(), 100);
        return true;
    }

    if (mode === 'char-to-tones' && choiceMode) {
        // Use MC mode with tone buttons and three-column layout
        initCharToTonesMc();
        return true;
    }

    if (mode === 'audio-to-pinyin' && audioSection) {
        renderThreeColumnPinyinDictationLayout(true); // true = audio mode
        typeMode.style.display = 'block';
        if (answerInput) answerInput.placeholder = 'Type pinyin...';
        audioSection.classList.remove('hidden');
        setupAudioMode({ focusAnswer: true });
        return true;
    }

    if (mode === 'audio-to-meaning' && audioSection && typeMode) {
        renderThreeColumnTranslationLayout(true); // true = audio mode
        audioSection.classList.remove('hidden');
        typeMode.style.display = 'block';
        if (answerInput) {
            answerInput.placeholder = 'Type your translation...';
        }
        setupAudioMode({ focusAnswer: true });
        return true;
    }

    if (mode === 'text-to-meaning' && typeMode) {
        renderThreeColumnTranslationLayout(false); // false = text mode
        typeMode.style.display = 'block';
        if (answerInput) {
            answerInput.placeholder = 'Type your translation...';
            setTimeout(() => answerInput.focus(), 100);
        }
        startTimer();
        return true;
    }

    return false;
}

function renderDictationChatQuestion(options = {}) {
    const { reset = false } = options;
    ensureDictationChatMode();
    if (questionDisplay) {
        questionDisplay.innerHTML = '';
    }
    attachDictationChatAudio();
    setupAudioMode({ focusAnswer: false });
    if (dictationChatMode) {
        dictationChatMode.style.display = 'flex';
    }
    if (reset) {
        resetDictationChatSession();
    }
    if (dictationChatInputEl && isElementReallyVisible(dictationChatInputEl)) {
        setTimeout(() => dictationChatInputEl.focus(), 80);
    }
    return true;
}

function attachDictationChatAudio() {
    if (!audioSection || !dictationChatAudioSlot) return;
    if (!dictationChatAudioHome) {
        dictationChatAudioHome = audioSection.parentElement;
        dictationChatAudioHomeNext = audioSection.nextSibling;
    }
    if (audioSection.parentElement !== dictationChatAudioSlot) {
        dictationChatAudioSlot.appendChild(audioSection);
    }
    audioSection.classList.remove('hidden');
}

function restoreDictationChatAudio() {
    if (!audioSection || !dictationChatAudioHome) return;
    if (audioSection.parentElement === dictationChatAudioHome) return;
    if (dictationChatAudioHomeNext && dictationChatAudioHomeNext.parentElement === dictationChatAudioHome) {
        dictationChatAudioHome.insertBefore(audioSection, dictationChatAudioHomeNext);
    } else {
        dictationChatAudioHome.appendChild(audioSection);
    }
}

function renderQuestionUiForChoiceModes() {
    if (mode === 'char-to-pinyin-mc' && choiceMode) {
        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div>`;
        generatePinyinOptions();
        choiceMode.style.display = 'block';
        return true;
    }

    if (mode === 'char-to-pinyin-type' && fuzzyMode) {
        renderThreeColumnPinyinLayout();
        generateFuzzyPinyinOptions();
        fuzzyMode.style.display = 'block';
        return true;
    }

    if (mode === 'char-to-pinyin-tones-mc' && fuzzyMode) {
        renderThreeColumnPinyinLayout();
        startPinyinToneMcFlow(true); // use fuzzy input for the pinyin step
        fuzzyMode.style.display = 'block';
        return true;
    }

    if (mode === 'pinyin-to-char' && choiceMode) {
        questionDisplay.innerHTML = `<div style="text-align: center; font-size: 48px; margin: 40px 0;">${currentQuestion.pinyin}</div>`;
        generateCharOptions();
        choiceMode.style.display = 'block';
        return true;
    }

    if (mode === 'char-to-meaning' && choiceMode) {
        renderMeaningQuestionLayout();
        generateMeaningOptions();
        choiceMode.style.display = 'block';
        updateMeaningChoicesVisibility();
        return true;
    }

    if (mode === 'char-to-meaning-type' && fuzzyMode) {
        renderThreeColumnMeaningLayout();
        generateFuzzyMeaningOptions();
        fuzzyMode.style.display = 'block';
        return true;
    }

    if (mode === 'meaning-to-char' && choiceMode) {
        questionDisplay.innerHTML = `<div style="text-align: center; font-size: 36px; margin: 40px 0;">${currentQuestion.meaning}</div>`;
        generateCharOptions();
        choiceMode.style.display = 'block';
        return true;
    }

    return false;
}

function renderQuestionUiForHandwritingModes() {
    if (mode === 'stroke-order' && strokeOrderMode) {
        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div><div class="text-center text-lg text-gray-500 mt-2">Trace each stroke in order</div>`;
        strokeOrderMode.style.display = 'block';
        initStrokeOrder();
        return true;
    }

    if (mode === 'handwriting' && handwritingMode) {
        const displayPinyin = prettifyHandwritingPinyin(currentQuestion.pinyin);

        // Show prompt inside the handwriting pane (keeps it from overlapping mode buttons)
        let promptEl = handwritingMode.querySelector('.handwriting-prompt');
        if (!promptEl) {
            promptEl = document.createElement('div');
            promptEl.className = 'handwriting-prompt';
            handwritingMode.insertBefore(promptEl, handwritingMode.firstChild);
        }
        const meaningText = currentQuestion.meaning ? ` · ${currentQuestion.meaning}` : '';
        promptEl.textContent = `${displayPinyin}${meaningText}`;

        // Clear the main question area so it doesn't cover the sidebar and reset hint/feedback
        questionDisplay.innerHTML = '';
        if (hint) {
            hint.textContent = '';
        }
        if (feedback) {
            feedback.textContent = '';
            feedback.className = '';
        }

        handwritingMode.style.display = 'block';
        initHandwriting();
        return true;
    }

    if (mode === 'draw-char' && drawCharMode) {
        const displayPinyin = prettifyHandwritingPinyin(currentQuestion.pinyin);
        const meaningText = currentQuestion.meaning ? `<div class="text-lg text-gray-500 mt-1">${currentQuestion.meaning}</div>` : '';
        questionDisplay.innerHTML = `<div class="text-center mt-4 mb-2"><div class="text-4xl font-bold text-gray-700">${displayPinyin}</div>${meaningText}</div>`;
        drawCharMode.style.display = 'block';
        initCanvas();
        clearCanvas();
        return true;
    }

    return false;
}

function renderQuestionUiForComponentModes() {
    if (mode === 'draw-missing-component' && drawCharMode) {
        if (!ensureDecompositionsLoadedOrDefer('draw-missing-component')) {
            return true;
        }

        // Use prepared component question if available, otherwise prepare new one
        let prepared = null;
        if (componentUpcomingQuestion) {
            prepared = componentUpcomingQuestion;
            componentUpcomingQuestion = null;
        } else {
            prepared = prepareComponentQuestion();
        }

        if (!prepared) {
            questionDisplay.innerHTML = `<div class="text-center text-2xl my-8 text-red-600">No characters with component data available in this lesson.</div>`;
            return true;
        }

        currentQuestion = prepared.question;
        window.currentQuestion = currentQuestion;
        currentDecomposition = prepared.decomposition;
        currentMissingComponent = prepared.decomposition.missingComponent;
        componentInlineFeedback = null;
        syncQuestionAfterSelection();
        markSchedulerServed(currentQuestion);
        updateCurrentWordConfidence();

        // Render partial word in three-column layout
        renderThreeColumnComponentLayout();

        // Show draw UI and seed candidates with the missing component + whole word
        drawCharMode.style.display = 'block';
        initCanvas();
        clearCanvas();
        updateOcrCandidates([currentMissingComponent.char, currentQuestion.char]);
        const ocrResult = document.getElementById('ocrResult');
        if (ocrResult) ocrResult.textContent = '';
        feedback.textContent = '';
        hint.textContent = '';
        return false;
    }

    if (mode === 'study' && studyMode) {
        questionDisplay.innerHTML = '';
        studyMode.style.display = 'block';
        populateStudyList();
        return false;
    }

    if (mode === 'radical-practice' && radicalPracticeMode) {
        // Skip characters without radical data
        let attempts = 0;
        while ((!currentQuestion.radicals || currentQuestion.radicals.length === 0) && attempts < 100) {
            const candidate = getRandomQuestion();
            if (!candidate) break;
            currentQuestion = candidate;
            attempts++;
        }

        window.currentQuestion = currentQuestion;

        if (!currentQuestion.radicals || currentQuestion.radicals.length === 0) {
            questionDisplay.innerHTML = `<div class="text-center text-2xl my-8 text-red-600">No characters with radical data available in this lesson.</div>`;
            return true;
        }

        syncQuestionAfterSelection();
        markSchedulerServed(currentQuestion);
        updateCurrentWordConfidence();

        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div><div class="text-center text-xl text-gray-600 mt-4">Select ALL radicals in this character</div>`;
        radicalPracticeMode.style.display = 'block';
        generateRadicalOptions();
        return false;
    }

    if (mode === 'missing-component' && missingComponentMode) {
        // Use three-column layout for missing component mode
        if (!ensureDecompositionsLoadedOrDefer('missing-component')) {
            return true;
        }

        // If we have an upcoming question ready, use it; otherwise prepare one
        let prepared = null;
        if (componentUpcomingQuestion) {
            prepared = componentUpcomingQuestion;
            componentUpcomingQuestion = null;
        } else {
            prepared = prepareComponentQuestion();
        }

        if (!prepared) {
            questionDisplay.innerHTML = `<div class="text-center text-2xl my-8 text-red-600">No characters with component data available in this lesson.</div>`;
            return true;
        }

        // Set up current question and decomposition
        currentQuestion = prepared.question;
        window.currentQuestion = currentQuestion;
        currentDecomposition = prepared.decomposition;
        currentMissingComponent = prepared.decomposition.missingComponent;

        // Clear inline feedback for new question
        componentInlineFeedback = null;

        syncQuestionAfterSelection();
        markSchedulerServed(currentQuestion);
        updateCurrentWordConfidence();

        // Render three-column layout
        renderThreeColumnComponentLayout();

        missingComponentMode.style.display = 'block';
        generateComponentOptions();
        return false;
    }

    if (mode === 'char-building' && charBuildingMode) {
        // Character Building mode - build all characters in a word component by component
        // Uses three-column layout with instant transitions

        if (!ensureDecompositionsLoadedOrDefer('char-building')) {
            return true;
        }

        // Use upcoming question if available, otherwise prepare new one
        let prepared = null;
        if (charBuildingUpcomingQuestion) {
            prepared = charBuildingUpcomingQuestion;
            charBuildingUpcomingQuestion = null;
        } else {
            prepared = prepareCharBuildingQuestion();
        }

        if (!prepared) {
            questionDisplay.innerHTML = `<div class="text-center text-2xl my-8 text-red-600">No characters with component data available in this lesson.</div>`;
            return true;
        }

        currentQuestion = prepared.question;
        window.currentQuestion = currentQuestion;
        charBuildingWordChars = prepared.wordChars;

        syncQuestionAfterSelection();
        markSchedulerServed(currentQuestion);
        updateCurrentWordConfidence();

        // Reset building state
        charBuildingCharIndex = 0;
        charBuildingCompletedComponents = [];
        charBuildingCurrentIndex = 0;
        charBuildingInlineFeedback = null;

        // Set up the first character's decomposition
        const firstChar = charBuildingWordChars[0];
        charBuildingDecomposition = {
            char: firstChar.char,
            data: firstChar.decomp,
            components: firstChar.decomp.components
        };

        // Render three-column layout
        renderThreeColumnCharBuildingLayout();

        charBuildingMode.style.display = 'block';
        generateCharBuildingOptions();
        return false;
    }

    return false;
}

function generateQuestion(options = {}) {
    const prefillAnswer = getPrefillAnswerForNextQuestion(options);
    resetForNextQuestion(prefillAnswer);
    prepareSchedulerForNextQuestion();
    if (maybeGenerateChunksQuestion()) return;

    let nextQuestion = selectNextQuizQuestion();

    if (!nextQuestion) {
        questionDisplay.innerHTML = `<div class="text-center text-2xl text-red-600 my-8">No questions available.</div>`;
        return;
    }

    currentQuestion = nextQuestion;
    updatePreviewDisplay();
    window.currentQuestion = currentQuestion;
    logDebugEvent('question-selected', {
        char: currentQuestion?.char,
        mode,
        schedulerMode
    });
    if (!shouldDeferServingForMode(mode)) {
        markSchedulerServed(currentQuestion);
    }

    // Update learn mode overlay if active
    if (typeof updateLearnModeCharacter === 'function') {
        updateLearnModeCharacter();
    }

    prepareUiForNewQuestion(prefillAnswer);

    // Show appropriate UI based on mode
    if (renderQuestionUiForTypingModes()) {
        // Mode handled
    } else if (renderQuestionUiForChoiceModes()) {
        // Mode handled
    } else if (renderQuestionUiForHandwritingModes()) {
        // Mode handled
    } else {
        if (renderQuestionUiForComponentModes()) {
            return;
        }
    }

    // If we prefilled an answer (user typed during the reveal phase), preserve it
    if (prefillAnswer && answerInput) {
        // Update partial progress indicators for typed modes
        updatePartialProgress();
    }

    // Start timer for the new question
    if (timerEnabled) {
        startTimer();
    }

    updateFullscreenQueueDisplay();

    // Show current word confidence
    updateCurrentWordConfidence();
}

function syncQuestionAfterSelection() {
    updatePreviewDisplay();
    if (typeof updateLearnModeCharacter === 'function') {
        updateLearnModeCharacter();
    }
}

function shouldDeferServingForMode(activeMode) {
    return Boolean(getModeConfig(activeMode).deferServing);
}

function updateCurrentWordConfidence() {
    if (!currentQuestion || !currentQuestion.char) return;

    // Find or create the confidence indicator element
    let indicator = document.getElementById('currentWordConfidence');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'currentWordConfidence';
        indicator.className = 'text-center text-sm text-gray-500 mt-2';
        // Insert after questionDisplay
        if (questionDisplay && questionDisplay.parentNode) {
            questionDisplay.parentNode.insertBefore(indicator, questionDisplay.nextSibling);
        }
    }

    const skillKey = getCurrentSkillKey();
    const stats = getSchedulerStats(currentQuestion.char, skillKey);
    const score = getConfidenceScore(currentQuestion.char);

    const isBKT = confidenceFormula === CONFIDENCE_FORMULAS.BKT;
    const threshold = getConfidenceMasteryThreshold();

    const served = stats.served || 0;
    const correct = stats.correct || 0;
    const streak = stats.streak || 0;
    const accPct = served > 0 ? Math.round((correct / served) * 100) : 0;

    let scoreDisplay, barPct, barColor;
    if (isBKT) {
        scoreDisplay = `${Math.round(score * 100)}%`;
        barPct = Math.round(score * 100);
        barColor = score >= threshold ? 'bg-emerald-500' : (score >= 0.5 ? 'bg-yellow-400' : 'bg-amber-400');
    } else {
        scoreDisplay = score.toFixed(2);
        barPct = Math.min(100, Math.round((score / 6) * 100)); // normalize heuristic roughly to 0-100
        barColor = score >= threshold ? 'bg-emerald-500' : (score >= 2 ? 'bg-yellow-400' : 'bg-amber-400');
    }

    const masteredBadge = score >= threshold ? ' ✓' : '';

    indicator.innerHTML = `
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
            <span class="text-xs text-gray-600">Confidence:</span>
            <div class="w-16 h-2 bg-gray-300 rounded-full overflow-hidden">
                <div class="h-full ${barColor} transition-all" style="width: ${barPct}%;"></div>
            </div>
            <span class="text-xs font-semibold text-gray-700">${scoreDisplay}${masteredBadge}</span>
            <span class="text-xs text-gray-400">|</span>
            <span class="text-xs text-gray-500">${served > 0 ? `${accPct}% · ${served} seen · ${streak}🔥` : 'new'}</span>
        </div>
    `;
}

function ensureTtsSpeedControl() {
    if (!audioSection) return null;

    let wrapper = audioSection.querySelector('.tts-speed-control');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'tts-speed-control flex flex-wrap items-center justify-center gap-2 mt-3 text-sm text-gray-600';

        const label = document.createElement('label');
        label.textContent = 'Speech speed';
        label.className = 'font-medium text-gray-600';
        label.htmlFor = 'ttsSpeedSelect';
        // Prevent speech recognition from picking up the speed value
        label.setAttribute('aria-hidden', 'false');
        label.setAttribute('data-speech-ignore', 'true');

        const select = document.createElement('select');
        select.id = 'ttsSpeedSelect';
        select.className = 'border-2 border-gray-300 rounded-lg px-3 py-1 bg-white text-sm focus:border-blue-500 focus:outline-none';
        // Prevent speech recognition from picking up the speed value
        select.setAttribute('data-speech-ignore', 'true');
        select.setAttribute('aria-label', 'Speech speed selector');

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        audioSection.appendChild(wrapper);
        ttsSpeedSelect = select;
    } else {
        ttsSpeedSelect = wrapper.querySelector('select');
    }

    if (!ttsSpeedSelect) return null;

    const optionSource = typeof getQuizTtsOptions === 'function'
        ? getQuizTtsOptions()
        : [
            { value: 0.5, label: 'Very Slow · 0.5×' },
            { value: 0.7, label: 'Slow · 0.7×' },
            { value: 0.85, label: 'Learning · 0.85×' },
            { value: 1.0, label: 'Normal · 1.0×' },
            { value: 1.15, label: 'Quick · 1.15×' },
            { value: 1.3, label: 'Fast · 1.3×' },
            { value: 1.5, label: 'Faster · 1.5×' },
            { value: 1.75, label: 'Very Fast · 1.75×' },
            { value: 2.0, label: 'Ultra Fast · 2.0×' },
            { value: 2.5, label: 'Maximum · 2.5×' },
            { value: 3.0, label: 'Extreme · 3.0×' }
        ];

    if (!ttsSpeedSelect.dataset.initialized) {
        ttsSpeedSelect.innerHTML = '';
        optionSource.forEach(option => {
            const numericValue = Number(option.value);
            const valueString = Number.isFinite(numericValue) ? numericValue.toFixed(2) : String(option.value);
            const opt = document.createElement('option');
            opt.value = valueString;
            opt.textContent = option.label || `${valueString}×`;
            ttsSpeedSelect.appendChild(opt);
        });
        ttsSpeedSelect.dataset.initialized = 'true';

        ttsSpeedSelect.addEventListener('change', () => {
            const newRate = parseFloat(ttsSpeedSelect.value);
            const applied = typeof setQuizTtsRate === 'function'
                ? setQuizTtsRate(newRate)
                : newRate;
            if (Number.isFinite(applied)) {
                const formatted = Number(applied).toFixed(2);
                ttsSpeedSelect.value = formatted;
            }
        });
    }

    const currentRate = typeof getQuizTtsRate === 'function'
        ? getQuizTtsRate()
        : 0.85;
    const formattedCurrent = Number(currentRate).toFixed(2);

    if (ttsSpeedSelect.value !== formattedCurrent) {
        const existingValues = Array.from(ttsSpeedSelect.options).map(opt => opt.value);
        if (!existingValues.includes(formattedCurrent)) {
            const opt = document.createElement('option');
            opt.value = formattedCurrent;
            opt.textContent = `${formattedCurrent}×`;
            ttsSpeedSelect.appendChild(opt);
        }
        ttsSpeedSelect.value = formattedCurrent;
    }

    return ttsSpeedSelect;
}

function addKeyboardHints() {
    // Add hint for Ctrl+Enter to show answer
    let hintEl = document.getElementById('keyboardHints');
    if (!hintEl) {
        hintEl = document.createElement('div');
        hintEl.id = 'keyboardHints';
        hintEl.className = 'text-center text-xs text-gray-400 mt-2';
        hintEl.innerHTML = '<kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">Ctrl+Enter</kbd> show answer';

        const typeMode = document.getElementById('typeMode');
        if (typeMode) {
            typeMode.appendChild(hintEl);
        }
    }
}

function setupAudioMode(options = {}) {
    const { focusAnswer = true } = options;
    const playBtn = document.getElementById('playAudioBtn');
    if (!playBtn || !currentQuestion) return;

    ensureTtsSpeedControl();
    addKeyboardHints();

    const pinyinOptions = (currentQuestion.pinyin || '').split('/');
    const firstPinyin = (pinyinOptions[0] || '').trim();

    const playCurrentPrompt = () => {
        if (firstPinyin) {
            playPinyinAudio(firstPinyin, currentQuestion.char);
        } else if (currentQuestion.char) {
            playSentenceAudio(currentQuestion.char);
        }
    };

    window.currentAudioPlayFunc = playCurrentPrompt;
    playBtn.onclick = playCurrentPrompt;
    playBtn.innerHTML = '🔊 Play Sentence <span class="text-xs opacity-75 ml-1">(Ctrl+J)</span>';

    if (focusAnswer && answerInput && isElementReallyVisible(answerInput)) {
        setTimeout(() => answerInput.focus(), 100);
    }

    // Auto-play once
    setTimeout(() => {
        playCurrentPrompt();
    }, 200);
}

function setupChunkAudioMode(chunkText) {
    const playBtn = document.getElementById('playAudioBtn');
    if (!playBtn) return;

    ensureTtsSpeedControl();
    addKeyboardHints();

    const playChunk = () => {
        playSentenceAudio(chunkText);
    };

    window.currentAudioPlayFunc = playChunk;
    playBtn.onclick = playChunk;
    playBtn.innerHTML = '🔊 Play Sentence <span class="text-xs opacity-75 ml-1">(Ctrl+J)</span>';

    if (answerInput && isElementReallyVisible(answerInput)) {
        setTimeout(() => answerInput.focus(), 100);
    }

    // Auto-play once
    setTimeout(() => {
        playChunk();
    }, 200);
}

function checkAnswer() {
    stopTimer();

    if (mode === 'char-to-pinyin-tones-mc') return; // handled by custom flow

    if (!answerInput.value.trim()) return;

    const userAnswer = answerInput.value.trim();

    if (mode === 'char-to-tones') {
        const expectedTones = extractToneSequence(currentQuestion.pinyin.split('/')[0].trim());

        if (userAnswer === expectedTones) {
            // Correct!
            playCorrectSound();
            if (!answered) {
                answered = true;
                total++;
                score++;
            }
            lastAnswerCorrect = true;

            feedback.textContent = `✓ Correct! ${currentQuestion.char} = ${currentQuestion.pinyin} (${expectedTones})`;
            feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
            hint.textContent = `Meaning: ${currentQuestion.meaning}`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-green-600';
            renderCharacterComponents(currentQuestion);
            if (mode === 'char-to-meaning') {
                renderCharBreakdownSoon();
            }

            // Play audio
            const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
            playPinyinAudio(firstPinyin, currentQuestion.char);

            // Clear input so it doesn't get prefilled into the next question
            if (answerInput) answerInput.value = '';

            updateStats();
            scheduleNextQuestion(1500);
        } else {
            // Wrong
            playWrongSound();
            if (!answered) {
                answered = true;
                total++;
            }
            lastAnswerCorrect = false;

            feedback.textContent = `✗ Wrong. The answer is: ${expectedTones} (${currentQuestion.pinyin})`;
            feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
            hint.textContent = `Meaning: ${currentQuestion.meaning}`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-red-600';
            renderCharacterComponents(currentQuestion);
            renderCharBreakdownSoon();

            // Clear input so it doesn't get prefilled into the next question
            if (answerInput) answerInput.value = '';

            updateStats();
            scheduleNextQuestion(2000);
        }
    } else if (mode === 'char-to-pinyin' || mode === 'audio-to-pinyin') {
        const pinyinOptions = currentQuestion.pinyin.split('/').map(p => p.trim());

        // Check if full answer is entered
        const fullMatch = pinyinOptions.some(option => checkPinyinMatch(userAnswer, option));

        if (fullMatch) {
            handleCorrectFullAnswer();
            return;
        }

        // Check if single syllable matches next expected syllable
        let syllableMatched = false;
        for (const option of pinyinOptions) {
            const syllables = splitPinyinSyllables(option);
            const optionWithNumbers = convertPinyinToToneNumbers(option);
            const syllablesWithNumbers = splitPinyinSyllables(optionWithNumbers);

            if (enteredSyllables.length < syllables.length) {
                const expectedSyllable = syllables[enteredSyllables.length];
                const expectedSyllableWithNumbers = syllablesWithNumbers[enteredSyllables.length];

                // Check if user's input matches expected syllable (with or without tone numbers)
                const userLower = userAnswer.toLowerCase();
                const expectedLower = expectedSyllable.toLowerCase();
                const expectedNumLower = expectedSyllableWithNumbers.toLowerCase();

                if (userLower === expectedLower || userLower === expectedNumLower) {
                    handleCorrectSyllable(syllables, option);
                    syllableMatched = true;
                    break;
                }
            }
        }

        if (!syllableMatched) {
            handleWrongAnswer();
        }
    } else if (mode === 'audio-to-meaning' || mode === 'audio-to-meaning-chunks' || mode === 'text-to-meaning' || mode === 'text-to-meaning-chunks') {
        // Use Groq API with Kimi K2 to grade the translation
        checkTranslationWithGroq(userAnswer);
        return;
    }
}

async function checkTranslationWithGroq(userTranslation) {
    // Show loading state
    if (checkBtn) {
        checkBtn.textContent = 'Grading...';
        checkBtn.disabled = true;
    }
    feedback.textContent = '⏳ Grading your translation...';
    feedback.className = 'text-center text-xl font-semibold my-4 text-gray-500';

    try {
        const systemPrompt = `You are evaluating a student's CHINESE LISTENING COMPREHENSION. The student heard Chinese audio and is telling you what they understood.

IMPORTANT: You are testing their CHINESE COMPREHENSION, not their English ability. They are a native English speaker.
- Their English doesn't matter AT ALL - only grade whether they UNDERSTOOD THE CHINESE
- Any English that shows they got the meaning = correct
- Messy English, typos, grammar errors = completely irrelevant, ignore entirely
- Synonyms, paraphrases, informal explanations = all fine if meaning is right

Your response MUST follow this exact format:
1. First line: GRADE: X%
2. Second line: Brief explanation (1 sentence)
3. Third line: MARKUP: followed by the student's EXACT text with annotations
   - Wrap parts showing CORRECT understanding in [OK:word/phrase]
   - Wrap parts showing WRONG understanding in [ERR:word/phrase|reason] - use | to separate text from reason
   - Keep their text exactly as written

Grading scale (grade their Chinese comprehension):
90-100%: Understood the Chinese correctly
70-89%: Understood most of it, missed minor details
50-69%: Got the general topic but missed key meaning
Below 50%: Did not understand the Chinese

Example response for correct:
GRADE: 100%
Understood the Chinese perfectly.
MARKUP: [OK:I am] [OK:happy] [OK:to meet you]

Example response with error:
GRADE: 60%
Misunderstood who was speaking.
MARKUP: [OK:He said] [ERR:she is coming|should be "he is coming" - 他 means he not she] [OK:tomorrow]`;

        const feedbackText = await callGroqChat({
            system: systemPrompt,
            messages: [{
                role: 'user',
                content: `Chinese: ${currentQuestion.char}
Reference translation: ${currentQuestion.meaning}
Student's translation: ${userTranslation}

Grade this translation with percentage, feedback, and word-by-word markup.`
            }],
            maxTokens: 300,
            temperature: 0.3
        }) || 'No feedback received.';

        // Parse result
        const gradeMatch = feedbackText.match(/GRADE:\s*(\d+)%/i) || feedbackText.match(/(\d+)%/);
        const grade = gradeMatch ? parseInt(gradeMatch[1]) : null;

        // Extract explanation (line after GRADE, before MARKUP)
        const lines = feedbackText.split('\n').map(l => l.trim()).filter(l => l);
        let explanation = '';
        let markup = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/^GRADE:/i)) continue;
            if (line.match(/^MARKUP:/i)) {
                markup = line.replace(/^MARKUP:\s*/i, '');
                break;
            }
            if (!explanation) {
                explanation = line;
            }
        }

        // Convert markup to color-coded HTML
        let colorCodedAnswer = '';
        if (markup) {
            colorCodedAnswer = markup
                .replace(/\[OK:([^\]]+)\]/g, '<span style="color: #16a34a; font-weight: 600;">$1</span>')
                // Handle [ERR:text|reason] format - show text with tooltip for reason
                .replace(/\[ERR:([^|\]]+)\|([^\]]+)\]/g, '<span style="color: #dc2626; font-weight: 600; text-decoration: underline wavy #dc2626; cursor: help;" title="$2">$1</span> <span style="display: inline-block; font-size: 11px; color: #991b1b; background: #fee2e2; padding: 1px 4px; border-radius: 3px; margin-left: 2px;">$2</span>')
                // Fallback for [ERR:text] without reason
                .replace(/\[ERR:([^\]]+)\]/g, '<span style="color: #dc2626; font-weight: 600; text-decoration: underline wavy #dc2626;">$1</span>');
        }

        // Update stats based on grade
        if (!answered) {
            answered = true;
            total++;
            if (grade !== null && grade >= 70) {
                score++;
                lastAnswerCorrect = true;
                playCorrectSound();
            } else {
                lastAnswerCorrect = false;
                playWrongSound();
            }
        }

        updateStats();

        // For non-chunk translation modes, use three-column instant transition
        if (mode === 'audio-to-meaning' || mode === 'text-to-meaning') {
            // Store the current question as previous with explanation and reference
            translationPreviousQuestion = currentQuestion;
            translationPreviousResult = {
                grade: grade || 0,
                explanation: explanation || '',
                userAnswer: userTranslation,
                colorCodedAnswer: colorCodedAnswer || escapeHtml(userTranslation),
                reference: currentQuestion.meaning || ''
            };

            // Clear feedback and hint - they're now shown in the three-column layout
            if (feedback) {
                feedback.textContent = '';
                feedback.className = '';
            }
            if (hint) {
                hint.textContent = '';
                hint.className = '';
            }

            // Clear input
            if (answerInput) answerInput.value = '';

            // Advance the upcoming question to become current
            if (translationUpcomingQuestion) {
                currentQuestion = translationUpcomingQuestion;
                translationUpcomingQuestion = null;
            }

            // Instant transition to next question
            displayQuestion();
            return;
        }

        // For chunk modes, use three-column layout with instant transitions
        if (mode === 'audio-to-meaning-chunks' || mode === 'text-to-meaning-chunks') {
            // Store previous chunk info with explanation and reference
            chunksPreviousChunk = currentQuestion;
            chunksPreviousResult = {
                grade: grade || 0,
                userAnswer: userTranslation,
                colorCodedAnswer: colorCodedAnswer || escapeHtml(userTranslation),
                explanation: explanation || '',
                reference: currentQuestion.meaning || ''
            };

            // Clear feedback and hint - shown in three-column layout
            if (feedback) { feedback.textContent = ''; feedback.className = ''; }
            if (hint) { hint.textContent = ''; hint.className = ''; }
            if (answerInput) answerInput.value = '';

            // Advance to next chunk
            currentChunkIndex++;

            // If more chunks, render next; otherwise, start new sentence
            if (currentChunkIndex < sentenceChunks.length) {
                currentQuestion = sentenceChunks[currentChunkIndex];
                window.currentQuestion = currentQuestion;

                // Pre-compute upcoming
                if (currentChunkIndex + 1 < sentenceChunks.length) {
                    chunksUpcomingChunk = sentenceChunks[currentChunkIndex + 1];
                } else {
                    chunksUpcomingChunk = null;
                }

                renderThreeColumnChunksLayout(mode === 'audio-to-meaning-chunks');
                if (mode === 'audio-to-meaning-chunks') {
                    setupChunkAudioMode(currentQuestion.char);
                }
                if (answerInput) setTimeout(() => answerInput.focus(), 50);
            } else {
                // All chunks done, get new sentence
                generateQuestion();
            }
            return;
        }

        // For other translation modes (non-chunks), show old feedback style
        let colorClass, emoji;
        if (grade !== null) {
            if (grade >= 90) {
                colorClass = 'text-green-600';
                emoji = '✓';
            } else if (grade >= 70) {
                colorClass = 'text-yellow-600';
                emoji = '○';
            } else if (grade >= 50) {
                colorClass = 'text-orange-600';
                emoji = '△';
            } else {
                colorClass = 'text-red-600';
                emoji = '✗';
            }

            feedback.innerHTML = `<span class="${colorClass} text-2xl font-bold">${emoji} ${grade}%</span><br><span class="text-base text-gray-700">${explanation}</span>`;
            feedback.className = 'text-center my-4';
        } else {
            feedback.innerHTML = `<span class="text-gray-600">${feedbackText}</span>`;
            feedback.className = 'text-center text-lg my-4';
        }

        // Show reference
        hint.innerHTML = `<div class="text-sm text-gray-500 mt-2"><strong>Chinese:</strong> ${currentQuestion.char} (${currentQuestion.pinyin})<br><strong>Reference:</strong> ${currentQuestion.meaning}</div>`;
        hint.className = 'text-center my-2';

        // Clear input
        if (answerInput) answerInput.value = '';

        // Schedule next question (faster turnaround for dictation flow)
        scheduleNextQuestion(grade >= 70 ? 1000 : 1600);

    } catch (error) {
        console.error('Groq API error:', error);
        if (error.code === 'MISSING_API_KEY') {
            feedback.innerHTML = '<span class="text-red-600">Please set your Groq API key first.</span><br><span class="text-sm text-gray-500">Press Ctrl+K and search for \"Set Groq API Key\"</span>';
            feedback.className = 'text-center text-lg font-semibold my-4';
        } else {
            feedback.innerHTML = `<span class="text-red-600">Error grading translation: ${error.message}</span>`;
            feedback.className = 'text-center text-lg font-semibold my-4';
        }
    } finally {
        if (checkBtn) {
            checkBtn.textContent = 'Check Answer';
            checkBtn.disabled = false;
        }
    }
}

function handleCorrectFullAnswer(userAnswer = '') {
    if (mode === 'char-to-pinyin') {
        const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
        playPinyinAudio(firstPinyin, currentQuestion.char);
    }

    playCorrectSound();
    if (!answered) {
        answered = true;
        total++;
        score++;
    }
    lastAnswerCorrect = true;
    markSchedulerOutcome(true);
    updateStats();

    // For pinyin dictation modes, use three-column instant transition
    if (mode === 'char-to-pinyin' || mode === 'audio-to-pinyin') {
        pinyinDictationPreviousQuestion = currentQuestion;
        pinyinDictationPreviousResult = 'correct';
        pinyinDictationPreviousUserAnswer = userAnswer || answerInput?.value || '';

        // Clear feedback and hint
        if (feedback) { feedback.textContent = ''; feedback.className = ''; }
        if (hint) { hint.textContent = ''; hint.className = ''; }
        if (answerInput) answerInput.value = '';

        // Advance upcoming to current
        if (pinyinDictationUpcomingQuestion) {
            currentQuestion = pinyinDictationUpcomingQuestion;
            pinyinDictationUpcomingQuestion = null;
        }

        displayQuestion();
        return;
    }

    if (mode === 'audio-to-pinyin') {
        feedback.textContent = `✓ Correct! ${currentQuestion.pinyin} (${currentQuestion.char})`;
    } else {
        feedback.textContent = `✓ Correct! ${currentQuestion.char} = ${currentQuestion.pinyin}`;
    }
    feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
    hint.textContent = `Meaning: ${currentQuestion.meaning}`;
    hint.className = 'text-center text-2xl font-semibold my-4 text-green-600';
    renderCharacterComponents(currentQuestion);
    if (mode === 'char-to-meaning') {
        renderCharBreakdownSoon();
    }

    // Clear input so it doesn't get prefilled into the next question
    if (answerInput) answerInput.value = '';

    scheduleNextQuestion(300);
}

function handleCorrectSyllable(syllables, fullPinyin) {
    enteredSyllables.push(syllables[enteredSyllables.length]);
    answerInput.value = '';
    if (mode === 'char-to-pinyin') {
        updateDictationProgress(enteredSyllables.length);
    }

    if (enteredSyllables.length === syllables.length) {
        // All syllables entered - complete!
        if (mode === 'char-to-pinyin') {
            playPinyinAudio(fullPinyin, currentQuestion.char);
        }

        playCorrectSound();
        if (!answered) {
            answered = true;
            total++;
            score++;
        }
        lastAnswerCorrect = true;
        markSchedulerOutcome(true);
        updateStats();

        // For pinyin dictation modes, use three-column instant transition
        if (mode === 'char-to-pinyin' || mode === 'audio-to-pinyin') {
            pinyinDictationPreviousQuestion = currentQuestion;
            pinyinDictationPreviousResult = 'correct';
            pinyinDictationPreviousUserAnswer = enteredSyllables.join(' ');

            // Clear feedback and hint
            if (feedback) { feedback.textContent = ''; feedback.className = ''; }
            if (hint) { hint.textContent = ''; hint.className = ''; }
            if (answerInput) answerInput.value = '';

            // Advance upcoming to current
            if (pinyinDictationUpcomingQuestion) {
                currentQuestion = pinyinDictationUpcomingQuestion;
                pinyinDictationUpcomingQuestion = null;
            }

            displayQuestion();
            return;
        }

        if (mode === 'audio-to-pinyin') {
            feedback.textContent = `✓ Correct! ${currentQuestion.pinyin} (${currentQuestion.char})`;
        } else {
            feedback.textContent = `✓ Correct! ${currentQuestion.char} = ${currentQuestion.pinyin}`;
        }
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        hint.textContent = `Meaning: ${currentQuestion.meaning}`;
        hint.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        renderCharacterComponents(currentQuestion);

        scheduleNextQuestion(300);
    } else {
        // More syllables needed - show progress without revealing remaining syllables
        hint.textContent = `✓ ${enteredSyllables.join(' ')} (${enteredSyllables.length}/${syllables.length})`;
        hint.className = 'text-center text-2xl font-semibold my-4 text-green-600';
    }
}

function handleWrongAnswer() {
    lastAnswerCorrect = false;
    playWrongSound();
    if (!answered) {
        answered = true;
        total++;
    }
    markSchedulerOutcome(false);

    if (mode === 'audio-to-pinyin') {
        feedback.textContent = `✗ Wrong. The answer is: ${currentQuestion.pinyin} (${currentQuestion.char})`;
    } else {
        feedback.textContent = `✗ Wrong. The answer is: ${currentQuestion.pinyin}`;
    }
    feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
    hint.textContent = `Meaning: ${currentQuestion.meaning}`;
    hint.className = 'text-center text-2xl font-semibold my-4 text-red-600';
    renderCharacterComponents(currentQuestion);
    if (mode === 'char-to-meaning') {
        renderCharBreakdownSoon();
    }
    if (mode === 'char-to-pinyin') {
        updateDictationProgress(dictationTotalSyllables || 0);
    }

    // Play audio for the correct answer in char-to-pinyin mode
    if (mode === 'char-to-pinyin') {
        const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
        playPinyinAudio(firstPinyin, currentQuestion.char);
    }

    updateStats();

    // Clear input and refocus for retry
    setTimeout(() => {
        answerInput.value = '';
        answerInput.focus();
    }, 0);
}

function giveUpAndShowAnswer() {
    if (!currentQuestion) return;
    if (answered) return; // Already answered
    if (mode === 'study') return; // Not applicable in study mode
    if (mode === 'dictation-chat') {
        skipDictationChatPrompt();
        return;
    }

    stopTimer();

    // Just delegate to handleWrongAnswer - same display for give up as wrong answer
    handleWrongAnswer();
}

// =============================================================================
// MULTIPLE CHOICE FUNCTIONS
// =============================================================================

function generatePinyinOptions() {
    const options = document.getElementById('options');
    if (!options) return;
    options.innerHTML = '';

    const currentVariants = currentQuestion.pinyin.split('/').map(p => p.trim()).filter(Boolean);
    const currentPinyin = currentVariants[0];

    const wrongOptions = [];
    const usedNormalized = new Set([normalizePinyinForChoice(currentPinyin)]);
    let safety = 0;

    while (wrongOptions.length < 3 && safety < 500) {
        safety++;
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
        if (random.char === currentQuestion.char) continue;

        const randomPinyin = random.pinyin.split('/')[0].trim();
        const normalizedRandom = normalizePinyinForChoice(randomPinyin);

        if (usedNormalized.has(normalizedRandom)) continue;

        wrongOptions.push(randomPinyin);
        usedNormalized.add(normalizedRandom);
    }

    const allOptions = [...wrongOptions, currentPinyin];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'px-6 py-4 text-xl bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition';
        btn.textContent = option;
        btn.dataset.normalized = normalizePinyinForChoice(option);
        btn.onclick = () => checkMultipleChoice(option);
        options.appendChild(btn);
    });
}

function generateCharOptions() {
    const options = document.getElementById('options');
    if (!options) return;
    options.innerHTML = '';

    const wrongOptions = [];
    while (wrongOptions.length < 3) {
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
        if (random.char !== currentQuestion.char && !wrongOptions.includes(random.char)) {
            wrongOptions.push(random.char);
        }
    }

    const allOptions = [...wrongOptions, currentQuestion.char];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'px-6 py-8 text-6xl bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition';
        btn.textContent = option;
        btn.onclick = () => checkMultipleChoice(option);
        options.appendChild(btn);
    });
}

function generateMeaningOptions() {
    const options = document.getElementById('options');
    if (!options) return;
    options.innerHTML = '';

    const wrongOptions = [];
    while (wrongOptions.length < 3) {
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
        if (random.char !== currentQuestion.char && !wrongOptions.includes(random.meaning)) {
            wrongOptions.push(random.meaning);
        }
    }

    const allOptions = [...wrongOptions, currentQuestion.meaning];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'px-6 py-4 text-xl bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition';
        btn.textContent = option;
        btn.onclick = () => checkMultipleChoice(option);
        options.appendChild(btn);
    });
}

function generateFuzzyMeaningOptions() {
    const options = document.getElementById('fuzzyOptions');
    if (!options || !fuzzyInput) return;

    options.innerHTML = '';
    // Don't clear fuzzyInput.value here - it may contain prefilled answer from prefiring

    const wrongOptions = [];
    while (wrongOptions.length < 3) {
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
        if (random.char !== currentQuestion.char && !wrongOptions.includes(random.meaning)) {
            wrongOptions.push(random.meaning);
        }
    }

    const allOptions = [...wrongOptions, currentQuestion.meaning];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg border-2 border-gray-300 transition';
        btn.textContent = option;
        btn.dataset.index = index;
        btn.dataset.meaning = option;
        btn.onclick = () => checkFuzzyAnswer(option);
        options.appendChild(btn);
    });

    // Fuzzy matching on input
    fuzzyInput.oninput = () => {
        // Track input during feedback period for prefiring
        if (answered && lastAnswerCorrect) {
            nextAnswerBuffer = fuzzyInput.value;
        } else {
            nextAnswerBuffer = '';
        }

        const input = fuzzyInput.value.trim().toLowerCase();
        if (!input) {
            document.querySelectorAll('#fuzzyOptions button').forEach(btn => {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            });
            return;
        }

        let bestMatch = null;
        let bestScore = -1;

        allOptions.forEach((option, index) => {
            const score = fuzzyMatch(input, option.toLowerCase());
            if (score > bestScore) {
                bestScore = score;
                bestMatch = index;
            }
        });

        document.querySelectorAll('#fuzzyOptions button').forEach((btn, index) => {
            if (index === bestMatch) {
                btn.classList.remove('bg-gray-100', 'border-gray-300');
                btn.classList.add('bg-blue-200', 'border-blue-500');
            } else {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            }
        });

    };

    // Enter key handler
    fuzzyInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && answered && lastAnswerCorrect) {
            e.preventDefault();
            goToNextQuestionAfterCorrect();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const selected = document.querySelector('#fuzzyOptions button.bg-blue-200');
            if (selected) {
                selected.click();
            }
        }
    };

    fuzzyInput.focus();

    // Trigger fuzzy matching on prefilled value (from prefiring) and auto-submit
    if (fuzzyInput.value) {
        fuzzyInput.dispatchEvent(new Event('input'));
        // Auto-submit the prefired answer
        const selected = document.querySelector('#fuzzyOptions button.bg-blue-200');
        if (selected) {
            selected.click();
        }
    }

}

function generateFuzzyPinyinOptions() {
    const options = document.getElementById('fuzzyOptions');
    if (!options || !fuzzyInput) return;

    options.innerHTML = '';

    const currentVariants = currentQuestion.pinyin.split('/').map(p => p.trim()).filter(Boolean);
    const currentPinyin = currentVariants[0];

    const wrongOptions = [];
    const usedNormalized = new Set([normalizePinyinForChoice(currentPinyin)]);
    let safety = 0;

    while (wrongOptions.length < 3 && safety < 500) {
        safety++;
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
        if (random.char === currentQuestion.char) continue;

        const randomPinyin = random.pinyin.split('/')[0].trim();
        const normalizedRandom = normalizePinyinForChoice(randomPinyin);

        if (usedNormalized.has(normalizedRandom)) continue;

        wrongOptions.push(randomPinyin);
        usedNormalized.add(normalizedRandom);
    }

    const allOptions = [...wrongOptions, currentPinyin];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg border-2 border-gray-300 transition text-lg';
        btn.textContent = option;
        btn.dataset.index = index;
        btn.dataset.pinyin = option;
        btn.dataset.normalized = normalizePinyinForChoice(option);
        btn.onclick = () => checkFuzzyPinyinAnswer(option);
        options.appendChild(btn);
    });

    // Fuzzy matching on input
    fuzzyInput.oninput = () => {
        if (answered && lastAnswerCorrect) {
            nextAnswerBuffer = fuzzyInput.value;
        } else {
            nextAnswerBuffer = '';
        }

        const input = fuzzyInput.value.trim().toLowerCase();
        if (!input) {
            document.querySelectorAll('#fuzzyOptions button').forEach(btn => {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            });
            return;
        }

        let bestMatch = null;
        let bestScore = -1;

        // First pass: check for exact match after stripping tone marks
        allOptions.forEach((option, index) => {
            const optionNoTones = stripToneMarks(option).toLowerCase();
            if (input === optionNoTones) {
                bestMatch = index;
                bestScore = 2000; // Higher than any fuzzy score
            }
        });

        // Second pass: check for prefix match after stripping tone marks
        if (bestMatch === null) {
            allOptions.forEach((option, index) => {
                const optionNoTones = stripToneMarks(option).toLowerCase();
                if (optionNoTones.startsWith(input)) {
                    const score = 1000 + input.length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = index;
                    }
                }
            });
        }

        // Third pass: fall back to fuzzy matching only if no exact/prefix match
        if (bestMatch === null) {
            allOptions.forEach((option, index) => {
                const score = fuzzyMatch(input, option.toLowerCase());
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = index;
                }
            });
        }

        document.querySelectorAll('#fuzzyOptions button').forEach((btn, index) => {
            if (index === bestMatch) {
                btn.classList.remove('bg-gray-100', 'border-gray-300');
                btn.classList.add('bg-blue-200', 'border-blue-500');
            } else {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            }
        });
    };

    // Enter key handler
    fuzzyInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && answered && lastAnswerCorrect) {
            e.preventDefault();
            goToNextQuestionAfterCorrect();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const typedInput = fuzzyInput.value.trim();

            // First, check if typed input directly matches the correct pinyin (allows typing full answer)
            if (typedInput) {
                const pinyinVariants = currentQuestion.pinyin.split('/').map(p => p.trim()).filter(Boolean);
                const isDirectMatch = pinyinVariants.some(variant => checkPinyinMatch(typedInput, variant));

                if (isDirectMatch) {
                    // Direct pinyin match - submit the correct pinyin
                    checkFuzzyPinyinAnswer(pinyinVariants[0]);
                    return;
                }
            }

            // Otherwise, click the highlighted option
            const selected = document.querySelector('#fuzzyOptions button.bg-blue-200');
            if (selected) {
                selected.click();
            }
        }
    };

    fuzzyInput.focus();

    // Trigger fuzzy matching on prefilled value and auto-submit
    if (fuzzyInput.value) {
        fuzzyInput.dispatchEvent(new Event('input'));

        // Check for direct pinyin match first
        const typedInput = fuzzyInput.value.trim();
        if (typedInput) {
            const pinyinVariants = currentQuestion.pinyin.split('/').map(p => p.trim()).filter(Boolean);
            const isDirectMatch = pinyinVariants.some(variant => checkPinyinMatch(typedInput, variant));

            if (isDirectMatch) {
                checkFuzzyPinyinAnswer(pinyinVariants[0]);
                return;
            }
        }

        // Fall back to clicking highlighted option
        const selected = document.querySelector('#fuzzyOptions button.bg-blue-200');
        if (selected) {
            selected.click();
        }
    }
}

function checkFuzzyPinyinAnswer(answer) {
    if (answered) return;
    if (!answer) return;

    const isFirstAttempt = !questionAttemptRecorded;
    if (isFirstAttempt) {
        total++;
        questionAttemptRecorded = true;
    }

    const pinyinOptions = currentQuestion.pinyin.split('/').map(p => p.trim()).filter(Boolean);
    const normalizedAnswer = normalizePinyinForChoice(answer);
    const correct = pinyinOptions.some(option => normalizePinyinForChoice(option) === normalizedAnswer);

    // Play audio for the character
    const firstPinyin = pinyinOptions[0];
    if (window.playPinyinAudio) {
        playPinyinAudio(firstPinyin, currentQuestion.char);
    }

    // For 3-column layout: immediately advance on correct
    lastAnswerCorrect = correct;

    if (correct) {
        // Record the finished card on the left and advance
        previousQuestion = currentQuestion;
        previousQuestionResult = 'correct';
        threeColumnInlineFeedback = null;

        playCorrectSound();
        if (isFirstAttempt) {
            score++;
            markSchedulerOutcome(true);
        }

        updateStats();

        // Move upcoming to current (pick fresh if none queued)
        if (upcomingQuestion) {
            currentQuestion = upcomingQuestion;
            window.currentQuestion = currentQuestion;
            upcomingQuestion = null;
        } else {
            currentQuestion = selectNextQuestion();
            window.currentQuestion = currentQuestion;
        }

        // Mark the new question as served and update confidence display
        markSchedulerServed(currentQuestion);
        updateCurrentWordConfidence();

        // Clear input and immediately show next question
        if (fuzzyInput) {
            fuzzyInput.value = '';
        }

        // Re-render with updated columns and generate new options
        answered = false;
        questionAttemptRecorded = false;
        renderThreeColumnPinyinLayout();
        generateFuzzyPinyinOptions();
        feedback.textContent = '';
        hint.textContent = '';
        return;
    }

    // Incorrect: stay on the same card and show inline feedback in the center column
    playWrongSound();
    if (isFirstAttempt) {
        markSchedulerOutcome(false);
    }

    threeColumnInlineFeedback = {
        message: `✗ Correct: ${currentQuestion.pinyin}`,
        type: 'incorrect'
    };

    updateStats();

    if (fuzzyInput) {
        fuzzyInput.value = '';
        setTimeout(() => fuzzyInput.focus(), 0);
    }

    renderThreeColumnPinyinLayout();
    generateFuzzyPinyinOptions();
    feedback.textContent = '';
    hint.textContent = '';
}

function checkFuzzyAnswer(answer) {
    if (answered) return;
    if (!answer) return;

    const isFirstAttempt = !questionAttemptRecorded;
    if (isFirstAttempt) {
        total++;
        questionAttemptRecorded = true;
    }

    const correct = answer === currentQuestion.meaning;

    // Play audio for the character (skip for audio-to-meaning since they already heard it)
    if (mode !== 'audio-to-meaning') {
        const firstPinyin = currentQuestion.pinyin.split('/').map(p => p.trim())[0];
        if (window.playPinyinAudio) {
            playPinyinAudio(firstPinyin, currentQuestion.char);
        }
    }

    // For 3-column layout in char-to-meaning-type: immediately advance
    if (mode === 'char-to-meaning-type') {
        lastAnswerCorrect = correct;

        if (correct) {
            // Record the finished card on the left and advance
            previousQuestion = currentQuestion;
            previousQuestionResult = 'correct';
            threeColumnInlineFeedback = null;

            playCorrectSound();
            if (isFirstAttempt) {
                score++;
                markSchedulerOutcome(true);
            }

            updateStats();

            // Move upcoming to current (pick fresh if none queued)
            if (upcomingQuestion) {
                currentQuestion = upcomingQuestion;
                window.currentQuestion = currentQuestion;
                upcomingQuestion = null;
            } else {
                currentQuestion = selectNextQuestion();
                window.currentQuestion = currentQuestion;
            }

            // Mark the new question as served and update confidence display
            markSchedulerServed(currentQuestion);
            updateCurrentWordConfidence();

            // Clear input and immediately show next question
            if (fuzzyInput) {
                fuzzyInput.value = '';
            }

            // Re-render with updated columns and generate new options
            answered = false;
            questionAttemptRecorded = false;
            renderThreeColumnMeaningLayout();
            generateFuzzyMeaningOptions();
            feedback.textContent = '';
            hint.textContent = '';
            return;
        }

        // Incorrect: stay on the same card and show inline feedback in the center column
        playWrongSound();
        if (isFirstAttempt) {
            markSchedulerOutcome(false);
        }

        threeColumnInlineFeedback = {
            message: `✗ Correct: ${currentQuestion.meaning} - ${currentQuestion.char} (${currentQuestion.pinyin})`,
            type: 'incorrect'
        };

        updateStats();

        if (fuzzyInput) {
            fuzzyInput.value = '';
            setTimeout(() => fuzzyInput.focus(), 0);
        }

        renderThreeColumnMeaningLayout();
        generateFuzzyMeaningOptions();
        feedback.textContent = '';
        hint.textContent = '';
        return;
    }

    if (correct) {
        answered = true;
        playCorrectSound();
        if (isFirstAttempt) {
            score++;
        }
        lastAnswerCorrect = true;
        if (isFirstAttempt) {
            markSchedulerOutcome(true);
        }
        feedback.textContent = `✓ Correct! ${currentQuestion.char} (${currentQuestion.pinyin})`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        renderMeaningHint(currentQuestion, 'correct');
        renderCharacterComponents(currentQuestion);
        if (mode === 'char-to-meaning') {
            renderCharBreakdownSoon();
        }
        updateStats();
        // Clear input after submission - user can then type next answer during feedback period
        if (fuzzyInput) {
            fuzzyInput.value = '';
        }
        scheduleNextQuestion(1500);
    } else {
        answered = false;
        playWrongSound();
        lastAnswerCorrect = false;
        if (isFirstAttempt) {
            markSchedulerOutcome(false);
        }
        feedback.textContent = `✗ Wrong! Correct: ${currentQuestion.meaning} - ${currentQuestion.char} (${currentQuestion.pinyin})`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
        renderMeaningHint(currentQuestion, 'incorrect');
        renderCharacterComponents(currentQuestion);
        if (mode === 'char-to-meaning') {
            renderCharBreakdownSoon();
        }
        updateStats();
        if (fuzzyInput) {
            fuzzyInput.value = '';
            setTimeout(() => fuzzyInput.focus(), 0);
        }
    }
}

function checkMultipleChoice(answer) {
    if (answered) return;

    answered = true;
    total++;

    let correct = false;
    let correctAnswer = '';

    if (mode === 'char-to-pinyin-mc') {
        const pinyinOptions = currentQuestion.pinyin.split('/').map(p => p.trim()).filter(Boolean);
        const normalizedAnswer = normalizePinyinForChoice(answer);
        correct = pinyinOptions.some(option => normalizePinyinForChoice(option) === normalizedAnswer);
        // Show all accepted variants in the feedback to make fuzziness visible to the user
        correctAnswer = pinyinOptions.join(' / ');
    } else if (mode === 'char-to-pinyin-tones-mc') {
        const pinyinOptions = currentQuestion.pinyin.split('/').map(p => p.trim()).filter(Boolean);
        const normalizedAnswer = normalizePinyinForChoice(answer);
        correct = pinyinOptions.some(option => normalizePinyinForChoice(option) === normalizedAnswer);
        correctAnswer = pinyinOptions.join(' / ');
    } else if (mode === 'char-to-meaning' || mode === 'audio-to-meaning') {
        correct = answer === currentQuestion.meaning;
        correctAnswer = currentQuestion.meaning;
    } else if (mode === 'pinyin-to-char' || mode === 'meaning-to-char') {
        correct = answer === currentQuestion.char;
        correctAnswer = currentQuestion.char;
    }

    if (correct) {
        score++;
        playCorrectSound();
        triggerCorrectFlash();
        showCorrectToast('✓ Nice!');
        feedback.textContent = `✓ Correct!`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        lastAnswerCorrect = true;
        markSchedulerOutcome(true);
        if (mode === 'char-to-meaning' || mode === 'audio-to-meaning') {
            renderMeaningHint(currentQuestion, 'correct');
        } else {
            hint.textContent = `${currentQuestion.char} (${currentQuestion.pinyin}) - ${currentQuestion.meaning}`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        }
        renderCharacterComponents(currentQuestion);
        if (mode === 'char-to-meaning') {
            renderCharBreakdownSoon();
        }

        // Play audio for char-to-pinyin-mc mode
        if (mode === 'char-to-pinyin-mc') {
            const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
            playPinyinAudio(firstPinyin, currentQuestion.char);
        }

        // Instant transition for audio-to-meaning, tighter delay for others
        scheduleNextQuestion(mode === 'audio-to-meaning' ? 0 : 600);
    } else {
        playWrongSound();
        feedback.textContent = `✗ Wrong. The answer is: ${correctAnswer}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
        lastAnswerCorrect = false;
        markSchedulerOutcome(false);
        if (mode === 'char-to-meaning' || mode === 'audio-to-meaning') {
            renderMeaningHint(currentQuestion, 'incorrect');
        } else {
            hint.textContent = `${currentQuestion.char} (${currentQuestion.pinyin}) - ${currentQuestion.meaning}`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-red-600';
        }
        renderCharacterComponents(currentQuestion);
        if (mode === 'char-to-meaning') {
            renderCharBreakdownSoon();
        }

        // Play audio for char-to-pinyin-mc mode
        if (mode === 'char-to-pinyin-mc') {
            const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
            playPinyinAudio(firstPinyin, currentQuestion.char);
        }

        // Shorter delay for audio-to-meaning wrong answers
        scheduleNextQuestion(mode === 'audio-to-meaning' ? 500 : 1200);
    }

    updateStats();
}

// =====================
// Char → Pinyin → Tones (MC) flow
// =====================

function startPinyinToneMcFlow(useFuzzyInput = false) {
    const primaryPinyin = currentQuestion.pinyin.split('/')[0].trim();
    // Split into syllables using the proper pinyin splitter
    // splitPinyinSyllables handles both spaced and unspaced pinyin
    toneFlowSyllables = (typeof splitPinyinSyllables === 'function')
        ? splitPinyinSyllables(primaryPinyin)
        : primaryPinyin.split(/\s+/).filter(Boolean);
    toneFlowChars = (currentQuestion.char || '').replace(/[＿_]/g, '').split('');

    // Each syllable gets its own tone (extract from each syllable individually)
    toneFlowExpected = toneFlowSyllables.map(syl => {
        const toneSeq = extractToneSequence(syl);
        // toneSeq might be multi-digit if syllable wasn't split properly, take first digit
        return toneSeq ? Number(String(toneSeq).charAt(0)) : 5;
    });
    toneFlowIndex = 0;
    toneFlowCompleted = [];
    toneFlowCompletedPinyin = [];
    toneFlowUseFuzzy = useFuzzyInput;
    toneFlowStage = 'pinyin';
    answered = false;
    feedback.textContent = '';
    hint.textContent = '';
    hint.className = 'text-center text-lg text-gray-600 my-2';

    renderToneFlowCharacterStep();
}

function setToneFlowPrompt(text) {
    const prompt = document.getElementById('prompt');
    if (prompt) {
        prompt.textContent = text;
    } else {
        hint.textContent = text;
    }
}

function renderToneFlowCharacterStep() {
    // Show progress and current character
    updateToneFlowProgress();

    const currentChar = toneFlowChars[toneFlowIndex] || '?';
    setToneFlowPrompt(`Pick pinyin for: ${currentChar}`);

    toneFlowStage = 'pinyin';

    if (toneFlowUseFuzzy && fuzzyMode && fuzzyInput) {
        generateFuzzyPinyinOptionsToneFlowSingle();
        fuzzyMode.style.display = 'block';
        if (choiceMode) choiceMode.style.display = 'none';
    } else {
        generatePinyinOptionsToneFlowSingle();
        if (choiceMode) choiceMode.style.display = 'block';
        if (fuzzyMode) fuzzyMode.style.display = 'none';
    }
}

function generatePinyinOptionsToneFlowSingle() {
    const options = document.getElementById('options');
    if (!options) return;
    options.innerHTML = '';

    const currentSyllable = toneFlowSyllables[toneFlowIndex];

    // Generate 3 wrong options from other syllables in the vocab
    const wrongOptions = [];
    const usedNormalized = new Set([normalizePinyinForChoice(currentSyllable)]);
    let safety = 0;

    while (wrongOptions.length < 3 && safety < 500) {
        safety++;
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
        const randomSyllables = random.pinyin.split('/')[0].trim().split(/\s+/);
        const randomSyl = randomSyllables[Math.floor(Math.random() * randomSyllables.length)];
        const normalizedRandom = normalizePinyinForChoice(randomSyl);

        if (usedNormalized.has(normalizedRandom)) continue;

        wrongOptions.push(randomSyl);
        usedNormalized.add(normalizedRandom);
    }

    const allOptions = [...wrongOptions, currentSyllable];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'px-6 py-4 text-xl bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition';
        btn.textContent = option;
        btn.dataset.normalized = normalizePinyinForChoice(option);
        btn.onclick = () => handleToneFlowPinyinChoiceSingle(option, btn);
        options.appendChild(btn);
    });
}

function generateFuzzyPinyinOptionsToneFlowSingle() {
    const options = document.getElementById('fuzzyOptions');
    if (!options || !fuzzyInput) return;
    options.innerHTML = '';
    fuzzyInput.value = '';

    const currentSyllable = toneFlowSyllables[toneFlowIndex];

    // Build a pool of all single syllables from the vocabulary
    const syllablePool = [];
    quizCharacters.forEach(item => {
        const primaryPinyin = item.pinyin.split('/')[0].trim();
        const syllables = (typeof splitPinyinSyllables === 'function')
            ? splitPinyinSyllables(primaryPinyin)
            : primaryPinyin.split(/\s+/).filter(Boolean);
        syllables.forEach(syl => {
            if (syl && !syl.includes('.') && !syl.includes('…')) {
                syllablePool.push(syl);
            }
        });
    });

    // Generate 3 wrong options from the pool
    const wrongOptions = [];
    const usedNormalized = new Set([normalizePinyinForChoice(currentSyllable)]);
    let safety = 0;

    while (wrongOptions.length < 3 && safety < 500) {
        safety++;
        const randomSyl = syllablePool[Math.floor(Math.random() * syllablePool.length)];
        if (!randomSyl) continue;
        const normalizedRandom = normalizePinyinForChoice(randomSyl);

        if (usedNormalized.has(normalizedRandom)) continue;

        wrongOptions.push(randomSyl);
        usedNormalized.add(normalizedRandom);
    }

    const allOptions = [...wrongOptions, currentSyllable];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg border-2 border-gray-300 transition text-lg';
        btn.textContent = option;
        btn.dataset.index = index;
        btn.dataset.pinyin = option;
        btn.dataset.normalized = normalizePinyinForChoice(option);
        btn.onclick = () => handleToneFlowPinyinChoiceSingle(option, btn);
        options.appendChild(btn);
    });

    // Fuzzy matching on input
    fuzzyInput.oninput = () => {
        const input = fuzzyInput.value.trim().toLowerCase();
        if (!input) {
            document.querySelectorAll('#fuzzyOptions button').forEach(btn => {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            });
            return;
        }

        let bestMatch = null;
        let bestScore = -1;

        // First pass: check for exact match after stripping tone marks
        allOptions.forEach((option, index) => {
            const optionNoTones = stripToneMarks(option).toLowerCase();
            if (input === optionNoTones) {
                bestMatch = index;
                bestScore = 2000; // Higher than any fuzzy score
            }
        });

        // Second pass: check for prefix match after stripping tone marks
        if (bestMatch === null) {
            allOptions.forEach((option, index) => {
                const optionNoTones = stripToneMarks(option).toLowerCase();
                if (optionNoTones.startsWith(input)) {
                    const score = 1000 + input.length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = index;
                    }
                }
            });
        }

        // Third pass: fall back to fuzzy matching only if no exact/prefix match
        if (bestMatch === null) {
            allOptions.forEach((option, index) => {
                const score = fuzzyMatch(input, option.toLowerCase());
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = index;
                }
            });
        }

        document.querySelectorAll('#fuzzyOptions button').forEach((btn, index) => {
            if (index === bestMatch) {
                btn.classList.remove('bg-gray-100', 'border-gray-300');
                btn.classList.add('bg-blue-200', 'border-blue-500');
            } else {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            }
        });
    };

    // Enter key handler
    fuzzyInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = fuzzyInput.value.trim();

            // Check if input includes tone number (e.g., "wan3")
            const toneMatch = input.match(/^(.+?)([1-5])$/);
            if (toneMatch) {
                const pinyinPart = toneMatch[1];
                const toneNum = parseInt(toneMatch[2]);
                const expectedTone = toneFlowExpected[toneFlowIndex];
                const expectedPinyin = normalizePinyinForChoice(currentSyllable);
                const inputPinyin = normalizePinyinForChoice(pinyinPart);

                // If both pinyin and tone are correct, skip the tone step
                if (inputPinyin === expectedPinyin && toneNum === expectedTone) {
                    fuzzyInput.value = '';
                    playCorrectSound();
                    const currentChar = toneFlowChars[toneFlowIndex] || '';
                    const currentSyl = toneFlowSyllables[toneFlowIndex] || '';
                    if (currentChar && currentSyl) {
                        playPinyinAudio(currentSyl, currentChar);
                    }
                    toneFlowCompletedPinyin.push(currentSyllable);
                    toneFlowCompleted.push(toneNum);
                    toneFlowIndex += 1;

                    if (toneFlowIndex >= toneFlowExpected.length) {
                        // Completed entire word
                        updateToneFlowProgress();
                        score++;
                        total++;
                        updateStats();
                        markSchedulerOutcome(true);
                        previousQuestion = currentQuestion;
                        previousQuestionResult = 'correct';
                        threeColumnInlineFeedback = null;
                        const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
                        playPinyinAudio(firstPinyin, currentQuestion.char);
                        feedback.textContent = '✓ Correct!';
                        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
                        answered = true;
                        generateQuestion();
                    } else {
                        // Move to next character
                        feedback.textContent = '';
                        renderToneFlowCharacterStep();
                    }
                    return;
                }
            }

            // Check for exact match first (normalized)
            const inputNormalized = normalizePinyinForChoice(input);
            const exactMatch = document.querySelector(`#fuzzyOptions button[data-normalized="${inputNormalized}"]`);
            if (exactMatch) {
                exactMatch.click();
                return;
            }

            // Fall back to highlighted button from fuzzy match
            const selected = document.querySelector('#fuzzyOptions button.bg-blue-200');
            if (selected) {
                selected.click();
            }
        }
    };

    fuzzyInput.focus();
}

// Strip tone marks from pinyin but keep the letters (e.g., "wǎn" -> "wan")
function stripToneMarks(pinyin) {
    if (!pinyin) return '';
    let result = pinyin;
    const marks = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
        'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü'
    };
    for (const [marked, base] of Object.entries(marks)) {
        result = result.replace(new RegExp(marked, 'g'), base);
    }
    return result;
}

function handleToneFlowPinyinChoiceSingle(choice, btn) {
    if (toneFlowStage !== 'pinyin') return;

    // Clear input immediately on submit
    if (fuzzyInput) {
        fuzzyInput.value = '';
    }

    const currentSyllable = toneFlowSyllables[toneFlowIndex];
    const normalizedAnswer = normalizePinyinForChoice(choice);
    const normalizedExpected = normalizePinyinForChoice(currentSyllable);
    const correct = normalizedAnswer === normalizedExpected;

    disableChoices();

    if (correct) {
        btn.classList.add('bg-green-100', 'border-green-500');
        btn.innerHTML = `✓ ${choice}`;
        toneFlowCompletedPinyin.push(choice);
        playCorrectSound();
        // Play the character audio
        const currentChar = toneFlowChars[toneFlowIndex] || '';
        const currentSyl = toneFlowSyllables[toneFlowIndex] || '';
        if (currentChar && currentSyl) {
            playPinyinAudio(currentSyl, currentChar);
        }
        setToneFlowPrompt(`Now pick tone for: ${toneFlowChars[toneFlowIndex]}`);
        toneFlowStage = 'tone';
        renderToneFlowToneStep();
    } else {
        btn.classList.add('bg-red-100', 'border-red-500');
        btn.innerHTML = `✗ ${choice}`;
        feedback.innerHTML = `Wrong — correct pinyin is <strong>${currentSyllable}</strong>`;
        feedback.className = 'text-center text-lg font-semibold text-red-600 my-2';
        // Re-render immediately so user can retry, feedback clears on next action
        renderToneFlowCharacterStep();
    }
}

function renderToneFlowToneStep() {
    if (toneFlowStage !== 'tone') return;

    const currentChar = toneFlowChars[toneFlowIndex] || '?';
    setToneFlowPrompt(`Pick tone for: ${currentChar}`);
    updateToneFlowProgress();

    if (toneFlowUseFuzzy && fuzzyMode && fuzzyInput) {
        if (choiceMode) choiceMode.style.display = 'none';
        fuzzyMode.style.display = 'block';
        renderFuzzyToneChoices();
    } else {
        if (choiceMode) choiceMode.style.display = 'block';
        if (fuzzyMode) fuzzyMode.style.display = 'none';
        renderToneChoices();
    }
}

function disableChoices() {
    document.querySelectorAll('#options button, #fuzzyOptions button').forEach(btn => {
        btn.disabled = true;
    });
}

function updateToneFlowProgress() {
    if (toneFlowExpected.length <= 1) {
        // Single character - show pinyin if we have it, otherwise nothing
        if (toneFlowCompletedPinyin.length > 0 && toneFlowStage === 'tone') {
            const char = toneFlowChars[0] || '?';
            // Strip tone marks so we don't give away the answer
            const pinyinNoTone = stripToneMarks(toneFlowCompletedPinyin[0]);
            hint.innerHTML = `<span class="text-blue-600 font-bold">${char} (${pinyinNoTone})</span> → <span class="text-gray-500">tone?</span>`;
            hint.className = 'text-center text-xl my-2';
        } else {
            hint.textContent = '';
        }
        return;
    }

    // Build progress display showing each character with pinyin and tone
    const parts = [];
    for (let i = 0; i < toneFlowExpected.length; i++) {
        const char = toneFlowChars[i] || '?';
        if (i < toneFlowCompleted.length) {
            // Fully completed - show character with pinyin and tone in green
            const pinyin = toneFlowCompletedPinyin[i] || '';
            parts.push(`<span class="text-green-600 font-bold">${char}<sub>${toneFlowCompleted[i]}</sub></span>`);
        } else if (i === toneFlowIndex) {
            // Current character
            if (toneFlowStage === 'pinyin') {
                // Asking for pinyin
                parts.push(`<span class="text-blue-600 font-bold border-b-2 border-blue-600">${char}<sub>?</sub></span>`);
            } else {
                // Asking for tone (pinyin already answered)
                const pinyin = toneFlowCompletedPinyin[i] || '';
                parts.push(`<span class="text-blue-600 font-bold border-b-2 border-blue-600">${char}<sub>?</sub></span>`);
            }
        } else {
            // Upcoming - show character grayed out
            parts.push(`<span class="text-gray-400">${char}<sub>_</sub></span>`);
        }
    }

    hint.innerHTML = parts.join(' ');
    hint.className = 'text-center text-2xl my-2';
}

function renderToneChoices() {
    const options = document.getElementById('options');
    if (!options) return;
    options.innerHTML = '';

    [1,2,3,4,5].forEach(num => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-3 text-lg bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition';
        btn.textContent = num;
        btn.onclick = () => handleToneFlowToneChoice(num, btn);
        options.appendChild(btn);
    });
}

function renderFuzzyToneChoices() {
    const options = document.getElementById('fuzzyOptions');
    if (!options || !fuzzyInput) return;
    options.innerHTML = '';
    fuzzyInput.value = '';

    const toneLabels = [
        { num: 1, label: '1 - First', match: 'first' },
        { num: 2, label: '2 - Second', match: 'second' },
        { num: 3, label: '3 - Third', match: 'third' },
        { num: 4, label: '4 - Fourth', match: 'fourth' },
        { num: 5, label: '5 - Fifth', match: 'fifth' }
    ];

    toneLabels.forEach(({ num, label }) => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg border-2 border-gray-300 transition text-lg';
        btn.textContent = label;
        btn.dataset.tone = num;
        btn.onclick = () => handleToneFlowToneChoice(num, btn);
        options.appendChild(btn);
    });

    // Fuzzy matching on input
    fuzzyInput.oninput = () => {
        const input = fuzzyInput.value.trim().toLowerCase();
        if (!input) {
            document.querySelectorAll('#fuzzyOptions button').forEach(btn => {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            });
            return;
        }

        // Direct number match - auto-submit immediately
        const numMatch = parseInt(input);
        if (numMatch >= 1 && numMatch <= 5) {
            const btn = document.querySelector(`#fuzzyOptions button[data-tone="${numMatch}"]`);
            if (btn) {
                btn.click();
            }
            return;
        }

        // Fuzzy match against first/second/third/fourth/fifth
        let bestMatch = null;
        let bestScore = -1;

        toneLabels.forEach(({ num, match }) => {
            const score = fuzzyMatch(input, match);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = num;
            }
        });

        if (bestMatch && bestScore > 0) {
            highlightToneButton(bestMatch);
        } else {
            // No match - clear highlights
            document.querySelectorAll('#fuzzyOptions button').forEach(btn => {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            });
        }
    };

    function highlightToneButton(toneNum) {
        document.querySelectorAll('#fuzzyOptions button').forEach(btn => {
            if (parseInt(btn.dataset.tone) === toneNum) {
                btn.classList.remove('bg-gray-100', 'border-gray-300');
                btn.classList.add('bg-blue-200', 'border-blue-500');
            } else {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            }
        });
    }

    // Enter key handler: pick highlighted option
    fuzzyInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const selected = document.querySelector('#fuzzyOptions button.bg-blue-200');
            if (selected) {
                selected.click();
            }
        }
    };

    fuzzyInput.focus();
}

function handleToneFlowToneChoice(choice, btn) {
    if (toneFlowStage !== 'tone') return;

    // Clear input immediately on submit
    if (fuzzyInput) {
        fuzzyInput.value = '';
    }

    const expected = toneFlowExpected[toneFlowIndex];
    disableChoices();

    if (choice === expected) {
        btn.classList.add('bg-green-100', 'border-green-500');
        btn.innerHTML = `✓ ${btn.textContent}`;
        toneFlowCompleted.push(choice);  // Record completed tone
        toneFlowIndex += 1;
        if (toneFlowIndex >= toneFlowExpected.length) {
            // Completed word - show final progress with all checkmarks
            updateToneFlowProgress();
            score++;
            total++;
            updateStats();
            playCorrectSound();
            markSchedulerOutcome(true);
            // Record for 3-column "last answer" display
            previousQuestion = currentQuestion;
            previousQuestionResult = 'correct';
            threeColumnInlineFeedback = null;
            // Play the character audio
            const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
            playPinyinAudio(firstPinyin, currentQuestion.char);
            feedback.textContent = '✓ Correct!';
            feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
            // Show completed tones with characters
            const charTones = toneFlowChars.map((c, i) => `${c}<sub>${toneFlowCompleted[i] || ''}</sub>`).join(' ');
            hint.innerHTML = `<span class="text-green-600 font-bold text-2xl">${charTones}</span> <span class="text-gray-600">(${currentQuestion.pinyin}) - ${currentQuestion.meaning}</span>`;
            hint.className = 'text-center text-xl font-semibold my-4';
            answered = true;
            // Move to next question immediately
            generateQuestion();
        } else {
            // Move to next CHARACTER (pinyin step) immediately
            playCorrectSound();
            feedback.textContent = '';
            renderToneFlowCharacterStep();
        }
    } else {
        btn.classList.add('bg-red-100', 'border-red-500');
        btn.innerHTML = `✗ ${btn.textContent}`;
        // Show the correct answer
        const currentChar = toneFlowChars[toneFlowIndex] || '?';
        feedback.innerHTML = `Wrong — correct tone for <strong>${currentChar}</strong> is <strong>${expected}</strong>`;
        feedback.className = 'text-center text-lg font-semibold text-red-600 my-2';
        // Re-render immediately so user can retry, feedback clears on next action
        renderToneFlowToneStep();
    }
}

function updateStats() {
    const scoreEl = document.getElementById('score');
    const totalEl = document.getElementById('total');
    const percentageEl = document.getElementById('percentage');
    const accuracyEl = document.getElementById('accuracy');

    if (scoreEl) scoreEl.textContent = score;
    if (totalEl) totalEl.textContent = total;

    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    if (percentageEl) percentageEl.textContent = percentage;
    if (accuracyEl) accuracyEl.textContent = percentage + '%';

    updateTimerDisplay();
    if (typeof updateDictationChatMiniStats === 'function') {
        updateDictationChatMiniStats();
    }
    checkComposerAdvance();
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('timerDisplay');
    if (!timerEl) return;

    if (timerEnabled) {
        const mins = Math.floor(timerRemainingSeconds / 60);
        const secs = timerRemainingSeconds % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        const isLow = timerRemainingSeconds <= 5;
        const colorClass = isLow ? 'text-red-600 font-bold' : 'text-gray-600';
        timerEl.innerHTML = `<span class="${colorClass}">⏱ ${timeStr}</span>`;
        timerEl.style.display = 'inline';
    } else {
        timerEl.style.display = 'none';
    }
}

function stopTimer() {
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
}

function startTimer() {
    stopTimer();
    if (!timerEnabled) return;

    timerRemainingSeconds = timerSeconds;
    updateTimerDisplay();

    timerIntervalId = setInterval(() => {
        timerRemainingSeconds--;
        updateTimerDisplay();

        if (timerRemainingSeconds <= 0) {
            stopTimer();
            // Auto-submit when time runs out
            if (!answered) {
                checkAnswer();
            }
        }
    }, 1000);
}

function loadTimerSettings() {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
        const storedEnabled = window.localStorage.getItem(TIMER_ENABLED_KEY);
        // Default to disabled if not set
        if (storedEnabled === null) {
            timerEnabled = false;
        } else if (storedEnabled === '1') {
            timerEnabled = true;
        } else if (storedEnabled === '0') {
            timerEnabled = false;
        }

        const storedSeconds = window.localStorage.getItem(TIMER_SECONDS_KEY);
        if (storedSeconds) {
            const parsed = parseInt(storedSeconds, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                timerSeconds = parsed;
            }
        }
    } catch (err) {
        console.warn('Failed to load timer settings', err);
    }
}

function saveTimerSettings() {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
        window.localStorage.setItem(TIMER_ENABLED_KEY, timerEnabled ? '1' : '0');
        window.localStorage.setItem(TIMER_SECONDS_KEY, String(timerSeconds));
    } catch (err) {
        console.warn('Failed to save timer settings', err);
    }
}

function setTimerEnabled(enabled) {
    timerEnabled = enabled;
    saveTimerSettings();
    updateTimerDisplay();

    if (enabled && !answered && currentQuestion) {
        startTimer();
    } else {
        stopTimer();
    }
}

function setTimerSeconds(seconds) {
    const parsed = parseInt(seconds, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    timerSeconds = parsed;
    saveTimerSettings();

    // Restart timer if it's currently running
    if (timerEnabled && !answered && currentQuestion) {
        startTimer();
    }
}

function loadComponentPreference() {
    if (componentPreferenceLoaded) return;
    componentPreferenceLoaded = true;

    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
        const stored = window.localStorage.getItem(COMPONENT_PREF_KEY);
        if (stored === '0') {
            showComponentBreakdown = false;
        } else if (stored === '1') {
            showComponentBreakdown = true;
        }
    } catch (err) {
        console.warn('Failed to load component hint preference', err);
    }
}

function saveComponentPreference() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(COMPONENT_PREF_KEY, showComponentBreakdown ? '1' : '0');
    } catch (err) {
        console.warn('Failed to save component hint preference', err);
    }
}

function setComponentBreakdownVisibility(enabled) {
    const newValue = Boolean(enabled);
    if (showComponentBreakdown === newValue) return;
    showComponentBreakdown = newValue;
    saveComponentPreference();

    if (!showComponentBreakdown) {
        componentPanelsHaveContent = false;
        applyComponentPanelVisibility();
        applyComponentColoring();
        renderEtymologyNote(null);
        if (componentBreakdown) {
            clearComponentBreakdown();
        }
    } else if (currentQuestion && answered) {
        renderCharacterComponents(currentQuestion);
    } else {
        let previewBreakdown = null;
        if (currentQuestion) {
            const canShow = answered || questionAttemptRecorded;
            previewBreakdown = canShow ? getComponentsForQuestion(currentQuestion) : null;
        }
        componentPanelsHaveContent = showComponentBreakdown && hasComponentPanelContent(previewBreakdown);
        applyComponentPanelVisibility();
        if (currentQuestion) {
            applyComponentColoring();
            renderEtymologyNote(previewBreakdown);
        }
    }
}

function toggleComponentBreakdownVisibility() {
    setComponentBreakdownVisibility(!showComponentBreakdown);
}

function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clearComponentBreakdown() {
    if (!componentBreakdown) return;
    componentBreakdown.innerHTML = '';
    componentBreakdown.classList.add('hidden');
}

function parseRadicalEntry(entry) {
    if (!entry) return null;
    const trimmed = String(entry).trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(.+?)\s*\((.+)\)$/);
    if (match) {
        return {
            char: match[1].trim(),
            meaning: match[2].trim()
        };
    }
    return { char: trimmed, meaning: '' };
}

function convertRadicalListToBreakdown(radicals) {
    if (!Array.isArray(radicals) || radicals.length === 0) return null;
    const entries = radicals.map(parseRadicalEntry).filter(Boolean);
    if (entries.length === 0) return null;
    const breakdown = {};
    breakdown.radical = entries[0];
    if (entries[1]) breakdown.phonetic = entries[1];
    if (entries.length > 2) {
        breakdown.others = entries.slice(2);
    }
    return breakdown;
}

function getComponentsForQuestion(question) {
    if (!question) return null;

    if (question.componentBreakdown) {
        return question.componentBreakdown;
    }

    if (question.components) {
        return question.components;
    }

    if (Array.isArray(question.radicals) && question.radicals.length > 0) {
        return convertRadicalListToBreakdown(question.radicals);
    }

    if (typeof window !== 'undefined' &&
        window.CHARACTER_COMPONENTS &&
        window.CHARACTER_COMPONENTS[question.char]) {
        return window.CHARACTER_COMPONENTS[question.char];
    }

    return null;
}

function hasComponentPanelContent(breakdown) {
    if (!breakdown) return false;

    const hasRadical = breakdown.radical && (
        Boolean(breakdown.radical.char) ||
        Boolean(breakdown.radical.meaning) ||
        Boolean(breakdown.radical.pinyin)
    );

    const hasPhonetic = breakdown.phonetic && (
        Boolean(breakdown.phonetic.char) ||
        Boolean(breakdown.phonetic.meaning) ||
        Boolean(breakdown.phonetic.pinyin)
    );

    const hasOther = Array.isArray(breakdown.others) && breakdown.others.some(entry => {
        if (!entry) return false;
        return Boolean(entry.char) || Boolean(entry.meaning) || Boolean(entry.pinyin);
    });

    return Boolean(
        hasRadical ||
        hasPhonetic ||
        hasOther ||
        (breakdown.hint && breakdown.hint.trim())
    );
}

function buildComponentLine(label, data, tagClass) {
    if (!data || (!data.char && !data.meaning)) return '';
    const componentChar = escapeHtml(data.char || '');
    const meaning = escapeHtml(data.meaning || '');
    const meaningHtml = meaning ? `<span class="component-meaning">${meaning}</span>` : '';
    return `<div class="component-line"><span class="component-label">${escapeHtml(label)}</span><span class="component-tag ${tagClass}">${componentChar}</span>${meaningHtml}</div>`;
}

function buildComponentChip(label, data, chipClass) {
    if (!data) return '';
    const chipLabel = label ? `<div class="component-chip-label">${escapeHtml(label)}</div>` : '';
    const chipSymbol = data.char ? `<div class="component-chip-symbol">${escapeHtml(data.char)}</div>` : '';
    const chipPinyin = data.pinyin ? `<div class="component-chip-pinyin">${escapeHtml(data.pinyin)}</div>` : '';
    const chipMeaning = data.meaning ? `<div class="component-chip-meaning">${escapeHtml(data.meaning)}</div>` : '';
    if (!chipLabel && !chipSymbol && !chipMeaning && !chipPinyin) return '';
    return `<div class="component-chip ${chipClass}">${chipLabel}${chipSymbol}${chipPinyin}${chipMeaning}</div>`;
}

function renderCharacterComponents(question) {
    const leftPanel = document.getElementById('componentPanelLeft');
    const rightPanel = document.getElementById('componentPanelRight');

    if (!showComponentBreakdown) {
        componentPanelsHaveContent = false;
        if (leftPanel) leftPanel.innerHTML = '';
        if (rightPanel) rightPanel.innerHTML = '';
        applyComponentPanelVisibility();
        applyComponentColoring();
        renderEtymologyNote(null);
        if (componentBreakdown) {
            clearComponentBreakdown();
        }
        return;
    }

    const breakdown = getComponentsForQuestion(question);
    const hasBreakdown = hasComponentPanelContent(breakdown);

    if (!hasBreakdown) {
        componentPanelsHaveContent = false;
        if (leftPanel) leftPanel.innerHTML = '';
        if (rightPanel) rightPanel.innerHTML = '';
        applyComponentPanelVisibility();
        applyComponentColoring();
        renderEtymologyNote(null);
        if (componentBreakdown) {
            clearComponentBreakdown();
        }
        return;
    }

    if (leftPanel && rightPanel) {
        leftPanel.innerHTML = '';
        rightPanel.innerHTML = '';

        const leftChips = [];
        const rightChips = [];

        if (breakdown.radical) {
            const chip = buildComponentChip('Radical', breakdown.radical, 'chip-radical');
            if (chip) leftChips.push(chip);
        }

        if (breakdown.phonetic) {
            const chip = buildComponentChip('Phonetic', breakdown.phonetic, 'chip-phonetic');
            if (chip) rightChips.push(chip);
        }

        const others = Array.isArray(breakdown.others) ? breakdown.others.filter(Boolean) : [];
        others.forEach((other, index) => {
            const chip = buildComponentChip(others.length > 1 ? `Component ${index + 1}` : 'Component', other, 'chip-other');
            if (!chip) return;
            if (leftChips.length <= rightChips.length) {
                leftChips.push(chip);
            } else {
                rightChips.push(chip);
            }
        });

        if (breakdown.hint) {
            const hintHtml = `<div class="component-hint-chip">${escapeHtml(breakdown.hint)}</div>`;
            if (leftChips.length <= rightChips.length) {
                leftChips.push(hintHtml);
            } else {
                rightChips.push(hintHtml);
            }
        }

        componentPanelsHaveContent = showComponentBreakdown && hasBreakdown;
        leftPanel.innerHTML = leftChips.join('');
        rightPanel.innerHTML = rightChips.join('');
        applyComponentPanelVisibility();
        applyComponentColoring();
        renderEtymologyNote(breakdown);

        if (componentBreakdown) {
            clearComponentBreakdown();
        }
        return;
    }

    if (!componentBreakdown) {
        componentPanelsHaveContent = false;
        applyComponentColoring();
        renderEtymologyNote(breakdown);
        return;
    }

    let html = '<div class="component-title">Character Components</div>';

    if (breakdown.radical) {
        html += buildComponentLine('Radical', breakdown.radical, 'component-radical');
    }

    if (breakdown.phonetic) {
        html += buildComponentLine('Phonetic', breakdown.phonetic, 'component-phonetic');
    }

    if (Array.isArray(breakdown.others)) {
        breakdown.others.forEach((other, index) => {
            if (!other) return;
            const label = breakdown.others.length > 1 ? `Component ${index + 1}` : 'Component';
            html += buildComponentLine(label, other, 'component-other');
        });
    }

    if (breakdown.hint) {
        html += `<div class="component-hint">${escapeHtml(breakdown.hint)}</div>`;
    }

    componentBreakdown.innerHTML = html;
    componentBreakdown.classList.remove('hidden');
    applyComponentColoring();
    renderEtymologyNote(breakdown);
}

function renderEtymologyNote(breakdown) {
    const card = document.getElementById('etymologyNoteCard');
    if (!card) return;

    const headerEl = document.getElementById('etymologyNoteHeader');
    const bodyEl = document.getElementById('etymologyNoteBody');

    const resetCard = () => {
        if (headerEl) headerEl.textContent = '';
        if (bodyEl) bodyEl.textContent = '';
        card.classList.add('hidden');
    };

    const canReveal = answered || questionAttemptRecorded;

    if (!showComponentBreakdown || !canReveal) {
        resetCard();
        return;
    }

    const current = currentQuestion || {};
    const charText = escapeHtml(current.char || '');
    const pinyinText = current.pinyin ? escapeHtml(current.pinyin.split('/')[0].trim()) : '';
    const meaningText = escapeHtml(current.meaning || '');

    if (headerEl) {
        const parts = [];
        if (charText) parts.push(charText);
        if (pinyinText) parts.push(pinyinText);
        if (meaningText) parts.push(`→ ${meaningText}`);
        headerEl.textContent = parts.join(' ');
    }

    let note = '';

    const normalizeNote = (value) => {
        if (typeof value !== 'string') return '';
        return value.replace(/\s+/g, ' ').trim();
    };

    // Priority 1: Check ETYMOLOGY_NOTES dataset for short, curated notes
    if (typeof ETYMOLOGY_NOTES !== 'undefined' && ETYMOLOGY_NOTES[current.char]) {
        note = normalizeNote(ETYMOLOGY_NOTES[current.char]);
    }
    // Priority 2: Check breakdown.etymologyNote from character-components.js
    else if (breakdown && breakdown.etymologyNote) {
        note = normalizeNote(breakdown.etymologyNote);
    }
    // Priority 3: Check breakdown.hint
    else if (breakdown && breakdown.hint) {
        note = normalizeNote(breakdown.hint);
    }
    // Priority 4: Generate default note from radical/phonetic
    else if (breakdown) {
        if (breakdown.radical && breakdown.radical.char && breakdown.phonetic && breakdown.phonetic.char) {
            note = `${normalizeNote(breakdown.radical.char)} hints the meaning while ${normalizeNote(breakdown.phonetic.char)} guides the pronunciation.`;
        } else if (breakdown.radical && breakdown.radical.char) {
            note = `${normalizeNote(breakdown.radical.char)} anchors the meaning of this character.`;
        } else if (breakdown.phonetic && breakdown.phonetic.char) {
            note = `${normalizeNote(breakdown.phonetic.char)} points to how it sounds.`;
        }
    }

    if (!note) {
        resetCard();
        return;
    }

    if (bodyEl) {
        bodyEl.textContent = note;
    }

    card.classList.remove('hidden');
}

function prioritizeMeaningModeButton() {
    const preferredButton =
        document.querySelector('.mode-btn[data-mode="char-to-meaning-type"]') ||
        document.querySelector('.mode-btn[data-mode="audio-to-meaning"]') ||
        document.querySelector('.mode-btn[data-mode="char-to-meaning"]');

    if (!preferredButton || !preferredButton.parentElement) return;

    const parent = preferredButton.parentElement;
    if (parent.firstElementChild === preferredButton) return;

    parent.insertBefore(preferredButton, parent.firstElementChild);
}

function renderMeaningHint(question, status) {
    if (!question) return;

    const card = document.getElementById('answerSummaryCard');
    const charText = question.char || '';
    const pinyinText = (question.pinyin || '').split('/').map(p => p.trim())[0] || '';
    const meaningText = question.meaning || '';

    if (card) {
        const charEl = document.getElementById('answerSummaryChar');
        const pinyinEl = document.getElementById('answerSummaryPinyin');
        const meaningEl = document.getElementById('answerSummaryMeaning');

        if (charEl) charEl.textContent = charText;
        if (pinyinEl) pinyinEl.textContent = pinyinText;
        if (meaningEl) meaningEl.textContent = meaningText;

        card.classList.remove('summary-correct', 'summary-incorrect', 'visible');
        if (status === 'correct') {
            card.classList.add('summary-correct');
        } else if (status === 'incorrect') {
            card.classList.add('summary-incorrect');
        }
        card.classList.add('visible');
        return;
    }

    if (!hint) return;
    hint.className = 'text-center text-2xl font-semibold my-4';
    hint.textContent = `${charText} (${pinyinText}) - ${meaningText}`;
}

function renderMeaningQuestionLayout() {
    if (!questionDisplay || !currentQuestion) return;

    componentPanelsHaveContent = false;
    const charHtml = escapeHtml(currentQuestion.char || '');

    questionDisplay.innerHTML = `
        <div class="meaning-question-layout${showComponentBreakdown ? '' : ' components-hidden'}">
            <div class="component-panel component-panel-left" id="componentPanelLeft"></div>
            <div class="meaning-char-column">
                <div class="answer-summary-card" id="answerSummaryCard">
                    <div class="summary-card-header">
                        <span class="summary-card-char" id="answerSummaryChar"></span>
                        <span class="summary-card-pinyin" id="answerSummaryPinyin"></span>
                    </div>
                    <div class="summary-card-meaning" id="answerSummaryMeaning"></div>
                </div>
                <div class="question-char-display">${charHtml}</div>
                <div class="etymology-note-card hidden" id="etymologyNoteCard">
                    <div class="etymology-title">Etymology note</div>
                    <div class="etymology-header" id="etymologyNoteHeader"></div>
                    <div class="etymology-body" id="etymologyNoteBody"></div>
                                    </div>
            </div>
            <div class="component-panel component-panel-right" id="componentPanelRight"></div>
        </div>
    `;

    resetMeaningAnswerSummary();
    applyComponentPanelVisibility();
    applyComponentColoring();
    renderEtymologyNote(null);
}

// Calculate dynamic font size based on character count
function getCharLargeFontSize(charText) {
    const len = charText.length;
    if (len <= 1) return '140px';
    if (len === 2) return '120px';
    if (len === 3) return '90px';
    if (len === 4) return '72px';
    return '56px'; // 5+ characters
}

// Helper function to generate marking badge HTML
function getMarkingBadgeHtml(char) {
    const marking = getWordMarking(char);
    if (!marking) return '';
    if (marking === 'learned') {
        return '<div class="word-marking-badge marking-badge-learned">✓ Learned</div>';
    } else if (marking === 'needs-work') {
        return '<div class="word-marking-badge marking-badge-needs-work">⚠ Needs Work</div>';
    }
    return '';
}

function renderThreeColumnMeaningLayout() {
    if (!questionDisplay || !currentQuestion) return;

    // Get upcoming question from preview queue or select one (exclude current)
    if (!upcomingQuestion) {
        const exclusions = currentQuestion?.char ? [currentQuestion.char] : [];
        upcomingQuestion = selectNextQuestion(exclusions);
    }

    const prevChar = previousQuestion ? escapeHtml(previousQuestion.char || '') : '';
    const prevPinyin = previousQuestion ? escapeHtml(previousQuestion.pinyin || '') : '';
    const prevMeaning = previousQuestion ? escapeHtml(previousQuestion.meaning || '') : '';
    const prevResultClass = previousQuestionResult === 'correct' ? 'result-correct' :
                           previousQuestionResult === 'incorrect' ? 'result-incorrect' : '';
    const prevResultIcon = previousQuestionResult === 'correct' ? '✓' :
                           previousQuestionResult === 'incorrect' ? '✗' : '•';
    const prevFeedbackText = previousQuestionResult === 'correct' ? 'Got it right' :
                             previousQuestionResult === 'incorrect' ? 'Missed it' : 'Reviewed';

    const currentChar = escapeHtml(currentQuestion.char || '');
    const currentCharFontSize = getCharLargeFontSize(currentQuestion.char || '');
    const currentMarkingBadge = getMarkingBadgeHtml(currentQuestion.char);

    const upcomingChar = upcomingQuestion ? escapeHtml(upcomingQuestion.char || '') : '';

    const inlineFeedback = threeColumnInlineFeedback;
    const inlineFeedbackMessage = inlineFeedback ? escapeHtml(inlineFeedback.message || '') : '';

    questionDisplay.innerHTML = `
        <div class="three-column-meaning-layout">
            <div class="column-previous column-card ${prevResultClass}">
                <div class="column-label">Previous</div>
                ${previousQuestion ? `
                    <div class="column-feedback">
                        <span class="column-result-icon">${prevResultIcon}</span>
                        <span class="column-feedback-text">${prevFeedbackText}</span>
                    </div>
                    <div class="column-char">${prevChar}</div>
                    <div class="column-pinyin">${prevPinyin}</div>
                    <div class="column-meaning">${prevMeaning}</div>
                ` : `
                    <div class="column-placeholder">Your last answer will appear here</div>
                `}
            </div>
            <div class="column-current column-card ${inlineFeedback ? (inlineFeedback.type === 'incorrect' ? 'has-error' : 'has-success') : ''}" style="position: relative;">
                <div class="column-label">Now</div>
                ${currentMarkingBadge}
                <div class="column-focus-ring">
                    <div class="column-char-large" style="font-size: ${currentCharFontSize};">${currentChar}</div>
                </div>
                ${inlineFeedback ? `
                    <div class="column-inline-feedback ${inlineFeedback.type === 'incorrect' ? 'is-incorrect' : 'is-correct'}">
                        ${inlineFeedbackMessage}
                    </div>
                ` : ''}
            </div>
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                ${upcomingQuestion ? `
                    <div class="column-ondeck">
                        <div class="column-char">${upcomingChar}</div>
                        <div class="ondeck-note">On deck</div>
                    </div>
                ` : `
                    <div class="column-placeholder">Next card is loading</div>
                `}
            </div>
        </div>
    `;
}

function renderThreeColumnPinyinLayout() {
    if (!questionDisplay || !currentQuestion) return;

    // Get upcoming question from preview queue or select one (exclude current)
    if (!upcomingQuestion) {
        const exclusions = currentQuestion?.char ? [currentQuestion.char] : [];
        upcomingQuestion = selectNextQuestion(exclusions);
    }

    const prevChar = previousQuestion ? escapeHtml(previousQuestion.char || '') : '';
    const prevPinyin = previousQuestion ? escapeHtml(previousQuestion.pinyin || '') : '';
    const prevMeaning = previousQuestion ? escapeHtml(previousQuestion.meaning || '') : '';
    const prevResultClass = previousQuestionResult === 'correct' ? 'result-correct' :
                           previousQuestionResult === 'incorrect' ? 'result-incorrect' : '';
    const prevResultIcon = previousQuestionResult === 'correct' ? '✓' :
                           previousQuestionResult === 'incorrect' ? '✗' : '•';
    const prevFeedbackText = previousQuestionResult === 'correct' ? 'Got it right' :
                             previousQuestionResult === 'incorrect' ? 'Missed it' : 'Reviewed';

    const currentChar = escapeHtml(currentQuestion.char || '');
    const currentCharFontSize = getCharLargeFontSize(currentQuestion.char || '');
    const currentMarkingBadge = getMarkingBadgeHtml(currentQuestion.char);

    const upcomingChar = upcomingQuestion ? escapeHtml(upcomingQuestion.char || '') : '';

    const inlineFeedback = threeColumnInlineFeedback;
    const inlineFeedbackMessage = inlineFeedback ? escapeHtml(inlineFeedback.message || '') : '';

    questionDisplay.innerHTML = `
        <div class="three-column-meaning-layout">
            <div class="column-previous column-card ${prevResultClass}">
                <div class="column-label">Previous</div>
                ${previousQuestion ? `
                    <div class="column-feedback">
                        <span class="column-result-icon">${prevResultIcon}</span>
                        <span class="column-feedback-text">${prevFeedbackText}</span>
                    </div>
                    <div class="column-char">${prevChar}</div>
                    <div class="column-pinyin">${prevPinyin}</div>
                    <div class="column-meaning">${prevMeaning}</div>
                ` : `
                    <div class="column-placeholder">Your last answer will appear here</div>
                `}
            </div>
            <div class="column-current column-card ${inlineFeedback ? (inlineFeedback.type === 'incorrect' ? 'has-error' : 'has-success') : ''}" style="position: relative;">
                <div class="column-label">Now</div>
                ${currentMarkingBadge}
                <div class="column-focus-ring">
                    <div class="column-char-large" style="font-size: ${currentCharFontSize};">${currentChar}</div>
                </div>
                ${inlineFeedback ? `
                    <div class="column-inline-feedback ${inlineFeedback.type === 'incorrect' ? 'is-incorrect' : 'is-correct'}">
                        ${inlineFeedbackMessage}
                    </div>
                ` : ''}
            </div>
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                ${upcomingQuestion ? `
                    <div class="column-ondeck">
                        <div class="column-char">${upcomingChar}</div>
                        <div class="ondeck-note">On deck</div>
                    </div>
                ` : `
                    <div class="column-placeholder">Next card is loading</div>
                `}
            </div>
        </div>
    `;
}

// ============================================================
// Display Question (re-render current question without selecting a new one)
// ============================================================

function displayQuestion() {
    if (!currentQuestion) return;

    // Reset per-question state (answered flag, entered syllables, hints, etc.)
    // without selecting a new question.
    resetForNextQuestion('');

    // Mark this question as served in the scheduler
    window.currentQuestion = currentQuestion;
    markSchedulerServed(currentQuestion);

    // Reset dictation state for fresh progress indicators
    resetDictationState();

    // Render based on mode
    if (mode === 'char-to-pinyin') {
        renderThreeColumnPinyinDictationLayout(false);
        if (typeMode) typeMode.style.display = 'block';
        if (answerInput) {
            answerInput.placeholder = 'Type pinyin...';
            setTimeout(() => answerInput.focus(), 50);
        }
    } else if (mode === 'audio-to-pinyin') {
        renderThreeColumnPinyinDictationLayout(true);
        if (typeMode) typeMode.style.display = 'block';
        if (audioSection) audioSection.classList.remove('hidden');
        if (answerInput) {
            answerInput.placeholder = 'Type pinyin...';
            setTimeout(() => answerInput.focus(), 50);
        }
        // Re-setup audio mode for the new question
        setupAudioMode({ focusAnswer: true });
    } else if (mode === 'audio-to-meaning') {
        renderThreeColumnTranslationLayout(true);
        if (typeMode) typeMode.style.display = 'block';
        if (audioSection) audioSection.classList.remove('hidden');
        if (answerInput) {
            answerInput.placeholder = 'Type your translation...';
            setTimeout(() => answerInput.focus(), 50);
        }
        setupAudioMode({ focusAnswer: true });
    } else if (mode === 'dictation-chat') {
        renderDictationChatQuestion({ reset: false });
    } else if (mode === 'text-to-meaning') {
        renderThreeColumnTranslationLayout(false);
        if (typeMode) typeMode.style.display = 'block';
        if (answerInput) {
            answerInput.placeholder = 'Type your translation...';
            setTimeout(() => answerInput.focus(), 50);
        }
    } else {
        // Fallback: for other modes, just call generateQuestion
        generateQuestion();
    }
}

// ============================================================
// Three-Column Translation Layout (audio-to-meaning, text-to-meaning)
// ============================================================

function getTranslationFontSize(text) {
    const len = (text || '').length;
    if (len <= 10) return '36px';
    if (len <= 20) return '28px';
    if (len <= 40) return '22px';
    return '18px';
}

function renderThreeColumnTranslationLayout(isAudioMode = false) {
    if (!questionDisplay || !currentQuestion) return;

    // Get upcoming question
    if (!translationUpcomingQuestion) {
        const exclusions = currentQuestion?.char ? [currentQuestion.char] : [];
        translationUpcomingQuestion = selectNextQuestion(exclusions);
    }

    const prev = translationPreviousQuestion;
    const prevResult = translationPreviousResult;
    const prevChar = prev ? escapeHtml(prev.char || '') : '';
    const prevPinyin = prev ? escapeHtml(prev.pinyin || '') : '';
    const prevMeaning = prev ? escapeHtml(prev.meaning || '') : '';

    // Determine result styling
    let prevResultClass = '';
    let prevResultIcon = '•';
    let prevFeedbackText = 'Reviewed';
    if (prevResult) {
        if (prevResult.grade >= 70) {
            prevResultClass = 'result-correct';
            prevResultIcon = '✓';
            prevFeedbackText = `${prevResult.grade}%`;
        } else {
            prevResultClass = 'result-incorrect';
            prevResultIcon = '✗';
            prevFeedbackText = `${prevResult.grade}%`;
        }
    }

    const currentChar = escapeHtml(currentQuestion.char || '');
    const currentFontSize = getTranslationFontSize(currentQuestion.char);

    const upcomingChar = translationUpcomingQuestion ? escapeHtml(translationUpcomingQuestion.char || '') : '';
    const upcomingFontSize = getTranslationFontSize(translationUpcomingQuestion?.char);

    const inlineFeedback = translationInlineFeedback;

    // Build previous column content - show user's answer with color-coded feedback
    let prevColumnContent = '';
    if (prev && prevResult) {
        const userAnswerHtml = prevResult.colorCodedAnswer || escapeHtml(prevResult.userAnswer || '');
        const isCorrect = prevResult.grade >= 70;

        // Build explanation section if there are errors
        let explanationHtml = '';
        if (!isCorrect && prevResult.explanation) {
            explanationHtml = `
                <div style="font-size: 11px; margin-top: 6px; padding: 4px 6px; background: #fef3c7; border-radius: 4px; color: #92400e; max-width: 200px; line-height: 1.3;">
                    ${escapeHtml(prevResult.explanation)}
                </div>
            `;
        }

        // Build reference (correct answer) section
        let referenceHtml = '';
        const refMeaning = prevResult.reference || prevMeaning;
        if (refMeaning) {
            referenceHtml = `
                <div style="font-size: 11px; margin-top: 4px; padding: 4px 6px; background: #ecfdf5; border-radius: 4px; max-width: 200px;">
                    <div style="color: #047857; font-size: 9px; text-transform: uppercase; margin-bottom: 2px;">Correct:</div>
                    <div style="color: #065f46; line-height: 1.3;">${escapeHtml(refMeaning)}</div>
                </div>
            `;
        }

        prevColumnContent = `
            <div class="column-feedback">
                <span class="column-result-icon">${prevResultIcon}</span>
                <span class="column-feedback-text">${prevFeedbackText}</span>
            </div>
            <div class="column-char" style="font-size: 28px;">${prevChar}</div>
            <div class="column-pinyin" style="font-size: 13px;">${prevPinyin}</div>
            <div class="translation-user-answer" style="font-size: 14px; margin-top: 8px; padding: 6px 8px; background: #f8fafc; border-radius: 4px; max-width: 200px;">
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 2px;">Your answer:</div>
                <div style="color: #334155; line-height: 1.4;">${userAnswerHtml}</div>
            </div>
            ${explanationHtml}
            ${referenceHtml}
        `;
    } else {
        prevColumnContent = '<div class="column-placeholder">Your last answer will appear here</div>';
    }

    // Build current column - show Chinese text or audio icon
    const currentMarkingBadge = getMarkingBadgeHtml(currentQuestion.char);
    let currentContent = '';
    if (isAudioMode) {
        currentContent = `
            <div style="font-size: 64px; margin-bottom: 8px;">🔊</div>
            <div style="font-size: 14px; color: #64748b;">Listen and translate</div>
        `;
    } else {
        currentContent = `<div class="column-char-large" style="font-size: ${currentFontSize}; line-height: 1.3; max-width: 260px; word-wrap: break-word;">${currentChar}</div>`;
    }

    questionDisplay.innerHTML = `
        <div class="three-column-meaning-layout three-column-translation-layout">
            <div class="column-previous column-card ${prevResultClass}">
                <div class="column-label">Previous</div>
                ${prevColumnContent}
            </div>
            <div class="column-current column-card ${inlineFeedback ? (inlineFeedback.type === 'incorrect' ? 'has-error' : 'has-success') : ''}" style="position: relative;">
                <div class="column-label">Now</div>
                ${currentMarkingBadge}
                <div class="column-focus-ring" style="padding: 12px;">
                    ${currentContent}
                </div>
                ${inlineFeedback ? `
                    <div class="column-inline-feedback ${inlineFeedback.type === 'incorrect' ? 'is-incorrect' : 'is-correct'}">
                        ${escapeHtml(inlineFeedback.message || '')}
                    </div>
                ` : ''}
            </div>
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                ${translationUpcomingQuestion ? `
                    <div class="column-ondeck">
                        <div class="column-char" style="font-size: ${upcomingFontSize}; max-width: 180px; word-wrap: break-word; line-height: 1.2;">${upcomingChar}</div>
                        <div class="ondeck-note">On deck</div>
                    </div>
                ` : `
                    <div class="column-placeholder">Next card is loading</div>
                `}
            </div>
        </div>
    `;
}

// ============================================================
// Three-Column Pinyin Dictation Layout (audio-to-pinyin, char-to-pinyin)
// ============================================================

function renderThreeColumnPinyinDictationLayout(isAudioMode = false) {
    if (!questionDisplay || !currentQuestion) return;

    // Get upcoming question
    if (!pinyinDictationUpcomingQuestion) {
        const exclusions = currentQuestion?.char ? [currentQuestion.char] : [];
        pinyinDictationUpcomingQuestion = selectNextQuestion(exclusions);
    }

    const prev = pinyinDictationPreviousQuestion;
    const prevResult = pinyinDictationPreviousResult;
    const prevUserAnswer = pinyinDictationPreviousUserAnswer;
    const prevChar = prev ? escapeHtml(prev.char || '') : '';
    const prevPinyin = prev ? escapeHtml(prev.pinyin || '') : '';

    // Determine result styling
    let prevResultClass = '';
    let prevResultIcon = '•';
    let prevFeedbackText = 'Reviewed';
    if (prevResult) {
        if (prevResult === 'correct') {
            prevResultClass = 'result-correct';
            prevResultIcon = '✓';
            prevFeedbackText = 'Correct';
        } else {
            prevResultClass = 'result-incorrect';
            prevResultIcon = '✗';
            prevFeedbackText = 'Incorrect';
        }
    }

    const currentChar = escapeHtml(currentQuestion.char || '');
    const currentFontSize = getTranslationFontSize(currentQuestion.char);
    const currentMarkingBadge = getMarkingBadgeHtml(currentQuestion.char);

    const upcomingChar = pinyinDictationUpcomingQuestion ? escapeHtml(pinyinDictationUpcomingQuestion.char || '') : '';
    const upcomingFontSize = getTranslationFontSize(pinyinDictationUpcomingQuestion?.char);

    // Build previous column content
    let prevColumnContent = '';
    if (prev && prevResult) {
        const userAnswerDisplay = prevUserAnswer ? escapeHtml(prevUserAnswer) : '';
        const isCorrect = prevResult === 'correct';
        prevColumnContent = `
            <div class="column-feedback">
                <span class="column-result-icon">${prevResultIcon}</span>
                <span class="column-feedback-text">${prevFeedbackText}</span>
            </div>
            <div class="column-char" style="font-size: 28px;">${prevChar}</div>
            <div class="column-pinyin" style="font-size: 15px; color: #1d4ed8;">${prevPinyin}</div>
            ${userAnswerDisplay ? `
                <div style="font-size: 13px; margin-top: 6px; padding: 4px 8px; background: ${isCorrect ? '#dcfce7' : '#fee2e2'}; border-radius: 4px; color: ${isCorrect ? '#166534' : '#991b1b'};">
                    Your answer: ${userAnswerDisplay}
                </div>
            ` : ''}
        `;
    } else {
        prevColumnContent = '<div class="column-placeholder">Your last answer will appear here</div>';
    }

    // Build current column - show Chinese text or audio icon
    let currentContent = '';
    if (isAudioMode) {
        currentContent = `
            <div style="font-size: 64px; margin-bottom: 8px;">🔊</div>
            <div style="font-size: 14px; color: #64748b;">Listen and type pinyin</div>
        `;
    } else {
        currentContent = `<div class="column-char-large" style="font-size: ${currentFontSize}; line-height: 1.3; max-width: 260px; word-wrap: break-word;">${currentChar}</div>`;
    }

    questionDisplay.innerHTML = `
        <div class="three-column-meaning-layout">
            <div class="column-previous column-card ${prevResultClass}">
                <div class="column-label">Previous</div>
                ${prevColumnContent}
            </div>
            <div class="column-current column-card" style="position: relative;">
                <div class="column-label">Now</div>
                ${currentMarkingBadge}
                <div class="column-focus-ring" style="padding: 12px;">
                    ${currentContent}
                </div>
            </div>
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                ${pinyinDictationUpcomingQuestion ? `
                    <div class="column-ondeck">
                        <div class="column-char" style="font-size: ${upcomingFontSize}; max-width: 180px; word-wrap: break-word; line-height: 1.2;">${upcomingChar}</div>
                        <div class="ondeck-note">On deck</div>
                    </div>
                ` : `
                    <div class="column-placeholder">Next card is loading</div>
                `}
            </div>
        </div>
    `;
}

// ============================================================
// Three-Column Chunks Layout (audio-to-meaning-chunks, text-to-meaning-chunks)
// ============================================================

function renderThreeColumnChunksLayout(isAudioMode = false) {
    if (!questionDisplay || !currentQuestion || !currentFullSentence) return;

    const chunkNum = currentChunkIndex + 1;
    const totalChunks = sentenceChunks.length;

    // Compute upcoming chunk if not set
    if (!chunksUpcomingChunk && currentChunkIndex + 1 < sentenceChunks.length) {
        chunksUpcomingChunk = sentenceChunks[currentChunkIndex + 1];
    }

    // Previous column
    const prev = chunksPreviousChunk;
    const prevResult = chunksPreviousResult;
    let prevResultClass = '';
    let prevResultIcon = '•';
    let prevFeedbackText = 'Reviewed';

    if (prevResult) {
        if (prevResult.grade >= 70) {
            prevResultClass = 'result-correct';
            prevResultIcon = '✓';
            prevFeedbackText = `${prevResult.grade}%`;
        } else {
            prevResultClass = 'result-incorrect';
            prevResultIcon = '✗';
            prevFeedbackText = `${prevResult.grade}%`;
        }
    }

    let prevColumnContent = '';
    if (prev && prevResult) {
        const userAnswerHtml = prevResult.colorCodedAnswer || escapeHtml(prevResult.userAnswer || '');
        const isCorrect = prevResult.grade >= 70;

        // Build explanation section if there are errors
        let explanationHtml = '';
        if (!isCorrect && prevResult.explanation) {
            explanationHtml = `
                <div style="font-size: 11px; margin-top: 6px; padding: 4px 6px; background: #fef3c7; border-radius: 4px; color: #92400e; max-width: 180px; line-height: 1.3;">
                    ${escapeHtml(prevResult.explanation)}
                </div>
            `;
        }

        // Build reference (correct answer) section
        let referenceHtml = '';
        if (prevResult.reference) {
            referenceHtml = `
                <div style="font-size: 11px; margin-top: 4px; padding: 4px 6px; background: #ecfdf5; border-radius: 4px; max-width: 180px;">
                    <div style="color: #047857; font-size: 9px; text-transform: uppercase; margin-bottom: 2px;">Correct:</div>
                    <div style="color: #065f46; line-height: 1.3;">${escapeHtml(prevResult.reference)}</div>
                </div>
            `;
        }

        prevColumnContent = `
            <div class="column-feedback">
                <span class="column-result-icon">${prevResultIcon}</span>
                <span class="column-feedback-text">${prevFeedbackText}</span>
            </div>
            <div class="column-char" style="font-size: 22px; max-width: 180px; word-wrap: break-word;">${escapeHtml(prev.char || '')}</div>
            <div class="translation-user-answer" style="font-size: 13px; margin-top: 6px; padding: 4px 8px; background: #f8fafc; border-radius: 4px; max-width: 180px;">
                <div style="color: #64748b; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;">Your answer:</div>
                <div style="color: #334155; line-height: 1.3;">${userAnswerHtml}</div>
            </div>
            ${explanationHtml}
            ${referenceHtml}
        `;
    } else {
        prevColumnContent = '<div class="column-placeholder">Your last answer will appear here</div>';
    }

    // Current column
    const currentChar = escapeHtml(currentQuestion.char || '');
    const currentFontSize = getTranslationFontSize(currentQuestion.char);
    // For chunks, show marking badge for the full sentence character
    const currentMarkingBadge = currentFullSentence ? getMarkingBadgeHtml(currentFullSentence.char) : '';

    let currentContent = '';
    if (isAudioMode) {
        currentContent = `
            <div style="font-size: 48px; margin-bottom: 4px;">🔊</div>
            <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Listen and translate</div>
            <div class="column-char" style="font-size: ${currentFontSize}; max-width: 220px; word-wrap: break-word; line-height: 1.3;">${currentChar}</div>
        `;
    } else {
        currentContent = `<div class="column-char-large" style="font-size: ${currentFontSize}; line-height: 1.3; max-width: 220px; word-wrap: break-word;">${currentChar}</div>`;
    }

    // Upcoming column
    const upcomingChunk = chunksUpcomingChunk;
    const upcomingChar = upcomingChunk ? escapeHtml(upcomingChunk.char || '') : '';
    const upcomingFontSize = getTranslationFontSize(upcomingChunk?.char);

    questionDisplay.innerHTML = `
        <div class="three-column-meaning-layout three-column-chunks-layout">
            <div class="column-previous column-card ${prevResultClass}">
                <div class="column-label">Previous</div>
                ${prevColumnContent}
            </div>
            <div class="column-current column-card" style="position: relative;">
                <div class="column-label">Chunk ${chunkNum}/${totalChunks}</div>
                ${currentMarkingBadge}
                <div class="column-focus-ring" style="padding: 10px;">
                    ${currentContent}
                </div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 6px; max-width: 200px; word-wrap: break-word;">
                    Full: ${escapeHtml(currentFullSentence.char)}
                </div>
            </div>
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                ${upcomingChunk ? `
                    <div class="column-ondeck">
                        <div class="column-char" style="font-size: ${upcomingFontSize}; max-width: 160px; word-wrap: break-word; line-height: 1.2;">${upcomingChar}</div>
                        <div class="ondeck-note">On deck</div>
                    </div>
                ` : `
                    <div class="column-placeholder">${currentChunkIndex + 1 >= totalChunks ? 'Last chunk!' : 'Loading...'}</div>
                `}
            </div>
        </div>
    `;
}

// ============================================================
// Char-to-Tones MC Mode (three-column layout with tone buttons)
// ============================================================

function initCharToTonesMc() {
    if (!currentQuestion) return;

    const pinyin = currentQuestion.pinyin.split('/')[0].trim();
    const syllables = splitPinyinSyllables(pinyin);
    const tones = extractToneSequence(pinyin);
    const chars = currentQuestion.char.split('');

    charToTonesMcIndex = 0;
    charToTonesMcExpected = tones.split('');
    charToTonesMcChars = chars;
    charToTonesMcPinyin = syllables;
    charToTonesMcCompleted = [];
    charToTonesMcInlineFeedback = null;

    // Get upcoming question
    if (!charToTonesMcUpcomingQuestion) {
        const exclusions = currentQuestion?.char ? [currentQuestion.char] : [];
        charToTonesMcUpcomingQuestion = selectNextQuestion(exclusions);
    }

    renderCharToTonesMcLayout();
    generateToneButtons();
}

function renderCharToTonesMcLayout() {
    if (!questionDisplay || !currentQuestion) return;

    const prevChar = charToTonesMcPreviousQuestion ? escapeHtml(charToTonesMcPreviousQuestion.char || '') : '';
    const prevPinyin = charToTonesMcPreviousQuestion ? escapeHtml(charToTonesMcPreviousQuestion.pinyin || '') : '';
    const prevMeaning = charToTonesMcPreviousQuestion ? escapeHtml(charToTonesMcPreviousQuestion.meaning || '') : '';
    const prevResultClass = charToTonesMcPreviousResult === 'correct' ? 'result-correct' :
                           charToTonesMcPreviousResult === 'incorrect' ? 'result-incorrect' : '';
    const prevResultIcon = charToTonesMcPreviousResult === 'correct' ? '✓' :
                           charToTonesMcPreviousResult === 'incorrect' ? '✗' : '•';
    const prevFeedbackText = charToTonesMcPreviousResult === 'correct' ? 'Got it right' :
                             charToTonesMcPreviousResult === 'incorrect' ? 'Missed it' : 'Reviewed';

    // Build current character display with progress indication
    let currentDisplay = '';
    const chars = charToTonesMcChars;
    const completed = charToTonesMcCompleted;
    const pinyin = charToTonesMcPinyin;
    const idx = charToTonesMcIndex;

    for (let i = 0; i < chars.length; i++) {
        if (i < idx) {
            // Completed character - show with tone number
            currentDisplay += `<span class="text-green-600">${escapeHtml(chars[i])}<sub class="text-lg">${completed[i]}</sub></span>`;
        } else if (i === idx) {
            // Current character - just show normally (no underline)
            currentDisplay += `<span class="text-gray-800">${escapeHtml(chars[i])}</span>`;
        } else {
            // Upcoming character - grayed
            currentDisplay += `<span class="text-gray-400">${escapeHtml(chars[i])}</span>`;
        }
    }

    const currentCharFontSize = getCharLargeFontSize(currentQuestion.char || '');

    const upcomingChar = charToTonesMcUpcomingQuestion ? escapeHtml(charToTonesMcUpcomingQuestion.char || '') : '';
    const upcomingPinyin = charToTonesMcUpcomingQuestion ? escapeHtml(charToTonesMcUpcomingQuestion.pinyin || '') : '';

    const inlineFeedback = charToTonesMcInlineFeedback;
    const inlineFeedbackMessage = inlineFeedback ? escapeHtml(inlineFeedback.message || '') : '';

    // Progress display
    const progressText = chars.length > 1 ? `Char ${idx + 1}/${chars.length}` : '';

    questionDisplay.innerHTML = `
        <div class="three-column-meaning-layout">
            <div class="column-previous column-card ${prevResultClass}">
                <div class="column-label">Previous</div>
                ${charToTonesMcPreviousQuestion ? `
                    <div class="column-feedback">
                        <span class="column-result-icon">${prevResultIcon}</span>
                        <span class="column-feedback-text">${prevFeedbackText}</span>
                    </div>
                    <div class="column-char">${prevChar}</div>
                    <div class="column-pinyin">${prevPinyin}</div>
                    <div class="column-meaning">${prevMeaning}</div>
                ` : `
                    <div class="column-placeholder">Your last answer will appear here</div>
                `}
            </div>
            <div class="column-current column-card ${inlineFeedback ? (inlineFeedback.type === 'incorrect' ? 'has-error' : 'has-success') : ''}">
                <div class="column-label">Now</div>
                <div class="column-focus-ring">
                    <div class="column-char-large" style="font-size: ${currentCharFontSize};">${currentDisplay}</div>
                </div>
                ${progressText ? `<div class="text-sm text-gray-500 mt-2">${progressText}</div>` : ''}
                ${inlineFeedback ? `
                    <div class="column-inline-feedback ${inlineFeedback.type === 'incorrect' ? 'is-incorrect' : 'is-correct'}">
                        ${inlineFeedbackMessage}
                    </div>
                ` : ''}
            </div>
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                ${charToTonesMcUpcomingQuestion ? `
                    <div class="column-ondeck">
                        <div class="column-char">${upcomingChar}</div>
                        <div class="column-pinyin text-sm text-gray-400">${upcomingPinyin}</div>
                        <div class="ondeck-note">On deck</div>
                    </div>
                ` : `
                    <div class="column-placeholder">Next card is loading</div>
                `}
            </div>
        </div>
    `;
}

function generateToneButtons() {
    if (!choiceMode) return;

    const optionsDiv = document.getElementById('options');
    if (!optionsDiv) return;

    const toneLabels = [
        { num: '1', name: 'First (ˉ)', desc: 'high level' },
        { num: '2', name: 'Second (ˊ)', desc: 'rising' },
        { num: '3', name: 'Third (ˇ)', desc: 'dipping' },
        { num: '4', name: 'Fourth (ˋ)', desc: 'falling' },
        { num: '5', name: 'Fifth (neutral)', desc: 'light' }
    ];

    optionsDiv.innerHTML = '';
    optionsDiv.className = 'grid grid-cols-5 gap-2';

    toneLabels.forEach(tone => {
        const btn = document.createElement('button');
        btn.className = 'tone-btn px-4 py-6 text-center bg-gray-100 hover:bg-blue-100 border-2 border-gray-300 hover:border-blue-400 rounded-lg transition-all';
        btn.innerHTML = `
            <div class="text-3xl font-bold">${tone.num}</div>
            <div class="text-xs text-gray-500 mt-1">${tone.desc}</div>
        `;
        btn.dataset.tone = tone.num;
        btn.onclick = () => handleToneChoice(tone.num);
        optionsDiv.appendChild(btn);
    });

    choiceMode.style.display = 'block';
}

function handleToneChoice(toneNum) {
    if (answered && lastAnswerCorrect) return; // Already answered correctly

    const expected = charToTonesMcExpected[charToTonesMcIndex];
    const currentChar = charToTonesMcChars[charToTonesMcIndex];
    const currentPinyin = charToTonesMcPinyin[charToTonesMcIndex];

    if (toneNum === expected) {
        // Correct tone for this character
        charToTonesMcCompleted.push(toneNum);
        charToTonesMcIndex++;

        // Play the syllable audio
        playPinyinAudio(currentPinyin, currentChar);

        if (charToTonesMcIndex >= charToTonesMcExpected.length) {
            // All tones completed correctly
            playCorrectSound();
            if (!answered) {
                answered = true;
                total++;
                score++;
            }
            lastAnswerCorrect = true;
            markSchedulerOutcome(true);

            // Update previous question state
            charToTonesMcPreviousQuestion = currentQuestion;
            charToTonesMcPreviousResult = 'correct';

            // Set up next upcoming
            const exclusions = [currentQuestion.char];
            if (charToTonesMcUpcomingQuestion) exclusions.push(charToTonesMcUpcomingQuestion.char);
            const nextUpcoming = selectNextQuestion(exclusions);

            feedback.textContent = `✓ Correct! ${currentQuestion.char} = ${charToTonesMcExpected.join('')}`;
            feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
            hint.textContent = `${currentQuestion.pinyin} - ${currentQuestion.meaning}`;
            hint.className = 'text-center text-lg my-2 text-gray-600';

            updateStats();

            // Move to next question instantly
            charToTonesMcUpcomingQuestion = nextUpcoming;
            generateQuestion();
        } else {
            // More characters to go - update display
            renderCharToTonesMcLayout();
            highlightCurrentToneButton();
        }
    } else {
        // Wrong tone - let user retry
        playWrongSound();

        // Briefly highlight correct button, then reset for retry
        const buttons = document.querySelectorAll('#options .tone-btn');
        buttons.forEach(btn => {
            if (btn.dataset.tone === expected) {
                btn.classList.remove('bg-gray-100', 'border-gray-300');
                btn.classList.add('bg-green-100', 'border-green-500');
            } else if (btn.dataset.tone === toneNum) {
                btn.classList.remove('bg-gray-100', 'border-gray-300');
                btn.classList.add('bg-red-100', 'border-red-500');
            }
        });

        feedback.textContent = `✗ Try again! That was tone ${toneNum}`;
        feedback.className = 'text-center text-xl font-semibold my-2 text-red-600';

        // Reset buttons after brief flash
        setTimeout(() => {
            highlightCurrentToneButton();
            feedback.textContent = '';
        }, 300);
    }
}

function highlightCurrentToneButton() {
    // Reset all buttons to default state
    const buttons = document.querySelectorAll('#options .tone-btn');
    buttons.forEach(btn => {
        btn.classList.remove('bg-blue-100', 'border-blue-400', 'opacity-50', 'bg-green-100', 'border-green-500');
        btn.classList.add('bg-gray-100', 'border-gray-300');
    });
}

function updateMeaningChoicesVisibility() {
    if (typeof document === 'undefined') return;
    const noticeId = 'meaningChoicesNotice';
    const existingNotice = document.getElementById(noticeId);

    if (mode !== 'char-to-meaning') {
        if (existingNotice) existingNotice.remove();
        return;
    }

    if (!choiceMode) return;

    if (hideMeaningChoices) {
        choiceMode.style.display = 'none';

        let notice = existingNotice;
        if (!notice) {
            notice = document.createElement('div');
            notice.id = noticeId;
            notice.className = 'mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-between gap-3';
            notice.innerHTML = `
                <div class="text-sm text-amber-900">Multiple-choice answers are hidden.</div>
                <div class="flex items-center gap-2">
                    <button id="meaningRevealBtn" type="button" class="px-3 py-1 text-sm font-semibold text-amber-800 bg-white/80 border border-amber-200 rounded-lg hover:bg-white">
                        Show choices
                    </button>
                </div>
            `;
            choiceMode.parentNode.insertBefore(notice, choiceMode.nextSibling);
        }

        const btn = document.getElementById('meaningRevealBtn');
        if (btn && !btn.dataset.bound) {
            btn.dataset.bound = 'true';
            btn.addEventListener('click', () => setHideMeaningChoices(false));
        }
    } else {
        choiceMode.style.display = 'block';
        if (existingNotice) existingNotice.remove();
    }
}

function resetMeaningAnswerSummary() {
    const card = document.getElementById('answerSummaryCard');
    if (!card) return;
    card.classList.remove('visible', 'summary-correct', 'summary-incorrect');

    const charEl = document.getElementById('answerSummaryChar');
    const pinyinEl = document.getElementById('answerSummaryPinyin');
    const meaningEl = document.getElementById('answerSummaryMeaning');

    if (charEl) charEl.textContent = '';
    if (pinyinEl) pinyinEl.textContent = '';
    if (meaningEl) meaningEl.textContent = '';
}

function applyComponentPanelVisibility() {
    const layout = document.querySelector('.meaning-question-layout');
    if (!layout) return;
    const shouldHide = !showComponentBreakdown || !componentPanelsHaveContent;
    layout.classList.toggle('components-hidden', shouldHide);
}

function applyComponentColoring() {
    const charEl = document.querySelector('.meaning-question-layout .question-char-display');
    if (!charEl) return;
    charEl.style.removeProperty('background-image');
    charEl.style.removeProperty('-webkit-background-clip');
    charEl.style.removeProperty('background-clip');
    charEl.style.color = '#111827';
}

function goToNextQuestionAfterCorrect() {
    if (!lastAnswerCorrect) return;
    clearPendingNextQuestion();
    lastAnswerCorrect = false;
    // Capture from whichever input field is active
    if ((mode === 'char-to-meaning-type' || mode === 'char-to-pinyin-type') && fuzzyInput) {
        nextAnswerBuffer = fuzzyInput.value;
    } else if (answerInput) {
        nextAnswerBuffer = answerInput.value;
    }
    generateQuestion({ prefillAnswer: nextAnswerBuffer });
    nextAnswerBuffer = '';
}

function clearPendingNextQuestion() {
    if (pendingNextQuestionTimeout) {
        clearTimeout(pendingNextQuestionTimeout);
        pendingNextQuestionTimeout = null;
    }
}

function scheduleNextQuestion(delay) {
    clearPendingNextQuestion();
    pendingNextQuestionTimeout = setTimeout(() => {
        pendingNextQuestionTimeout = null;
        let buffered = '';
        if (typeof nextAnswerBuffer === 'string' && nextAnswerBuffer !== '') {
            buffered = nextAnswerBuffer;
        } else if ((mode === 'char-to-meaning-type' || mode === 'char-to-pinyin-type') && fuzzyInput) {
            buffered = fuzzyInput.value;
        } else if (answerInput) {
            buffered = answerInput.value;
        }
        generateQuestion({ prefillAnswer: buffered });
        nextAnswerBuffer = '';
    }, delay);
}

// =============================================================================
// SPECIAL MODES (Stroke Order, Handwriting, Draw, Study)
// =============================================================================

async function initStrokeOrder() {
    const writerDiv = document.getElementById('strokeOrderWriter');
    if (!writerDiv) return;

    // Make touch input reliable on mobile (prevent scroll/selection from eating strokes)
    writerDiv.style.touchAction = 'none';
    writerDiv.style.userSelect = 'none';
    writerDiv.style.webkitUserSelect = 'none';
    writerDiv.style.msUserSelect = 'none';
    writerDiv.style.webkitTapHighlightColor = 'transparent';
    writerDiv.setAttribute('aria-label', 'Stroke order tracing area');

    writerDiv.innerHTML = '';

    const rawText = (currentQuestion.char || '').trim();
    if (!rawText) return;

    const characters = Array.from(rawText).filter(ch => /\S/.test(ch));
    if (!characters.length) return;

    let statusEl = document.getElementById('strokeOrderStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'strokeOrderStatus';
        strokeOrderMode.appendChild(statusEl);
    }
    statusEl.className = 'text-center text-xl font-semibold my-4 text-blue-600';
    statusEl.textContent = 'Loading strokes…';

    const showError = (msg) => {
        statusEl.textContent = msg;
        statusEl.className = 'text-center text-xl font-semibold my-4 text-red-600';
        feedback.textContent = msg;
        feedback.className = 'text-center text-lg font-semibold my-4 text-red-600';
    };

    try {
        await ensureHanziWriterLoaded();
    } catch (err) {
        console.warn(err);
        showError('Could not load the stroke-order engine. Check your connection and retry.');
        return;
    }

    feedback.textContent = characters.length > 1
        ? 'Draw the strokes for each character in order.'
        : 'Draw the strokes in order. Strokes will fill as you trace them correctly.';
    feedback.className = 'text-center text-2xl font-semibold my-4 text-blue-600';
    hint.textContent = '';
    hint.className = 'text-center text-2xl font-semibold my-4';

    let currentIndex = 0;

    const initializeCharacter = () => {
        const targetChar = characters[currentIndex];
        if (!targetChar) return;

        writerDiv.innerHTML = '';

        try {
            // Clean up any previous writer instance so pointer listeners don't stack
            if (writer && typeof writer.cancelQuiz === 'function') {
                writer.cancelQuiz();
            }

            writer = HanziWriter.create(writerDiv, targetChar, {
                width: 320,
                height: 320,
                padding: 8,
                showOutline: true,
                showCharacter: false,
                strokeAnimationSpeed: 1,
                delayBetweenStrokes: 0,
                renderer: 'canvas' // canvas is more reliable for touch/pointer tracing across browsers
            });
            // Expose for debugging/automation (e.g., Playwright checks)
            try { window.writer = writer; } catch (_) {}

            // Ensure the drawing surface itself ignores scrolling/selection quirks on touch devices
            const surface = writerDiv.querySelector('canvas, svg');
            if (surface) {
                surface.style.touchAction = 'none';
                surface.style.userSelect = 'none';
                surface.style.webkitUserSelect = 'none';
                surface.style.msUserSelect = 'none';
                surface.style.webkitTapHighlightColor = 'transparent';
            }
        } catch (error) {
            console.warn('Failed to initialize stroke order quiz for character:', targetChar, error);
            if (currentIndex < characters.length - 1) {
                currentIndex++;
                initializeCharacter();
                return;
            }
            showError('Could not start stroke-order quiz. Try another word or refresh.');
            scheduleNextQuestion(0);
            return;
        }

        statusEl.textContent = characters.length > 1
            ? `Trace each stroke (${currentIndex + 1}/${characters.length})`
            : 'Trace each stroke in order';
        statusEl.className = 'text-center text-xl font-semibold my-4 text-blue-600';

        let completed = false;

        // Slightly more lenient + allow backwards strokes to reduce false negatives
        const startQuiz = async () => {
            try {
                await writer.quiz({
                    leniency: 1.2,
                    showHintAfterMisses: 2,
                    acceptBackwardsStrokes: true,
                    onMistake: () => {
                        if (statusEl) {
                            statusEl.textContent = `✗ Wrong stroke. Try again. (${currentIndex + 1}/${characters.length})`;
                            statusEl.className = 'text-center text-xl font-semibold my-4 text-red-600';
                        }
                    },
                    onCorrectStroke: (strokeData) => {
                        if (!statusEl) return;
                        const currentStroke = strokeData.strokeNum + 1;
                        const totalStrokes = strokeData.strokesRemaining + currentStroke;
                        statusEl.textContent = `✓ Stroke ${currentStroke}/${totalStrokes} (${currentIndex + 1}/${characters.length})`;
                        statusEl.className = 'text-center text-xl font-semibold my-4 text-green-600';
                    },
                    onComplete: () => {
                        if (completed) return;
                        completed = true;

                        if (currentIndex < characters.length - 1) {
                            currentIndex++;
                            statusEl.textContent = `✓ Character complete! (${currentIndex}/${characters.length})`;
                            statusEl.className = 'text-center text-xl font-semibold my-4 text-green-600';
                            setTimeout(() => initializeCharacter(), 400);
                            return;
                        }

                        playCorrectSound();
                        lastAnswerCorrect = true;
                        if (!answered) {
                            answered = true;
                            total++;
                            score++;
                        }

                        statusEl.textContent = '✓ All characters complete!';
                        statusEl.className = 'text-center text-xl font-semibold my-4 text-green-600';

                        feedback.textContent = `Great job! ${currentQuestion.char} (${currentQuestion.pinyin})`;
                        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
                        hint.textContent = `Meaning: ${currentQuestion.meaning}`;
                        hint.className = 'text-center text-2xl font-semibold my-4 text-green-600';

                        updateStats();
                        scheduleNextQuestion(1500);
                    }
                });
            } catch (quizErr) {
                console.warn('Stroke-order quiz failed to start', quizErr);
                showError('Could not start stroke-order quiz. Try another word or refresh.');
            }
        };

        startQuiz();

        return; // end initializeCharacter

    };

    initializeCharacter();
}

function initHandwriting() {
    const writerDiv = document.getElementById('handwritingWriter');
    if (!writerDiv || typeof HanziWriter === 'undefined') return;

    writerDiv.innerHTML = '';
    handwritingAnswerShown = false; // Reset answer shown state for new question
    updateHandwritingSpaceHint(false); // Reset hint UI

    // Create HanziWriter instances for all characters (skip placeholders like … or _)
    const chars = stripPlaceholderChars(currentQuestion.char).split('');
    if (!chars.length) return;
    const writers = [];

    // Calculate available width dynamically to ensure characters fit on screen
    // Get the container's available width, accounting for padding and margins
    const container = writerDiv.parentElement;
    const containerRect = container ? container.getBoundingClientRect() : null;
    
    // Use the smaller of: container width or viewport width (with safety margin)
    // Account for sidebar (if present), padding, and margins
    const viewportWidth = window.innerWidth;
    const containerWidth = containerRect ? containerRect.width : viewportWidth;
    const availableWidth = Math.min(containerWidth - 40, viewportWidth - 300); // Reserve 300px for sidebar/padding
    
    // Calculate character size to fit all characters on screen
    // Using flexbox with gap (10px between items, set in CSS)
    const gapPerChar = 10; // Gap between characters (from CSS)
    const numChars = chars.length;
    
    // Calculate max character width that fits
    // Total width needed = (charWidth * numChars) + (gapPerChar * (numChars - 1))
    // availableWidth >= (charWidth * numChars) + (gapPerChar * (numChars - 1))
    // charWidth <= (availableWidth - gapPerChar * (numChars - 1)) / numChars
    const totalGapWidth = gapPerChar * (numChars - 1);
    const maxCharWidth = Math.floor((availableWidth - totalGapWidth) / numChars);
    
    // Set reasonable min/max bounds for readability
    const minSize = 120; // Minimum size for readability
    const maxSize = numChars === 1 ? 400 : (numChars === 2 ? 300 : 250); // Larger for fewer chars
    const charWidth = Math.max(minSize, Math.min(maxSize, maxCharWidth));
    const charHeight = charWidth; // Keep square aspect ratio

    chars.forEach(char => {
        const charDiv = document.createElement('div');
        // No need for margin since we're using flexbox gap
        writerDiv.appendChild(charDiv);

        const charWriter = HanziWriter.create(charDiv, char, {
            width: charWidth,
            height: charHeight,
            padding: 5,
            showOutline: false,
            showCharacter: false,
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 50
        });

        writers.push(charWriter);
    });

    const hwShowBtn = document.getElementById('hwShowBtn');
    const hwNextBtn = document.getElementById('hwNextBtn');

    // Split pinyin into individual syllables for each character
    // Handle formats like "shàngkè", "shàng kè", "shàng.kè", etc.
    const fullPinyin = prettifyHandwritingPinyin(currentQuestion.pinyin);
    const pinyinSyllables = typeof splitPinyinSyllables === 'function' 
        ? splitPinyinSyllables(fullPinyin)
        : fullPinyin.split(/[.\s]+/).filter(p => p);
    
    // Ensure we have the right number of pinyin syllables (pad or truncate if needed)
    const charPinyins = [];
    for (let i = 0; i < chars.length; i++) {
        if (i < pinyinSyllables.length) {
            charPinyins.push(pinyinSyllables[i]);
        } else {
            // If we run out of pinyin syllables, use the last one or the full pinyin
            charPinyins.push(pinyinSyllables[pinyinSyllables.length - 1] || fullPinyin);
        }
    }

    const showAnswer = () => {
        // Show and animate all characters
        writers.forEach((w) => {
            w.showCharacter();
            w.showOutline();
            w.animateCharacter();
        });

        // Play audio for the full word
        const cleanChars = chars.join('');
        if (typeof playPinyinAudio === 'function') {
            playPinyinAudio(fullPinyin, cleanChars);
        }

        const displayPinyin = fullPinyin;
        feedback.textContent = `${cleanChars} (${displayPinyin}) - ${currentQuestion.meaning}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-blue-600';
        handwritingAnswerShown = true;
        updateHandwritingSpaceHint(false);
    };

    if (hwShowBtn) {
        hwShowBtn.onclick = showAnswer;
    }

    if (hwNextBtn) {
        hwNextBtn.onclick = () => {
            generateQuestion();
        };
    }

    // Store showAnswer function for space key handler
    window.handwritingShowAnswer = showAnswer;
}

function initCanvas() {
    canvas = document.getElementById('drawCanvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';

    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseout', handleCanvasMouseUp);
    canvas.addEventListener('wheel', handleCanvasWheel);

    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);

    strokes = [];
    currentStroke = null;
    drawStartTime = null;
    canvasScale = 1;
    canvasOffsetX = 0;
    canvasOffsetY = 0;

    const clearBtn = document.getElementById('clearCanvasBtn');
    const submitBtn = document.getElementById('submitDrawBtn');
    const showAnswerBtn = document.getElementById('showDrawAnswerBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetBtn = document.getElementById('resetViewBtn');
    const fullscreenBtn = document.getElementById('fullscreenDrawBtn');

    if (clearBtn) clearBtn.onclick = clearCanvas;
    if (submitBtn) submitBtn.onclick = submitDrawing;
    if (showAnswerBtn) showAnswerBtn.onclick = revealDrawingAnswer;
    if (undoBtn) undoBtn.onclick = undoStroke;
    if (redoBtn) redoBtn.onclick = redoStroke;
    if (zoomInBtn) zoomInBtn.onclick = zoomIn;
    if (zoomOutBtn) zoomOutBtn.onclick = zoomOut;
    if (resetBtn) resetBtn.onclick = resetView;
    if (fullscreenBtn) fullscreenBtn.onclick = enterFullscreenDrawing;

    updateOcrCandidates();
    updateUndoRedoButtons();
}

function getCanvasScaleFactors() {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { rect, scaleX, scaleY };
}

function getCanvasCoords(e) {
    const { rect, scaleX, scaleY } = getCanvasScaleFactors();
    let clientX, clientY;

    if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const rawX = (clientX - rect.left) * scaleX;
    const rawY = (clientY - rect.top) * scaleY;

    // Transform coordinates based on zoom and pan
    const x = (rawX - canvasOffsetX) / canvasScale;
    const y = (rawY - canvasOffsetY) / canvasScale;

    return { x, y };
}

function getRelativeTimestamp() {
    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();

    if (drawStartTime === null) {
        drawStartTime = now;
    }

    return Math.round(now - drawStartTime);
}

function startDrawing(e) {
    isDrawing = true;
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;
    const initialTimestamp = getRelativeTimestamp();
    currentStroke = {
        x: [Math.round(coords.x)],
        y: [Math.round(coords.y)],
        t: [initialTimestamp]
    };
}

function draw(e) {
    if (isPanning) return;
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCanvasCoords(e);

    // Apply transformation for drawing
    ctx.save();
    ctx.translate(canvasOffsetX, canvasOffsetY);
    ctx.scale(canvasScale, canvasScale);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    ctx.restore();

    if (currentStroke) {
        currentStroke.x.push(Math.round(coords.x));
        currentStroke.y.push(Math.round(coords.y));
        currentStroke.t.push(getRelativeTimestamp());
    }
    lastX = coords.x;
    lastY = coords.y;
}

function stopDrawing() {
    if (isDrawing && currentStroke && currentStroke.x.length > 0) {
        strokes.push(currentStroke);
        undoneStrokes = []; // Clear redo history when new stroke is added
        currentStroke = null;
        updateUndoRedoButtons();

        if (ocrTimeout) clearTimeout(ocrTimeout);
        ocrTimeout = setTimeout(runOCR, 400);
    }
    isDrawing = false;
}

function handleCanvasMouseDown(e) {
    if (e.button === 1 || e.shiftKey) {
        // Middle mouse or Shift + left mouse = pan
        e.preventDefault();
        isPanning = true;
        const { rect, scaleX, scaleY } = getCanvasScaleFactors();
        const pointerX = (e.clientX - rect.left) * scaleX;
        const pointerY = (e.clientY - rect.top) * scaleY;
        panStartX = pointerX - canvasOffsetX;
        panStartY = pointerY - canvasOffsetY;
        canvas.style.cursor = 'grabbing';
    } else if (e.button === 0) {
        // Left mouse = draw
        startDrawing(e);
    }
}

function handleCanvasMouseMove(e) {
    if (isPanning) {
        e.preventDefault();
        const { rect, scaleX, scaleY } = getCanvasScaleFactors();
        const pointerX = (e.clientX - rect.left) * scaleX;
        const pointerY = (e.clientY - rect.top) * scaleY;
        canvasOffsetX = pointerX - panStartX;
        canvasOffsetY = pointerY - panStartY;
        redrawCanvas();
    } else {
        draw(e);
    }
}

function handleCanvasMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'crosshair';
    }
    stopDrawing();
}

function handleCanvasWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(3, canvasScale * delta));

    // Zoom toward mouse position
    const { rect, scaleX, scaleY } = getCanvasScaleFactors();
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const scaleChange = newScale / canvasScale;
    canvasOffsetX = mouseX - (mouseX - canvasOffsetX) * scaleChange;
    canvasOffsetY = mouseY - (mouseY - canvasOffsetY) * scaleChange;

    canvasScale = newScale;
    redrawCanvas();
}

function handleTouchStart(e) {
    e.preventDefault();
    startDrawing(e);
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    draw(e);
}

async function runOCR() {
    if (strokes.length === 0) {
        updateOcrCandidates();
        return;
    }

    try {
        const ink = strokes.map(stroke => {
            const x = stroke.x || [];
            const y = stroke.y || [];
            const t = stroke.t && stroke.t.length
                ? stroke.t
                : x.map(() => 0);
            return [x, y, t];
        });

        const data = {
            options: 'enable_pre_space',
            requests: [{
                writing_guide: {
                    writing_area_width: canvas.width,
                    writing_area_height: canvas.height
                },
                ink,
                language: 'zh-Hans'
            }]
        };

        const response = await fetch('https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        const candidates = Array.isArray(result?.[1]?.[0]?.[1])
            ? result[1][0][1]
            : [];

        updateOcrCandidates(candidates);

        if (candidates.length > 0) {
            const recognizedChar = candidates[0];
            const ocrResult = document.getElementById('ocrResult');
            if (ocrResult) {
                ocrResult.textContent = recognizedChar;
            }
        } else {
            const ocrResult = document.getElementById('ocrResult');
            if (ocrResult) {
                ocrResult.textContent = '';
            }
        }
    } catch (error) {
        console.error('OCR error:', error);
        updateOcrCandidates();
    }
}

function clearCanvas() {
    if (!ctx || !canvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
    undoneStrokes = [];
    currentStroke = null;
    drawStartTime = null;
    if (ocrTimeout) {
        clearTimeout(ocrTimeout);
        ocrTimeout = null;
    }
    updateOcrCandidates();
    updateUndoRedoButtons();
    const ocrResult = document.getElementById('ocrResult');
    if (ocrResult) {
        ocrResult.textContent = '';
    }
}

function zoomIn() {
    canvasScale = Math.min(canvasScale * 1.2, 3);
    redrawCanvas();
}

function zoomOut() {
    canvasScale = Math.max(canvasScale / 1.2, 0.5);
    redrawCanvas();
}

function resetView() {
    canvasScale = 1;
    canvasOffsetX = 0;
    canvasOffsetY = 0;
    redrawCanvas();
}

function undoStroke() {
    if (strokes.length === 0) return;

    const lastStroke = strokes.pop();
    undoneStrokes.push(lastStroke);

    redrawCanvas();
    updateUndoRedoButtons();

    if (ocrTimeout) clearTimeout(ocrTimeout);
    ocrTimeout = setTimeout(runOCR, 400);
}

function redoStroke() {
    if (undoneStrokes.length === 0) return;

    const stroke = undoneStrokes.pop();
    strokes.push(stroke);

    redrawCanvas();
    updateUndoRedoButtons();

    if (ocrTimeout) clearTimeout(ocrTimeout);
    ocrTimeout = setTimeout(runOCR, 400);
}

function redrawCanvas() {
    if (!ctx || !canvas) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan transformations
    ctx.translate(canvasOffsetX, canvasOffsetY);
    ctx.scale(canvasScale, canvasScale);

    strokes.forEach(stroke => {
        if (stroke.x.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(stroke.x[0], stroke.y[0]);

        for (let i = 1; i < stroke.x.length; i++) {
            ctx.lineTo(stroke.x[i], stroke.y[i]);
        }
        ctx.stroke();
    });

    // Reset transform for next operations
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const disabledClass = 'px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed transition';
    const activeClass = 'px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold shadow-sm hover:border-blue-400 hover:text-blue-600 transition';

    if (undoBtn) {
        undoBtn.disabled = strokes.length === 0;
        undoBtn.className = strokes.length === 0 ? disabledClass : activeClass;
    }

    if (redoBtn) {
        redoBtn.disabled = undoneStrokes.length === 0;
        redoBtn.className = undoneStrokes.length === 0 ? disabledClass : activeClass;
    }
}

function updateOcrCandidates(candidates = []) {
    const container = document.getElementById('ocrCandidates');
    if (!container) return;

    container.innerHTML = '';

    if (!Array.isArray(candidates) || candidates.length === 0) {
        return;
    }

    candidates.slice(0, 5).forEach(candidate => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = candidate;
        button.className = 'px-3 py-1.5 text-lg rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:border-blue-400 hover:text-blue-600 transition';
        button.onclick = () => {
            const ocrResult = document.getElementById('ocrResult');
            if (ocrResult) {
                ocrResult.textContent = candidate;
            }
        };
        container.appendChild(button);
    });
}

function submitDrawing() {
    const ocrResult = document.getElementById('ocrResult');
    if (!ocrResult) return;

    const recognized = ocrResult.textContent.trim();
    if (!recognized) {
        feedback.textContent = '✗ Please draw a character first!';
        feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
        return;
    }

    // Play submit sound
    playSubmitSound();

    const expectedChar = (mode === 'draw-missing-component' && currentMissingComponent)
        ? currentMissingComponent.char
        : currentQuestion.char;

    const normalizedRecognized = normalizeDrawAnswer(recognized);
    const normalizedTarget = normalizeDrawAnswer(expectedChar);
    const correct = normalizedRecognized === normalizedTarget;
    const isFirstAttempt = !answered;

    if (isFirstAttempt) {
        answered = true;
        total++;
        if (correct) {
            score++;
        }
        markSchedulerOutcome(correct);
    }

    if (correct) {
        playCorrectSound();
        const tryAgainText = isFirstAttempt ? '' : ' (practice attempt)';
        const meaningSuffix = currentQuestion.meaning ? ` – ${currentQuestion.meaning}` : '';
        const label = mode === 'draw-missing-component'
            ? `Missing: ${expectedChar}`
            : `${currentQuestion.char}`;
        feedback.textContent = `✓ Correct! ${label} (${currentQuestion.pinyin})${meaningSuffix}${tryAgainText}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';

        if (mode === 'draw-missing-component') {
            // Record previous question for left column
            componentPreviousQuestion = {
                question: currentQuestion,
                decomposition: currentDecomposition
            };
            componentPreviousResult = 'correct';
            componentInlineFeedback = null;

            // Advance to next component question
            if (componentUpcomingQuestion) {
                currentQuestion = componentUpcomingQuestion.question;
                window.currentQuestion = currentQuestion;
                currentDecomposition = componentUpcomingQuestion.decomposition;
                currentMissingComponent = componentUpcomingQuestion.decomposition.missingComponent;
                componentUpcomingQuestion = null;
            } else {
                const prepared = prepareComponentQuestion();
                if (prepared) {
                    currentQuestion = prepared.question;
                    window.currentQuestion = currentQuestion;
                    currentDecomposition = prepared.decomposition;
                    currentMissingComponent = prepared.decomposition.missingComponent;
                }
            }

            markSchedulerServed(currentQuestion);
            updateCurrentWordConfidence();
            renderThreeColumnComponentLayout();
            updateOcrCandidates([currentMissingComponent.char, currentQuestion.char]);
            clearCanvas();
            answered = false;
            questionAttemptRecorded = false;
            lastAnswerCorrect = true;
            showDrawNextButton();
            updateStats();
            return;
        }
    } else {
        playWrongSound();
        const tryAgainText = isFirstAttempt ? ' - Keep practicing!' : ' - Try again!';
        const label = mode === 'draw-missing-component'
            ? `Missing: ${expectedChar}`
            : `${currentQuestion.char}`;
        feedback.textContent = `✗ Wrong! You wrote: ${recognized}, Correct: ${label} (${currentQuestion.pinyin})${tryAgainText}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';

        if (mode === 'draw-missing-component') {
            componentInlineFeedback = {
                message: `✗ Correct: ${expectedChar}`,
                type: 'incorrect'
            };
            renderThreeColumnComponentLayout();
        }
    }

    updateStats();

    // Show the next button after first attempt
    if (isFirstAttempt) {
        showDrawNextButton();
    }
}

function normalizeDrawAnswer(text = '') {
    // Remove spaces and placeholder symbols used to indicate gaps
    return stripPlaceholderChars(text).replace(/\s+/g, '').trim();
}

function stripPlaceholderChars(text = '') {
    return text.replace(/[\.·•…⋯﹒＿_—-]/g, '');
}

function prettifyHandwritingPinyin(pinyin = '') {
    // Remove placeholder dots/ellipsis and collapse whitespace for display
    return pinyin.replace(/[\.·•…⋯﹒＿_—-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function revealDrawingAnswer() {
    if (!currentQuestion) return;

    const expectedChar = (mode === 'draw-missing-component' && currentMissingComponent)
        ? currentMissingComponent.char
        : currentQuestion.char;

    const ocrResult = document.getElementById('ocrResult');
    if (ocrResult) {
        ocrResult.textContent = expectedChar;
        ocrResult.style.fontFamily = "'Noto Sans SC', sans-serif";
        ocrResult.style.fontWeight = '700';
        if (expectedChar.length > 1) {
            ocrResult.className = 'text-5xl min-h-[80px] text-blue-600 font-bold';
        } else {
            ocrResult.className = 'text-6xl min-h-[80px] text-blue-600 font-bold';
        }
    }

    // Show individual characters as candidates for multi-character words
    if (expectedChar.length > 1) {
        const individualChars = expectedChar.split('');
        updateOcrCandidates([expectedChar, ...individualChars]);
    } else {
        updateOcrCandidates([expectedChar]);
    }

    const isFirstReveal = !answered;

    if (isFirstReveal) {
        answered = true;
        total++;

        markSchedulerOutcome(false);
    }

    const meaningSuffix = currentQuestion.meaning ? ` – ${currentQuestion.meaning}` : '';
    const revealText = isFirstReveal ? 'ⓘ Answer: ' : 'ⓘ Answer (shown again): ';
    feedback.textContent = `${revealText}${expectedChar} (${currentQuestion.pinyin})${meaningSuffix}`;
    feedback.className = 'text-center text-2xl font-semibold my-4 text-blue-600';

    updateStats();

    // Show the next button after first reveal
    if (isFirstReveal) {
        showDrawNextButton();
    }
}

function showDrawNextButton() {
    const nextBtn = document.getElementById('drawNextBtn');
    if (!nextBtn) return;
    if (!nextBtn.dataset.bound) {
        nextBtn.dataset.bound = 'true';
        nextBtn.addEventListener('click', () => {
            clearCanvas();
            generateQuestion();
            nextBtn.classList.add('hidden');
        });
    }
    nextBtn.classList.remove('hidden');
}

function hideDrawNextButton() {
    const nextBtn = document.getElementById('drawNextBtn');
    if (nextBtn) {
        nextBtn.classList.add('hidden');
    }
}

// Fullscreen drawing mode
let fullscreenCanvas, fullscreenCtx;
let isFullscreenMode = false;
let isFullscreenLearnMode = false;
let learnModeBlinkInterval = null;

function enterFullscreenDrawing() {
    const container = document.getElementById('fullscreenDrawContainer');
    if (!container) return;

    isFullscreenMode = true;
    container.classList.remove('hidden');

    // Update prompt
    const prompt = document.getElementById('fullscreenPrompt');
    if (prompt && currentQuestion) {
        prompt.textContent = `Draw: ${currentQuestion.pinyin}`;
    }

    // Update confidence display
    updateFullscreenConfidence();

    // Initialize fullscreen canvas
    fullscreenCanvas = document.getElementById('fullscreenDrawCanvas');
    if (!fullscreenCanvas) return;

    // Get context first so resizeFullscreenCanvas can apply dpr scaling
    fullscreenCtx = fullscreenCanvas.getContext('2d');

    // Full-page canvas - fills entire viewport
    const resizeFullscreenCanvas = () => {
        const dpr = window.devicePixelRatio || 1;
        fullscreenCanvas.width = window.innerWidth * dpr;
        fullscreenCanvas.height = window.innerHeight * dpr;
        fullscreenCanvas.style.width = window.innerWidth + 'px';
        fullscreenCanvas.style.height = window.innerHeight + 'px';
        if (fullscreenCtx) {
            fullscreenCtx.scale(dpr, dpr);
            fullscreenCtx.lineWidth = 6;
            fullscreenCtx.lineCap = 'round';
            fullscreenCtx.lineJoin = 'round';
            fullscreenCtx.strokeStyle = '#000';
            redrawFullscreenCanvas();
        }
    };
    resizeFullscreenCanvas();
    window.addEventListener('resize', resizeFullscreenCanvas);

    // Add event listeners
    fullscreenCanvas.addEventListener('mousedown', startFullscreenDrawing);
    fullscreenCanvas.addEventListener('mousemove', drawFullscreen);
    fullscreenCanvas.addEventListener('mouseup', stopFullscreenDrawing);
    fullscreenCanvas.addEventListener('mouseout', stopFullscreenDrawing);

    fullscreenCanvas.addEventListener('touchstart', handleFullscreenTouchStart);
    fullscreenCanvas.addEventListener('touchmove', handleFullscreenTouchMove);
    fullscreenCanvas.addEventListener('touchend', stopFullscreenDrawing);

    // Setup buttons
    const undoBtn = document.getElementById('fullscreenUndoBtn');
    const redoBtn = document.getElementById('fullscreenRedoBtn');
    const clearBtn = document.getElementById('fullscreenClearBtn');
    const submitBtn = document.getElementById('fullscreenSubmitBtn');
    const showAnswerBtn = document.getElementById('fullscreenShowAnswerBtn');
    const nextBtn = document.getElementById('fullscreenNextBtn');
    const nextSetBtn = document.getElementById('fullscreenNextSetBtn');
    const exitBtn = document.getElementById('exitFullscreenBtn');

    if (undoBtn) undoBtn.onclick = undoFullscreenStroke;
    if (redoBtn) redoBtn.onclick = redoFullscreenStroke;
    if (clearBtn) clearBtn.onclick = clearFullscreenCanvas;
    if (submitBtn) submitBtn.onclick = submitFullscreenDrawing;
    if (showAnswerBtn) showAnswerBtn.onclick = showFullscreenAnswer;
    if (nextBtn) nextBtn.onclick = nextFullscreenQuestion;
    if (nextSetBtn && !nextSetBtn.dataset.bound) {
        nextSetBtn.dataset.bound = 'true';
        nextSetBtn.onclick = () => {
            if (!isBatchMode()) {
                setSchedulerMode(SCHEDULER_MODES.BATCH_5);
            }
            advanceBatchSetNow();
            updateFullscreenQueueDisplay();
            updateSchedulerToolbar();
        };
    }
    if (exitBtn) exitBtn.onclick = exitFullscreenDrawing;

    // Learn mode button
    const learnBtn = document.getElementById('fullscreenLearnBtn');
    if (learnBtn) learnBtn.onclick = enterFullscreenLearnMode;

    // Reset drawing state
    strokes = [];
    undoneStrokes = [];
    currentStroke = null;
    drawStartTime = null;

    // Update undo/redo button state
    updateFullscreenUndoRedoButtons();

    // Play character pronunciation audio
    if (currentQuestion && currentQuestion.pinyin) {
        const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
        playPinyinAudio(firstPinyin, currentQuestion.char);
    }

    // Keep next-set control state in sync when entering fullscreen
    updateFullscreenNextSetButton();
}

function exitFullscreenDrawing() {
    const container = document.getElementById('fullscreenDrawContainer');
    if (container) {
        container.classList.add('hidden');
    }
    isFullscreenMode = false;

    // Clean up learn mode if active
    if (isFullscreenLearnMode) {
        exitFullscreenLearnMode();
    }

    // Clear fullscreen canvas
    if (fullscreenCanvas && fullscreenCtx) {
        fullscreenCtx.clearRect(0, 0, fullscreenCanvas.width, fullscreenCanvas.height);
    }
}

function updateFullscreenConfidence() {
    const confidenceEl = document.getElementById('fullscreenConfidence');
    if (!confidenceEl || !currentQuestion) return;

    const score = getConfidenceScore(currentQuestion.char);
    const pct = Math.round(score * 100);
    confidenceEl.textContent = `Confidence: ${pct}%`;
}

// Fullscreen Learn Mode - blink current character in center of screen
function enterFullscreenLearnMode() {
    isFullscreenLearnMode = true;

    // Get current character from the question
    const char = currentQuestion ? currentQuestion.char : '';
    if (!char) return;

    // Create or get the blink overlay
    let overlay = document.getElementById('learnModeOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'learnModeOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 20vw;
            color: rgba(0, 0, 0, 0.3);
            pointer-events: none;
            z-index: 100;
            font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(overlay);
    }

    overlay.textContent = char;
    overlay.style.opacity = '1';

    // Start blinking every 2 seconds
    let visible = true;
    learnModeBlinkInterval = setInterval(() => {
        visible = !visible;
        overlay.style.opacity = visible ? '1' : '0';
    }, 2000);

    // Update button to show "Stop" instead of "Learn"
    const learnBtn = document.getElementById('fullscreenLearnBtn');
    if (learnBtn) {
        learnBtn.textContent = '⏹ Stop';
        learnBtn.onclick = exitFullscreenLearnMode;
    }
}

function exitFullscreenLearnMode() {
    isFullscreenLearnMode = false;

    // Stop the blink interval
    if (learnModeBlinkInterval) {
        clearInterval(learnModeBlinkInterval);
        learnModeBlinkInterval = null;
    }

    // Hide the overlay
    const overlay = document.getElementById('learnModeOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
    }

    // Restore button to "Learn"
    const learnBtn = document.getElementById('fullscreenLearnBtn');
    if (learnBtn) {
        learnBtn.textContent = '📖 Learn';
        learnBtn.onclick = enterFullscreenLearnMode;
    }
}

// Update learn mode overlay with new character (called when question changes)
function updateLearnModeCharacter() {
    if (!isFullscreenLearnMode) return;

    const char = currentQuestion ? currentQuestion.char : '';
    const overlay = document.getElementById('learnModeOverlay');
    if (overlay && char) {
        overlay.textContent = char;
    }
}

function getFullscreenCanvasCoords(e) {
    const rect = fullscreenCanvas.getBoundingClientRect();
    // For full-page canvas, coordinates are simply client coords since canvas fills viewport
    if (e.touches && e.touches[0]) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function startFullscreenDrawing(e) {
    isDrawing = true;
    const coords = getFullscreenCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;
    const initialTimestamp = getRelativeTimestamp();
    currentStroke = {
        x: [Math.round(coords.x)],
        y: [Math.round(coords.y)],
        t: [initialTimestamp]
    };
}

function drawFullscreen(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getFullscreenCanvasCoords(e);
    fullscreenCtx.beginPath();
    fullscreenCtx.moveTo(lastX, lastY);
    fullscreenCtx.lineTo(coords.x, coords.y);
    fullscreenCtx.stroke();

    if (currentStroke) {
        currentStroke.x.push(Math.round(coords.x));
        currentStroke.y.push(Math.round(coords.y));
        currentStroke.t.push(getRelativeTimestamp());
    }
    lastX = coords.x;
    lastY = coords.y;
}

function stopFullscreenDrawing() {
    if (isDrawing && currentStroke && currentStroke.x.length > 0) {
        strokes.push(currentStroke);
        undoneStrokes = []; // Clear redo history when new stroke is added
        currentStroke = null;

        if (ocrTimeout) clearTimeout(ocrTimeout);
        ocrTimeout = setTimeout(runFullscreenOCR, 400);

        updateFullscreenUndoRedoButtons();
    }
    isDrawing = false;
}

function handleFullscreenTouchStart(e) {
    e.preventDefault();
    startFullscreenDrawing(e);
}

function handleFullscreenTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    drawFullscreen(e);
}

async function runFullscreenOCR() {
    if (strokes.length === 0) {
        const ocrResult = document.getElementById('fullscreenOcrResult');
        if (ocrResult) ocrResult.textContent = '';
        return;
    }

    try {
        const response = await fetch('https://www.google.com/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input_type: 0,
                requests: [{
                    language: 'zh',
                    writing_guide: {
                        width: fullscreenCanvas.width,
                        height: fullscreenCanvas.height
                    },
                    ink: strokes.map(stroke => [stroke.x, stroke.y, stroke.t])
                }]
            })
        });

        const data = await response.json();
        if (data && data[1] && data[1][0] && data[1][0][1]) {
            const candidates = data[1][0][1];
            const ocrResult = document.getElementById('fullscreenOcrResult');
            const ocrPinyin = document.getElementById('fullscreenOcrPinyin');
            if (ocrResult && candidates.length > 0) {
                const matchedChar = candidates[0];
                ocrResult.textContent = matchedChar;
                // Look up pinyin for the matched character
                if (ocrPinyin) {
                    const matchedItem = quizCharacters.find(item => item.char === matchedChar);
                    ocrPinyin.textContent = matchedItem ? matchedItem.pinyin : '';
                }
            }
        }
    } catch (error) {
        console.error('OCR Error:', error);
    }
}

function clearFullscreenCanvas() {
    if (!fullscreenCtx || !fullscreenCanvas) return;
    // Use CSS dimensions since context has DPR scale transform applied
    fullscreenCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    strokes = [];
    undoneStrokes = [];
    currentStroke = null;
    drawStartTime = null;
    if (ocrTimeout) {
        clearTimeout(ocrTimeout);
        ocrTimeout = null;
    }
    const ocrResult = document.getElementById('fullscreenOcrResult');
    const ocrPinyin = document.getElementById('fullscreenOcrPinyin');
    if (ocrResult) {
        ocrResult.textContent = '';
    }
    if (ocrPinyin) {
        ocrPinyin.textContent = '';
    }
    updateFullscreenUndoRedoButtons();
}

function undoFullscreenStroke() {
    if (strokes.length === 0) return;

    const lastStroke = strokes.pop();
    undoneStrokes.push(lastStroke);

    redrawFullscreenCanvas();
    updateFullscreenUndoRedoButtons();

    if (ocrTimeout) clearTimeout(ocrTimeout);
    ocrTimeout = setTimeout(runFullscreenOCR, 400);
}

function redoFullscreenStroke() {
    if (undoneStrokes.length === 0) return;

    const stroke = undoneStrokes.pop();
    strokes.push(stroke);

    redrawFullscreenCanvas();
    updateFullscreenUndoRedoButtons();

    if (ocrTimeout) clearTimeout(ocrTimeout);
    ocrTimeout = setTimeout(runFullscreenOCR, 400);
}

function redrawFullscreenCanvas() {
    if (!fullscreenCtx || !fullscreenCanvas) return;

    // Use CSS dimensions since context has DPR scale transform applied
    fullscreenCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    strokes.forEach(stroke => {
        if (stroke.x.length === 0) return;

        fullscreenCtx.beginPath();
        fullscreenCtx.moveTo(stroke.x[0], stroke.y[0]);

        for (let i = 1; i < stroke.x.length; i++) {
            fullscreenCtx.lineTo(stroke.x[i], stroke.y[i]);
        }
        fullscreenCtx.stroke();
    });
}

function updateFullscreenUndoRedoButtons() {
    const undoBtn = document.getElementById('fullscreenUndoBtn');
    const redoBtn = document.getElementById('fullscreenRedoBtn');

    if (undoBtn) {
        undoBtn.disabled = strokes.length === 0;
        undoBtn.className = strokes.length === 0
            ? 'bg-gray-300 text-gray-500 px-6 py-2 rounded-lg transition cursor-not-allowed'
            : 'bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg transition';
    }

    if (redoBtn) {
        redoBtn.disabled = undoneStrokes.length === 0;
        redoBtn.className = undoneStrokes.length === 0
            ? 'bg-gray-300 text-gray-500 px-6 py-2 rounded-lg transition cursor-not-allowed'
            : 'bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition';
    }
}

function submitFullscreenDrawing() {
    const ocrResult = document.getElementById('fullscreenOcrResult');
    if (!ocrResult) return;

    const isFirstAttempt = !answered;

    const recognized = ocrResult.textContent.trim();
    if (!recognized) {
        alert('Please draw a character first!');
        return;
    }

    // Play submit sound
    playSubmitSound();

    if (isFirstAttempt) {
        answered = true;
        total++;
    }

    const normalizedRecognized = normalizeDrawAnswer(recognized);
    const normalizedTarget = normalizeDrawAnswer(currentQuestion.char);
    const correct = normalizedRecognized === normalizedTarget;

    // Play sounds and update score
    if (correct) {
        playCorrectSound();
        if (isFirstAttempt) {
            score++;
        }
    } else {
        playWrongSound();
    }

    if (isFirstAttempt) {
        markSchedulerOutcome(correct);
    }

    // Show feedback in fullscreen
    const prompt = document.getElementById('fullscreenPrompt');
    const meaningText = currentQuestion.meaning ? ` – ${currentQuestion.meaning}` : '';
    if (prompt) {
        if (correct) {
            prompt.innerHTML = `<span class="text-green-600">✓ Correct! ${currentQuestion.char} (${currentQuestion.pinyin})${meaningText}</span>`;
        } else {
            prompt.innerHTML = `<span class="text-red-600">✗ Wrong! You wrote: ${recognized}, Correct: ${currentQuestion.char} (${currentQuestion.pinyin})${meaningText}</span>`;
        }
    }

    // Also update main feedback for when user exits fullscreen
    if (correct) {
        feedback.textContent = `✓ Correct! ${currentQuestion.char} (${currentQuestion.pinyin})${meaningText}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
    } else {
        feedback.textContent = `✗ Wrong! You wrote: ${recognized}, Correct: ${currentQuestion.char} (${currentQuestion.pinyin})${meaningText}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
    }

    updateStats();

    // Stay in fullscreen and auto-advance after 1.5 seconds
    setTimeout(() => {
        clearFullscreenCanvas();
        generateQuestion();
        // Update prompt for new question
        const prompt = document.getElementById('fullscreenPrompt');
        if (prompt && currentQuestion) {
            prompt.innerHTML = `Draw: ${currentQuestion.pinyin}`;
        }

        // Play character pronunciation audio for new question
        if (currentQuestion && currentQuestion.pinyin) {
            const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
            playPinyinAudio(firstPinyin, currentQuestion.char);
        }
    }, 1500);
}

function showFullscreenAnswer() {
    if (!currentQuestion) return;

    const ocrResult = document.getElementById('fullscreenOcrResult');
    if (ocrResult) {
        ocrResult.textContent = currentQuestion.char;
    }

    const prompt = document.getElementById('fullscreenPrompt');
    if (prompt) {
        const meaningSuffix = currentQuestion.meaning ? ` – ${currentQuestion.meaning}` : '';
        prompt.innerHTML = `<span class="text-red-600">✗ Answer: ${currentQuestion.char} (${currentQuestion.pinyin})${meaningSuffix}</span>`;
    }

    if (!answered) {
        answered = true;
        total++;
        // Score not incremented = counts as wrong

        markSchedulerOutcome(false);

        updateStats();

        // Also update main feedback - show as wrong (red)
        const meaningSuffix = currentQuestion.meaning ? ` – ${currentQuestion.meaning}` : '';
        feedback.textContent = `✗ Answer: ${currentQuestion.char} (${currentQuestion.pinyin})${meaningSuffix}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
    }
}

function nextFullscreenQuestion() {
    clearFullscreenCanvas();
    generateQuestion();

    // Update prompt for new question
    const prompt = document.getElementById('fullscreenPrompt');
    if (prompt && currentQuestion) {
        prompt.innerHTML = `Draw: ${currentQuestion.pinyin}`;
    }

    // Update confidence display
    updateFullscreenConfidence();

    // Play character pronunciation audio
    if (currentQuestion && currentQuestion.pinyin) {
        const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
        playPinyinAudio(firstPinyin, currentQuestion.char);
    }
}

function populateStudyList() {
    if (!studyMode) return;
    if (!ensureStudyModeLayout()) return;
    renderStudyListContents();
}

function ensureStudyModeLayout() {
    if (!studyMode) return false;
    if (studyModeInitialized) return true;

    studyMode.innerHTML = `
        <div class="study-mode-shell h-full flex flex-col gap-4 overflow-hidden">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between px-4 lg:px-6">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">Study Mode Reference</h2>
                    <p class="text-sm text-gray-600">Quick list of this lesson's vocab. Use search or sorting as needed.</p>
                </div>
                <div id="studyStatsFiltered" class="text-sm text-gray-500">Showing 0 / 0 terms</div>
            </div>
            <div class="study-body grid grid-cols-1 gap-4 px-4 lg:px-6 flex-1 min-h-0 overflow-y-auto">
                <div class="study-list-card flex flex-col gap-3 min-h-0">
                    <div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                        <div class="relative flex-1 w-full">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none">⌕</span>
                            <input
                                id="studySearchInput"
                                type="search"
                                class="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition bg-white shadow-sm text-gray-800"
                                placeholder="Search character, pinyin, or meaning"
                                autocomplete="off"
                            >
                        </div>
                        <div class="flex flex-wrap gap-3 items-center text-sm md:justify-end">
                            <label for="studySortSelect" class="font-semibold text-gray-600">Sort:</label>
                            <select id="studySortSelect" class="px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none text-sm font-semibold text-gray-700 bg-white">
                                <option value="original">Original order</option>
                                <option value="char">Character (A-Z)</option>
                                <option value="pinyin">Pinyin (A-Z)</option>
                                <option value="meaning">Meaning (A-Z)</option>
                            </select>
                            <button id="studyShuffleBtn" type="button" class="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:text-blue-600 transition bg-white">Shuffle</button>
                            <button id="studyResetBtn" type="button" class="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:border-blue-500 transition bg-white">Reset</button>
                        </div>
                    </div>
                    <div class="rounded-2xl border border-gray-200 bg-white shadow-sm flex-1 min-h-0 flex flex-col">
                        <div class="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase bg-gray-50 rounded-t-2xl">
                            <span class="md:col-span-2">Character</span>
                            <span class="md:col-span-3">Pinyin</span>
                            <span class="md:col-span-6">Meaning</span>
                            <span class="md:col-span-1 text-right">Audio</span>
                        </div>
                        <div id="studyList" class="study-list flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    studyModeInitialized = true;

    const searchInput = document.getElementById('studySearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            const value = event.target.value || '';
            studyModeState.searchRaw = value;
            studyModeState.searchQuery = value.trim().toLowerCase();
            renderStudyListContents();
        });
    }

    const sortSelect = document.getElementById('studySortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (event) => {
            studyModeState.sortBy = event.target.value || 'original';
            studyModeState.shuffleOrder = null;
            renderStudyListContents();
        });
    }

    const shuffleBtn = document.getElementById('studyShuffleBtn');
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            if (!quizCharacters.length) return;
            studyModeState.sortBy = 'original';
            studyModeState.shuffleOrder = getShuffledIndices(quizCharacters.length);
            const selectEl = document.getElementById('studySortSelect');
            if (selectEl) {
                selectEl.value = 'original';
            }
            renderStudyListContents();
        });
    }

    const resetBtn = document.getElementById('studyResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            studyModeState.searchRaw = '';
            studyModeState.searchQuery = '';
            studyModeState.sortBy = 'original';
            studyModeState.shuffleOrder = null;

            const searchEl = document.getElementById('studySearchInput');
            if (searchEl) {
                searchEl.value = '';
                searchEl.focus();
            }
            const selectEl = document.getElementById('studySortSelect');
            if (selectEl) {
                selectEl.value = 'original';
            }
            renderStudyListContents();
        });
    }

    return true;
}

function renderStudyListContents() {
    const studyList = document.getElementById('studyList');
    if (!studyList) return;

    const totalCount = quizCharacters.length;
    const statsFiltered = document.getElementById('studyStatsFiltered');

    if (studyModeState.shuffleOrder && studyModeState.shuffleOrder.length !== totalCount) {
        studyModeState.shuffleOrder = null;
    }

    let orderedCharacters = quizCharacters.slice();

    if (studyModeState.sortBy === 'char') {
        orderedCharacters.sort((a, b) => compareStudyStrings(a?.char, b?.char));
    } else if (studyModeState.sortBy === 'pinyin') {
        orderedCharacters.sort((a, b) => compareStudyStrings(a?.pinyin, b?.pinyin));
    } else if (studyModeState.sortBy === 'meaning') {
        orderedCharacters.sort((a, b) => compareStudyStrings(a?.meaning, b?.meaning));
    } else if (studyModeState.shuffleOrder && studyModeState.shuffleOrder.length === orderedCharacters.length) {
        orderedCharacters = studyModeState.shuffleOrder
            .map(index => orderedCharacters[index])
            .filter(Boolean);
    }

    const rawQuery = studyModeState.searchRaw.trim();
    const loweredQuery = studyModeState.searchQuery;

    let filteredCharacters = orderedCharacters;
    if (rawQuery) {
        filteredCharacters = orderedCharacters.filter(item => {
            const charMatch = (item.char || '').includes(rawQuery);
            const pinyinMatch = (item.pinyin || '').toLowerCase().includes(loweredQuery);
            const meaningMatch = (item.meaning || '').toLowerCase().includes(loweredQuery);
            return charMatch || pinyinMatch || meaningMatch;
        });
    }

    studyList.innerHTML = '';
    studyList.scrollTop = 0;

    if (!filteredCharacters.length) {
        const empty = document.createElement('div');
        empty.className = 'p-10 text-center text-gray-500';
        empty.innerHTML = `
            <div class="text-xl font-semibold mb-2">No matches found</div>
            <div class="text-sm">Try a different search or reset filters.</div>
        `;
        studyList.appendChild(empty);
        if (statsFiltered) {
            statsFiltered.textContent = `Showing 0 / ${totalCount} terms`;
        }
        return;
    }

    filteredCharacters.forEach((item, displayIndex) => {
        studyList.appendChild(createStudyRow(item, displayIndex));
    });

    if (statsFiltered) {
        statsFiltered.textContent = `Showing ${filteredCharacters.length} / ${totalCount} terms`;
    }
}

function createStudyRow(item, displayIndex) {
    const row = document.createElement('div');
    row.className = 'study-row flex flex-col gap-2 p-4 md:grid md:grid-cols-12 md:items-center md:gap-4 hover:bg-gray-50 transition';

    const charCell = document.createElement('div');
    charCell.className = 'text-4xl font-bold text-gray-900 tracking-tight md:col-span-2 min-w-0 overflow-hidden';
    charCell.textContent = item.char || '—';

    const pinyinCell = document.createElement('div');
    pinyinCell.className = 'text-base font-semibold text-gray-900 md:col-span-3 min-w-0 overflow-hidden break-words';
    const displayPinyin = (item.pinyin || '')
        .split('/')
        .map(part => part.trim())
        .filter(Boolean)
        .join(' · ');
    pinyinCell.textContent = displayPinyin || '—';

    const meaningCell = document.createElement('div');
    meaningCell.className = 'text-sm text-gray-600 leading-snug md:col-span-6 min-w-0 overflow-hidden break-words';
    meaningCell.textContent = item.meaning || '—';

    const actionsCell = document.createElement('div');
    actionsCell.className = 'flex items-center justify-start md:justify-end md:col-span-1 min-w-0 flex-shrink-0';

    const audioButton = document.createElement('button');
    audioButton.type = 'button';
    audioButton.className = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition bg-white';
    audioButton.innerHTML = '<span class="text-lg leading-none">🔊</span><span class="hidden lg:inline">Play</span>';
    const firstPinyin = (item.pinyin || '').split('/')[0]?.trim() || '';
    audioButton.addEventListener('click', () => {
        const fallback = firstPinyin || item.pinyin || item.char || '';
        playPinyinAudio(fallback, item.char);
    });

    actionsCell.appendChild(audioButton);

    row.appendChild(charCell);
    row.appendChild(pinyinCell);
    row.appendChild(meaningCell);
    row.appendChild(actionsCell);

    return row;
}

function getShuffledIndices(length) {
    const indices = Array.from({ length }, (_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
}

function compareStudyStrings(a = '', b = '') {
    const first = (a || '').toString();
    const second = (b || '').toString();
    return first.localeCompare(second, 'zh-Hans', { sensitivity: 'base' });
}

function ensureDrawModeLayout() {
    if (!drawCharMode || drawModeInitialized) return;

    drawCharMode.innerHTML = `
        <div class="space-y-4">
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col lg:flex-row gap-4">
                <div class="flex flex-col gap-3 text-center lg:text-left w-full lg:w-[220px]">
                    <div class="text-xs uppercase tracking-[0.35em] text-gray-400">Recognition</div>
                    <div id="ocrResult" class="text-5xl font-semibold text-blue-600 min-h-[72px]">&nbsp;</div>
                    <div id="ocrCandidates" class="flex flex-wrap gap-2 justify-center lg:justify-start"></div>
                </div>
                <div class="flex-1 flex flex-col gap-3">
                    <canvas id="drawCanvas" width="400" height="400" class="w-full aspect-square bg-white border border-gray-200 rounded-2xl shadow-inner touch-none select-none"></canvas>
                    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <span>Hold Space to pan · Scroll to zoom</span>
                        <button id="fullscreenDrawBtn" type="button" class="px-3 py-1.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition">⛶ Fullscreen</button>
                    </div>
                </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap gap-2">
                    <button id="undoBtn" type="button" class="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed transition">↶ Undo</button>
                    <button id="redoBtn" type="button" class="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed transition">↷ Redo</button>
                    <button id="zoomInBtn" type="button" class="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition">Zoom In</button>
                    <button id="zoomOutBtn" type="button" class="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition">Zoom Out</button>
                    <button id="resetViewBtn" type="button" class="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition">Reset</button>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button id="clearCanvasBtn" type="button" class="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-red-400 hover:text-red-600 transition">Clear</button>
                    <button id="showDrawAnswerBtn" type="button" class="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition">Show Answer</button>
                    <button id="submitDrawBtn" type="button" class="px-4 py-2 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition">Submit</button>
                    <button id="drawNextBtn" type="button" class="hidden px-4 py-2 rounded-xl border border-blue-200 text-blue-600 font-semibold hover:border-blue-400 transition">Next</button>
                </div>
            </div>
        </div>
    `;

    drawModeInitialized = true;
}

function ensureFullscreenDrawLayout() {
    if (fullscreenDrawInitialized) return;
    let container = document.getElementById('fullscreenDrawContainer');

    // Create container if it doesn't exist
    if (!container) {
        container = document.createElement('div');
        container.id = 'fullscreenDrawContainer';
        container.className = 'hidden fixed inset-0 z-50 bg-white';
        document.body.appendChild(container);
    }

    container.innerHTML = `
        <div class="relative w-full h-full overflow-hidden">
            <!-- Full-page canvas as background -->
            <canvas id="fullscreenDrawCanvas" class="absolute inset-0 w-full h-full touch-none select-none bg-white" style="cursor: crosshair;"></canvas>

            <!-- Top bar with prompt and exit -->
            <div class="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pointer-events-none z-10">
                <div class="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-lg border border-gray-200">
                    <div class="text-xs uppercase tracking-[0.35em] text-gray-400">Draw</div>
                    <div id="fullscreenPrompt" class="text-3xl font-bold text-gray-900">字</div>
                    <div id="fullscreenConfidence" class="text-sm text-gray-500 mt-1"></div>
                </div>
                <button id="exitFullscreenBtn" type="button" class="pointer-events-auto px-4 py-2 rounded-xl bg-white/90 backdrop-blur-sm border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 shadow-lg transition">Exit</button>
            </div>

            <!-- Left panel with OCR result -->
            <div class="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <div class="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-200 w-32">
                    <div class="text-xs uppercase tracking-[0.25em] text-gray-400 mb-2">Match</div>
                    <div id="fullscreenOcrResult" class="text-6xl font-bold text-blue-600 text-center min-h-[80px]" style="font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">&nbsp;</div>
                </div>
            </div>

            <!-- Pinyin display near bottom -->
            <div class="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                <div id="fullscreenOcrPinyin" class="text-2xl font-semibold text-blue-600 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border border-gray-200"></div>
            </div>

            <!-- Bottom toolbar -->
            <div class="absolute bottom-0 left-0 right-0 p-4 pointer-events-none z-10">
                <div class="flex flex-wrap items-center justify-center gap-3 pointer-events-auto">
                    <div class="bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg border border-gray-200 flex gap-2">
                        <button id="fullscreenUndoBtn" type="button" class="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition text-sm">Undo</button>
                        <button id="fullscreenRedoBtn" type="button" class="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition text-sm">Redo</button>
                        <button id="fullscreenClearBtn" type="button" class="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-red-400 hover:text-red-600 transition text-sm">Clear</button>
                    </div>
                    <div class="bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg border border-gray-200 flex gap-2">
                        <button id="fullscreenNextSetBtn" type="button" class="px-3 py-2 rounded-xl border border-amber-200 text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100 transition text-sm">Next Set</button>
                        <button id="fullscreenShowAnswerBtn" type="button" class="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition text-sm">Show</button>
                        <button id="fullscreenLearnBtn" type="button" class="px-3 py-2 rounded-xl border border-yellow-400 text-yellow-700 font-semibold bg-yellow-50 hover:bg-yellow-100 transition text-sm">📖 Learn</button>
                        <button id="fullscreenSubmitBtn" type="button" class="px-3 py-2 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition text-sm">Submit</button>
                        <button id="fullscreenNextBtn" type="button" class="px-3 py-2 rounded-xl border border-blue-500 text-blue-600 font-semibold hover:bg-blue-50 transition text-sm">Next →</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    fullscreenDrawInitialized = true;
}

// =============================================================================
// RADICAL PRACTICE MODE
// =============================================================================

function generateRadicalOptions() {
    const radicalOptionsDiv = document.getElementById('radicalOptions');
    const radicalSubmitBtn = document.getElementById('radicalSubmitBtn');
    if (!radicalOptionsDiv || !radicalSubmitBtn) return;

    radicalOptionsDiv.innerHTML = '';
    radicalSelectedAnswers = [];

    // Get correct radicals for current character
    const correctRadicals = currentQuestion.radicals || [];

    // Get all unique radicals from the entire character set for distractors
    const allRadicals = new Set();
    quizCharacters.forEach(char => {
        if (char.radicals) {
            char.radicals.forEach(rad => allRadicals.add(rad));
        }
    });

    // Create distractor pool (excluding correct radicals)
    const distractors = Array.from(allRadicals).filter(rad => !correctRadicals.includes(rad));

    // Shuffle and pick some distractors (aim for 4-6 total options)
    const numDistractors = Math.min(Math.max(3, 8 - correctRadicals.length), distractors.length);
    const shuffledDistractors = distractors.sort(() => Math.random() - 0.5).slice(0, numDistractors);

    // Combine correct and distractors, then shuffle
    const allOptions = [...correctRadicals, ...shuffledDistractors].sort(() => Math.random() - 0.5);

    // Create option buttons
    allOptions.forEach((radical, index) => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg border-2 border-gray-300 transition text-lg';
        btn.textContent = radical;
        btn.dataset.radical = radical;
        btn.onclick = () => toggleRadicalSelection(btn, radical);
        radicalOptionsDiv.appendChild(btn);
    });

    // Set up submit button
    radicalSubmitBtn.onclick = () => checkRadicalAnswer();
}

function toggleRadicalSelection(btn, radical) {
    const index = radicalSelectedAnswers.indexOf(radical);

    if (index > -1) {
        // Deselect
        radicalSelectedAnswers.splice(index, 1);
        btn.classList.remove('bg-blue-500', 'text-white', 'border-blue-600');
        btn.classList.add('bg-gray-100', 'border-gray-300');
    } else {
        // Select
        radicalSelectedAnswers.push(radical);
        btn.classList.remove('bg-gray-100', 'border-gray-300');
        btn.classList.add('bg-blue-500', 'text-white', 'border-blue-600');
    }
}

function checkRadicalAnswer() {
    if (answered) return;
    answered = true;
    total++;

    const correctRadicals = currentQuestion.radicals || [];

    // Check if selected radicals match exactly
    const selectedSet = new Set(radicalSelectedAnswers);
    const correctSet = new Set(correctRadicals);

    const allCorrect = radicalSelectedAnswers.length === correctRadicals.length &&
                       radicalSelectedAnswers.every(r => correctSet.has(r));

    // Highlight buttons
    const buttons = document.querySelectorAll('#radicalOptions button');
    buttons.forEach(btn => {
        const radical = btn.dataset.radical;
        const isCorrect = correctSet.has(radical);
        const wasSelected = selectedSet.has(radical);

        if (isCorrect && wasSelected) {
            // Correct and selected - green
            btn.classList.remove('bg-blue-500', 'bg-gray-100', 'border-blue-600', 'border-gray-300');
            btn.classList.add('bg-green-500', 'text-white', 'border-green-600');
        } else if (isCorrect && !wasSelected) {
            // Correct but not selected - show as missed (green border)
            btn.classList.remove('bg-gray-100', 'border-gray-300');
            btn.classList.add('bg-green-100', 'border-green-500', 'border-4');
        } else if (!isCorrect && wasSelected) {
            // Incorrect selection - red
            btn.classList.remove('bg-blue-500', 'border-blue-600');
            btn.classList.add('bg-red-500', 'text-white', 'border-red-600');
        }
    });

    if (allCorrect) {
        playCorrectSound();
        score++;
        feedback.textContent = `✓ Correct! All radicals found.`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        hint.textContent = `${currentQuestion.char} (${currentQuestion.pinyin}) - ${currentQuestion.meaning}`;
        hint.className = 'text-center text-xl font-semibold my-4 text-green-600';
    } else {
        playWrongSound();
        const missed = correctRadicals.filter(r => !selectedSet.has(r));
        const wrong = radicalSelectedAnswers.filter(r => !correctSet.has(r));

        let msg = '✗ Incorrect.';
        if (missed.length > 0) msg += ` Missed: ${missed.join(', ')}.`;
        if (wrong.length > 0) msg += ` Wrong: ${wrong.join(', ')}.`;

        feedback.textContent = msg;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
        hint.textContent = `Correct radicals: ${correctRadicals.join(', ')}`;
        hint.className = 'text-center text-xl font-semibold my-4 text-red-600';
    }

    markSchedulerOutcome(allCorrect);

    // Play audio
    const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
    playPinyinAudio(firstPinyin, currentQuestion.char);

    updateStats();
    scheduleNextQuestion(2500);
}

// =============================================================================
// MISSING COMPONENT QUIZ MODE
// =============================================================================

let componentInputEl = null;
let componentAllOptions = [];
let partialCharacterCache = {};
let currentDecomposition = null; // { char, data, visibleIndex, givenComponent }
let componentPreviousQuestion = null; // { question, decomposition: { char, data, visibleIndex, givenComponent, missingComponent } }
let componentPreviousResult = null; // 'correct' or 'incorrect'
let componentUpcomingQuestion = null; // { question, decomposition: { char, data, visibleIndex, givenComponent, missingComponent } }
let componentInlineFeedback = null; // { message, type: 'correct'|'incorrect' }

// Prepare a question with component decomposition data
function prepareComponentQuestion(exclusions = []) {
    let attempts = 0;
    let foundDecomposition = null;
    let question = null;

    while (!foundDecomposition && attempts < 100) {
        question = selectNextQuestion(exclusions);
        if (!question) break;

        const chars = Array.from(question.char);
        for (const c of chars) {
            const decomp = CHARACTER_DECOMPOSITIONS[c];
            if (decomp && decomp.components && decomp.matches) {
                // Pick a random component to be "missing"
                const components = decomp.components;
                const missingIndex = Math.floor(Math.random() * components.length);
                const visibleIndex = missingIndex === 0 ? 1 : 0;

                foundDecomposition = {
                    char: c,
                    data: decomp,
                    visibleIndex: visibleIndex,
                    givenComponent: components[visibleIndex],
                    missingComponent: components[missingIndex]
                };
                break;
            }
        }
        attempts++;
    }

    if (!foundDecomposition || !question) return null;

    return {
        question: question,
        decomposition: foundDecomposition
    };
}

// Render three-column layout for missing component mode
async function renderThreeColumnComponentLayout() {
    if (!questionDisplay || !currentQuestion || !currentDecomposition) return;

    // Get upcoming question if not already set
    if (!componentUpcomingQuestion) {
        const exclusions = currentQuestion?.char ? [currentQuestion.char] : [];
        componentUpcomingQuestion = prepareComponentQuestion(exclusions);
    }

    // Build previous column content
    let prevContent = '';
    if (componentPreviousQuestion) {
        const prev = componentPreviousQuestion;
        const prevResultClass = componentPreviousResult === 'correct' ? 'result-correct' :
                               componentPreviousResult === 'incorrect' ? 'result-incorrect' : '';
        const prevResultIcon = componentPreviousResult === 'correct' ? '✓' :
                               componentPreviousResult === 'incorrect' ? '✗' : '•';
        const prevFeedbackText = componentPreviousResult === 'correct' ? 'Got it right' :
                                 componentPreviousResult === 'incorrect' ? 'Missed it' : '';

        prevContent = `
            <div class="column-previous column-card ${prevResultClass}">
                <div class="column-label">Previous</div>
                <div class="column-feedback">
                    <span class="column-result-icon">${prevResultIcon}</span>
                    <span class="column-feedback-text">${prevFeedbackText}</span>
                </div>
                <div class="column-char">${escapeHtml(prev.question.char)}</div>
                <div class="column-pinyin">${escapeHtml(prev.question.pinyin)}</div>
                <div class="column-meaning">${escapeHtml(prev.question.meaning)}</div>
            </div>`;
    } else {
        prevContent = `
            <div class="column-previous column-card">
                <div class="column-label">Previous</div>
                <div class="column-placeholder">Your last answer will appear here</div>
            </div>`;
    }

    // Build current column content with partial character
    const fullWord = currentQuestion.char;
    const targetChar = currentDecomposition.char;
    const givenComponent = currentDecomposition.givenComponent;

    let wordDisplay = '';
    for (let i = 0; i < fullWord.length; i++) {
        if (fullWord[i] === targetChar) {
            wordDisplay += `<span id="currentPartialChar" style="display: inline-block; width: 80px; height: 80px; vertical-align: middle;"></span>`;
        } else {
            wordDisplay += `<span style="font-size: 5rem; font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif; vertical-align: middle; color: #1f2937;">${fullWord[i]}</span>`;
        }
    }

    const inlineFeedbackHtml = componentInlineFeedback ? `
        <div class="column-inline-feedback ${componentInlineFeedback.type === 'incorrect' ? 'is-incorrect' : 'is-correct'}">
            ${escapeHtml(componentInlineFeedback.message)}
        </div>` : '';

    const currentContent = `
        <div class="column-current column-card ${componentInlineFeedback ? (componentInlineFeedback.type === 'incorrect' ? 'has-error' : 'has-success') : ''}">
            <div class="column-label">Now</div>
            <div class="text-xl text-blue-600 font-semibold">${escapeHtml(currentQuestion.pinyin)}</div>
            <div class="text-sm text-gray-500 mb-2">${escapeHtml(currentQuestion.meaning)}</div>
            <div class="column-focus-ring" style="min-height: 80px; display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                ${wordDisplay}
            </div>
            <div class="text-base text-gray-600 mt-2">
                <span class="text-xl text-gray-700" style="font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">${givenComponent.char}</span>
                <span class="text-gray-400 mx-2">+</span>
                <span class="text-xl text-blue-500 font-bold">?</span>
            </div>
            ${inlineFeedbackHtml}
        </div>`;

    // Build upcoming column content
    let upcomingContent = '';
    if (componentUpcomingQuestion) {
        const up = componentUpcomingQuestion;
        upcomingContent = `
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                <div class="column-ondeck">
                    <div id="upcomingPartialChar" style="display: inline-block; width: 60px; height: 60px;"></div>
                    <div class="text-sm text-gray-500 mt-1">${escapeHtml(up.question.pinyin)}</div>
                    <div class="ondeck-note">On deck</div>
                </div>
            </div>`;
    } else {
        upcomingContent = `
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                <div class="column-placeholder">Next card is loading</div>
            </div>`;
    }

    questionDisplay.innerHTML = `
        <div class="three-column-meaning-layout">
            ${prevContent}
            ${currentContent}
            ${upcomingContent}
        </div>
    `;

    // Render partial characters asynchronously
    const currentPartialEl = document.getElementById('currentPartialChar');
    if (currentPartialEl && currentDecomposition) {
        await renderPartialCharacter(
            currentDecomposition.char,
            currentDecomposition.data,
            [currentDecomposition.visibleIndex],
            currentPartialEl
        );
    }

    const upcomingPartialEl = document.getElementById('upcomingPartialChar');
    if (upcomingPartialEl && componentUpcomingQuestion) {
        await renderPartialCharacter(
            componentUpcomingQuestion.decomposition.char,
            componentUpcomingQuestion.decomposition.data,
            [componentUpcomingQuestion.decomposition.visibleIndex],
            upcomingPartialEl
        );
    }
}

// Render a character showing only certain components using Hanzi Writer stroke data
async function renderPartialCharacter(char, decomposition, visibleComponents, targetElement) {
    if (!decomposition.matches || !targetElement) {
        // Fallback: just show the character
        targetElement.innerHTML = `<span style="font-size: 6rem; color: #1f2937;">${char}</span>`;
        return;
    }

    try {
        // Load stroke data from Hanzi Writer
        const charData = await new Promise((resolve, reject) => {
            if (partialCharacterCache[char]) {
                resolve(partialCharacterCache[char]);
                return;
            }
            if (typeof HanziWriter !== 'undefined' && HanziWriter.loadCharacterData) {
                HanziWriter.loadCharacterData(char).then(data => {
                    partialCharacterCache[char] = data;
                    resolve(data);
                }).catch(reject);
            } else {
                reject(new Error('HanziWriter not available'));
            }
        });

        if (!charData || !charData.strokes) {
            throw new Error('No stroke data');
        }

        const matches = decomposition.matches;
        const strokes = charData.strokes;

        // Create SVG with only visible strokes
        const svgSize = 120;
        const scale = svgSize / 1024; // Hanzi Writer uses 1024x1024 coordinate system

        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 1024 1024">`;

        // Transform to flip Y axis (Hanzi Writer data is Y-inverted)
        svgContent += `<g transform="scale(1, -1) translate(0, -900)">`;

        strokes.forEach((strokePath, i) => {
            const componentIndex = matches[i];
            const isVisible = visibleComponents.includes(componentIndex);

            if (isVisible) {
                // Show this stroke normally
                svgContent += `<path d="${strokePath}" fill="#1f2937" />`;
            }
            // Missing component strokes are fully invisible (not rendered)
        });

        svgContent += `</g></svg>`;

        targetElement.innerHTML = svgContent;

    } catch (err) {
        console.warn('Failed to render partial character:', err);
        // Fallback to CSS clip-path approach
        targetElement.innerHTML = `<span style="font-size: 6rem; color: #1f2937;">${char}</span>`;
    }
}

function generateComponentOptions() {
    const componentOptionsDiv = document.getElementById('componentOptions');
    componentInputEl = document.getElementById('componentInput');
    if (!componentOptionsDiv || !currentMissingComponent) return;

    componentOptionsDiv.innerHTML = '';
    if (componentInputEl) {
        componentInputEl.value = '';
        componentInputEl.focus();
    }

    // Get the correct answer pinyin
    const correctPinyin = currentMissingComponent.pinyin;

    // Build pool of wrong options from the radicals list
    const allRadicals = CHARACTER_DECOMPOSITIONS['_radicals'] || [];
    const wrongOptions = [];
    const usedPinyin = new Set([correctPinyin]);

    // Also add components from other decompositions for variety
    const otherComponents = [];
    for (const [char, data] of Object.entries(CHARACTER_DECOMPOSITIONS)) {
        if (char === '_radicals') continue;
        if (data.components) {
            data.components.forEach(c => {
                if (!usedPinyin.has(c.pinyin)) {
                    otherComponents.push(c);
                }
            });
        }
    }

    // Combine radicals and other components
    const distractorPool = [...allRadicals, ...otherComponents];

    // Shuffle and pick 3 distractors
    const shuffled = distractorPool.sort(() => Math.random() - 0.5);
    for (const item of shuffled) {
        if (wrongOptions.length >= 3) break;
        if (!usedPinyin.has(item.pinyin)) {
            wrongOptions.push(item);
            usedPinyin.add(item.pinyin);
        }
    }

    // Combine correct answer with wrong options
    componentAllOptions = [
        { ...currentMissingComponent, isCorrect: true },
        ...wrongOptions.map(w => ({ ...w, isCorrect: false }))
    ].sort(() => Math.random() - 0.5);

    // Create option buttons - matching fuzzy mode style
    componentAllOptions.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg border-2 border-gray-300 transition flex items-center gap-3';
        btn.innerHTML = `
            <span class="text-3xl text-gray-800" style="font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">${option.char}</span>
            <span class="text-lg text-gray-700">${option.pinyin}</span>
        `;
        btn.dataset.pinyin = option.pinyin;
        btn.dataset.char = option.char;
        btn.dataset.correct = option.isCorrect;
        btn.dataset.index = index;
        btn.onclick = () => checkComponentAnswer(option);
        componentOptionsDiv.appendChild(btn);
    });

    // Setup fuzzy input handler
    if (componentInputEl) {
        componentInputEl.oninput = () => {
            if (answered && lastAnswerCorrect) {
                nextAnswerBuffer = componentInputEl.value;
                return;
            }

            const input = componentInputEl.value.trim().toLowerCase();
            const buttons = document.querySelectorAll('#componentOptions button');

            if (!input) {
                buttons.forEach(btn => {
                    btn.classList.remove('bg-blue-200', 'border-blue-500');
                    btn.classList.add('bg-gray-100', 'border-gray-300');
                });
                return;
            }

            // Find best match - normalize tones for comparison
            const toneMap = {
                'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
                'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
                'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
                'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
                'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
                'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v', 'ü': 'v'
            };
            const normalizePinyin = (s) => {
                return s.toLowerCase().split('').map(c => toneMap[c] || c).join('');
            };
            const normalizedInput = normalizePinyin(input);

            let bestMatch = -1;
            let bestScore = -1;
            componentAllOptions.forEach((opt, idx) => {
                const normalizedPinyin = normalizePinyin(opt.pinyin);
                // Check if pinyin starts with input OR exact match
                if (normalizedPinyin.startsWith(normalizedInput) || normalizedPinyin === normalizedInput) {
                    const score = normalizedInput.length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = idx;
                    }
                }
            });

            buttons.forEach((btn, index) => {
                if (index === bestMatch) {
                    btn.classList.remove('bg-gray-100', 'border-gray-300');
                    btn.classList.add('bg-blue-200', 'border-blue-500');
                } else {
                    btn.classList.remove('bg-blue-200', 'border-blue-500');
                    btn.classList.add('bg-gray-100', 'border-gray-300');
                }
            });
        };

        componentInputEl.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                if (answered && lastAnswerCorrect) {
                    e.preventDefault();
                    goToNextQuestionAfterCorrect();
                    return;
                }

                e.preventDefault();
                // Find highlighted button and click it
                const highlighted = document.querySelector('#componentOptions button.bg-blue-200');
                if (highlighted) {
                    const idx = parseInt(highlighted.dataset.index);
                    checkComponentAnswer(componentAllOptions[idx]);
                }
            }
        };
    }
}

function checkComponentAnswer(selectedOption) {
    if (answered) return;

    const isCorrect = selectedOption.isCorrect;
    const isFirstAttempt = !questionAttemptRecorded;

    if (isFirstAttempt) {
        total++;
        questionAttemptRecorded = true;
    }

    // Play audio for the word
    const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
    playPinyinAudio(firstPinyin, currentQuestion.char);

    if (isCorrect) {
        // Record previous question for left column
        componentPreviousQuestion = {
            question: currentQuestion,
            decomposition: currentDecomposition
        };
        componentPreviousResult = 'correct';
        componentInlineFeedback = null;

        playCorrectSound();
        if (isFirstAttempt) {
            score++;
            markSchedulerOutcome(true);
        }

        updateStats();

        // Move upcoming to current
        if (componentUpcomingQuestion) {
            currentQuestion = componentUpcomingQuestion.question;
            window.currentQuestion = currentQuestion;
            currentDecomposition = componentUpcomingQuestion.decomposition;
            currentMissingComponent = componentUpcomingQuestion.decomposition.missingComponent;
            componentUpcomingQuestion = null;
        } else {
            const prepared = prepareComponentQuestion();
            if (prepared) {
                currentQuestion = prepared.question;
                window.currentQuestion = currentQuestion;
                currentDecomposition = prepared.decomposition;
                currentMissingComponent = prepared.decomposition.missingComponent;
            }
        }

        // Mark the new question as served and update confidence display
        markSchedulerServed(currentQuestion);
        updateCurrentWordConfidence();

        // Clear input and immediately show next question
        if (componentInputEl) {
            componentInputEl.value = '';
        }

        // Re-render with updated columns
        answered = false;
        questionAttemptRecorded = false;
        renderThreeColumnComponentLayout();
        generateComponentOptions();
        feedback.textContent = '';
        hint.textContent = '';
        return;
    }

    // Incorrect: stay on same card, show inline feedback
    playWrongSound();
    if (isFirstAttempt) {
        markSchedulerOutcome(false);
    }

    componentInlineFeedback = {
        message: `✗ Correct: ${currentMissingComponent.char} (${currentMissingComponent.pinyin})`,
        type: 'incorrect'
    };

    updateStats();

    // Clear input and re-render
    if (componentInputEl) {
        componentInputEl.value = '';
        setTimeout(() => componentInputEl.focus(), 0);
    }

    renderThreeColumnComponentLayout();
    generateComponentOptions();
    feedback.textContent = '';
    hint.textContent = '';
}

// =============================================================================
// CHARACTER BUILDING QUIZ MODE
// =============================================================================

let charBuildingMode = null;
let charBuildingWordChars = []; // array of { char, decomp } for all decomposable chars in word
let charBuildingCharIndex = 0; // which character in the word we're building
let charBuildingDecomposition = null; // current character's { char, data, components }
let charBuildingCompletedComponents = []; // indices of completed components for current char
let charBuildingCurrentIndex = 0; // which component we're asking for in current char
let charBuildingAllOptions = [];
let charBuildingInputEl = null;
let charBuildingFilteredOptions = []; // currently visible filtered options

// Three-column layout state for char-building mode
let charBuildingPreviousQuestion = null; // { question, wordChars }
let charBuildingPreviousResult = null; // 'correct' or 'incorrect'
let charBuildingUpcomingQuestion = null; // { question, wordChars }
let charBuildingInlineFeedback = null; // { message, type: 'correct'|'incorrect' }

// Prepare a question for character building mode - finds ALL decomposable chars in word
function prepareCharBuildingQuestion(exclusions = []) {
    let attempts = 0;
    let question = null;
    let wordChars = [];

    while (wordChars.length === 0 && attempts < 100) {
        question = selectNextQuestion(exclusions);
        if (!question) break;

        const chars = Array.from(question.char);
        wordChars = [];

        for (const c of chars) {
            const decomp = CHARACTER_DECOMPOSITIONS[c];
            if (decomp && decomp.components && decomp.matches && decomp.components.length >= 2) {
                wordChars.push({
                    char: c,
                    decomp: decomp
                });
            }
        }

        // Need at least one decomposable character
        if (wordChars.length === 0) {
            attempts++;
            continue;
        }
        break;
    }

    if (wordChars.length === 0 || !question) return null;

    return {
        question: question,
        wordChars: wordChars
    };
}

// Render partial character showing only completed components for char building
async function renderCharBuildingPartial(container, char, completedIndices) {
    if (!container) return;

    const cacheKey = `${char}_build_${completedIndices.join(',')}`;
    if (partialCharacterCache[cacheKey]) {
        container.innerHTML = partialCharacterCache[cacheKey];
        return;
    }

    const decomp = CHARACTER_DECOMPOSITIONS[char];
    if (!decomp || !decomp.matches) {
        container.innerHTML = `<span class="text-8xl text-gray-300">?</span>`;
        return;
    }

    try {
        const charData = await HanziWriter.loadCharacterData(char);
        const strokes = charData.strokes;
        const matches = decomp.matches;

        // Build SVG showing only strokes belonging to completed components
        let strokePaths = '';
        for (let i = 0; i < strokes.length; i++) {
            const componentIndex = matches[i];
            if (completedIndices.includes(componentIndex)) {
                strokePaths += `<path d="${strokes[i]}" fill="#333"></path>`;
            }
            // Don't show any hint for incomplete strokes
        }

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="120" height="120">
                <g transform="scale(1,-1) translate(0,-900)">
                    ${strokePaths}
                </g>
            </svg>
        `;

        partialCharacterCache[cacheKey] = svg;
        container.innerHTML = svg;
    } catch (err) {
        console.warn('Error rendering char building partial:', err);
        container.innerHTML = `<span class="text-8xl text-gray-300">?</span>`;
    }
}

// Render three-column layout for character building mode
async function renderThreeColumnCharBuildingLayout() {
    if (!questionDisplay || !currentQuestion || !charBuildingDecomposition) return;

    // Prepare upcoming question if not already set
    if (!charBuildingUpcomingQuestion) {
        const exclusions = currentQuestion?.char ? [currentQuestion.char] : [];
        charBuildingUpcomingQuestion = prepareCharBuildingQuestion(exclusions);
    }

    const decomp = charBuildingDecomposition;
    const totalComponents = decomp.components.length;
    const totalChars = charBuildingWordChars.length;

    // === PREVIOUS COLUMN ===
    let prevContent = '';
    if (charBuildingPreviousQuestion) {
        const prev = charBuildingPreviousQuestion;
        const prevResultClass = charBuildingPreviousResult === 'correct' ? 'result-correct' :
                               charBuildingPreviousResult === 'incorrect' ? 'result-incorrect' : '';
        const prevResultIcon = charBuildingPreviousResult === 'correct' ? '✓' :
                               charBuildingPreviousResult === 'incorrect' ? '✗' : '•';
        const prevFeedbackText = charBuildingPreviousResult === 'correct' ? 'Got it right' :
                                 charBuildingPreviousResult === 'incorrect' ? 'Missed it' : '';
        prevContent = `
            <div class="column-previous column-card ${prevResultClass}">
                <div class="column-label">Previous</div>
                <div class="column-feedback">
                    <span class="column-result-icon">${prevResultIcon}</span>
                    <span class="column-feedback-text">${prevFeedbackText}</span>
                </div>
                <div class="column-char">${escapeHtml(prev.question.char)}</div>
                <div class="column-pinyin">${escapeHtml(prev.question.pinyin)}</div>
                <div class="column-meaning">${escapeHtml(prev.question.meaning)}</div>
            </div>`;
    } else {
        prevContent = `
            <div class="column-previous column-card">
                <div class="column-label">Previous</div>
                <div class="column-placeholder">Your last answer will appear here</div>
            </div>`;
    }

    // === CURRENT COLUMN ===
    // Build the word display with partial characters
    const fullWord = currentQuestion.char;
    let wordDisplay = '';
    let partialIds = [];

    for (let i = 0; i < fullWord.length; i++) {
        const char = fullWord[i];
        const wordCharIdx = charBuildingWordChars.findIndex(wc => wc.char === char);

        if (wordCharIdx === -1) {
            wordDisplay += `<span style="font-size: 4rem; color: #9ca3af;">${char}</span>`;
        } else if (wordCharIdx < charBuildingCharIndex) {
            wordDisplay += `<span style="font-size: 4rem; color: #16a34a;">${char}</span>`;
        } else if (wordCharIdx === charBuildingCharIndex) {
            wordDisplay += `<span id="charBuildingPartial" style="display: inline-block; width: 70px; height: 70px; vertical-align: middle;"></span>`;
            partialIds.push({ id: 'charBuildingPartial', char: char, completed: charBuildingCompletedComponents });
        } else {
            const futureId = `charBuildingFuture${wordCharIdx}`;
            wordDisplay += `<span id="${futureId}" style="display: inline-block; width: 70px; height: 70px; vertical-align: middle;"></span>`;
            partialIds.push({ id: futureId, char: char, completed: [] });
        }
    }

    // Component progress dots
    const componentDots = decomp.components.map((comp, i) => {
        if (charBuildingCompletedComponents.includes(i)) {
            return `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #16a34a; margin: 0 3px;"></span>`;
        } else if (i === charBuildingCurrentIndex) {
            return `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; margin: 0 3px; animation: pulse 1s infinite;"></span>`;
        } else {
            return `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #d1d5db; margin: 0 3px;"></span>`;
        }
    }).join('');

    // Character progress for multi-char words
    const charProgressHtml = totalChars > 1 ? `
        <div style="margin-bottom: 8px;">
            ${charBuildingWordChars.map((wc, i) => {
                const bg = i < charBuildingCharIndex ? '#16a34a' : i === charBuildingCharIndex ? '#3b82f6' : '#d1d5db';
                const ring = i === charBuildingCharIndex ? 'box-shadow: 0 0 0 2px #93c5fd;' : '';
                return `<span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${bg}; margin: 0 2px; ${ring}" title="${wc.char}"></span>`;
            }).join('')}
        </div>` : '';

    const inlineFeedbackHtml = charBuildingInlineFeedback ? `
        <div class="column-inline-feedback ${charBuildingInlineFeedback.type === 'incorrect' ? 'is-incorrect' : 'is-correct'}">
            ${escapeHtml(charBuildingInlineFeedback.message)}
        </div>` : '';

    const currentContent = `
        <div class="column-current column-card ${charBuildingInlineFeedback ? (charBuildingInlineFeedback.type === 'incorrect' ? 'has-error' : 'has-success') : ''}">
            <div class="column-label">Now</div>
            <div style="font-size: 1.1rem; color: #3b82f6; font-weight: 600;">${escapeHtml(currentQuestion.pinyin)}</div>
            <div style="font-size: 0.9rem; color: #6b7280; margin-bottom: 8px;">${escapeHtml(currentQuestion.meaning)}</div>
            <div class="column-focus-ring" style="min-height: 70px; display: flex; align-items: center; justify-content: center; gap: 2px;">
                ${wordDisplay}
            </div>
            ${charProgressHtml}
            <div style="margin: 8px 0;">${componentDots}</div>
            <div style="font-size: 0.85rem; color: #6b7280;">
                ${totalChars > 1 ? `Char ${charBuildingCharIndex + 1}/${totalChars} · ` : ''}Component ${charBuildingCurrentIndex + 1}/${totalComponents}
            </div>
            ${inlineFeedbackHtml}
        </div>`;

    // === UPCOMING COLUMN ===
    let upcomingContent = '';
    if (charBuildingUpcomingQuestion) {
        const up = charBuildingUpcomingQuestion;
        upcomingContent = `
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                <div class="column-ondeck">
                    <div style="font-size: 2rem; color: #9ca3af;">${escapeHtml(up.question.char)}</div>
                    <div style="font-size: 0.85rem; color: #9ca3af; margin-top: 4px;">${escapeHtml(up.question.pinyin)}</div>
                    <div class="ondeck-note">On deck</div>
                </div>
            </div>`;
    } else {
        upcomingContent = `
            <div class="column-upcoming column-card">
                <div class="column-label">Upcoming</div>
                <div class="column-placeholder">Next word loading</div>
            </div>`;
    }

    questionDisplay.innerHTML = `
        <div class="three-column-meaning-layout">
            ${prevContent}
            ${currentContent}
            ${upcomingContent}
        </div>
    `;

    // Render partial characters asynchronously
    for (const p of partialIds) {
        const el = document.getElementById(p.id);
        if (el) {
            await renderCharBuildingPartial(el, p.char, p.completed);
        }
    }
}

// Generate options for character building mode
function generateCharBuildingOptions() {
    if (!charBuildingMode) return;

    const optionsContainer = document.getElementById('charBuildingOptions');
    if (!optionsContainer) return;

    const decomp = charBuildingDecomposition;
    if (!decomp) return;

    const correctComponent = decomp.components[charBuildingCurrentIndex];
    const allRadicals = CHARACTER_DECOMPOSITIONS['_radicals'] || [];

    // Build options: correct answer + distractors
    let options = [correctComponent];

    // Add other components from the same character as distractors (if not already completed)
    for (let i = 0; i < decomp.components.length; i++) {
        if (i !== charBuildingCurrentIndex && !charBuildingCompletedComponents.includes(i)) {
            const comp = decomp.components[i];
            if (!options.some(o => o.char === comp.char)) {
                options.push(comp);
            }
        }
    }

    // Add random radicals as additional distractors
    const shuffledRadicals = [...allRadicals].sort(() => Math.random() - 0.5);
    for (const radical of shuffledRadicals) {
        if (options.length >= 4) break;
        if (!options.some(o => o.char === radical.char)) {
            options.push(radical);
        }
    }

    // Shuffle options
    options = options.sort(() => Math.random() - 0.5);
    charBuildingAllOptions = options;
    charBuildingFilteredOptions = options; // Initially all options are visible

    // Setup input element
    charBuildingInputEl = document.getElementById('charBuildingInput');
    if (charBuildingInputEl) {
        charBuildingInputEl.value = '';
        charBuildingInputEl.oninput = () => filterCharBuildingOptions();
        // Add Enter key handler
        charBuildingInputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Select first visible option
                if (charBuildingFilteredOptions.length > 0) {
                    checkCharBuildingAnswer(charBuildingFilteredOptions[0]);
                }
            }
        };
        setTimeout(() => charBuildingInputEl.focus(), 50);
    }

    // Render option buttons
    renderCharBuildingOptionButtons(options);
}

function renderCharBuildingOptionButtons(options) {
    const optionsContainer = document.getElementById('charBuildingOptions');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = '';

    for (const option of options) {
        const btn = document.createElement('button');
        btn.className = 'char-building-option px-4 py-3 text-left rounded-lg border-2 border-gray-300 hover:bg-gray-100 transition flex items-center gap-3';
        btn.innerHTML = `
            <span class="text-3xl">${escapeHtml(option.char)}</span>
            <span class="text-gray-600">${escapeHtml(option.pinyin)} - ${escapeHtml(option.meaning)}</span>
        `;
        btn.onclick = () => checkCharBuildingAnswer(option);
        optionsContainer.appendChild(btn);
    }
}

function filterCharBuildingOptions() {
    if (!charBuildingInputEl) return;

    const query = charBuildingInputEl.value.trim().toLowerCase();
    if (!query) {
        charBuildingFilteredOptions = charBuildingAllOptions;
        renderCharBuildingOptionButtons(charBuildingAllOptions);
        return;
    }

    // Normalize pinyin for comparison (remove tones)
    const toneMap = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
        'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v', 'ü': 'v'
    };
    const normalizePinyin = (s) => {
        return s.toLowerCase().split('').map(c => toneMap[c] || c).join('');
    };

    const normalizedQuery = normalizePinyin(query);

    const filtered = charBuildingAllOptions.filter(opt => {
        const normalizedPinyin = normalizePinyin(opt.pinyin);
        // Match if query matches start of pinyin OR exact match OR meaning contains query
        return normalizedPinyin.startsWith(normalizedQuery) ||
               normalizedPinyin === normalizedQuery ||
               opt.char.includes(query) ||
               opt.meaning.toLowerCase().includes(query);
    });

    charBuildingFilteredOptions = filtered.length > 0 ? filtered : charBuildingAllOptions;
    renderCharBuildingOptionButtons(charBuildingFilteredOptions);
}

function checkCharBuildingAnswer(selectedOption) {
    const decomp = charBuildingDecomposition;
    if (!decomp) return;

    const correctComponent = decomp.components[charBuildingCurrentIndex];
    const isCorrect = selectedOption.char === correctComponent.char;

    const isFirstAttempt = !questionAttemptRecorded;
    if (isFirstAttempt) {
        total++;
        questionAttemptRecorded = true;
    }

    if (isCorrect) {
        playCorrectSound();

        // Mark this component as completed
        charBuildingCompletedComponents.push(charBuildingCurrentIndex);

        // Check if all components of current character are done
        if (charBuildingCompletedComponents.length >= decomp.components.length) {
            // Current character complete!

            // Check if there are more characters in the word to build
            if (charBuildingCharIndex < charBuildingWordChars.length - 1) {
                // Move to next character in the word - INSTANT
                charBuildingCharIndex++;
                charBuildingCompletedComponents = [];
                charBuildingCurrentIndex = 0;
                charBuildingInlineFeedback = null;
                // Set up the new character's decomposition
                const nextChar = charBuildingWordChars[charBuildingCharIndex];
                charBuildingDecomposition = {
                    char: nextChar.char,
                    data: nextChar.decomp,
                    components: nextChar.decomp.components
                };
                renderThreeColumnCharBuildingLayout();
                generateCharBuildingOptions();
            } else {
                // All characters in word complete! Move to next word - INSTANT
                if (isFirstAttempt) {
                    score++;
                    markSchedulerOutcome(true);
                }
                updateStats();

                // Save current as previous
                charBuildingPreviousQuestion = {
                    question: currentQuestion,
                    wordChars: charBuildingWordChars
                };
                charBuildingPreviousResult = 'correct';

                // Move upcoming to current
                if (charBuildingUpcomingQuestion) {
                    currentQuestion = charBuildingUpcomingQuestion.question;
                    window.currentQuestion = currentQuestion;
                    charBuildingWordChars = charBuildingUpcomingQuestion.wordChars;
                    charBuildingUpcomingQuestion = null;
                } else {
                    const prepared = prepareCharBuildingQuestion();
                    if (prepared) {
                        currentQuestion = prepared.question;
                        window.currentQuestion = currentQuestion;
                        charBuildingWordChars = prepared.wordChars;
                    }
                }

                // Reset for new word
                charBuildingCharIndex = 0;
                charBuildingCompletedComponents = [];
                charBuildingCurrentIndex = 0;
                charBuildingInlineFeedback = null;
                answered = false;
                questionAttemptRecorded = false;

                // Set up first character's decomposition
                if (charBuildingWordChars.length > 0) {
                    const firstChar = charBuildingWordChars[0];
                    charBuildingDecomposition = {
                        char: firstChar.char,
                        data: firstChar.decomp,
                        components: firstChar.decomp.components
                    };
                }

                markSchedulerServed(currentQuestion);
                updateCurrentWordConfidence();
                renderThreeColumnCharBuildingLayout();
                generateCharBuildingOptions();
                feedback.textContent = '';
                hint.textContent = '';
            }
        } else {
            // Move to next component of current character - INSTANT
            charBuildingCurrentIndex++;
            charBuildingInlineFeedback = null;
            renderThreeColumnCharBuildingLayout();
            generateCharBuildingOptions();
        }
    } else {
        // Incorrect answer
        playWrongSound();
        if (isFirstAttempt) {
            markSchedulerOutcome(false);
        }
        updateStats();

        // Show inline feedback
        charBuildingInlineFeedback = {
            message: `✗ ${selectedOption.char} (${selectedOption.pinyin}) - try again`,
            type: 'incorrect'
        };
        renderThreeColumnCharBuildingLayout();
        generateCharBuildingOptions();
    }

    // Clear and refocus input
    if (charBuildingInputEl) {
        charBuildingInputEl.value = '';
        charBuildingFilteredOptions = charBuildingAllOptions;
        charBuildingInputEl.focus();
    }
}

// =============================================================================
// COMMAND PALETTE SETUP FOR QUIZ PAGES
// =============================================================================

let quizHotkeysRegistered = false;

function getCurrentPromptText() {
    const question = window.currentQuestion;
    const activeMode = window.mode;
    if (!question) return '';

    const asString = (value) => {
        if (typeof value === 'string') return value.trim();
        if (value === null || value === undefined) return '';
        return String(value).trim();
    };

    const firstFromList = (value) => {
        const text = asString(value);
        if (!text) return '';
        return text.split('/')[0].trim();
    };

    switch (activeMode) {
        case 'pinyin-to-char':
            return firstFromList(question.pinyin);
        case 'meaning-to-char':
            return asString(question.meaning);
        case 'char-to-pinyin':
        case 'char-to-pinyin-mc':
        case 'char-to-pinyin-tones-mc':
        case 'char-to-tones':
        case 'char-to-meaning':
        case 'char-to-meaning-type':
        case 'stroke-order':
        case 'handwriting':
        case 'draw-char':
            return asString(question.char);
        case 'audio-to-pinyin':
        case 'audio-to-meaning':
        case 'dictation-chat':
            return asString(question.char) || firstFromList(question.pinyin);
        default:
            break;
    }

    return asString(question.char) || firstFromList(question.pinyin) || asString(question.meaning);
}

function copyToClipboard(text) {
    if (!text) return;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.warn('Copy to clipboard failed', err);
    }
    document.body.removeChild(textarea);
}

function getActiveInputField() {
    if ((mode === 'char-to-meaning-type' || mode === 'char-to-pinyin-type') && fuzzyInput && isElementReallyVisible(fuzzyInput)) {
        return fuzzyInput;
    }
    if (answerInput && isElementReallyVisible(answerInput)) {
        return answerInput;
    }
    if (fuzzyInput && isElementReallyVisible(fuzzyInput)) {
        return fuzzyInput;
    }
    if (mode === 'dictation-chat' && dictationChatInputEl && isElementReallyVisible(dictationChatInputEl)) {
        return dictationChatInputEl;
    }
    return null;
}

function isElementReallyVisible(el) {
    if (!el) return false;
    if (typeof el.offsetParent !== 'undefined' && el.offsetParent !== null) return true;
    if (typeof el.getClientRects === 'function' && el.getClientRects().length > 0) return true;
    return false;
}

function focusInputElement(el) {
    if (!el) return;
    try {
        if (typeof el.focus === 'function') {
            el.focus({ preventScroll: false });
        }
    } catch (err) {
        console.warn('Failed to focus element', err);
    }

    if (typeof el.select === 'function') {
        try {
            el.select();
        } catch (err) {
            // Some inputs may not support select; ignore.
        }
    } else if (el.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection && window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    return Boolean(el.isContentEditable);
}

function isCommandPaletteOpen() {
    const palette = document.getElementById('commandPalette');
    return Boolean(palette && palette.style.display !== 'none');
}

function handleQuizHotkeys(e) {
    if (isCommandPaletteOpen()) return;

    const target = e.target;
    const copyComboActive = e.altKey && !e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c';
    const focusInputCombo = !e.shiftKey && !e.altKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';

    if (focusInputCombo) {
        e.preventDefault();
        const input = getActiveInputField();
        if (input) {
            focusInputElement(input);
        }
        return;
    }

    // Ctrl+Enter: Give up and show answer
    const giveUpCombo = !e.altKey && !e.shiftKey && (e.ctrlKey || e.metaKey) && e.key === 'Enter';
    if (giveUpCombo) {
        e.preventDefault();
        if (mode === 'dictation-chat') {
            requestDictationChatNext({ allowSkip: true });
        } else {
            giveUpAndShowAnswer();
        }
        return;
    }

    if (mode === 'dictation-chat' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'n') {
        if (isTypingTarget(target)) return;
        e.preventDefault();
        requestDictationChatNext();
        return;
    }

    // Ctrl+H: Focus quiz (vim left) / close chat if open
    if (!e.altKey && !e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (chatPanelVisible) {
            setChatPanelVisible(false);
        }
        focusQuizInput();
        return;
    }

    // Ctrl+L: Focus chat (vim right) / open chat panel
    if (!e.altKey && !e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (chatPanelVisible) {
            focusChatInput();
        } else {
            setChatPanelVisible(true);
        }
        return;
    }

    // Char-to-tones mode: number keys 1-5 select tone directly
    if (mode === 'char-to-tones' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (isTypingTarget(target)) return;
        if (/^[1-5]$/.test(e.key)) {
            e.preventDefault();
            handleToneChoice(e.key);
            return;
        }
    }

    // Handwriting mode: after answer shown, space = correct, any other key = wrong
    if (mode === 'handwriting' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (isTypingTarget(target)) return;

        if (e.key === ' ') {
            e.preventDefault();
            if (!handwritingAnswerShown) {
                // First space: show the answer
                if (window.handwritingShowAnswer) {
                    window.handwritingShowAnswer();
                }
            } else {
                // Space after answer shown = correct
                handleHandwritingResult(true);
            }
            return;
        } else if (handwritingAnswerShown && e.key.length === 1) {
            // Any other key after answer shown = wrong
            e.preventDefault();
            handleHandwritingResult(false);
            return;
        }
    }

    if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'Enter' && answered && lastAnswerCorrect) {
        if (target === answerInput || target === fuzzyInput) {
            // Input handlers will manage this case
        } else {
            e.preventDefault();
            goToNextQuestionAfterCorrect();
            return;
        }
    }

    if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === '/') {
        if (isTypingTarget(target)) return;
        if (target && typeof target.closest === 'function' && target.closest('#commandPalette')) return;
        const input = getActiveInputField();
        if (input) {
            e.preventDefault();
            focusInputElement(input);
        }
        return;
    }

    // Word marking keybinds: [ = needs work, ] = learned, \ = unmark
    if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (isTypingTarget(target)) {
            // Skip if in input field
        } else if (e.key === '[' && currentQuestion?.char) {
            e.preventDefault();
            markWord(currentQuestion.char, 'needs-work');
            showMarkingToast(`"${currentQuestion.char}" marked as needs work`, 'warning');
            return;
        } else if (e.key === ']' && currentQuestion?.char) {
            e.preventDefault();
            markWord(currentQuestion.char, 'learned');
            showMarkingToast(`"${currentQuestion.char}" marked as learned`, 'success');
            return;
        } else if (e.key === '\\' && currentQuestion?.char) {
            e.preventDefault();
            markWord(currentQuestion.char, null);
            showMarkingToast(`"${currentQuestion.char}" unmarked`, 'info');
            return;
        }
    }

    if (copyComboActive) {
        e.preventDefault();
        const prompt = getCurrentPromptText();
        if (prompt) {
            copyToClipboard(prompt);
        }
    }
}

function registerQuizHotkeys() {
    if (quizHotkeysRegistered) return;
    quizHotkeysRegistered = true;
    document.addEventListener('keydown', handleQuizHotkeys);
    document.addEventListener('keyup', handleQuizKeyup);
}

function handleQuizKeyup(e) {
    // Currently unused, but keeping for potential future use
}

function handleHandwritingResult(correct) {
    if (!currentQuestion) return;

    if (correct) {
        // Play correct sound and word audio
        playCorrectSound();
        if (currentQuestion.pinyin && typeof playPinyinAudio === 'function') {
            const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
            setTimeout(() => playPinyinAudio(firstPinyin, currentQuestion.char), 200);
        }
        // Record correct answer
        updateBKT(currentQuestion.char, true);
    } else {
        // Play wrong sound
        playWrongSound();
        // Record wrong answer
        updateBKT(currentQuestion.char, false);
    }

    // Go to next question
    generateQuestion();
}

function updateHandwritingSpaceHint(holding) {
    const hint = document.getElementById('hwSpaceHint');
    if (!hint) return;

    if (handwritingAnswerShown) {
        hint.innerHTML = `
            <div class="inline-flex items-center gap-3 px-6 py-3 bg-green-50 rounded-full border border-green-200">
                <kbd class="px-3 py-1.5 bg-white border border-green-300 rounded-md shadow-sm text-sm font-mono">Space</kbd>
                <span class="text-green-700">= ✓ correct</span>
                <span class="text-gray-400 mx-1">|</span>
                <span class="text-red-600">Any other key = ✗ wrong</span>
            </div>
        `;
    } else {
        hint.innerHTML = `
            <div class="inline-flex items-center gap-3 px-6 py-3 bg-gray-100 rounded-full">
                <kbd class="px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-mono">Space</kbd>
                <span class="text-gray-600">Press to reveal</span>
            </div>
        `;
    }
}

function initQuizCommandPalette() {
    const defaultModes = [
        { name: 'Char → Pinyin', mode: 'char-to-pinyin', type: 'mode' },
        { name: 'Char → Pinyin (MC)', mode: 'char-to-pinyin-type', type: 'mode' },
        { name: 'Char → Pinyin → Tones (MC)', mode: 'char-to-pinyin-tones-mc', type: 'mode' },
        { name: 'Char → Tones', mode: 'char-to-tones', type: 'mode' },
        { name: 'Audio → Pinyin', mode: 'audio-to-pinyin', type: 'mode' },
        { name: 'Audio → Meaning', mode: 'audio-to-meaning', type: 'mode' },
        { name: 'Dictation Chat', mode: 'dictation-chat', type: 'mode' },
        { name: 'Pinyin → Char', mode: 'pinyin-to-char', type: 'mode' },
        { name: 'Char → Meaning', mode: 'char-to-meaning', type: 'mode' },
        { name: 'Char → Meaning (Fuzzy)', mode: 'char-to-meaning-type', type: 'mode' },
        { name: 'Meaning → Char', mode: 'meaning-to-char', type: 'mode' },
        { name: 'Stroke Order', mode: 'stroke-order', type: 'mode' },
        { name: 'Handwriting', mode: 'handwriting', type: 'mode' },
        { name: 'Draw Character', mode: 'draw-char', type: 'mode' },
        { name: 'Draw Missing Component', mode: 'draw-missing-component', type: 'mode' },
        { name: 'Composer (auto progression)', mode: 'composer', type: 'mode' },
        { name: 'Study Mode', mode: 'study', type: 'mode' }
    ];

    const availableModeButtons = Array.from(document.querySelectorAll('.mode-btn[data-mode]'));
    const availableModes = new Set(availableModeButtons.map(btn => btn.dataset.mode));

    const filteredDefaults = defaultModes.filter(item => availableModes.has(item.mode));
    const rawItems = Array.isArray(config?.commandPaletteItems) && config.commandPaletteItems.length
        ? config.commandPaletteItems
        : filteredDefaults;
    const paletteItems = rawItems.filter(item => !item.mode || availableModes.has(item.mode));
    const finalModes = paletteItems.length ? paletteItems : filteredDefaults;

    if (typeof initCommandPalette === 'function') {
        initCommandPalette({
            modes: finalModes,
            actions: getQuizPaletteActions(),
            searchPlaceholder: 'Search quiz modes, commands, or pages…'
        });
    }

    function getQuizPaletteActions() {
        const actions = [];

        if (previewElement && config.enablePreviewQueue) {
            actions.push({
                name: previewQueueEnabled ? 'Hide Upcoming Characters' : 'Show Upcoming Characters',
                type: 'action',
                description: previewQueueEnabled
                    ? 'Turn off the upcoming character preview queue'
                    : 'Display the next few characters in the queue',
                keywords: 'preview upcoming queue characters toggle',
                action: () => {
                    togglePreviewQueue();
                },
                available: () => Boolean(previewElement),
                scope: 'This page only'
            });
        }

        actions.push({
            name: 'Toggle Tab Tone Cycling',
            type: 'action',
            description: 'Enable or disable Tab/Shift+Tab tone selection for single-syllable input',
            keywords: 'tone tab cycling pinyin toggle shift',
            action: () => {
                toggleToneCycler();
            },
            available: () => Boolean(answerInput),
            scope: 'Typing modes'
        });

        actions.push({
            name: 'Toggle Component Hints',
            type: 'action',
            description: 'Show or hide radical/phonetic breakdowns for the current quiz',
            keywords: 'component breakdown hint radical phonetic toggle',
            action: () => {
                toggleComponentBreakdownVisibility();
            },
            available: () => Boolean(componentBreakdown || document.querySelector('.meaning-question-layout')),
            scope: 'This page only'
        });

        actions.push({
            name: 'Next Quiz Mode',
            type: 'action',
            description: 'Cycle forward through the available quiz modes',
            keywords: 'mode next cycle forward',
            action: () => cycleQuizMode(1),
            available: () => document.querySelectorAll('.mode-btn').length > 1,
            scope: 'This page only'
        });

        actions.push({
            name: 'Previous Quiz Mode',
            type: 'action',
            description: 'Go back to the previous quiz mode',
            keywords: 'mode previous back cycle',
            action: () => cycleQuizMode(-1),
            available: () => document.querySelectorAll('.mode-btn').length > 1,
            scope: 'This page only'
        });

        actions.push({
            name: 'Copy Current Character',
            type: 'action',
            description: 'Copy the current prompt character to the clipboard',
            keywords: 'copy clipboard character prompt',
            action: () => {
                if (window.currentQuestion?.char) {
                    copyToClipboard(window.currentQuestion.char);
                }
            },
            available: () => Boolean(window.currentQuestion?.char),
            scope: 'This page only'
        });

        actions.push({
            name: 'Copy Character + Pinyin',
            type: 'action',
            description: 'Copy the current prompt with pinyin for sharing',
            keywords: 'copy clipboard pinyin prompt',
            action: () => {
                if (window.currentQuestion?.char && window.currentQuestion?.pinyin) {
                    copyToClipboard(`${window.currentQuestion.char} – ${window.currentQuestion.pinyin}`);
                }
            },
            available: () => Boolean(window.currentQuestion?.char && window.currentQuestion?.pinyin),
            scope: 'This page only'
        });

        actions.push({
            name: 'Copy Prompt Text',
            type: 'action',
            description: 'Copy the current question prompt to the clipboard',
            keywords: 'copy prompt question clipboard word text',
            shortcut: 'Ctrl+Alt+C',
            action: () => {
                const prompt = getCurrentPromptText();
                if (prompt) {
                    copyToClipboard(prompt);
                }
            },
            available: () => Boolean(getCurrentPromptText()),
            scope: 'This page only'
        });

        actions.push({
            name: 'Play Character Audio',
            type: 'action',
            description: 'Hear the pronunciation for the current prompt',
            keywords: 'audio play pronunciation sound',
            action: () => {
                if (window.currentQuestion?.pinyin && typeof window.playPinyinAudio === 'function') {
                    const firstPinyin = window.currentQuestion.pinyin.split('/')[0].trim();
                    window.playPinyinAudio(firstPinyin, window.currentQuestion.char);
                }
            },
            available: () => Boolean(window.currentQuestion?.pinyin) && typeof window.playPinyinAudio === 'function',
            scope: 'This page only'
        });

        actions.push({
            name: timerEnabled ? 'Disable Answer Timer' : 'Enable Answer Timer',
            type: 'action',
            description: timerEnabled
                ? 'Turn off the countdown timer for questions'
                : 'Add a time limit for answering each question',
            keywords: 'timer countdown time limit enable disable toggle',
            action: () => {
                setTimerEnabled(!timerEnabled);
            }
        });

        actions.push({
            name: 'Set Timer Duration',
            type: 'action',
            description: `Current: ${timerSeconds}s. Change how many seconds you have to answer`,
            keywords: 'timer duration seconds time limit set change',
            action: () => {
                const input = prompt(`Enter timer duration in seconds (currently ${timerSeconds}s):`, String(timerSeconds));
                if (input !== null && input.trim() !== '') {
                    const seconds = parseInt(input.trim(), 10);
                    if (Number.isFinite(seconds) && seconds > 0) {
                        setTimerSeconds(seconds);
                    } else {
                        alert('Please enter a valid positive number of seconds.');
                    }
                }
            }
        });

        actions.push({
            name: hideMeaningChoices ? 'Show Char → Meaning Choices' : 'Hide Char → Meaning Choices',
            type: 'action',
            description: hideMeaningChoices
                ? 'Reveal multiple-choice answers for Char → Meaning questions'
                : 'Hide the multiple-choice answers so you have to recall without options',
            keywords: 'meaning choices hide show toggle multiple choice answers conceal options',
            action: () => toggleHideMeaningChoices(),
            available: () => true
        });

        actions.push({
            name: 'Reset Current Mode Stats',
            type: 'action',
            description: `Clear confidence data for "${getCurrentSkillKey()}" mode on this page`,
            keywords: 'reset clear confidence stats mode data progress',
            action: () => {
                const skillKey = getCurrentSkillKey();
                if (!confirm(`Reset all "${skillKey}" confidence data for this lesson? This cannot be undone.`)) return;

                let count = 0;
                for (const key of Object.keys(schedulerStats)) {
                    if (key.endsWith(`::${skillKey}`)) {
                        delete schedulerStats[key];
                        count++;
                    }
                }
                saveSchedulerStats();
                if (typeof renderConfidenceList === 'function') renderConfidenceList();
                alert(`Reset ${count} "${skillKey}" entries.`);
            },
            available: () => Object.keys(schedulerStats).length > 0
        });

        actions.push({
            name: 'Reset All Lesson Stats',
            type: 'action',
            description: 'Clear ALL confidence data for this lesson (all modes)',
            keywords: 'reset clear confidence stats lesson data progress all',
            action: () => {
                if (!confirm('Reset ALL confidence data for this lesson? This cannot be undone.')) return;

                const count = Object.keys(schedulerStats).length;
                schedulerStats = {};
                saveSchedulerStats();
                if (typeof renderConfidenceList === 'function') renderConfidenceList();
                alert(`Reset ${count} entries for this lesson.`);
            },
            available: () => Object.keys(schedulerStats).length > 0
        });

        // Confidence panel visibility controls
        actions.push({
            name: confidencePanelVisible ? 'Hide Confidence Tracker' : 'Show Confidence Tracker',
            type: 'action',
            description: confidencePanelVisible
                ? 'Collapse the live confidence sidebar panel'
                : 'Show the live confidence sidebar panel',
            keywords: 'confidence tracker sidebar panel hide show live stats',
            action: () => {
                ensureConfidencePanel();
                setConfidencePanelVisible(!confidencePanelVisible);
            },
            available: () => true,
            scope: 'This page only'
        });

        // Explicit show/hide commands for voice/keyboard users
        actions.push({
            name: 'Show Confidence Tracker',
            type: 'action',
            description: 'Show the live confidence sidebar panel',
            keywords: 'confidence tracker sidebar panel show live stats',
            action: () => {
                ensureConfidencePanel();
                setConfidencePanelVisible(true);
            },
            available: () => !confidencePanelVisible,
            scope: 'This page only'
        });

        actions.push({
            name: 'Hide Confidence Tracker',
            type: 'action',
            description: 'Hide the live confidence sidebar panel',
            keywords: 'confidence tracker sidebar panel hide collapse live stats',
            action: () => {
                ensureConfidencePanel();
                setConfidencePanelVisible(false);
            },
            available: () => confidencePanelVisible,
            scope: 'This page only'
        });

        // Confidence formula switching
        actions.push({
            name: 'Confidence: Use BKT (Bayesian)',
            type: 'action',
            description: 'Switch to Bayesian Knowledge Tracing - models learning probability (0-1 scale, 0.95 = mastered)',
            keywords: 'confidence formula bkt bayesian knowledge tracing learning probability mastery',
            action: () => setConfidenceFormula(CONFIDENCE_FORMULAS.BKT),
            available: () => confidenceFormula !== CONFIDENCE_FORMULAS.BKT,
            scope: 'This page only'
        });
        actions.push({
            name: 'Confidence: Use Heuristic (Original)',
            type: 'action',
            description: 'Switch to original ad-hoc formula - accuracy + streaks + recency bonus',
            keywords: 'confidence formula heuristic original accuracy streak recency',
            action: () => setConfidenceFormula(CONFIDENCE_FORMULAS.HEURISTIC),
            available: () => confidenceFormula !== CONFIDENCE_FORMULAS.HEURISTIC,
            scope: 'This page only'
        });
        actions.push({
            name: 'Reset BKT Scores',
            type: 'action',
            description: 'Reset all Bayesian Knowledge Tracing probabilities to 0 (start fresh)',
            keywords: 'reset bkt bayesian knowledge tracing clear probability learning',
            action: () => {
                resetAllBKT();
            },
            available: () => true,
            scope: 'This page only'
        });

        // Scheduler actions
        actions.push({
            name: 'Next Item: Random',
            type: 'action',
            description: 'Use pure shuffle ordering for upcoming questions',
            keywords: 'random order shuffle next item scheduler',
            action: () => setSchedulerMode(SCHEDULER_MODES.RANDOM)
        });
        actions.push({
            name: 'Next Item: Confidence-weighted',
            type: 'action',
            description: 'Recency + mistakes weighting for adaptive selection',
            keywords: 'confidence weighted sampler adaptive scheduler',
            action: () => setSchedulerMode(SCHEDULER_MODES.WEIGHTED)
        });
        actions.push({
            name: 'Next Item: Adaptive 5-Card Flow',
            type: 'action',
            description: 'Rolling 5-card lane; graduate strong cards, keep strugglers in place.',
            keywords: 'adaptive five card rolling sticky graduate confidence lane',
            action: () => setSchedulerMode(SCHEDULER_MODES.ADAPTIVE_5)
        });
        actions.push({
            name: 'Next Item: 5-Card Batches',
            type: 'action',
            description: 'Work one random batch of 5 until mastered, then auto-rotate',
            keywords: 'batch mode five cards grouped rotation mastery subset',
            action: () => setSchedulerMode(SCHEDULER_MODES.BATCH_5)
        });
        actions.push({
            name: 'Next Item: 2-Card Batches',
            type: 'action',
            description: 'Work one random batch of 2 until mastered, then auto-rotate',
            keywords: 'batch mode two cards grouped rotation mastery subset pair',
            action: () => setSchedulerMode(SCHEDULER_MODES.BATCH_2)
        });
        actions.push({
            name: 'Next Set (Batch Mode)',
            type: 'action',
            description: 'Skip the current batch and load a fresh set immediately',
            keywords: 'batch next set new cards skip group rotate',
            action: () => advanceBatchSetNow(),
            available: () => isBatchMode(),
            scope: 'Batch modes only'
        });
        actions.push({
            name: 'Refresh Adaptive Deck (5-card)',
            type: 'action',
            description: 'Re-evaluate graduation, refill the 5-card lane now.',
            keywords: 'adaptive refresh five card lane swap graduate',
            action: () => refreshAdaptiveDeckNow(true),
            available: () => schedulerMode === SCHEDULER_MODES.ADAPTIVE_5,
            scope: 'Adaptive 5 only'
        });
        actions.push({
            name: 'Next Item: In Order',
            type: 'action',
            description: 'Cycle through the current pool in order and wrap',
            keywords: 'in order sequential fixed order list scheduler',
            action: () => setSchedulerMode(SCHEDULER_MODES.ORDERED)
        });
        actions.push({
            name: 'Next Item: Feed Mode',
            type: 'action',
            description: 'Explore/exploit MAB-based adaptive learning with flexible hand size',
            keywords: 'feed mode explore exploit mab bandit adaptive learning ucb',
            action: () => setSchedulerMode(SCHEDULER_MODES.FEED)
        });
        actions.push({
            name: 'Next Item: Feed Graduate Mode',
            type: 'action',
            description: 'Feed mode with graduation - cards leave hand when confidence is high enough',
            keywords: 'feed graduate mode explore exploit mab bandit adaptive learning ucb graduation confidence mastery',
            action: () => setSchedulerMode(SCHEDULER_MODES.FEED_SR)
        });
        actions.push({
            name: 'Reset Feed Mode',
            type: 'action',
            description: 'Clear all Feed Mode progress and start fresh',
            keywords: 'feed reset clear mab bandit hand',
            action: () => {
                resetFeedState();
                prepareFeedForNextQuestion();
            },
            available: () => schedulerMode === SCHEDULER_MODES.FEED || schedulerMode === SCHEDULER_MODES.FEED_SR,
            scope: 'Feed mode only'
        });

        // Chat panel toggle
        actions.push({
            name: chatPanelVisible ? 'Close Chat' : 'Open Chat',
            type: 'action',
            description: chatPanelVisible
                ? 'Close the quiz chat panel (Ctrl+H)'
                : 'Open chat to ask questions about the current quiz (Ctrl+L)',
            keywords: 'chat ask question help tutor assistant open close toggle',
            action: toggleChatPanel,
            available: () => true,
            scope: 'This page only'
        });

        // Timer controls
        actions.push({
            name: timerEnabled ? 'Disable Timer' : 'Enable Timer',
            type: 'action',
            description: timerEnabled
                ? 'Turn off the auto-submit timer'
                : `Enable auto-submit timer (${timerSeconds} seconds)`,
            keywords: 'timer auto submit countdown enable disable toggle',
            action: () => {
                timerEnabled = !timerEnabled;
                saveTimerSettings();
                updateTimerDisplay();
                if (timerEnabled && !answered) {
                    startTimer();
                } else {
                    stopTimer();
                }
            },
            available: () => true,
            scope: 'All pages'
        });

        actions.push({
            name: 'Set Timer Duration',
            type: 'action',
            description: `Change the auto-submit timer duration (currently ${timerSeconds}s)`,
            keywords: 'timer duration seconds time limit set configure',
            action: () => {
                const input = prompt(`Enter timer duration in seconds (current: ${timerSeconds}):`, timerSeconds.toString());
                if (input) {
                    const val = parseInt(input, 10);
                    if (val > 0 && val <= 300) {
                        timerSeconds = val;
                        saveTimerSettings();
                        updateTimerDisplay();
                    }
                }
            },
            available: () => true,
            scope: 'All pages'
        });

        return actions;
    }

    function cycleQuizMode(direction) {
        const buttons = Array.from(document.querySelectorAll('.mode-btn'));
        if (!buttons.length) return;
        const activeIndex = buttons.findIndex(btn => btn.classList.contains('active'));
        const currentIndex = activeIndex >= 0 ? activeIndex : 0;
        const targetIndex = (currentIndex + direction + buttons.length) % buttons.length;
        const target = buttons[targetIndex];
        if (target) {
            target.click();
        }
    }

}

// =============================================================================
// INITIALIZATION
// =============================================================================

function initQuizRuntime() {
    // Reserve Ctrl/Cmd+K for focusing the quiz input instead of the command palette
    window.__preferCtrlKForQuiz = true;

    // Upgrade pre-Lesson 7 pages to the experimental layout automatically
    upgradeLegacyLessonLayoutIfNeeded();
}

function initQuizPersistentState(charactersData, userConfig) {
    originalQuizCharacters = charactersData; // Store original array
    quizCharacters = charactersData;
    config = userConfig || {};
    initQuizDebugInterface();

    loadConfidencePanelVisibility();
    loadConfidenceTrackingEnabled();
    loadConfidenceFormula();
    loadHideMeaningChoices();
    loadComponentPreference();
    loadTimerSettings();
    loadSchedulerStats();
    loadSchedulerMode();
    ensureCharGlossesLoaded();
    loadBatchState();
    loadAdaptiveState();
    loadFeedState();
    loadDecompositionsData(); // Load character decompositions from JSON
    loadComposerState();
    loadWordMarkings(); // Load user word markings
    ensureModeButton('draw-missing-component', 'Draw Missing Component');
    ensureModeButton('composer', 'Composer');
    buildComposerPipeline();

    reconcileBatchStateWithQueue();
    reconcileAdaptiveStateWithPool();
    reconcileFeedStateWithPool();

    if (config.defaultMode) {
        mode = config.defaultMode;
    }

    // Load saved mode (overrides default if valid)
    loadQuizMode();
}

function initQuizDomElements() {
    // Get DOM elements
    questionDisplay = document.getElementById('questionDisplay');
    answerInput = document.getElementById('answerInput');
    checkBtn = document.getElementById('checkBtn');
    feedback = document.getElementById('feedback');
    hint = document.getElementById('hint');
    componentBreakdown = document.getElementById('componentBreakdown');
    typeMode = document.getElementById('typeMode');
    choiceMode = document.getElementById('choiceMode');
    fuzzyMode = document.getElementById('fuzzyMode');
    fuzzyInput = document.getElementById('fuzzyInput');
    strokeOrderMode = document.getElementById('strokeOrderMode');
    handwritingMode = document.getElementById('handwritingMode');
    drawCharMode = document.getElementById('drawCharMode');
    drawModeInitialized = false;
    ensureDrawModeLayout();
    studyMode = document.getElementById('studyMode');
    studyModeInitialized = false;
    studyModeState.searchRaw = '';
    studyModeState.searchQuery = '';
    studyModeState.sortBy = 'original';
    studyModeState.shuffleOrder = null;
    ensureDictationChatMode();
    radicalPracticeMode = document.getElementById('radicalPracticeMode');
    missingComponentMode = document.getElementById('missingComponentMode');
    charBuildingMode = document.getElementById('charBuildingMode');
    audioSection = document.getElementById('audioSection');
    fullscreenDrawInitialized = false;
    ensureFullscreenDrawLayout();
}

function configureQuizInputs() {
    // Disable autocomplete and speech input to prevent browser from auto-filling values
    // (e.g., TTS speed "1.20" being transcribed as "yi dian er ling")
    if (answerInput) {
        answerInput.setAttribute('autocomplete', 'off');
        answerInput.setAttribute('autocorrect', 'off');
        answerInput.setAttribute('autocapitalize', 'off');
        answerInput.setAttribute('spellcheck', 'false');
    }
    if (fuzzyInput) {
        fuzzyInput.setAttribute('autocomplete', 'off');
        fuzzyInput.setAttribute('autocorrect', 'off');
        fuzzyInput.setAttribute('autocapitalize', 'off');
        fuzzyInput.setAttribute('spellcheck', 'false');
    }

    // Setup keyboard shortcut hints for inputs
    setupInputShortcutHints();
}

function initQuizPreviewAndSchedulerUi() {
    previewQueue = [];
    const requestedPreviewSize = Number(config.previewQueueSize);
    previewQueueSize = Number.isFinite(requestedPreviewSize) && requestedPreviewSize > 0
        ? Math.floor(requestedPreviewSize)
        : 3;
    previewApplicableModes = Array.isArray(config.previewApplicableModes)
        ? config.previewApplicableModes.slice()
        : null;

    const previewElementId = typeof config.previewElementId === 'string' && config.previewElementId.trim()
        ? config.previewElementId.trim()
        : null;
    previewElement = previewElementId ? document.getElementById(previewElementId) : document.getElementById('questionPreview');
    previewListElement = previewElement
        ? (previewElement.querySelector('.preview-list') || previewElement)
        : null;
    setPreviewQueueEnabled(config.enablePreviewQueue && previewElement);
    ensureSchedulerToolbar();
    updateSchedulerToolbar();
    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        prepareAdaptiveForNextQuestion();
    }
    renderConfidenceList();
    updateMeaningChoicesVisibility();
}

function resetModeTransientState() {
    // Reset three-column state when switching modes
    translationPreviousQuestion = null;
    translationPreviousResult = null;
    translationUpcomingQuestion = null;
    translationInlineFeedback = null;
    pinyinDictationPreviousQuestion = null;
    pinyinDictationPreviousResult = null;
    pinyinDictationPreviousUserAnswer = null;
    pinyinDictationUpcomingQuestion = null;
    chunksPreviousChunk = null;
    chunksPreviousResult = null;
    chunksUpcomingChunk = null;
    dictationChatPassed = false;
    dictationChatLastUserAnswer = '';
    dictationChatAiPrompt = '';
    dictationChatPromptGenerating = false;
    dictationChatMessages = [];
}

function applyModeChange(selectedMode, btn) {
    if (selectedMode === 'composer') {
        composerEnabled = true;
        buildComposerPipeline();
        saveComposerState();
        saveQuizMode('composer');
        const stage = getComposerCurrentStage();
        mode = stage ? stage.mode : mode;
    } else {
        composerEnabled = false;
        saveComposerState();
        mode = selectedMode;
        saveQuizMode(mode);
    }

    if (btn) {
        btn.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500');
        btn.classList.remove('border-gray-300');
    }
}

function clearModeButtonActiveStates() {
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('active', 'bg-blue-500', 'text-white', 'border-blue-500');
        b.classList.add('border-gray-300');
    });
}

function initQuizEventListeners() {
    // Setup event listeners
    checkBtn.addEventListener('click', checkAnswer);

    answerInput.addEventListener('input', () => {
        if (mode === 'char-to-tones') {
            // Only allow 1-5 digits
            const filtered = answerInput.value.replace(/[^1-5]/g, '');
            answerInput.value = filtered;
            enteredTones = filtered;

            // Show progress hint
            const expectedTones = extractToneSequence(currentQuestion.pinyin.split('/')[0].trim());
            hint.textContent = `${filtered} (${filtered.length}/${expectedTones.length})`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-blue-600';

            // Auto-submit when correct length reached
            if (filtered.length === expectedTones.length) {
                setTimeout(() => checkAnswer(), 100);
            }
        } else {
            updatePartialProgress();
        }

        // While in the post-answer phase (correct), keep anything typed so it can prefill the next item
        // Skip for char-to-tones mode since tone numbers don't carry over meaningfully
        if (answered && lastAnswerCorrect && mode !== 'char-to-tones') {
            nextAnswerBuffer = answerInput.value;
        } else {
            nextAnswerBuffer = '';
        }
    });

    answerInput.addEventListener('keydown', (e) => {
        if (handleToneCyclerKeydown(e)) {
            return;
        }

        if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && answered && lastAnswerCorrect) {
            e.preventDefault();
            goToNextQuestionAfterCorrect();
            return;
        }

        // Ctrl+J to skip question
        if (e.key === 'j' && e.ctrlKey) {
            e.preventDefault();
            generateQuestion();
            return;
        }

        if (mode === 'char-to-tones') {
            // In char-to-tones mode, Enter or Ctrl+C clears
            if (e.key === 'Enter' || (e.key === 'c' && e.ctrlKey)) {
                e.preventDefault();
                answerInput.value = '';
                enteredTones = '';
                hint.textContent = '';
                return;
            }
        } else if (mode === 'char-to-pinyin' && e.key === ' ') {
            if (e.altKey) {
                return;
            }
            if (!e.ctrlKey && !e.metaKey && e.shiftKey) {
                // Allow Shift+Space to insert a literal space
                return;
            }
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                playFullDictationSentence();
            } else {
                playCurrentDictationPart();
            }
        } else if (e.key === ' ' && mode === 'audio-to-pinyin' && audioSection) {
            // Space replays audio in audio-to-pinyin mode only
            // audio-to-meaning needs spaces for typing English sentences
            e.preventDefault();
            if (window.currentAudioPlayFunc) {
                window.currentAudioPlayFunc();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            checkAnswer();
        }
    });
}

function initModeButtons() {
    prioritizeMeaningModeButton();
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            clearModeButtonActiveStates();
            applyModeChange(btn.dataset.mode, btn);
            resetModeTransientState();

            score = 0;
            total = 0;
            updateStats();
            generateQuestion();
            updateComposerStatusDisplay();
        });
    });

    // Set initial active button
    const initialBtn = composerEnabled
        ? document.querySelector(`[data-mode="composer"]`)
        : document.querySelector(`[data-mode="${mode}"]`);
    if (initialBtn) {
        initialBtn.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500');
        initialBtn.classList.remove('border-gray-300');
    }
}

function initQuiz(charactersData, userConfig = {}) {
    initQuizRuntime();
    initQuizPersistentState(charactersData, userConfig);
    initQuizDomElements();
    configureQuizInputs();
    initQuizPreviewAndSchedulerUi();
    initQuizEventListeners();
    initModeButtons();

    registerQuizHotkeys();

    // Initialize command palette
    initQuizCommandPalette();

    // Setup collapsible sidebars
    setupCollapsibleSidebars();

    if (isBatchMode()) {
        prepareBatchForNextQuestion();
    }

    // Start first question
    generateQuestion();
}

// Setup collapsible sidebars for quiz modes and confidence panel
function setupCollapsibleSidebars() {
    // Find the left sidebar (quiz modes)
    const leftSidebar = document.querySelector(
        '.flex.min-h-screen > .w-64, .flex.min-h-screen > div:first-child.bg-white, .app-container > .sidebar, .app-container > aside.sidebar, .app-container > div.sidebar'
    );
    if (leftSidebar && !leftSidebar.closest('.sidebar-wrapper')) {
        wrapSidebarWithToggle(leftSidebar, 'left');
    }

    // Don't wrap the confidence panel. It is a fixed-position drawer with its own
    // pull-tab toggle; wrapping it moves the element out of the DOM and strips the
    // id/styles, which hides the panel entirely. Keep it as-is so its fixed layout
    // and stored visibility state keep working.
}

function wrapSidebarWithToggle(sidebar, side) {
    const wrapper = document.createElement('div');
    wrapper.className = `sidebar-wrapper ${side}`;

    const toggle = document.createElement('button');
    toggle.className = 'sidebar-toggle';
    toggle.innerHTML = side === 'left' ? '◀' : '▶';
    toggle.title = `Toggle ${side} sidebar`;

    // Get stored collapse state
    const storageKey = `sidebar-${side}-collapsed`;
    let storedCollapse = null;
    try {
        storedCollapse = localStorage.getItem(storageKey);
    } catch (e) {
        storedCollapse = null;
    }
    const isCollapsed = storedCollapse === null
        ? isNarrowViewport()
        : storedCollapse === 'true';

    sidebar.parentNode.insertBefore(wrapper, sidebar);

    const content = document.createElement('div');
    content.className = 'sidebar-content';

    // Move sidebar's children to content div
    while (sidebar.firstChild) {
        content.appendChild(sidebar.firstChild);
    }

    // Copy sidebar's relevant classes
    content.className += ' ' + Array.from(sidebar.classList).filter(c =>
        !c.startsWith('w-') && c !== 'bg-white' && c !== 'shadow-lg' && c !== 'p-4'
    ).join(' ');

    wrapper.appendChild(content);
    wrapper.appendChild(toggle);

    // Remove the original sidebar
    sidebar.remove();

    // Apply initial collapsed state
    if (isCollapsed) {
        wrapper.classList.add('collapsed');
        toggle.innerHTML = side === 'left' ? '▶' : '◀';
    }

    toggle.addEventListener('click', () => {
        wrapper.classList.toggle('collapsed');
        const nowCollapsed = wrapper.classList.contains('collapsed');
        toggle.innerHTML = side === 'left'
            ? (nowCollapsed ? '▶' : '◀')
            : (nowCollapsed ? '◀' : '▶');
        try {
            localStorage.setItem(storageKey, nowCollapsed);
        } catch (e) {}
    });
}
