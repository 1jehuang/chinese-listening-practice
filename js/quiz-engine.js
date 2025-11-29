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
let originalQuizCharacters = []; // Store original characters before SR filtering
let config = {};
let nextAnswerBuffer = ''; // carry typed text into the next question after showing feedback

// 3-column layout state for char-to-meaning-type mode
let previousQuestion = null;
let previousQuestionResult = null; // 'correct' or 'incorrect'
let upcomingQuestion = null;
let threeColumnInlineFeedback = null; // { message, type: 'correct' | 'incorrect' }

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
let handwritingAnswerShown = false;
let studyModeInitialized = false;
let drawModeInitialized = false;
let fullscreenDrawInitialized = false;
const studyModeState = {
    searchRaw: '',
    searchQuery: '',
    sortBy: 'original',
    shuffleOrder: null
};

// Timer state
let timerEnabled = false;
let timerSeconds = 10;
let timerIntervalId = null;
let timerRemainingSeconds = 0;
const TIMER_ENABLED_KEY = 'quizTimerEnabled';
const TIMER_SECONDS_KEY = 'quizTimerSeconds';

// Spaced Repetition state (FSRS-based)
let srEnabled = false;
let srData = {};
let srPageKey = '';
let srDueCount = 0;
let srQuestionStartTime = 0;
const SR_ENABLED_KEY = 'sr_enabled';
let srAggressiveMode = false;
const SR_AGGRESSIVE_KEY = 'sr_aggressive_mode';
const SR_STATE_NAMES = ['New', 'Learning', 'Review', 'Relearning'];
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
const ADAPTIVE_RECENT_WRONG_COOLDOWN = 90; // seconds to keep a recently-missed card around
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

// BKT (Bayesian Knowledge Tracing) parameters
// These model within-session learning probability
const BKT_PARAMS = {
    P_L0: 0.0,    // Prior: probability of knowing before any exposure
    P_T: 0.2,     // Transit: probability of learning per attempt
    P_G: 0.25,    // Guess: probability of correct answer without knowing (1/4 for 4 choices)
    P_S: 0.08     // Slip: probability of wrong answer despite knowing
};
const BKT_MASTERY_THRESHOLD = 0.85;  // P(Learned) >= this means "mastered"

// FSRS-4.5 default parameters (optimized weights)
const FSRS_PARAMS = {
    w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
    requestRetention: 0.9,  // Target 90% recall probability
    maximumInterval: 36500, // 100 years in days (effectively unlimited)
    decay: -0.5            // Power law decay constant
};

// Hanzi Writer
let writer = null;

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

// =============================================================================
// SPACED REPETITION - Now loaded from js/spaced-repetition.js
// =============================================================================
// (Functions: FSRS algorithm, SR card management, loadSRData, saveSRData, etc.)

function showSRCardInfo(char) {
    // Remove any existing SR card info
    const existing = document.getElementById('srCardInfo');
    if (existing) {
        existing.remove();
    }

    if (!srEnabled || !char) {
        return;
    }

    const card = getSRCardData(char);
    const stateName = SR_STATE_NAMES[card.state] || 'Unknown';

    // Calculate days until due
    const now = Date.now();
    const daysUntilDue = card.due > now ? ((card.due - now) / (24 * 60 * 60 * 1000)).toFixed(1) : 0;

    // Color coding for state
    const stateColors = {
        0: 'text-blue-600 bg-blue-50 border-blue-200',  // New
        1: 'text-yellow-600 bg-yellow-50 border-yellow-200',  // Learning
        2: 'text-green-600 bg-green-50 border-green-200',  // Review
        3: 'text-orange-600 bg-orange-50 border-orange-200'   // Relearning
    };
    const stateClass = stateColors[card.state] || 'text-gray-600 bg-gray-50 border-gray-200';

    const infoBox = document.createElement('div');
    infoBox.id = 'srCardInfo';
    infoBox.className = `${stateClass} border-l-4 px-4 py-2 mb-4 rounded text-sm`;
    infoBox.innerHTML = `
        <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-4">
                <span class="font-semibold">📊 ${stateName}</span>
                <span class="text-xs opacity-75">Stability: ${card.stability.toFixed(1)}d</span>
                <span class="text-xs opacity-75">Difficulty: ${card.difficulty.toFixed(1)}/10</span>
                ${card.reps > 0 ? `<span class="text-xs opacity-75">Reviews: ${card.reps}</span>` : ''}
                ${card.lapses > 0 ? `<span class="text-xs opacity-75">Lapses: ${card.lapses}</span>` : ''}
                ${daysUntilDue > 0 ? `<span class="text-xs opacity-75">Next: ${daysUntilDue}d</span>` : ''}
            </div>
        </div>
    `;

    // Insert after SR banner or at top of container
    const srBanner = document.getElementById('srBanner');
    const container = document.querySelector('.max-w-3xl');

    if (srBanner && srBanner.parentNode) {
        srBanner.parentNode.insertBefore(infoBox, srBanner.nextSibling);
    } else if (container && container.firstChild) {
        container.insertBefore(infoBox, container.firstChild);
    }
}

function formatSRDueText(dueTimestamp) {
    const now = Date.now();
    const delta = (dueTimestamp || 0) - now;
    if (!dueTimestamp || delta <= 0) return 'due now';

    const minutes = Math.round(delta / 60000);
    if (minutes < 90) return `due in ${minutes}m`;

    const hours = delta / 3600000;
    if (hours < 48) return `due in ${hours.toFixed(1)}h`;

    const days = delta / 86400000;
    return `due in ${days.toFixed(1)}d`;
}

function summarizeSRCard(card) {
    if (!card) return '';
    const stateName = SR_STATE_NAMES[card.state] || 'New';
    const dueText = formatSRDueText(card.due);
    return `${stateName} • ${dueText}`;
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
    const stored = localStorage.getItem(SCHEDULER_MODE_KEY);
    if (stored && Object.values(SCHEDULER_MODES).includes(stored)) {
        schedulerMode = stored;
    } else if (stored === 'fast-loop') {
        // Legacy mode: map old Fast Loop to weighted scheduler
        schedulerMode = SCHEDULER_MODES.WEIGHTED;
    } else {
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

function getSchedulerModeLabel(mode = schedulerMode) {
    switch (mode) {
        case SCHEDULER_MODES.WEIGHTED:
            return 'Confidence-weighted (recency + errors)';
        case SCHEDULER_MODES.ADAPTIVE_5:
            return 'Adaptive 5-card lane';
        case SCHEDULER_MODES.FEED:
            return 'Feed (explore/exploit)';
        case SCHEDULER_MODES.FEED_SR:
            return 'Feed SR (with graduation)';
        case SCHEDULER_MODES.BATCH_5:
            return 'Batch sets (5 → 10 after full pass)';
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
            return 'Feed mode with SR confidence graduation; cards leave hand when mastered.';
        case SCHEDULER_MODES.BATCH_5:
            return 'Disjoint 5-card sets until every word is seen, then 10-card sets for combined practice.';
        case SCHEDULER_MODES.ORDERED:
            return 'Walk through the list in defined order and wrap.';
        case SCHEDULER_MODES.RANDOM:
        default:
            return 'Pure shuffle from the current pool.';
    }
}

function getCurrentSkillKey(customMode = mode) {
    const m = customMode;
    if (m === 'char-to-meaning' || m === 'char-to-meaning-type' || m === 'meaning-to-char' || m === 'audio-to-meaning') {
        return 'meaning';
    }
    if (m === 'char-to-pinyin' || m === 'char-to-pinyin-mc' || m === 'char-to-pinyin-tones-mc' || m === 'char-to-pinyin-type' || m === 'pinyin-to-char' || m === 'audio-to-pinyin' || m === 'char-to-tones') {
        return 'pinyin';
    }
    if (m === 'stroke-order' || m === 'handwriting' || m === 'draw-char') {
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
    saveSchedulerStats();
    renderConfidenceList();

    if (schedulerMode === SCHEDULER_MODES.BATCH_5) {
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

    saveSchedulerStats();

    if (schedulerMode === SCHEDULER_MODES.BATCH_5) {
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
    const lastWrongAgo = stats.lastWrong ? (Date.now() - stats.lastWrong) / 1000 : Infinity;

    if (served < ADAPTIVE_GRAD_MIN_SERVED) return false;
    if (streak < ADAPTIVE_GRAD_MIN_STREAK) return false;
    if (!confidenceOk) return false;
    if (lastWrongAgo < ADAPTIVE_RECENT_WRONG_COOLDOWN) return false;
    return true;
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
    console.log('Wrong cooldown (sec):', ADAPTIVE_RECENT_WRONG_COOLDOWN);
    console.log('');

    deck.forEach(char => {
        const stats = getSchedulerStats(char);
        const score = getConfidenceScore(char);
        const lastWrongAgo = stats.lastWrong ? (Date.now() - stats.lastWrong) / 1000 : Infinity;

        const checks = {
            served: (stats.served || 0) >= ADAPTIVE_GRAD_MIN_SERVED,
            streak: (stats.streak || 0) >= ADAPTIVE_GRAD_MIN_STREAK,
            confidence: score >= threshold,
            cooldown: lastWrongAgo >= ADAPTIVE_RECENT_WRONG_COOLDOWN
        };
        const wouldGraduate = checks.served && checks.streak && checks.confidence && checks.cooldown;

        console.log(`${char}: served=${stats.served || 0}, streak=${stats.streak || 0}, score=${score.toFixed(2)}, lastWrongAgo=${lastWrongAgo.toFixed(0)}s`);
        console.log(`  Checks: served=${checks.served}, streak=${checks.streak}, confidence=${checks.confidence}, cooldown=${checks.cooldown}`);
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

    if (!stats || stats.attempts === 0) {
        // Unseen cards get high priority, especially early on
        // Score scales with how much we've explored - less explored = higher unseen priority
        const explorationRatio = getFeedExplorationRatio();
        let baseScore = explorationRatio < 0.5 ? 3.0 : 2.0;

        // In Feed SR mode, boost priority for low-SR-confidence cards we haven't seen this session
        if (useSRConfidence) {
            const srScore = getConfidenceScore(char);
            const threshold = getConfidenceMasteryThreshold();
            // Low SR confidence = higher priority
            const srBoost = Math.max(0, (threshold - srScore) / threshold);
            baseScore += srBoost * 1.5;
        }

        return baseScore + Math.random() * 0.5;
    }

    const sessionConfidence = stats.correct / stats.attempts;
    const explorationBonus = FEED_UCB_C * Math.sqrt(Math.log(totalPulls) / stats.attempts);

    // Higher score = more likely to pick
    // Low confidence OR rarely seen = high score
    let score = (1 - sessionConfidence) + explorationBonus;

    // In Feed SR mode, also factor in persistent SR confidence
    if (useSRConfidence) {
        const srScore = getConfidenceScore(char);
        const threshold = getConfidenceMasteryThreshold();
        // Low SR confidence = higher priority (boost score)
        const srBoost = Math.max(0, (threshold - srScore) / threshold);
        score += srBoost * 0.5;
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

    if (explorationRatio < 0.3) {
        // Still exploring - larger hand to cycle through more cards
        return Math.min(FEED_MAX_HAND_SIZE, poolSize);
    } else if (explorationRatio < 0.6) {
        // Middle phase - moderate hand size
        return Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_DEFAULT_HAND_SIZE + 2, weakCount + 3));
    } else {
        // Explored most of the deck - shrink to focus on weak cards
        // Hand size based on how many weak cards exist
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
            // Feed SR: graduate when SR confidence is high enough AND we've seen it this session
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
    if (schedulerMode !== SCHEDULER_MODES.FEED) {
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
    if (schedulerMode !== SCHEDULER_MODES.FEED) return;
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
    if (schedulerMode !== SCHEDULER_MODES.FEED) return;
    reconcileFeedStateWithPool();
    ensureFeedHand();
    updateFeedStatusDisplay();
}

function updateFeedStatusDisplay() {
    const statusEl = document.getElementById('schedulerStatus');
    if (!statusEl) return;
    const isFeedSR = schedulerMode === SCHEDULER_MODES.FEED_SR;
    const isFeed = schedulerMode === SCHEDULER_MODES.FEED;
    if (!isFeed && !isFeedSR) {
        // Clear feed display if we're in a different mode
        if (statusEl.innerHTML.includes('Feed Mode') || statusEl.innerHTML.includes('Feed SR')) {
            statusEl.innerHTML = '';
        }
        return;
    }

    const hand = feedModeState.hand || [];
    const seenCount = Object.keys(feedModeState.seen || {}).length;
    const poolSize = Array.isArray(quizCharacters) ? quizCharacters.length : 0;
    const explorationPct = poolSize > 0 ? Math.round((seenCount / poolSize) * 100) : 0;
    const threshold = getConfidenceMasteryThreshold();

    // Count weak cards and mastered cards
    let weakCount = 0;
    let masteredCount = 0;
    for (const char of Object.keys(feedModeState.seen || {})) {
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
            // Show SR confidence score for Feed SR mode
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

    const modeLabel = isFeedSR ? 'Feed SR Mode' : 'Feed Mode';
    const statsLine = isFeedSR
        ? `${explorationPct}% explored · ${masteredCount} mastered · ${weakCount} weak · ${feedModeState.totalPulls || 0} pulls`
        : `${explorationPct}% explored · ${weakCount} weak · ${feedModeState.totalPulls || 0} pulls`;

    statusEl.className = 'mt-1 text-xs text-purple-800';
    statusEl.innerHTML = `
        <div class="text-[11px] font-semibold uppercase tracking-[0.25em] text-purple-500">${modeLabel}</div>
        <div class="text-sm text-purple-900">Hand (${hand.length}): ${handBadges || '<em>empty</em>'}</div>
        <div class="text-[11px] text-purple-700">${statsLine}</div>
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

function getHeuristicConfidenceScore(char) {
    const stats = getSchedulerStats(char);
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
            confidencePanelVisible = deckSize <= CONFIDENCE_AUTO_HIDE_THRESHOLD;
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

function setConfidencePanelVisible(visible) {
    confidencePanelVisible = Boolean(visible);
    if (confidencePanel) {
        confidencePanel.classList.toggle('hidden', !confidencePanelVisible);
    }
    const toggleBtn = document.getElementById('confidenceToggleBtn');
    if (toggleBtn) {
        toggleBtn.textContent = confidencePanelVisible ? 'Hide' : 'Show';
        toggleBtn.setAttribute('aria-pressed', confidencePanelVisible ? 'true' : 'false');
    }
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

function ensureConfidencePanel() {
    if (typeof document === 'undefined') return;
    if (confidencePanel && confidenceListElement && confidenceSummaryElement) return;

    const firstModeBtn = document.querySelector('.mode-btn');
    const sidebar = firstModeBtn
        ? firstModeBtn.closest('.w-64') || firstModeBtn.closest('.bg-white') || firstModeBtn.closest('.shadow-lg')
        : null;

    if (!sidebar) return;

    let panel = document.getElementById('confidencePanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'confidencePanel';
        panel.className = 'mt-6 border-t border-gray-200 pt-4';
        panel.innerHTML = `
            <div class="flex items-center justify-between gap-2 mb-2">
                <div>
                    <div class="text-[11px] uppercase tracking-[0.28em] text-gray-400">Confidence</div>
                    <div class="text-sm font-semibold text-gray-900">Least → Most sure</div>
                    <div id="confidenceGoalBadge" class="hidden inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">All ≥ ${CONFIDENCE_GOAL}</div>
                </div>
                <div class="flex flex-col items-end gap-1">
                    <div class="flex items-center gap-1">
                        <span id="confidenceLiveLabel" class="text-[11px] text-gray-500">live</span>
                        <button id="confidenceTrackingToggle" type="button" class="text-[11px] font-semibold text-green-600 px-1 py-0.5 rounded hover:bg-gray-100" title="Toggle live tracking">On</button>
                    </div>
                    <button id="confidenceToggleBtn" type="button" class="text-[11px] font-semibold text-blue-600 px-2 py-1 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200" aria-pressed="true">Hide</button>
                </div>
            </div>
            <div id="confidenceSummary" class="text-xs text-gray-500 mb-2"></div>
            <div id="confidenceList" class="space-y-1 max-h-[68vh] overflow-y-auto pr-1"></div>
        `;
        sidebar.appendChild(panel);
    }

    confidencePanel = panel;
    confidenceListElement = panel.querySelector('#confidenceList');
    confidenceSummaryElement = panel.querySelector('#confidenceSummary');

    const toggleBtn = document.getElementById('confidenceToggleBtn');
    if (toggleBtn && !toggleBtn.dataset.bound) {
        toggleBtn.dataset.bound = 'true';
        toggleBtn.addEventListener('click', toggleConfidencePanel);
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

    return `
        <div class="flex items-center justify-between gap-2 px-2 py-1 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition">
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-2xl font-semibold text-gray-900">${escapeHtml(item.char || '?')}</span>
                <div class="min-w-0">
                    ${pinyin ? `<div class="text-xs text-gray-600 truncate">${escapeHtml(pinyin)}</div>` : ''}
                    <div class="text-[11px] text-gray-500">${served ? `${accPct}% · ${served} seen` : 'new'}</div>
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <div class="w-14 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full ${barColor}" style="width: ${pct}%;"></div>
                </div>
                <span class="text-[11px] font-semibold text-gray-700">${scoreDisplay}${masteredBadge}</span>
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

    if (!confidencePanelVisible) return; // avoid extra work when hidden

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
    return cycle > 0 ? BATCH_COMBINED_SIZE : BATCH_INITIAL_SIZE;
}

function selectBatchFromPool(pool, size) {
    const targetSize = Number.isFinite(size) ? size : getCurrentBatchSize();
    if (!Array.isArray(pool) || !pool.length) return [];
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(targetSize, shuffled.length));
}

function startNewBatch() {
    if (schedulerMode !== SCHEDULER_MODES.BATCH_5) return;

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
    if (schedulerMode !== SCHEDULER_MODES.BATCH_5) {
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
    if (schedulerMode !== SCHEDULER_MODES.BATCH_5) {
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
    if (schedulerMode !== SCHEDULER_MODES.BATCH_5) return;
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
    if (schedulerMode !== SCHEDULER_MODES.BATCH_5) return;
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

    if (schedulerMode !== SCHEDULER_MODES.BATCH_5) {
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
            const ready = shouldGraduateAdaptiveChar(item.char);
            const cls = ready ? 'text-emerald-700 font-semibold' : 'text-gray-900';
            return `<span class="${cls}">${escapeHtml(item.char)}</span>`;
        }).join(' ')
        : '—';

    statusEl.className = 'mt-1 text-xs text-indigo-800';
    statusEl.innerHTML = `
        <div class="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-500">Adaptive 5</div>
        <div class="text-sm text-indigo-900">Deck (${deckItems.length}/${ADAPTIVE_DECK_SIZE}): ${deckBadges}</div>
        <div class="text-[11px] text-indigo-700">${masteredCount} graduated · ${remaining} remaining · cycle ${cycleNumber}</div>
    `;
}

function setSchedulerMode(mode) {
    if (!Object.values(SCHEDULER_MODES).includes(mode)) return;
    const switchingToBatch = mode === SCHEDULER_MODES.BATCH_5 && schedulerMode !== SCHEDULER_MODES.BATCH_5;
    schedulerMode = mode;
    saveSchedulerMode(mode);
    if (switchingToBatch) {
        resetBatchState({ refresh: false });
    }
    updateSchedulerToolbar();
    if (schedulerMode === SCHEDULER_MODES.BATCH_5) {
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
    if (schedulerMode === SCHEDULER_MODES.BATCH_5) {
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
        const label = srEnabled ? summarizeSRCard(getSRCardData(item.char)) : 'SR off';
        const pinyin = item.pinyin ? item.pinyin.split('/')[0].trim() : '';
        const isCurrent = currentQuestion && currentQuestion.char === item.char;
        return `
            <li class="flex items-center justify-between gap-3 border ${isCurrent ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-transparent'} rounded-lg px-3 py-2">
                <div class="flex items-center gap-3">
                    <span class="text-xs font-semibold text-gray-500">#${idx + 1}</span>
                    <span class="text-2xl font-bold text-gray-900">${escapeHtml(item.char || '?')}</span>
                    <span class="text-sm text-gray-500">${escapeHtml(pinyin)}</span>
                </div>
                <span class="text-xs ${isCurrent ? 'text-blue-700' : 'text-gray-600'}">${label}</span>
            </li>
        `;
    }).join('');

    queueEl.innerHTML = items;
}

function ensureSchedulerToolbar() {
    const container =
        document.querySelector('.quiz-shell') ||
        document.querySelector('.max-w-3xl') ||
        document.getElementById('questionDisplay')?.parentElement;
    const question = document.getElementById('questionDisplay');
    if (!container || !question) return;

    let bar = document.getElementById('schedulerToolbar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'schedulerToolbar';
        bar.className = 'mb-4 flex flex-wrap gap-2 justify-center items-center';
        bar.innerHTML = `
            <button id="schedulerRandomBtn" type="button" class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition">Random</button>
            <button id="schedulerWeightedBtn" type="button" class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition">Confidence</button>
            <button id="schedulerAdaptiveBtn" type="button" class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition">Adaptive 5</button>
            <button id="schedulerFeedBtn" type="button" class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition">Feed</button>
            <button id="schedulerFeedSRBtn" type="button" class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition">Feed SR</button>
            <button id="schedulerBatchBtn" type="button" class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition">5-Card Sets</button>
            <button id="schedulerOrderedBtn" type="button" class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition">In Order</button>
            <div id="schedulerModeLabel" class="hidden"></div>
            <div id="schedulerModeDescription" class="hidden"></div>
            <div id="batchModeStatus" class="hidden"></div>
            <div id="adaptiveModeStatus" class="hidden"></div>
        `;
        container.insertBefore(bar, question);
    }

    const randomBtn = document.getElementById('schedulerRandomBtn');
    const weightedBtn = document.getElementById('schedulerWeightedBtn');
    const adaptiveBtn = document.getElementById('schedulerAdaptiveBtn');
    const feedBtn = document.getElementById('schedulerFeedBtn');
    const feedSRBtn = document.getElementById('schedulerFeedSRBtn');
    const batchBtn = document.getElementById('schedulerBatchBtn');
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
    updateFeedStatusDisplay();
    updateFullscreenNextSetButton();
}

function updateFullscreenNextSetButton() {
    const btn = document.getElementById('fullscreenNextSetBtn');
    if (!btn) return;

    const inBatchMode = schedulerMode === SCHEDULER_MODES.BATCH_5;
    btn.disabled = !inBatchMode;
    btn.className = inBatchMode
        ? 'px-4 py-2 rounded-xl border border-amber-200 text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100 transition'
        : 'px-4 py-2 rounded-xl border border-gray-200 text-gray-400 font-semibold bg-gray-50 cursor-not-allowed transition';
    btn.title = inBatchMode ? 'Load a fresh 5-card set now' : 'Switch to 5-Card Sets to use this';
}

function refreshSrQueue(regenerateQuestion = false) {
    if (!Array.isArray(originalQuizCharacters) || !originalQuizCharacters.length) return;

    quizCharacters = applySRFiltering(originalQuizCharacters);
    reconcileBatchStateWithQueue();
    reconcileAdaptiveStateWithPool();
    if (schedulerMode === SCHEDULER_MODES.BATCH_5) {
        prepareBatchForNextQuestion();
    }
    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        prepareAdaptiveForNextQuestion();
    }

    if (previewQueueEnabled) {
        previewQueue = [];
        ensurePreviewQueue();
        updatePreviewDisplay();
    }

    showSRBanner();

    if (regenerateQuestion && typeof generateQuestion === 'function') {
        generateQuestion();
    }

    updateFullscreenQueueDisplay();
    renderConfidenceList();
}

function setSRAggressiveMode(enabled, options = {}) {
    srAggressiveMode = Boolean(enabled);
    try {
        localStorage.setItem(SR_AGGRESSIVE_KEY, srAggressiveMode.toString());
    } catch (e) {
        console.warn('Failed to save aggressive SR state', e);
    }

    if (options.refreshQueue !== false) {
        refreshSrQueue(options.regenerateQuestion);
    }

    updateDrawingSrUI();
    updateFullscreenSrUI();
}

function toggleSRAggressiveMode() {
    setSRAggressiveMode(!srAggressiveMode, { regenerateQuestion: true });
}

function updateDrawingSrUI() {
    const statusEl = document.getElementById('drawSrStatus');
    const cardEl = document.getElementById('drawSrCardState');
    const panelEl = document.getElementById('drawSrPanel');
    const toggleBtn = document.getElementById('drawSrToggleBtn');
    const statsBtn = document.getElementById('drawSrStatsBtn');
    const aggressiveBtn = document.getElementById('drawAggressiveBtn');

    if (!statusEl && !cardEl && !panelEl) return;

    const stats = getSRStats();
    const srActive = stats.enabled;

    if (panelEl) {
        panelEl.className = srActive
            ? 'rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3'
            : 'rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3';
    }

    if (statusEl) {
        statusEl.textContent = srActive
            ? `${stats.dueToday} due · ${stats.total} total • ${Object.keys(srData || {}).length} tracked`
            : 'Spaced repetition is off (showing all cards)';
        statusEl.className = srActive
            ? 'text-sm font-semibold text-blue-900'
            : 'text-sm font-semibold text-gray-700';
    }

    if (cardEl) {
        if (srActive && currentQuestion && currentQuestion.char) {
            const card = getSRCardData(currentQuestion.char);
            cardEl.textContent = summarizeSRCard(card);
            cardEl.className = 'text-xs text-blue-800';
        } else if (srActive) {
            cardEl.textContent = 'Waiting to schedule the current card…';
            cardEl.className = 'text-xs text-blue-800';
        } else {
            cardEl.textContent = 'Enable SR to see when drawing reviews are due.';
            cardEl.className = 'text-xs text-gray-600';
        }
    }

    if (toggleBtn) {
        toggleBtn.textContent = srActive ? 'Disable SR' : 'Enable SR';
        toggleBtn.className = srActive
            ? 'px-3 py-2 rounded-lg border border-blue-300 text-blue-700 font-semibold hover:border-blue-400 hover:text-blue-800 transition'
            : 'px-3 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition';
    }

    const statsDisabled = !srEnabled;
    if (statsBtn) {
        statsBtn.disabled = statsDisabled;
        statsBtn.className = statsDisabled
            ? 'px-3 py-2 rounded-lg border border-gray-200 text-gray-400 font-semibold cursor-not-allowed transition'
            : 'px-3 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition';
    }

    if (aggressiveBtn) {
        aggressiveBtn.disabled = !srEnabled;
        aggressiveBtn.textContent = srAggressiveMode ? 'Aggressive SR: On' : 'Aggressive SR: Off';
        aggressiveBtn.className = srAggressiveMode && srEnabled
            ? 'px-3 py-2 rounded-lg border border-red-300 text-red-700 font-semibold bg-red-50 hover:border-red-400 hover:text-red-800 transition'
            : srEnabled
                ? 'px-3 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition'
                : 'px-3 py-2 rounded-lg border border-gray-200 text-gray-400 font-semibold cursor-not-allowed transition';
    }
}

function updateFullscreenSrUI() {
    const statusEl = document.getElementById('fullscreenSrStatus');
    const cardEl = document.getElementById('fullscreenSrCardState');
    const toggleBtn = document.getElementById('fullscreenSrToggleBtn');
    const statsBtn = document.getElementById('fullscreenSrStatsBtn');
    const aggressiveBtn = document.getElementById('fullscreenAggressiveBtn');

    if (!statusEl && !cardEl) return;

    const stats = getSRStats();
    const srActive = stats.enabled;

    if (statusEl) {
        statusEl.textContent = srActive
            ? `${stats.dueToday} due · ${stats.total} total`
            : 'SR off';
        statusEl.className = srActive
            ? 'text-sm font-semibold text-blue-900'
            : 'text-sm font-semibold text-gray-700';
    }

    if (cardEl) {
        if (srActive && currentQuestion && currentQuestion.char) {
            const card = getSRCardData(currentQuestion.char);
            cardEl.textContent = summarizeSRCard(card);
            cardEl.className = 'text-xs text-blue-800';
        } else if (srActive) {
            cardEl.textContent = 'Waiting to track this card…';
            cardEl.className = 'text-xs text-blue-800';
        } else {
            cardEl.textContent = 'Enable SR to see schedule details.';
            cardEl.className = 'text-xs text-gray-600';
        }
    }

    if (toggleBtn) {
        toggleBtn.textContent = srActive ? 'Disable SR' : 'Enable SR';
        toggleBtn.className = srActive
            ? 'px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 font-semibold hover:border-blue-400 hover:text-blue-800 transition'
            : 'px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition';
    }

    const statsDisabled = !srEnabled;
    if (statsBtn) {
        statsBtn.disabled = statsDisabled;
        statsBtn.className = statsDisabled
            ? 'px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 font-semibold cursor-not-allowed transition'
            : 'px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 font-semibold hover:border-blue-400 hover:text-blue-800 transition';
    }

    if (aggressiveBtn) {
        aggressiveBtn.disabled = !srEnabled;
        aggressiveBtn.textContent = srAggressiveMode ? 'Aggressive SR: On' : 'Aggressive SR: Off';
        aggressiveBtn.className = srAggressiveMode && srEnabled
            ? 'px-3 py-1.5 rounded-lg border border-red-200 text-red-700 font-semibold bg-red-50 hover:border-red-400 hover:text-red-800 transition'
            : srEnabled
                ? 'px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 font-semibold hover:border-blue-400 hover:text-blue-800 transition'
                : 'px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 font-semibold cursor-not-allowed transition';
    }

    updateFullscreenQueueDisplay();
}

function showSrStatsAlert() {
    const stats = getSRStats();
    if (!stats.enabled) {
        alert('Spaced repetition is currently off.');
        return;
    }

    alert(
        `Spaced Repetition Stats:\n\n` +
        `Due today: ${stats.dueToday}\n` +
        `Total cards: ${stats.total}\n` +
        `Tracked cards: ${stats.reviewed}`
    );
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
    if (schedulerMode === SCHEDULER_MODES.BATCH_5) {
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

// Normalize a pinyin string for strict but punctuation-agnostic comparison.
// Keeps tone numbers (using convertPinyinToToneNumbers) so tone accuracy is still required,
// but strips spaces, dots, commas, and other separators so variants like
// "bān chū.qù", "ban1 chu1 qu4", and "ban1chu1qu4" compare equal.
function normalizePinyinForChoice(pinyin) {
    if (!pinyin) return '';
    const asNumbers = convertPinyinToToneNumbers(pinyin.toLowerCase().trim());
    return asNumbers.replace(PINYIN_STRIP_REGEX, '');
}

function normalizePinyin(pinyin) {
    // Normalize pinyin to a standard form for comparison
    // 1. Convert to lowercase
    // 2. Remove all separators/punctuation
    // 3. Remove all tone numbers
    // 4. Remove all tone marks
    // 5. Result: pure letters only (e.g., "zhongguo")

    let result = pinyin.toLowerCase().trim();

    // Remove all separators and punctuation
    result = result.replace(PINYIN_STRIP_REGEX, '');

    // Normalize ü/u: variants to 'v'
    result = result.replace(/u:/g, 'v');

    // Remove tone numbers (1-5)
    result = result.replace(/[1-5]/g, '');

    // Remove tone marks by replacing with base vowels
    for (const [marked, base] of Object.entries(TONE_MARK_TO_BASE)) {
        result = result.replace(new RegExp(marked, 'g'), base);
    }

    return result;
}

function extractToneSequence(pinyin) {
    const syllables = splitPinyinSyllables(pinyin);
    if (syllables.length === 0) return '';

    let tones = '';

    syllables.forEach(syl => {
        let tone = null;
        for (let i = 0; i < syl.length; i++) {
            const char = syl[i];
            if (/[1-5]/.test(char)) {
                tone = char;
                break;
            }

            const lower = char.toLowerCase();
            if (TONE_MARK_TO_NUMBER[lower]) {
                tone = TONE_MARK_TO_NUMBER[lower];
                break;
            }
        }

        if (!tone) {
            tone = '5';
        }

        tones += tone;
    });

    return tones;
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
    if ((mode !== 'char-to-pinyin' && mode !== 'audio-to-pinyin') || answered) return;

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

function generateQuestion(options = {}) {
    const prefillAnswer = typeof options.prefillAnswer === 'string'
        ? options.prefillAnswer
        : (typeof nextAnswerBuffer === 'string' ? nextAnswerBuffer : '');
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
    if (answerInput) {
        answerInput.value = prefillAnswer;
    }
    questionAttemptRecorded = false;
    handwritingAnswerShown = false; // Reset handwriting answer shown state
    lastAnswerCorrect = false;
    clearComponentBreakdown();
    hideDrawNextButton();

    if (schedulerMode === SCHEDULER_MODES.BATCH_5) {
        prepareBatchForNextQuestion();
    }
    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        prepareAdaptiveForNextQuestion();
    }

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
        nextQuestion = selectNextQuestion();
    }

    if (!nextQuestion) {
        questionDisplay.innerHTML = `<div class="text-center text-2xl text-red-600 my-8">No questions available.</div>`;
        return;
    }

    currentQuestion = nextQuestion;
    updatePreviewDisplay();
    window.currentQuestion = currentQuestion;
    markSchedulerServed(currentQuestion);

    // Clear any previous per-character breakdown
    const prevBreakdown = document.getElementById('charBreakdown');
    if (prevBreakdown) prevBreakdown.remove();

    // Clear input fields to prevent autofilled values (e.g., "yi dian er ling" from TTS speed)
    if (answerInput) {
        answerInput.value = prefillAnswer;
    }
    if (fuzzyInput) {
        // Also prefill fuzzyInput for char-to-meaning-type mode prefiring
        fuzzyInput.value = prefillAnswer;
    }

    // Hide all mode containers
    typeMode.style.display = 'none';
    if (choiceMode) choiceMode.style.display = 'none';
    if (fuzzyMode) fuzzyMode.style.display = 'none';
    if (strokeOrderMode) strokeOrderMode.style.display = 'none';
    if (handwritingMode) handwritingMode.style.display = 'none';
    if (drawCharMode) drawCharMode.style.display = 'none';
    if (studyMode) studyMode.style.display = 'none';
    if (radicalPracticeMode) radicalPracticeMode.style.display = 'none';
    if (audioSection) audioSection.classList.add('hidden');
    resetDictationState();

    // Show appropriate UI based on mode
    if (mode === 'char-to-pinyin') {
        renderDictationSentence(currentQuestion);
        typeMode.style.display = 'block';
        setTimeout(() => answerInput.focus(), 100);
    } else if (mode === 'char-to-tones') {
        const expectedTones = extractToneSequence(currentQuestion.pinyin.split('/')[0].trim());
        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div><div style="text-align: center; color: #999; font-size: 14px; margin-top: -20px;">Type tone numbers (1-5). Need ${expectedTones.length} tone${expectedTones.length > 1 ? 's' : ''}. Enter/Ctrl+C to clear.</div>`;
        typeMode.style.display = 'block';
        setTimeout(() => answerInput.focus(), 100);
    } else if (mode === 'audio-to-pinyin' && audioSection) {
        questionDisplay.innerHTML = `<div class="text-center text-6xl my-8 font-bold text-gray-700">🔊 Listen</div>`;
        typeMode.style.display = 'block';
        audioSection.classList.remove('hidden');
        setupAudioMode({ focusAnswer: true });
    } else if (mode === 'audio-to-meaning' && audioSection && choiceMode) {
        questionDisplay.innerHTML = `<div class="text-center text-6xl my-8 font-bold text-gray-700">🔊 Listen</div><div class="text-center text-lg text-gray-500 -mt-4">Choose the matching meaning</div>`;
        audioSection.classList.remove('hidden');
        generateMeaningOptions();
        choiceMode.style.display = 'block';
        setupAudioMode({ focusAnswer: false });
    } else if (mode === 'char-to-pinyin-mc' && choiceMode) {
        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div>`;
        generatePinyinOptions();
        choiceMode.style.display = 'block';
    } else if (mode === 'char-to-pinyin-type' && fuzzyMode) {
        renderThreeColumnPinyinLayout();
        generateFuzzyPinyinOptions();
        fuzzyMode.style.display = 'block';
    } else if (mode === 'char-to-pinyin-tones-mc' && fuzzyMode) {
        renderThreeColumnPinyinLayout();
        startPinyinToneMcFlow(true); // use fuzzy input for the pinyin step
        fuzzyMode.style.display = 'block';
    } else if (mode === 'pinyin-to-char' && choiceMode) {
        questionDisplay.innerHTML = `<div style="text-align: center; font-size: 48px; margin: 40px 0;">${currentQuestion.pinyin}</div>`;
        generateCharOptions();
        choiceMode.style.display = 'block';
    } else if (mode === 'char-to-meaning' && choiceMode) {
        renderMeaningQuestionLayout();
        generateMeaningOptions();
        choiceMode.style.display = 'block';
        updateMeaningChoicesVisibility();
    } else if (mode === 'char-to-meaning-type' && fuzzyMode) {
        renderThreeColumnMeaningLayout();
        generateFuzzyMeaningOptions();
        fuzzyMode.style.display = 'block';
    } else if (mode === 'meaning-to-char' && choiceMode) {
        questionDisplay.innerHTML = `<div style="text-align: center; font-size: 36px; margin: 40px 0;">${currentQuestion.meaning}</div>`;
        generateCharOptions();
        choiceMode.style.display = 'block';
    } else if (mode === 'stroke-order' && strokeOrderMode) {
        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div><div class="text-center text-lg text-gray-500 mt-2">Trace each stroke in order</div>`;
        strokeOrderMode.style.display = 'block';
        initStrokeOrder();
    } else if (mode === 'handwriting' && handwritingMode) {
        const cleanChars = stripPlaceholderChars(currentQuestion.char);
        const displayPinyin = prettifyHandwritingPinyin(currentQuestion.pinyin);
        const charCount = cleanChars.length || currentQuestion.char.length;
        const charText = charCount > 1 ? `Practice ${charCount} characters: ` : 'Practice: ';
        questionDisplay.innerHTML = `<div class="text-center text-6xl my-8 font-bold text-gray-700">${charText}${displayPinyin}</div>`;
        handwritingMode.style.display = 'block';
        initHandwriting();
    } else if (mode === 'draw-char' && drawCharMode) {
        const charCount = currentQuestion.char.length;
        const charText = charCount > 1 ? `Draw ${charCount} characters: ` : 'Draw: ';
        const pinyinParts = currentQuestion.pinyin.split(/[.\s]+/).filter(p => p).join(' + ');
        const meaningText = currentQuestion.meaning ? ` <span class="text-2xl text-gray-500">(${currentQuestion.meaning})</span>` : '';
        questionDisplay.innerHTML = `<div class="text-center text-4xl my-8 font-bold text-gray-700">${charText}${pinyinParts}${meaningText}</div>`;
        drawCharMode.style.display = 'block';
        initCanvas();
        clearCanvas();
    } else if (mode === 'study' && studyMode) {
        questionDisplay.innerHTML = `<div class="text-center text-4xl my-8 font-bold text-gray-700">Study All Vocabulary</div>`;
        studyMode.style.display = 'block';
        populateStudyList();
    } else if (mode === 'radical-practice' && radicalPracticeMode) {
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
            return;
        }

        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div><div class="text-center text-xl text-gray-600 mt-4">Select ALL radicals in this character</div>`;
        radicalPracticeMode.style.display = 'block';
        generateRadicalOptions();
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

    // Show SR card info if enabled
    if (srEnabled && currentQuestion) {
        showSRCardInfo(currentQuestion.char);
    }

    // Update SR UI for drawing surfaces
    updateDrawingSrUI();
    updateFullscreenSrUI();
    updateFullscreenQueueDisplay();

    // Show current word confidence
    updateCurrentWordConfidence();

    // Track response time for FSRS
    srQuestionStartTime = Date.now();
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

function setupAudioMode(options = {}) {
    const { focusAnswer = true } = options;
    const playBtn = document.getElementById('playAudioBtn');
    if (!playBtn || !currentQuestion) return;

    ensureTtsSpeedControl();

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

    if (focusAnswer && answerInput && isElementReallyVisible(answerInput)) {
        setTimeout(() => answerInput.focus(), 100);
    }

    // Auto-play once
    setTimeout(() => {
        playCurrentPrompt();
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

            // Update SR data on correct answer
            if (srEnabled && currentQuestion && currentQuestion.char) {
                const responseTime = Date.now() - srQuestionStartTime;
                updateSRCard(currentQuestion.char, true, responseTime);
            }

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

            // Update SR data on wrong answer
            if (srEnabled && currentQuestion && currentQuestion.char) {
                const responseTime = Date.now() - srQuestionStartTime;
                updateSRCard(currentQuestion.char, false, responseTime);
            }

            feedback.textContent = `✗ Wrong. The answer is: ${expectedTones} (${currentQuestion.pinyin})`;
            feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
            hint.textContent = `Meaning: ${currentQuestion.meaning}`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-red-600';
            renderCharacterComponents(currentQuestion);
            renderCharBreakdownSoon();

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
    }
}

function handleCorrectFullAnswer() {
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

    // Update SR data on correct answer
    if (srEnabled && currentQuestion && currentQuestion.char) {
        const responseTime = Date.now() - srQuestionStartTime;
        updateSRCard(currentQuestion.char, true, responseTime);
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
    if (mode === 'char-to-pinyin') {
        updateDictationProgress(dictationTotalSyllables || 0);
    }

    updateStats();
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

        if (mode === 'audio-to-pinyin') {
            feedback.textContent = `✓ Correct! ${currentQuestion.pinyin} (${currentQuestion.char})`;
        } else {
            feedback.textContent = `✓ Correct! ${currentQuestion.char} = ${currentQuestion.pinyin}`;
        }
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        hint.textContent = `Meaning: ${currentQuestion.meaning}`;
        hint.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        renderCharacterComponents(currentQuestion);
        if (mode === 'char-to-pinyin') {
            updateDictationProgress(dictationTotalSyllables || enteredSyllables.length);
        }

        updateStats();
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

    // Play audio for the character
    const firstPinyin = currentQuestion.pinyin.split('/').map(p => p.trim())[0];
    if (window.playPinyinAudio) {
        playPinyinAudio(firstPinyin, currentQuestion.char);
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

        scheduleNextQuestion(800);
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

        scheduleNextQuestion(1500);
    }

    updateStats();
}

// =====================
// Char → Pinyin → Tones (MC) flow
// =====================

function startPinyinToneMcFlow(useFuzzyInput = false) {
    const primaryPinyin = currentQuestion.pinyin.split('/')[0].trim();
    // Split into syllables
    toneFlowSyllables = primaryPinyin.split(/\s+/).filter(Boolean);
    toneFlowChars = (currentQuestion.char || '').replace(/[＿_]/g, '').split('');
    toneFlowExpected = toneFlowSyllables.map(syl => {
        const toneSeq = extractToneSequence(syl);
        return toneSeq ? Number(toneSeq) : 5;
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

    // Generate 3 wrong options
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

function handleToneFlowPinyinChoiceSingle(choice, btn) {
    if (toneFlowStage !== 'pinyin') return;

    const currentSyllable = toneFlowSyllables[toneFlowIndex];
    const normalizedAnswer = normalizePinyinForChoice(choice);
    const normalizedExpected = normalizePinyinForChoice(currentSyllable);
    const correct = normalizedAnswer === normalizedExpected;

    disableChoices();

    if (correct) {
        btn.classList.add('bg-green-100', 'border-green-500');
        toneFlowCompletedPinyin.push(choice);
        // Clear input before switching to tone step
        if (fuzzyInput) {
            fuzzyInput.value = '';
        }
        setToneFlowPrompt(`Now pick tone for: ${toneFlowChars[toneFlowIndex]}`);
        toneFlowStage = 'tone';
        setTimeout(() => renderToneFlowToneStep(), 250);
    } else {
        btn.classList.add('bg-red-100', 'border-red-500');
        feedback.innerHTML = `Wrong — correct pinyin is <strong>${currentSyllable}</strong>`;
        feedback.className = 'text-center text-lg font-semibold text-red-600 my-2';
        if (fuzzyInput) {
            fuzzyInput.value = '';
        }
        setTimeout(() => {
            feedback.textContent = '';
            renderToneFlowCharacterStep();
        }, 800);
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
            hint.innerHTML = `<span class="text-blue-600 font-bold">${char} (${toneFlowCompletedPinyin[0]})</span> → <span class="text-gray-500">tone?</span>`;
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

        // Direct number match
        const numMatch = parseInt(input);
        if (numMatch >= 1 && numMatch <= 5) {
            highlightToneButton(numMatch);
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

    const expected = toneFlowExpected[toneFlowIndex];
    disableChoices();

    if (choice === expected) {
        btn.classList.add('bg-green-100', 'border-green-500');
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
            scheduleNextQuestion(900);
        } else {
            // Show brief success feedback before moving to next CHARACTER (pinyin step)
            feedback.textContent = '✓';
            feedback.className = 'text-center text-xl font-semibold text-green-600 my-2';
            // Clear the text box for the next character
            if (fuzzyInput) {
                fuzzyInput.value = '';
            }
            setTimeout(() => {
                feedback.textContent = '';
                renderToneFlowCharacterStep();  // Go to next character's pinyin
            }, 250);
        }
    } else {
        btn.classList.add('bg-red-100', 'border-red-500');
        // Show the correct answer
        const currentChar = toneFlowChars[toneFlowIndex] || '?';
        feedback.innerHTML = `Wrong — correct tone for <strong>${currentChar}</strong> is <strong>${expected}</strong>`;
        feedback.className = 'text-center text-lg font-semibold text-red-600 my-2';
        // Clear the text box immediately and refocus
        if (fuzzyInput) {
            fuzzyInput.value = '';
            setTimeout(() => fuzzyInput.focus(), 0);
        }
        setTimeout(() => {
            feedback.textContent = '';
            renderToneFlowToneStep();  // Stay on tone step for this character
        }, 800);
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
        // Default to enabled if not set
        if (storedEnabled === null) {
            timerEnabled = true;
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
            <div class="column-current column-card ${inlineFeedback ? (inlineFeedback.type === 'incorrect' ? 'has-error' : 'has-success') : ''}">
                <div class="column-label">Now</div>
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
            <div class="column-current column-card ${inlineFeedback ? (inlineFeedback.type === 'incorrect' ? 'has-error' : 'has-success') : ''}">
                <div class="column-label">Now</div>
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

function initStrokeOrder() {
    const writerDiv = document.getElementById('strokeOrderWriter');
    if (!writerDiv || typeof HanziWriter === 'undefined') return;

    writerDiv.innerHTML = '';

    const rawText = (currentQuestion.char || '').trim();
    if (!rawText) return;

    const characters = Array.from(rawText).filter(ch => /\S/.test(ch));
    if (!characters.length) return;

    let statusEl = document.getElementById('strokeOrderStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'strokeOrderStatus';
        statusEl.className = 'text-center text-xl font-semibold my-4 text-blue-600';
        strokeOrderMode.appendChild(statusEl);
    } else {
        statusEl.className = 'text-center text-xl font-semibold my-4 text-blue-600';
    }

    statusEl.textContent = 'Trace each stroke in order';

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
            writer = HanziWriter.create(writerDiv, targetChar, {
                width: 320,
                height: 320,
                padding: 8,
                showOutline: true,
                showCharacter: false,
                strokeAnimationSpeed: 1,
                delayBetweenStrokes: 0
            });
        } catch (error) {
            console.warn('Failed to initialize stroke order quiz for character:', targetChar, error);
            if (currentIndex < characters.length - 1) {
                currentIndex++;
                initializeCharacter();
                return;
            }
            scheduleNextQuestion(0);
            return;
        }

        statusEl.textContent = characters.length > 1
            ? `Trace each stroke (${currentIndex + 1}/${characters.length})`
            : 'Trace each stroke in order';
        statusEl.className = 'text-center text-xl font-semibold my-4 text-blue-600';

        let completed = false;

        writer.quiz({
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
    };

    initializeCharacter();
}

function initHandwriting() {
    const writerDiv = document.getElementById('handwritingWriter');
    if (!writerDiv || typeof HanziWriter === 'undefined') return;

    writerDiv.innerHTML = '';
    handwritingAnswerShown = false; // Reset answer shown state for new question

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
        // Show and animate all characters at once, playing audio for each
        writers.forEach((w, index) => {
            w.showCharacter();
            w.showOutline();
            w.animateCharacter();
            
            // Play audio for this character with a small delay to avoid overlap
            const char = chars[index];
            const charPinyin = charPinyins[index];
            if (charPinyin && typeof playPinyinAudio === 'function') {
                setTimeout(() => {
                    playPinyinAudio(charPinyin, char);
                }, index * 300); // Small delay between audio clips to avoid overlap
            }
        });

        const cleanChars = chars.join('');
        const displayPinyin = fullPinyin;
        feedback.textContent = `${cleanChars} (${displayPinyin}) - ${currentQuestion.meaning}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-blue-600';
        handwritingAnswerShown = true;
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
    const srToggleBtn = document.getElementById('drawSrToggleBtn');
    const srStatsBtn = document.getElementById('drawSrStatsBtn');
    const aggressiveBtn = document.getElementById('drawAggressiveBtn');

    if (clearBtn) clearBtn.onclick = clearCanvas;
    if (submitBtn) submitBtn.onclick = submitDrawing;
    if (showAnswerBtn) showAnswerBtn.onclick = revealDrawingAnswer;
    if (undoBtn) undoBtn.onclick = undoStroke;
    if (redoBtn) redoBtn.onclick = redoStroke;
    if (zoomInBtn) zoomInBtn.onclick = zoomIn;
    if (zoomOutBtn) zoomOutBtn.onclick = zoomOut;
    if (resetBtn) resetBtn.onclick = resetView;
    if (fullscreenBtn) fullscreenBtn.onclick = enterFullscreenDrawing;
    if (srToggleBtn && !srToggleBtn.dataset.bound) {
        srToggleBtn.dataset.bound = 'true';
        srToggleBtn.onclick = () => {
            toggleSREnabled();
            updateDrawingSrUI();
            updateFullscreenSrUI();
        };
    }
    if (srStatsBtn && !srStatsBtn.dataset.bound) {
        srStatsBtn.dataset.bound = 'true';
        srStatsBtn.onclick = () => {
            showSrStatsAlert();
        };
    }
    if (aggressiveBtn && !aggressiveBtn.dataset.bound) {
        aggressiveBtn.dataset.bound = 'true';
        aggressiveBtn.onclick = () => {
            toggleSRAggressiveMode();
            updateDrawingSrUI();
            updateFullscreenSrUI();
        };
    }

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

    const normalizedRecognized = normalizeDrawAnswer(recognized);
    const normalizedTarget = normalizeDrawAnswer(currentQuestion.char);
    const correct = normalizedRecognized === normalizedTarget;
    const isFirstAttempt = !answered;

    if (isFirstAttempt) {
        answered = true;
        total++;
        if (correct) {
            score++;
        }
        markSchedulerOutcome(correct);
        if (srEnabled && currentQuestion && currentQuestion.char) {
            const responseTime = Date.now() - srQuestionStartTime;
            updateSRCard(currentQuestion.char, correct, responseTime);
            updateDrawingSrUI();
            updateFullscreenSrUI();
        }
    }

    if (correct) {
        playCorrectSound();
        const tryAgainText = isFirstAttempt ? '' : ' (practice attempt)';
        feedback.textContent = `✓ Correct! ${currentQuestion.char} (${currentQuestion.pinyin})${tryAgainText}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
    } else {
        playWrongSound();
        const tryAgainText = isFirstAttempt ? ' - Keep practicing!' : ' - Try again!';
        feedback.textContent = `✗ Wrong! You wrote: ${recognized}, Correct: ${currentQuestion.char} (${currentQuestion.pinyin})${tryAgainText}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
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

    const ocrResult = document.getElementById('ocrResult');
    if (ocrResult) {
        ocrResult.textContent = currentQuestion.char;
        // Adjust font size for multi-character words to ensure all characters are visible
        ocrResult.style.fontFamily = "'Noto Sans SC', sans-serif";
        ocrResult.style.fontWeight = '700';
        if (currentQuestion.char.length > 1) {
            ocrResult.className = 'text-5xl min-h-[80px] text-blue-600 font-bold';
        } else {
            ocrResult.className = 'text-6xl min-h-[80px] text-blue-600 font-bold';
        }
    }

    // Show individual characters as candidates for multi-character words
    if (currentQuestion.char.length > 1) {
        const individualChars = currentQuestion.char.split('');
        updateOcrCandidates([currentQuestion.char, ...individualChars]);
    } else {
        updateOcrCandidates([currentQuestion.char]);
    }

    const isFirstReveal = !answered;

    if (isFirstReveal) {
        answered = true;
        total++;

        if (srEnabled && currentQuestion && currentQuestion.char) {
            const responseTime = Date.now() - srQuestionStartTime;
            updateSRCard(currentQuestion.char, false, responseTime);
            updateDrawingSrUI();
            updateFullscreenSrUI();
        }
        markSchedulerOutcome(false);
    }

    const meaningSuffix = currentQuestion.meaning ? ` – ${currentQuestion.meaning}` : '';
    const revealText = isFirstReveal ? 'ⓘ Answer: ' : 'ⓘ Answer (shown again): ';
    feedback.textContent = `${revealText}${currentQuestion.char} (${currentQuestion.pinyin})${meaningSuffix}`;
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

function enterFullscreenDrawing() {
    const container = document.getElementById('fullscreenDrawContainer');
    if (!container) return;

    isFullscreenMode = true;
    container.classList.remove('hidden');

    // Keep SR indicators in sync inside fullscreen
    updateFullscreenSrUI();

    // Update prompt
    const prompt = document.getElementById('fullscreenPrompt');
    if (prompt && currentQuestion) {
        prompt.textContent = `Draw: ${currentQuestion.pinyin}`;
    }

    // Initialize fullscreen canvas
    fullscreenCanvas = document.getElementById('fullscreenDrawCanvas');
    if (!fullscreenCanvas) return;

    // Set canvas size to better utilize screen space
    // Account for toolbar (80px) and padding, aim for square canvas
    const availableHeight = window.innerHeight - 200; // Reserve space for toolbar and margins
    const availableWidth = window.innerWidth - 100; // Reserve space for margins
    const canvasSize = Math.min(availableHeight, availableWidth, 1000); // Increased max size to 1000px
    fullscreenCanvas.width = canvasSize;
    fullscreenCanvas.height = canvasSize;

    fullscreenCtx = fullscreenCanvas.getContext('2d');
    fullscreenCtx.lineWidth = Math.max(8, canvasSize / 80); // Scale stroke width with canvas size
    fullscreenCtx.lineCap = 'round';
    fullscreenCtx.lineJoin = 'round';
    fullscreenCtx.strokeStyle = '#000';

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
    const srToggleBtn = document.getElementById('fullscreenSrToggleBtn');
    const srStatsBtn = document.getElementById('fullscreenSrStatsBtn');
    const aggressiveBtn = document.getElementById('fullscreenAggressiveBtn');

    if (undoBtn) undoBtn.onclick = undoFullscreenStroke;
    if (redoBtn) redoBtn.onclick = redoFullscreenStroke;
    if (clearBtn) clearBtn.onclick = clearFullscreenCanvas;
    if (submitBtn) submitBtn.onclick = submitFullscreenDrawing;
    if (showAnswerBtn) showAnswerBtn.onclick = showFullscreenAnswer;
    if (nextBtn) nextBtn.onclick = nextFullscreenQuestion;
    if (nextSetBtn && !nextSetBtn.dataset.bound) {
        nextSetBtn.dataset.bound = 'true';
        nextSetBtn.onclick = () => {
            if (schedulerMode !== SCHEDULER_MODES.BATCH_5) {
                setSchedulerMode(SCHEDULER_MODES.BATCH_5);
            }
            advanceBatchSetNow();
            updateFullscreenQueueDisplay();
            updateSchedulerToolbar();
        };
    }
    if (exitBtn) exitBtn.onclick = exitFullscreenDrawing;
    if (srToggleBtn && !srToggleBtn.dataset.bound) {
        srToggleBtn.dataset.bound = 'true';
        srToggleBtn.onclick = () => {
            toggleSREnabled();
            updateFullscreenSrUI();
            updateDrawingSrUI();
        };
    }
    if (srStatsBtn && !srStatsBtn.dataset.bound) {
        srStatsBtn.dataset.bound = 'true';
        srStatsBtn.onclick = () => {
            showSrStatsAlert();
        };
    }
    if (aggressiveBtn && !aggressiveBtn.dataset.bound) {
        aggressiveBtn.dataset.bound = 'true';
        aggressiveBtn.onclick = () => {
            toggleSRAggressiveMode();
            updateFullscreenSrUI();
            updateDrawingSrUI();
        };
    }

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

    // Clear fullscreen canvas
    if (fullscreenCanvas && fullscreenCtx) {
        fullscreenCtx.clearRect(0, 0, fullscreenCanvas.width, fullscreenCanvas.height);
    }
}

function getFullscreenCanvasCoords(e) {
    const rect = fullscreenCanvas.getBoundingClientRect();
    const scaleX = fullscreenCanvas.width / rect.width;
    const scaleY = fullscreenCanvas.height / rect.height;

    if (e.touches && e.touches[0]) {
        return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
    }
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
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
            if (ocrResult && candidates.length > 0) {
                ocrResult.textContent = candidates[0];
            }
        }
    } catch (error) {
        console.error('OCR Error:', error);
    }
}

function clearFullscreenCanvas() {
    if (!fullscreenCtx || !fullscreenCanvas) return;
    fullscreenCtx.clearRect(0, 0, fullscreenCanvas.width, fullscreenCanvas.height);
    strokes = [];
    undoneStrokes = [];
    currentStroke = null;
    drawStartTime = null;
    if (ocrTimeout) {
        clearTimeout(ocrTimeout);
        ocrTimeout = null;
    }
    const ocrResult = document.getElementById('fullscreenOcrResult');
    if (ocrResult) {
        ocrResult.textContent = '';
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

    fullscreenCtx.clearRect(0, 0, fullscreenCanvas.width, fullscreenCanvas.height);

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

    if (isFirstAttempt && srEnabled && currentQuestion && currentQuestion.char) {
        const responseTime = Date.now() - srQuestionStartTime;
        updateSRCard(currentQuestion.char, correct, responseTime);
        updateDrawingSrUI();
        updateFullscreenSrUI();
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
        prompt.innerHTML = `<span class="text-blue-600">ⓘ Answer: ${currentQuestion.char} (${currentQuestion.pinyin})${meaningSuffix}</span>`;
    }

    if (!answered) {
        answered = true;
        total++;

        if (srEnabled && currentQuestion && currentQuestion.char) {
            const responseTime = Date.now() - srQuestionStartTime;
            updateSRCard(currentQuestion.char, false, responseTime);
            updateDrawingSrUI();
            updateFullscreenSrUI();
        }
        markSchedulerOutcome(false);

        updateStats();

        // Also update main feedback
        const meaningSuffix = currentQuestion.meaning ? ` – ${currentQuestion.meaning}` : '';
        feedback.textContent = `ⓘ Answer: ${currentQuestion.char} (${currentQuestion.pinyin})${meaningSuffix}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-blue-600';
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
        <div class="space-y-4">
            <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">Study Mode Reference</h2>
                    <p class="text-sm text-gray-600">Quick list of this lesson’s vocab. Use search or sorting as needed.</p>
                </div>
                <div id="studyStatsFiltered" class="text-sm text-gray-500">Showing 0 / 0 terms</div>
            </div>
            <div class="flex flex-col gap-3 md:flex-row md:items-center">
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
                <div class="flex flex-wrap gap-3 items-center text-sm">
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
            <div class="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div class="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase bg-gray-50 rounded-t-2xl">
                    <span class="md:col-span-2">Character</span>
                    <span class="md:col-span-3">Pinyin</span>
                    <span class="md:col-span-6">Meaning</span>
                    <span class="md:col-span-1 text-right">Audio</span>
                </div>
                <div id="studyList" class="max-h-[65vh] overflow-y-auto divide-y divide-gray-100"></div>
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
    charCell.className = 'text-4xl font-bold text-gray-900 tracking-tight md:col-span-2';
    charCell.textContent = item.char || '—';

    const pinyinCell = document.createElement('div');
    pinyinCell.className = 'text-base font-semibold text-gray-900 md:col-span-3';
    const displayPinyin = (item.pinyin || '')
        .split('/')
        .map(part => part.trim())
        .filter(Boolean)
        .join(' · ');
    pinyinCell.textContent = displayPinyin || '—';

    const meaningCell = document.createElement('div');
    meaningCell.className = 'text-sm text-gray-600 leading-snug md:col-span-6';
    meaningCell.textContent = item.meaning || '—';

    const actionsCell = document.createElement('div');
    actionsCell.className = 'flex items-center justify-start md:justify-end md:col-span-1';

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
    const container = document.getElementById('fullscreenDrawContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="flex flex-col h-full bg-white overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 p-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.35em] text-gray-400">Fullscreen Drawing</div>
                    <div id="fullscreenPrompt" class="text-2xl font-semibold text-gray-900 mt-1">Draw:</div>
                </div>
                <button id="exitFullscreenBtn" type="button" class="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition">Exit</button>
            </div>
            <div class="flex flex-1 flex-col lg:flex-row min-h-0 overflow-auto">
                <div class="border-b border-gray-200 bg-white p-4 lg:w-72 lg:border-b-0 lg:border-r flex flex-col gap-3 flex-shrink-0">
                    <div class="text-xs uppercase tracking-[0.35em] text-gray-400">Recognition</div>
                    <div id="fullscreenOcrResult" class="text-7xl font-bold text-blue-600 min-h-[100px]">&nbsp;</div>
                    <p class="text-xs text-gray-500">Top guess updates automatically while you draw.</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center bg-gray-100 p-4 gap-3 min-h-0">
                    <div class="w-full max-w-4xl flex-1 flex items-center justify-center min-h-0">
                        <canvas id="fullscreenDrawCanvas" width="600" height="600" class="bg-white border-4 border-gray-200 rounded-3xl shadow-xl touch-none select-none max-w-full max-h-full"></canvas>
                    </div>
                    <div class="text-xs text-gray-500 text-center">Hold Space to pan · Scroll to zoom</div>
                </div>
            </div>
            <div class="border-t border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                <div class="flex flex-wrap gap-2">
                    <button id="fullscreenUndoBtn" type="button" class="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition">Undo</button>
                    <button id="fullscreenRedoBtn" type="button" class="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition">Redo</button>
                    <button id="fullscreenClearBtn" type="button" class="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-red-400 hover:text-red-600 transition">Clear</button>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button id="fullscreenNextSetBtn" type="button" class="px-4 py-2 rounded-xl border border-amber-200 text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100 transition">Next Set</button>
                    <button id="fullscreenShowAnswerBtn" type="button" class="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition">Show Answer</button>
                    <button id="fullscreenSubmitBtn" type="button" class="px-4 py-2 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition">Submit</button>
                    <button id="fullscreenNextBtn" type="button" class="px-4 py-2 rounded-xl border border-blue-200 text-blue-600 font-semibold hover:border-blue-500 transition">Next</button>
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

    // Space key handling for handwriting mode
    if (mode === 'handwriting' && e.key === ' ' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Don't interfere if user is typing in an input or textarea
        if (isTypingTarget(target)) return;
        e.preventDefault();
        if (handwritingAnswerShown) {
            // Answer is already shown, go to next question
            generateQuestion();
        } else {
            // Answer not shown, show it
            if (window.handwritingShowAnswer) {
                window.handwritingShowAnswer();
            }
        }
        return;
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
}

function initQuizCommandPalette() {
    const defaultModes = [
        { name: 'Char → Pinyin', mode: 'char-to-pinyin', type: 'mode' },
        { name: 'Char → Pinyin (MC)', mode: 'char-to-pinyin-type', type: 'mode' },
        { name: 'Char → Pinyin → Tones (MC)', mode: 'char-to-pinyin-tones-mc', type: 'mode' },
        { name: 'Char → Tones', mode: 'char-to-tones', type: 'mode' },
        { name: 'Audio → Pinyin', mode: 'audio-to-pinyin', type: 'mode' },
        { name: 'Audio → Meaning', mode: 'audio-to-meaning', type: 'mode' },
        { name: 'Pinyin → Char', mode: 'pinyin-to-char', type: 'mode' },
        { name: 'Char → Meaning', mode: 'char-to-meaning', type: 'mode' },
        { name: 'Char → Meaning (Fuzzy)', mode: 'char-to-meaning-type', type: 'mode' },
        { name: 'Meaning → Char', mode: 'meaning-to-char', type: 'mode' },
        { name: 'Stroke Order', mode: 'stroke-order', type: 'mode' },
        { name: 'Handwriting', mode: 'handwriting', type: 'mode' },
        { name: 'Draw Character', mode: 'draw-char', type: 'mode' },
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
            name: 'Next Set (5-Card Mode)',
            type: 'action',
            description: 'Skip the current batch and load a fresh set immediately',
            keywords: 'batch next set new five cards skip group rotate',
            action: () => advanceBatchSetNow(),
            available: () => schedulerMode === SCHEDULER_MODES.BATCH_5,
            scope: '5-card sets only'
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
            name: 'Next Item: Feed SR Mode',
            type: 'action',
            description: 'Feed mode with SR confidence graduation - cards leave hand when mastered',
            keywords: 'feed sr mode explore exploit mab bandit adaptive learning ucb graduation confidence',
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

        // Spaced Repetition actions
        actions.push({
            name: srEnabled ? 'Disable Spaced Repetition' : 'Enable Spaced Repetition',
            type: 'action',
            description: srEnabled
                ? 'Turn off spaced repetition and show all cards'
                : 'Show only cards that are due for review based on your performance',
            keywords: 'spaced repetition sr review memory schedule toggle enable disable',
            action: () => {
                toggleSREnabled();
            }
        });

        if (srEnabled) {
            actions.push({
                name: 'View SR Stats',
                type: 'action',
                description: `${srDueCount} cards due today`,
                keywords: 'spaced repetition sr stats review due cards',
                action: () => {
                    showSrStatsAlert();
                }
            });

            actions.push({
                name: 'Reset SR Data',
                type: 'action',
                description: 'Clear all spaced repetition progress for this page',
                keywords: 'spaced repetition sr reset clear delete data',
                action: () => {
                    resetSRData();
                }
            });

            actions.push({
                name: srAggressiveMode ? 'Disable Aggressive SR (Drawing)' : 'Enable Aggressive SR (Drawing)',
                type: 'action',
                description: srAggressiveMode
                    ? 'Return to normal scheduling for drawing'
                    : 'Clamp intervals and focus on due cards while drawing',
                keywords: 'spaced repetition sr aggressive fast drawing due clamp',
                action: () => {
                    toggleSRAggressiveMode();
                }
            });
        }

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

function initQuiz(charactersData, userConfig = {}) {
    // Reserve Ctrl/Cmd+K for focusing the quiz input instead of the command palette
    window.__preferCtrlKForQuiz = true;

    originalQuizCharacters = charactersData; // Store original array
    quizCharacters = charactersData;
    config = userConfig || {};

    loadConfidencePanelVisibility();
    loadConfidenceTrackingEnabled();
    loadConfidenceFormula();
    loadHideMeaningChoices();
    loadComponentPreference();
    loadTimerSettings();
    loadSRData();
    loadSchedulerStats();
    loadSchedulerMode();
    ensureCharGlossesLoaded();
    loadBatchState();
    loadAdaptiveState();
    loadFeedState();

    // Apply SR filtering to characters
    quizCharacters = applySRFiltering(quizCharacters);
    reconcileBatchStateWithQueue();
    reconcileAdaptiveStateWithPool();
    reconcileFeedStateWithPool();

    if (config.defaultMode) {
        mode = config.defaultMode;
    }

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
    radicalPracticeMode = document.getElementById('radicalPracticeMode');
    audioSection = document.getElementById('audioSection');
    fullscreenDrawInitialized = false;
    ensureFullscreenDrawLayout();

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
    if (schedulerMode === SCHEDULER_MODES.ADAPTIVE_5) {
        prepareAdaptiveForNextQuestion();
    }
    renderConfidenceList();
    updateMeaningChoicesVisibility();

    // Setup event listeners
    checkBtn.addEventListener('click', checkAnswer);

    answerInput.addEventListener('input', (e) => {
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
        if (answered && lastAnswerCorrect) {
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
        } else if (e.key === ' ' && (mode === 'audio-to-pinyin' || mode === 'audio-to-meaning') && audioSection) {
            e.preventDefault();
            if (window.currentAudioPlayFunc) {
                window.currentAudioPlayFunc();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            checkAnswer();
        }
    });

    // Mode selector
    prioritizeMeaningModeButton();
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => {
                b.classList.remove('active', 'bg-blue-500', 'text-white', 'border-blue-500');
                b.classList.add('border-gray-300');
            });
            btn.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500');
            btn.classList.remove('border-gray-300');
            mode = btn.dataset.mode;
            score = 0;
            total = 0;
            updateStats();
            generateQuestion();
        });
    });

    // Set initial active button
    const initialBtn = document.querySelector(`[data-mode="${mode}"]`);
    if (initialBtn) {
        initialBtn.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500');
        initialBtn.classList.remove('border-gray-300');
    }

    registerQuizHotkeys();

    // Initialize command palette
    initQuizCommandPalette();

    // Show SR banner if enabled
    showSRBanner();

    if (schedulerMode === SCHEDULER_MODES.BATCH_5) {
        prepareBatchForNextQuestion();
    }

    // Start first question
    generateQuestion();
}
