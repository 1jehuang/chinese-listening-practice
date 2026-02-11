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
let deckSessionStartedAt = Date.now();
let deckSessionKeys = new Set();
let deckSessionSeenKeys = new Set();

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
let handwritingResultMarked = null;
let handwritingAwaitingAdvance = false;
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
    BATCH_3: 'batch-3',
    BATCH_2: 'batch-2',
    ORDERED: 'ordered',
    FEED: 'feed',
    FEED_SR: 'feed-sr',
    FEED_EEG: 'feed-eeg'
};
function isFeedScheduler(m) {
    if (m === undefined) m = schedulerMode;
    return m === SCHEDULER_MODES.FEED || m === SCHEDULER_MODES.FEED_SR || m === SCHEDULER_MODES.FEED_EEG;
}
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
const BATCH_3_INITIAL_SIZE = 3;
const BATCH_3_COMBINED_SIZE = 6;
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

// Adaptive timing constants
const FEED_AFK_THRESHOLD_MS = 60000;           // 60s = AFK
const FEED_DEFAULT_HALF_LIFE_MS = 5 * 60 * 1000; // 5 min default forgetting half-life
const FEED_RESPONSE_TIMES_LIMIT = 20;          // max response times to track per card
const FEED_GAP_HISTORY_LIMIT = 10;             // max gap history entries per card
let feedStateKey = '';
let feedModeState = {
    hand: [],                              // current active cards (flexible size)
    seen: {},                              // { char: { attempts, correct, streak, lastSeen, responseTimes, avgResponseTime, afkAttempts, gapHistory, halfLife } }
    totalPulls: 0,                         // total questions asked
    globalAvgResponseTime: null            // global average response time across all cards
};
let feedQuestionDisplayedAt = null;        // timestamp when current question was displayed

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
        case SCHEDULER_MODES.FEED_EEG:
            return 'Feed + EEG';
        case SCHEDULER_MODES.BATCH_5:
            return 'Batch sets (5 → 10 after full pass)';
        case SCHEDULER_MODES.BATCH_3:
            return 'Batch sets (3 → 6 after full pass)';
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
        case SCHEDULER_MODES.FEED_EEG:
            return 'Feed Graduate + EEG brain state. Serves harder cards when focused, easier review when drifting. Tracks per-character brain patterns.';
        case SCHEDULER_MODES.BATCH_5:
            return 'Disjoint 5-card sets until every word is seen, then 10-card sets for combined practice.';
        case SCHEDULER_MODES.BATCH_3:
            return 'Disjoint 3-card sets until every word is seen, then 6-card sets for combined practice.';
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
    markDeckQuestionSeen(question);
    updateDeckEtaDisplay();
    if (!confidenceTrackingEnabled) return;
    const stats = getSchedulerStats(question.char);
    stats.served += 1;
    stats.lastServed = Date.now();
    schedulerOutcomeRecordedChar = null;

    // Track when question was displayed for response time measurement
    if (schedulerMode === SCHEDULER_MODES.FEED || schedulerMode === SCHEDULER_MODES.FEED_SR) {
        feedQuestionDisplayedAt = Date.now();
    }

    logDebugEvent('scheduler-served', {
        char: question.char,
        skill: getCurrentSkillKey(),
        served: stats.served,
        mode: schedulerMode
    });
    if (typeof eeg !== 'undefined' && eeg.logQuizEvent) {
        eeg.logQuizEvent('question-shown', {
            char: question.char,
            pinyin: question.pinyin,
            meaning: question.meaning,
            mode: mode,
            skill: getCurrentSkillKey(),
            scheduler: schedulerMode,
            served: stats.served,
        });
    }
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
    if (typeof eeg !== 'undefined' && eeg.logQuizEvent) {
        eeg.logQuizEvent('answer', {
            char: char,
            correct: Boolean(correct),
            mode: mode,
            skill: getCurrentSkillKey(),
            responseMs: getQuestionResponseMs(),
            streak: stats.streak,
            served: stats.served,
            correctCount: stats.correct,
            wrongCount: stats.wrong,
        });
    }

    saveSchedulerStats();

    if (isBatchMode()) {
        maybeAdvanceBatchAfterAnswer();
    }

    renderConfidenceList();

    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        prepareAdaptiveForNextQuestion();
    }

    if (schedulerMode === SCHEDULER_MODES.FEED || schedulerMode === SCHEDULER_MODES.FEED_SR || schedulerMode === SCHEDULER_MODES.FEED_EEG) {
        const responseMs = getQuestionResponseMs();
        recordFeedOutcome(char, correct, responseMs);
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
    const defaults = { hand: [], seen: {}, totalPulls: 0, globalAvgResponseTime: null };
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
                feedModeState.globalAvgResponseTime = Number.isFinite(parsed.globalAvgResponseTime) ? parsed.globalAvgResponseTime : null;
            }
        }
    } catch (e) {
        console.warn('Failed to load feed mode state', e);
    }
    feedModeState.hand = Array.from(new Set(feedModeState.hand));
    feedQuestionDisplayedAt = null;
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
    feedModeState = { hand: [], seen: {}, totalPulls: 0, globalAvgResponseTime: null };
    feedQuestionDisplayedAt = null;
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
    const useSRConfidence = schedulerMode === SCHEDULER_MODES.FEED_SR || schedulerMode === SCHEDULER_MODES.FEED_EEG;

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

        // EEG: use ML model + ratio-based engagement + head movement for smarter card selection
        if (schedulerMode === SCHEDULER_MODES.FEED_EEG && typeof neuro !== 'undefined') {
            var eegBias = neuro.getEEGDifficultyBias();
            if (eegBias > 0) baseScore += eegBias * 0.8;
            else baseScore -= Math.abs(eegBias) * 0.5;

            // Use per-character brain profile to boost cards that were wrong when unfocused
            if (typeof neuro.getCharBrainProfile === 'function') {
                var brainProfile = neuro.getCharBrainProfile(char);
                if (brainProfile && brainProfile.mlUnfocusedAccuracy !== null && brainProfile.mlUnfocusedAccuracy < 0.5) {
                    baseScore += 0.6;
                }
            }

            // If signal quality is poor, reduce EEG influence
            if (typeof eeg !== 'undefined' && typeof eeg.isSignalUsable === 'function' && !eeg.isSignalUsable()) {
                baseScore *= 0.7;
            }
        }

        return baseScore + Math.random() * 0.5;
    }

    const sessionConfidence = stats.correct / stats.attempts;
    const explorationBonus = FEED_UCB_C * Math.sqrt(Math.log(totalPulls) / stats.attempts);

    // Higher score = more likely to pick
    // Low confidence OR rarely seen = high score
    let score = (1 - sessionConfidence) + explorationBonus;

    // Factor in forgetting probability based on time since last seen
    // pForget = 1 - 0.5^(gap / halfLife)
    // urgency = pForget * (1 - confidence)
    const now = Date.now();
    const gap = stats.lastSeen ? now - stats.lastSeen : 0;
    const halfLife = stats.halfLife || FEED_DEFAULT_HALF_LIFE_MS;
    const pForget = 1 - Math.pow(0.5, gap / halfLife);
    const urgency = pForget * (1 - sessionConfidence);
    score += urgency * 1.5; // Weight urgency contribution

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

    // EEG-modulated bandit scoring: adjust arm values based on brain state
    if (schedulerMode === SCHEDULER_MODES.FEED_EEG && typeof eeg !== 'undefined' && eeg.state && eeg.state.ready) {
        var eegSignalOk = typeof eeg.isSignalUsable === 'function' ? eeg.isSignalUsable() : true;

        if (eegSignalOk) {
            // Get composite focus (blends ratio-based engagement + ML model)
            var compositeFocus = typeof eeg.getCompositeFocusScore === 'function'
                ? eeg.getCompositeFocusScore() : (eeg.state.engagement || 0);
            var headMove = eeg.state.headMovement || 0;

            // Focused → boost harder cards (low accuracy, high difficulty)
            // Unfocused → boost easier cards (high accuracy, low difficulty)
            var focusBias = (compositeFocus - 0.2) * 3.0; // range roughly -0.6 to +2.4
            focusBias = Math.max(-1.5, Math.min(1.5, focusBias));

            // Modulate: when focused, difficulty score contributes MORE to the score
            // (hard cards become more attractive). When unfocused, urgency dominates
            // (you review due/easy cards instead of pushing into new hard ones).
            if (focusBias > 0) {
                score += focusBias * difficultyScore * 0.8;
                score += focusBias * explorationBonus * 0.3;
            } else {
                score += Math.abs(focusBias) * (1 - difficultyScore) * 0.6;
                score -= Math.abs(focusBias) * explorationBonus * 0.2;
            }

            // Head movement penalty: fidgeting = don't push hard cards
            if (headMove > 0.5) {
                score -= (headMove - 0.5) * difficultyScore * 1.2;
            }

            // Per-character brain profile: if this card was previously wrong
            // during unfocused states, boost it when we ARE focused now
            if (typeof neuro !== 'undefined' && typeof neuro.getCharBrainProfile === 'function') {
                var brainProfile = neuro.getCharBrainProfile(char);
                if (brainProfile) {
                    if (brainProfile.mlUnfocusedAccuracy !== null && brainProfile.mlUnfocusedAccuracy < 0.5 && focusBias > 0.3) {
                        score += 0.8;
                    }
                    if (brainProfile.fragile && focusBias > 0) {
                        score += 0.5;
                    }
                }
            }
        }
    }

    return score;
}

function getFeedCardUrgency(char) {
    // Helper to get urgency info for a specific card (for UI)
    const stats = feedModeState.seen[char];
    if (!stats || stats.attempts === 0) {
        return { pForget: 0, urgency: 0, halfLife: FEED_DEFAULT_HALF_LIFE_MS, gap: 0 };
    }

    const now = Date.now();
    const gap = stats.lastSeen ? now - stats.lastSeen : 0;
    const halfLife = stats.halfLife || FEED_DEFAULT_HALF_LIFE_MS;
    const pForget = 1 - Math.pow(0.5, gap / halfLife);
    const confidence = stats.correct / stats.attempts;
    const urgency = pForget * (1 - confidence);

    return { pForget, urgency, halfLife, gap };
}

function getFeedExplorationRatio() {
    // What fraction of the pool have we seen?
    const poolSize = Array.isArray(quizCharacters) ? quizCharacters.length : 0;
    if (poolSize === 0) return 0;
    const seenCount = Object.keys(feedModeState.seen || {}).length;
    return seenCount / poolSize;
}

function getFeedTargetHandSize() {
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR && schedulerMode !== SCHEDULER_MODES.FEED_EEG) {
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

    // Calculate timing-based max hand size
    // max_hand_size = min_half_life_in_hand / avg_response_time
    // This ensures we can cycle through hand before shortest half-life expires
    let timingMaxHandSize = FEED_MAX_HAND_SIZE;
    const avgResponseTime = feedModeState.globalAvgResponseTime;

    if (avgResponseTime && avgResponseTime > 0) {
        // Find minimum half-life among cards in hand (or default)
        let minHalfLifeInHand = FEED_DEFAULT_HALF_LIFE_MS;
        for (const char of feedModeState.hand || []) {
            const stats = feedModeState.seen[char];
            if (stats && stats.halfLife && stats.halfLife < minHalfLifeInHand) {
                minHalfLifeInHand = stats.halfLife;
            }
        }

        // Hand size should allow cycling through all cards before shortest half-life
        // We want to see each card at least once per half-life period
        timingMaxHandSize = Math.floor(minHalfLifeInHand / avgResponseTime);
        timingMaxHandSize = Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_MAX_HAND_SIZE, timingMaxHandSize));
    }

    // Start small like 5-card sets: begin with 2 cards, expand as you learn
    let baseHandSize;
    if (seenCount < 2) {
        // Very beginning - start with just 2 cards
        baseHandSize = 2;
    } else if (explorationRatio < 0.15) {
        // Early phase - small sets of 3-4
        baseHandSize = Math.min(4, Math.max(2, weakCount + 2));
    } else if (explorationRatio < 0.3) {
        // Growing phase - expand to 5-6
        baseHandSize = Math.min(6, Math.max(3, weakCount + 2));
    } else if (explorationRatio < 0.6) {
        // Middle phase - moderate hand size
        baseHandSize = Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_DEFAULT_HAND_SIZE + 2, weakCount + 3));
    } else {
        // Explored most of the deck - shrink to focus on weak cards
        baseHandSize = Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_DEFAULT_HAND_SIZE, weakCount + 2));
    }

    // Return the minimum of exploration-based size and timing-based max
    return Math.min(baseHandSize, timingMaxHandSize);
}

function getTimingBasedHandSizeInfo() {
    // Helper function to get timing details for UI
    const avgResponseTime = feedModeState.globalAvgResponseTime;
    if (!avgResponseTime || avgResponseTime <= 0) {
        return { avgResponseTime: null, minHalfLife: null, maxHandSize: FEED_MAX_HAND_SIZE, isConstrained: false };
    }

    let minHalfLife = FEED_DEFAULT_HALF_LIFE_MS;
    for (const char of feedModeState.hand || []) {
        const stats = feedModeState.seen[char];
        if (stats && stats.halfLife && stats.halfLife < minHalfLife) {
            minHalfLife = stats.halfLife;
        }
    }

    const maxHandSize = Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_MAX_HAND_SIZE, Math.floor(minHalfLife / avgResponseTime)));
    const baseHandSize = getFeedExplorationRatio() < 0.3 ? 6 : FEED_DEFAULT_HAND_SIZE + 2;

    return {
        avgResponseTime,
        minHalfLife,
        maxHandSize,
        isConstrained: maxHandSize < baseHandSize
    };
}

function ensureFeedHand() {
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR && schedulerMode !== SCHEDULER_MODES.FEED_EEG) return;
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
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR && schedulerMode !== SCHEDULER_MODES.FEED_EEG) {
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

function recordFeedOutcome(char, correct, responseMs = null) {
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR && schedulerMode !== SCHEDULER_MODES.FEED_EEG) return;
    if (!char) return;

    feedModeState.totalPulls = (feedModeState.totalPulls || 0) + 1;
    const now = Date.now();

    if (!feedModeState.seen[char]) {
        feedModeState.seen[char] = {
            attempts: 0,
            correct: 0,
            streak: 0,
            lastSeen: now,
            responseTimes: [],
            avgResponseTime: null,
            afkAttempts: 0,
            gapHistory: [],
            halfLife: null
        };
    }

    const stats = feedModeState.seen[char];
    const previousLastSeen = stats.lastSeen;

    // Calculate response time if we have display timestamp
    const responseTime = feedQuestionDisplayedAt ? now - feedQuestionDisplayedAt : null;
    const isAFK = responseTime !== null && responseTime > FEED_AFK_THRESHOLD_MS;

    // Track response time (non-AFK only)
    if (responseTime !== null && !isAFK) {
        if (!Array.isArray(stats.responseTimes)) stats.responseTimes = [];
        stats.responseTimes.push(responseTime);
        // Keep only last N response times
        if (stats.responseTimes.length > FEED_RESPONSE_TIMES_LIMIT) {
            stats.responseTimes = stats.responseTimes.slice(-FEED_RESPONSE_TIMES_LIMIT);
        }
        // Update rolling average
        stats.avgResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;

        // Update global average response time
        updateGlobalAvgResponseTime();
    }

    // Track AFK attempts
    if (isAFK) {
        stats.afkAttempts = (stats.afkAttempts || 0) + 1;
    }

    // Track gap history for forgetting curve (only if we've seen this card before)
    if (previousLastSeen && stats.attempts > 0) {
        const gap = now - previousLastSeen;
        if (!Array.isArray(stats.gapHistory)) stats.gapHistory = [];
        stats.gapHistory.push({ gap, forgot: !correct });
        if (stats.gapHistory.length > FEED_GAP_HISTORY_LIMIT) {
            stats.gapHistory = stats.gapHistory.slice(-FEED_GAP_HISTORY_LIMIT);
        }
        // Update half-life estimate
        stats.halfLife = estimateForgettingHalfLife(stats.gapHistory);
    }

    stats.attempts += 1;
    stats.lastSeen = now;

    if (correct) {
        stats.correct += 1;
        stats.streak = (stats.streak || 0) + 1;
    } else {
        stats.streak = 0;
    }

    // Reset display timestamp
    feedQuestionDisplayedAt = null;

    saveFeedState();

    // After recording, refresh hand (may remove/add cards)
    ensureFeedHand();
}

function updateGlobalAvgResponseTime() {
    const allTimes = [];
    for (const char of Object.keys(feedModeState.seen || {})) {
        const stats = feedModeState.seen[char];
        if (stats && Array.isArray(stats.responseTimes)) {
            allTimes.push(...stats.responseTimes);
        }
    }
    if (allTimes.length > 0) {
        feedModeState.globalAvgResponseTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
    }
}

function estimateForgettingHalfLife(gapHistory) {
    if (!Array.isArray(gapHistory) || gapHistory.length < 2) {
        return FEED_DEFAULT_HALF_LIFE_MS;
    }

    // Find transitions where user remembered after short gaps but forgot after long gaps
    // Half-life is roughly where remember/forget probability is ~50%
    const remembered = gapHistory.filter(h => !h.forgot).map(h => h.gap);
    const forgot = gapHistory.filter(h => h.forgot).map(h => h.gap);

    if (remembered.length === 0 || forgot.length === 0) {
        // No data points in one category - use default or simple estimate
        if (forgot.length > 0) {
            // User keeps forgetting - half-life is probably shorter than shortest forgotten gap
            const minForgot = Math.min(...forgot);
            return Math.max(30000, minForgot / 2); // At least 30 seconds
        }
        if (remembered.length > 0) {
            // User always remembers - half-life is probably longer than longest remembered gap
            const maxRemembered = Math.max(...remembered);
            return Math.min(maxRemembered * 2, 30 * 60 * 1000); // Cap at 30 minutes
        }
        return FEED_DEFAULT_HALF_LIFE_MS;
    }

    // Estimate half-life as the geometric mean of max remembered and min forgotten gaps
    const maxRemembered = Math.max(...remembered);
    const minForgot = Math.min(...forgot);

    if (maxRemembered < minForgot) {
        // Clean separation - half-life is between them
        return Math.sqrt(maxRemembered * minForgot);
    } else {
        // Overlapping data - use weighted average based on frequency
        const rememberAvg = remembered.reduce((a, b) => a + b, 0) / remembered.length;
        const forgotAvg = forgot.reduce((a, b) => a + b, 0) / forgot.length;
        return (rememberAvg + forgotAvg) / 2;
    }
}

function prepareFeedForNextQuestion() {
    if (schedulerMode !== SCHEDULER_MODES.FEED && schedulerMode !== SCHEDULER_MODES.FEED_SR && schedulerMode !== SCHEDULER_MODES.FEED_EEG) return;
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
        const urgencyInfo = getFeedCardUrgency(char);
        const urgencyPct = Math.round(urgencyInfo.urgency * 100);

        if (isFeedSR) {
            // Show confidence score for Feed Graduate mode
            const srScore = getConfidenceScore(char);
            const isMastered = srScore >= threshold;
            const srPct = confidenceFormula === CONFIDENCE_FORMULAS.BKT
                ? Math.round(srScore * 100)
                : Math.round((srScore / 6) * 100);
            const icon = isMastered ? '✓' : '';
            // Add urgency indicator for high-urgency cards
            const urgencyClass = urgencyPct > 50 ? 'border-l-2 border-red-400' : '';
            return `<span class="inline-block px-1.5 py-0.5 rounded text-xs ${urgencyClass} ${isMastered ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}" title="Urgency: ${urgencyPct}%">${char} ${srPct}%${icon}</span>`;
        } else {
            // Show streak for regular Feed mode
            const streak = stats?.streak || 0;
            const streakIcon = streak >= FEED_STREAK_TO_REMOVE ? '✓' : (streak > 0 ? `×${streak}` : '');
            // Add urgency indicator for high-urgency cards
            const urgencyClass = urgencyPct > 50 ? 'border-l-2 border-red-400' : '';
            return `<span class="inline-block px-1.5 py-0.5 rounded text-xs ${urgencyClass} bg-purple-100 text-purple-800" title="Urgency: ${urgencyPct}%">${char} ${sessionConf}%${streakIcon}</span>`;
        }
    }).join(' ');

    const modeLabel = isFeedSR ? 'Feed Graduate Mode' : 'Feed Mode';

    // Build timing info line
    let timingLine = '';
    const avgResponseTime = feedModeState.globalAvgResponseTime;
    if (avgResponseTime) {
        const avgSec = (avgResponseTime / 1000).toFixed(1);
        const timingInfo = getTimingBasedHandSizeInfo();
        const halfLifeSec = timingInfo.minHalfLife ? (timingInfo.minHalfLife / 1000).toFixed(0) : '—';
        const constraintNote = timingInfo.isConstrained ? ' (constrained)' : '';
        timingLine = `<div class="text-[11px] text-purple-600">⏱ ${avgSec}s avg · ½-life ${halfLifeSec}s · max hand ${timingInfo.maxHandSize}${constraintNote}</div>`;
    }

    const statsLine = isFeedSR
        ? `${explorationPct}% explored · ${masteredCount} ready ≥ ${threshold.toFixed(2)} · ${weakCount} weak · ${feedModeState.totalPulls || 0} pulls`
        : `${explorationPct}% explored · ${weakCount} weak · ${feedModeState.totalPulls || 0} pulls`;

    statusEl.className = 'mt-1 text-xs text-purple-800';
    statusEl.innerHTML = `
        <div class="text-[11px] font-semibold uppercase tracking-[0.25em] text-purple-500">${modeLabel}</div>
        <div class="text-sm text-purple-900">Hand (${hand.length}): ${handBadges || '<em>empty</em>'}</div>
        <div class="text-[11px] text-purple-700">${statsLine}</div>
        ${timingLine}
        ${isFeedSR ? `<div class="text-[11px] text-purple-700">Graduation: ready ${masteredCount}/${seenCount || 1} (confidence ≥ ${threshold.toFixed(2)})</div>` : ''}
    `;
    if (schedulerMode === SCHEDULER_MODES.FEED || schedulerMode === SCHEDULER_MODES.FEED_SR || schedulerMode === SCHEDULER_MODES.FEED_EEG) {
        prepareFeedForNextQuestion();
    } else {
        updateFeedStatusDisplay();
    }
    toggleFeedStatusTicker();
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

        // In pinyin dictation modes, Enter after wrong answer advances to next question
        if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && answered && !lastAnswerCorrect && (mode === 'char-to-pinyin' || mode === 'audio-to-pinyin')) {
            e.preventDefault();
            generateQuestion();
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
            resetDeckSessionProgress();
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
