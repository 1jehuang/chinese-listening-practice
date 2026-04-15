// Common utility functions shared across all quiz pages

const globalScope = typeof window !== 'undefined' ? window : globalThis;
const AUDIO_PRECONNECT_ORIGINS = [
    'https://www.purpleculture.net',
    'https://fanyi.baidu.com',
    'https://translate.googleapis.com'
];

// TTS speed configuration ----------------------------------------------------

const TTS_RATE_STORAGE_KEY = 'quizTtsRate';
const DEFAULT_TTS_RATE = 0.85;
const MIN_TTS_RATE = 0.5;
const MAX_TTS_RATE = 2.5;
const TTS_SPEED_OPTIONS = [
    { value: 0.5, label: 'Very Slow · 0.5×' },
    { value: 0.6, label: 'Slow · 0.6×' },
    { value: 0.7, label: 'Slow · 0.7×' },
    { value: 0.75, label: 'Slow-Medium · 0.75×' },
    { value: 0.85, label: 'Learning · 0.85×' },
    { value: 0.9, label: 'Learning-Quick · 0.9×' },
    { value: 1.0, label: 'Normal · 1.0×' },
    { value: 1.1, label: 'Quick · 1.1×' },
    { value: 1.15, label: 'Quick · 1.15×' },
    { value: 1.2, label: 'Fast · 1.2×' },
    { value: 1.3, label: 'Fast · 1.3×' },
    { value: 1.4, label: 'Faster · 1.4×' },
    { value: 1.5, label: 'Faster · 1.5×' },
    { value: 1.6, label: 'Very Fast · 1.6×' },
    { value: 1.75, label: 'Very Fast · 1.75×' },
    { value: 2.0, label: 'Ultra Fast · 2.0×' },
    { value: 2.25, label: 'Ultra Fast · 2.25×' },
    { value: 2.5, label: 'Maximum · 2.5×' }
];

function clampTtsRate(rate) {
    if (Number.isNaN(rate)) return DEFAULT_TTS_RATE;
    return Math.min(MAX_TTS_RATE, Math.max(MIN_TTS_RATE, rate));
}

function readStoredTtsRate() {
    if (typeof globalScope.localStorage === 'undefined') return DEFAULT_TTS_RATE;
    try {
        const raw = globalScope.localStorage.getItem(TTS_RATE_STORAGE_KEY);
        if (!raw) return DEFAULT_TTS_RATE;
        const parsed = parseFloat(raw);
        return clampTtsRate(parsed);
    } catch (err) {
        console.warn('Unable to read stored TTS rate, falling back to default', err);
        return DEFAULT_TTS_RATE;
    }
}

function persistTtsRate(rate) {
    if (typeof globalScope.localStorage === 'undefined') return;
    try {
        globalScope.localStorage.setItem(TTS_RATE_STORAGE_KEY, rate.toString());
    } catch (err) {
        console.warn('Unable to persist TTS rate', err);
    }
}

function getQuizTtsRate() {
    if (typeof globalScope.__quizTtsRate === 'number') {
        return clampTtsRate(globalScope.__quizTtsRate);
    }
    const stored = readStoredTtsRate();
    globalScope.__quizTtsRate = stored;
    return stored;
}

function setQuizTtsRate(rate) {
    const clamped = clampTtsRate(Number(rate));
    globalScope.__quizTtsRate = clamped;
    persistTtsRate(clamped);
    return clamped;
}

function getQuizTtsOptions() {
    return TTS_SPEED_OPTIONS.map(option => ({ ...option }));
}

globalScope.getQuizTtsRate = getQuizTtsRate;
globalScope.setQuizTtsRate = setQuizTtsRate;
globalScope.getQuizTtsOptions = getQuizTtsOptions;

// Active audio management ----------------------------------------------------

function detachActiveAudio(audio) {
    if (!audio) return;
    const cleanup = audio.__activeCleanup;
    if (typeof cleanup === 'function') {
        cleanup();
    } else if (globalScope.__activeAudio === audio) {
        globalScope.__activeAudio = null;
    }
}

function stopActiveAudio() {
    globalScope.__pendingEdgeTtsToken = null;
    const current = globalScope.__activeAudio;
    if (!current) return;

    try {
        current.pause();
    } catch (err) {
        console.warn('Failed to pause active audio', err);
    }

    try {
        if (typeof current.currentTime === 'number') {
            current.currentTime = 0;
        }
    } catch (err) {
        // Ignore currentTime reset errors (e.g., streaming sources)
    }

    detachActiveAudio(current);
}

function clearDeferredAudioPlayback() {
    globalScope.__deferredAudioPlayback = null;
    if (typeof document !== 'undefined' && document.body) {
        delete document.body.dataset.ttsPendingInteraction;
    }
}

function retryDeferredAudioPlayback() {
    const pending = globalScope.__deferredAudioPlayback;
    if (typeof pending !== 'function') return false;
    clearDeferredAudioPlayback();
    pending();
    return true;
}

function ensureDeferredAudioPlaybackListeners() {
    if (globalScope.__deferredAudioPlaybackListenersBound) return;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

    const resume = () => {
        retryDeferredAudioPlayback();
    };

    ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach((eventName) => {
        document.addEventListener(eventName, resume, true);
    });

    globalScope.__deferredAudioPlaybackListenersBound = true;
}

function queueDeferredAudioPlayback(playbackFn) {
    if (typeof playbackFn !== 'function') return false;
    globalScope.__deferredAudioPlayback = playbackFn;
    ensureDeferredAudioPlaybackListeners();
    if (typeof document !== 'undefined' && document.body) {
        document.body.dataset.ttsPendingInteraction = 'true';
    }
    return true;
}

function isAutoplayBlockedError(error) {
    const name = String(error?.name || '');
    const message = String(error?.message || '');
    return name === 'NotAllowedError' ||
        /notallowederror/i.test(name) ||
        /user gesture/i.test(message) ||
        /not allowed/i.test(message) ||
        /play\(\) failed because the user didn't interact/i.test(message);
}

function supportsImmediateSpeechStart() {
    if (typeof navigator === 'undefined') return true;
    const ua = navigator.userAgent || '';
    const isWebKit = /applewebkit/i.test(ua);
    const isChrome = /chrome|chromium|crios|edg/i.test(ua);
    return !isWebKit || isChrome;
}

function startSpeechSynthesis(utterance) {
    if (!utterance || typeof speechSynthesis === 'undefined') return false;
    const speak = () => {
        try {
            speechSynthesis.speak(utterance);
            return true;
        } catch (err) {
            console.warn('Failed to start speech synthesis', err);
            return false;
        }
    };

    if (supportsImmediateSpeechStart()) {
        return speak();
    }

    setTimeout(speak, 10);
    return true;
}

globalScope.retryDeferredAudioPlayback = retryDeferredAudioPlayback;
globalScope.clearDeferredAudioPlayback = clearDeferredAudioPlayback;

function setActiveAudio(audio) {
    if (!audio) {
        stopActiveAudio();
        return;
    }

    stopActiveAudio();

    let clear = null;
    const handlePause = () => {
        if (!audio) return;
        if (!audio.paused) return;
        const duration = audio.duration || 0;
        const endedNaturally = duration && Math.abs(audio.currentTime - duration) < 0.05;
        if (audio.currentTime === 0 || endedNaturally) {
            clear?.();
        }
    };

    clear = () => {
        audio.removeEventListener('ended', clear);
        audio.removeEventListener('pause', handlePause);
        delete audio.__activeCleanup;
        if (globalScope.__activeAudio === audio) {
            globalScope.__activeAudio = null;
        }
    };

    audio.__activeCleanup = clear;
    audio.addEventListener('ended', clear);
    audio.addEventListener('pause', handlePause);

    globalScope.__activeAudio = audio;
}

function primeAudioElement(audio) {
    if (!audio) return audio;
    try {
        audio.preload = 'auto';
    } catch (_) {}
    try {
        if (typeof audio.load === 'function') {
            audio.load();
        }
    } catch (_) {}
    return audio;
}

function ensureAudioOriginsPreconnected() {
    if (typeof document === 'undefined' || !document.head) return;
    if (globalScope.__audioOriginsPreconnected) return;

    AUDIO_PRECONNECT_ORIGINS.forEach((origin) => {
        ['preconnect', 'dns-prefetch'].forEach((rel) => {
            const selector = `link[rel="${rel}"][href="${origin}"]`;
            if (typeof document.querySelector === 'function' && document.querySelector(selector)) {
                return;
            }
            const link = document.createElement('link');
            link.rel = rel;
            link.href = origin;
            if (rel === 'preconnect') {
                link.crossOrigin = 'anonymous';
            }
            document.head.appendChild(link);
        });
    });

    globalScope.__audioOriginsPreconnected = true;
}

globalScope.ensureAudioOriginsPreconnected = ensureAudioOriginsPreconnected;

function getSentenceAudioCache() {
    if (!globalScope.__sentenceAudioCache) {
        globalScope.__sentenceAudioCache = new Map();
    }
    return globalScope.__sentenceAudioCache;
}

function getPinyinAudioCache() {
    if (!globalScope.__pinyinAudioCache) {
        globalScope.__pinyinAudioCache = new Map();
    }
    return globalScope.__pinyinAudioCache;
}

function getSentenceAudioInstance(sentence, rate) {
    const trimmedSentence = (sentence || '').trim();
    if (!trimmedSentence || typeof Audio === 'undefined') return null;

    const effectiveRate = typeof rate === 'number'
        ? rate
        : (typeof getQuizTtsRate === 'function' ? getQuizTtsRate() : DEFAULT_TTS_RATE);
    const cacheKey = `${trimmedSentence}|${effectiveRate.toFixed(2)}`;
    const cache = getSentenceAudioCache();

    let audio = cache.get(cacheKey);
    if (!audio) {
        audio = primeAudioElement(new Audio(sentenceTtsUrl(trimmedSentence, effectiveRate)));
        cache.set(cacheKey, audio);
    }

    return { audio, cacheKey, cache };
}

function getPinyinAudioInstance(pinyin) {
    const trimmedPinyin = (pinyin || '').trim();
    if (!trimmedPinyin || typeof Audio === 'undefined') return null;

    const audioKey = pinyinToAudioKey(trimmedPinyin);
    const cache = getPinyinAudioCache();
    let audio = cache.get(audioKey);

    if (!audio) {
        audio = primeAudioElement(new Audio(`https://www.purpleculture.net/mp3/${audioKey}.mp3`));
        cache.set(audioKey, audio);
    }

    return { audio, audioKey, cache };
}

function preloadSentenceAudio(sentence, rate) {
    const result = getSentenceAudioInstance(sentence, rate);
    if (!result) return null;
    primeAudioElement(result.audio);
    return result.audio;
}

function preloadPinyinAudio(pinyin, chineseChar) {
    const text = (chineseChar || '').trim();
    const isMultiChar = text.length > 1;
    const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent || '');

    if ((isFirefox || isMultiChar) && text) {
        return preloadSentenceAudio(text);
    }

    const result = getPinyinAudioInstance(pinyin);
    if (!result) return null;
    primeAudioElement(result.audio);
    return result.audio;
}

function preloadPromptAudio(question) {
    if (!question) return null;

    const pinyinOptions = (question.pinyin || '').split('/');
    const firstPinyin = (pinyinOptions[0] || '').trim();
    if (firstPinyin) {
        return preloadPinyinAudio(firstPinyin, question.char);
    }

    if (question.char) {
        return preloadSentenceAudio(question.char);
    }

    return null;
}

globalScope.preloadPromptAudio = preloadPromptAudio;

// Sound effect functions -----------------------------------------------------

function playCorrectSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

function playWrongSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 200;
    oscillator.type = 'sawtooth';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

function playSubmitSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 600;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
}

let fuzzyNonWordRegex = null;
try {
    fuzzyNonWordRegex = new RegExp('[^\\p{L}\\p{N}]+', 'gu');
} catch (err) {
    fuzzyNonWordRegex = /[^a-zA-Z0-9\u4e00-\u9fff]+/g;
}

function normalizeFuzzy(text) {
    if (!text) return '';
    let normalized = text.toLowerCase();
    if (typeof normalized.normalize === 'function') {
        normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    normalized = normalized.replace(fuzzyNonWordRegex, '');
    return normalized.trim();
}

function damerauLevenshtein(a, b) {
    const lenA = a.length;
    const lenB = b.length;
    if (!lenA) return lenB;
    if (!lenB) return lenA;

    const dp = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));
    for (let i = 0; i <= lenA; i++) dp[i][0] = i;
    for (let j = 0; j <= lenB; j++) dp[0][j] = j;

    for (let i = 1; i <= lenA; i++) {
        const aChar = a[i - 1];
        for (let j = 1; j <= lenB; j++) {
            const bChar = b[j - 1];
            const cost = aChar === bChar ? 0 : 1;
            let best = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
            if (i > 1 && j > 1 && aChar === b[j - 2] && a[i - 2] === bChar) {
                best = Math.min(best, dp[i - 2][j - 2] + cost);
            }
            dp[i][j] = best;
        }
    }
    return dp[lenA][lenB];
}

function countSubsequenceMatches(input, target) {
    let matches = 0;
    let idx = 0;
    for (const ch of input) {
        const found = target.indexOf(ch, idx);
        if (found === -1) continue;
        matches += 1;
        idx = found + 1;
    }
    return matches;
}

function charOverlapRatio(input, target) {
    const setA = new Set(input.split(''));
    const setB = new Set(target.split(''));
    if (!setA.size) return 0;
    let overlap = 0;
    for (const ch of setA) {
        if (setB.has(ch)) overlap += 1;
    }
    return overlap / setA.size;
}

// Fuzzy matching function for text input (typo-tolerant)
function fuzzyMatch(input, target) {
    const normInput = normalizeFuzzy(input);
    const normTarget = normalizeFuzzy(target);

    if (!normInput || !normTarget) return 0;
    if (normInput === normTarget) return 1000;
    if (normTarget.startsWith(normInput)) return 900 + normInput.length;
    if (normTarget.includes(normInput)) return 700 + normInput.length;

    const maxLen = Math.max(normInput.length, normTarget.length);
    const dist = damerauLevenshtein(normInput, normTarget);
    const similarity = Math.max(0, 1 - dist / maxLen);
    const subseqRatio = countSubsequenceMatches(normInput, normTarget) / normInput.length;
    const overlapRatio = charOverlapRatio(normInput, normTarget);

    let score = Math.round(similarity * 450 + subseqRatio * 120 + overlapRatio * 80);
    if (dist <= 1) score += 60;
    else if (dist <= 2) score += 30;

    return Math.max(0, Math.min(650, score));
}

// Convert single pinyin syllable with tone marks to audio key format
function pinyinToAudioKey(pinyin) {
    const toneMarkToBase = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
        'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
        'ü': 'v'
    };

    const toneMarkToNumber = {
        'ā': '1', 'á': '2', 'ǎ': '3', 'à': '4',
        'ē': '1', 'é': '2', 'ě': '3', 'è': '4',
        'ī': '1', 'í': '2', 'ǐ': '3', 'ì': '4',
        'ō': '1', 'ó': '2', 'ǒ': '3', 'ò': '4',
        'ū': '1', 'ú': '2', 'ǔ': '3', 'ù': '4',
        'ǖ': '1', 'ǘ': '2', 'ǚ': '3', 'ǜ': '4'
    };

    let result = pinyin.toLowerCase();
    let tone = '5'; // default neutral tone

    // Find tone mark and extract tone number
    for (const [marked, toneNum] of Object.entries(toneMarkToNumber)) {
        if (result.includes(marked)) {
            tone = toneNum;
            break;
        }
    }

    // Replace all tone marks with base vowels
    for (const [marked, base] of Object.entries(toneMarkToBase)) {
        result = result.replace(new RegExp(marked, 'g'), base);
    }

    // Add tone number at the end
    return result + tone;
}

// Voice caching for iOS compatibility ----------------------------------------
// iOS Safari returns empty array from getVoices() on first call - need to wait
// for voiceschanged event and cache the voices

let cachedVoices = [];
let voicesLoaded = false;

function isAudioDiagnosticsEnabled() {
    if (typeof window === 'undefined') return false;
    if (window.__audioDiagnosticsEnabled === true) return true;
    try {
        const params = new URLSearchParams(window.location.search || '');
        if (params.has('audioDebug')) return true;
    } catch (_) {}
    try {
        return window.localStorage?.getItem('audioDebug') === '1';
    } catch (_) {
        return false;
    }
}

function getAudioDiagnosticsState() {
    if (!globalScope.__audioDiagnosticsState) {
        globalScope.__audioDiagnosticsState = {
            enabled: isAudioDiagnosticsEnabled(),
            history: [],
            engine: '',
            voice: '',
            status: '',
            event: '',
            src: '',
            requestedAt: 0,
            playStartedAt: 0,
            currentTime: 0,
            readyState: '',
            networkState: '',
            paused: '',
            audible: 'unknown',
            signalLevel: '0.000',
            error: '',
            pendingInteraction: 'false'
        };
    }
    return globalScope.__audioDiagnosticsState;
}

function ensureAudioDiagnosticsPanel() {
    const state = getAudioDiagnosticsState();
    if (!state.enabled) return null;
    if (typeof document === 'undefined' || !document.body) return null;

    let panel = document.getElementById('audioDiagnosticsPanel');
    if (!panel) {
        panel = document.createElement('pre');
        panel.id = 'audioDiagnosticsPanel';
        panel.setAttribute('aria-live', 'polite');
        Object.assign(panel.style, {
            position: 'fixed',
            left: '12px',
            bottom: '12px',
            zIndex: '99999',
            maxWidth: 'min(92vw, 520px)',
            maxHeight: '45vh',
            overflow: 'auto',
            margin: '0',
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'rgba(17, 24, 39, 0.92)',
            color: '#f9fafb',
            font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            whiteSpace: 'pre-wrap',
            pointerEvents: 'none'
        });
        document.body.appendChild(panel);
    }
    return panel;
}

function renderAudioDiagnostics() {
    const state = getAudioDiagnosticsState();
    if (!state.enabled) return;
    const panel = ensureAudioDiagnosticsPanel();
    if (!panel) return;
    panel.textContent = [
        'Audio diagnostics',
        `engine: ${state.engine || '-'}`,
        `voice: ${state.voice || '-'}`,
        `status: ${state.status || '-'}`,
        `event: ${state.event || '-'}`,
        `pendingInteraction: ${state.pendingInteraction || 'false'}`,
        `audible: ${state.audible || 'unknown'}`,
        `signalLevel: ${state.signalLevel || '0.000'}`,
        `currentTime: ${state.currentTime ?? 0}`,
        `readyState: ${state.readyState || '-'}`,
        `networkState: ${state.networkState || '-'}`,
        `paused: ${state.paused || '-'}`,
        `error: ${state.error || '-'}`,
        `src: ${state.src || '-'}`,
        'history:',
        ...(state.history && state.history.length ? state.history : ['-'])
    ].join('\n');
}

function updateAudioDiagnostics(patch = {}) {
    const state = getAudioDiagnosticsState();
    const nextEvent = patch.event;
    const nextError = typeof patch.error === 'string' ? patch.error : '';
    Object.assign(state, patch);
    if (nextEvent || nextError) {
        const stamp = new Date().toLocaleTimeString([], { hour12: false });
        const entry = `${stamp} ${nextEvent || state.event || 'state'}${nextError ? ` | ${nextError}` : ''}`;
        state.history = Array.isArray(state.history) ? state.history.concat(entry).slice(-8) : [entry];
    }
    if (typeof document !== 'undefined' && document.body) {
        if (state.audible) document.body.dataset.ttsAudible = String(state.audible);
        if (typeof state.signalLevel !== 'undefined') document.body.dataset.ttsSignalLevel = String(state.signalLevel);
        if (state.event) document.body.dataset.ttsEvent = String(state.event);
    }
    renderAudioDiagnostics();
}

function describeMediaError(mediaError) {
    if (!mediaError) return '';
    const codeNames = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
    };
    return codeNames[mediaError.code] || mediaError.message || `code ${mediaError.code || 'unknown'}`;
}

function describeAudioFailure(error) {
    if (!error) return '';
    const name = error.name ? `${error.name}` : 'Error';
    const message = error.message ? `: ${error.message}` : '';
    return `${name}${message}`;
}

function attachAudioDiagnostics(audio, details = {}) {
    const state = getAudioDiagnosticsState();
    if (!state.enabled || !audio) return () => {};

    const cleanups = [];
    let pollId = null;
    let signalIntervalId = null;
    let analyserContext = null;
    let mediaStream = null;
    let sourceNode = null;
    let analyserNode = null;

    updateAudioDiagnostics({
        engine: details.engine || state.engine || '',
        voice: details.voiceLabel || state.voice || '',
        status: details.status || state.status || '',
        event: 'attached',
        src: audio.currentSrc || audio.src || '',
        error: '',
        currentTime: Number(audio.currentTime || 0).toFixed(3),
        readyState: String(audio.readyState ?? ''),
        networkState: String(audio.networkState ?? ''),
        paused: String(Boolean(audio.paused)),
        pendingInteraction: String(Boolean(document?.body?.dataset?.ttsPendingInteraction === 'true')),
        audible: 'unknown',
        signalLevel: '0.000'
    });

    const updateFromAudio = (eventName) => {
        updateAudioDiagnostics({
            event: eventName,
            src: audio.currentSrc || audio.src || '',
            currentTime: Number(audio.currentTime || 0).toFixed(3),
            readyState: String(audio.readyState ?? ''),
            networkState: String(audio.networkState ?? ''),
            paused: String(Boolean(audio.paused)),
            error: describeMediaError(audio.error),
            pendingInteraction: String(Boolean(document?.body?.dataset?.ttsPendingInteraction === 'true'))
        });
    };

    ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'play', 'playing', 'pause', 'waiting', 'stalled', 'suspend', 'timeupdate', 'ended', 'error'].forEach((eventName) => {
        const handler = () => updateFromAudio(eventName);
        audio.addEventListener(eventName, handler);
        cleanups.push(() => audio.removeEventListener(eventName, handler));
    });

    const autoCleanupHandler = () => {
        window.setTimeout(() => {
            cleanups.forEach((fn) => {
                try { fn(); } catch (_) {}
            });
        }, 1000);
    };
    audio.addEventListener('ended', autoCleanupHandler, { once: true });
    audio.addEventListener('error', autoCleanupHandler, { once: true });
    cleanups.push(() => audio.removeEventListener('ended', autoCleanupHandler));
    cleanups.push(() => audio.removeEventListener('error', autoCleanupHandler));

    pollId = window.setInterval(() => {
        updateFromAudio('poll');
    }, 250);
    cleanups.push(() => window.clearInterval(pollId));

    try {
        const capture = typeof audio.captureStream === 'function'
            ? audio.captureStream.bind(audio)
            : (typeof audio.mozCaptureStream === 'function' ? audio.mozCaptureStream.bind(audio) : null);
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (capture && AudioCtx) {
            mediaStream = capture();
            analyserContext = new AudioCtx();
            sourceNode = analyserContext.createMediaStreamSource(mediaStream);
            analyserNode = analyserContext.createAnalyser();
            analyserNode.fftSize = 2048;
            sourceNode.connect(analyserNode);
            const buffer = new Uint8Array(analyserNode.fftSize);
            signalIntervalId = window.setInterval(() => {
                analyserNode.getByteTimeDomainData(buffer);
                let peak = 0;
                for (let i = 0; i < buffer.length; i += 1) {
                    const centered = Math.abs((buffer[i] - 128) / 128);
                    if (centered > peak) peak = centered;
                }
                updateAudioDiagnostics({
                    signalLevel: peak.toFixed(3),
                    audible: peak > 0.02 ? 'yes' : (getAudioDiagnosticsState().audible === 'yes' ? 'yes' : 'no')
                });
            }, 120);
            cleanups.push(() => window.clearInterval(signalIntervalId));
            cleanups.push(() => {
                try { sourceNode.disconnect(); } catch (_) {}
                try { analyserNode.disconnect(); } catch (_) {}
                try { analyserContext.close(); } catch (_) {}
            });
        }
    } catch (err) {
        updateAudioDiagnostics({ event: 'capture-error', error: err?.message || String(err) });
    }

    return () => {
        cleanups.forEach((fn) => {
            try { fn(); } catch (_) {}
        });
    };
}

function setTtsDebug(engine, voiceLabel, status) {
    if (typeof window !== 'undefined') {
        window.__lastTtsEngine = engine;
        window.__lastTtsVoice = voiceLabel || '';
        if (typeof status !== 'undefined') {
            window.__lastTtsStatus = status;
        }
    }
    if (typeof document !== 'undefined' && document.body) {
        document.body.dataset.ttsEngine = engine;
        if (voiceLabel) {
            document.body.dataset.ttsVoice = voiceLabel;
        } else {
            delete document.body.dataset.ttsVoice;
        }
        if (typeof status !== 'undefined') {
            document.body.dataset.ttsStatus = status;
        }
    }
    updateAudioDiagnostics({ engine, voice: voiceLabel || '', status: status || '' });
}

function recordPromptAudioStart() {
    if (typeof window === 'undefined' || typeof performance === 'undefined' || typeof performance.now !== 'function') {
        return;
    }
    const requestedAt = window.__lastPromptAudioRequestedAt;
    if (typeof requestedAt !== 'number') return;

    const latency = Math.max(0, performance.now() - requestedAt);
    window.__lastPromptAudioStartLatencyMs = latency;
    if (document?.body) {
        document.body.dataset.promptAudioLatencyMs = latency.toFixed(1);
    }
}

function loadVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        cachedVoices = voices;
        voicesLoaded = true;
    }
}

function isLikelyRoboticVoice(voice) {
    const name = (voice?.name || '').toLowerCase();
    const uri = (voice?.voiceURI || '').toLowerCase();
    return name.includes('espeak') || name.includes('festival') || name.includes('flite') ||
        uri.includes('espeak') || uri.includes('festival') || uri.includes('flite');
}

// Initialize voices on page load
if (typeof window !== 'undefined' && window.speechSynthesis) {
    loadVoices();
    // iOS Safari fires voiceschanged after getVoices() returns empty
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function getChineseVoice() {
    if (!voicesLoaded) loadVoices();
    const zhVoices = cachedVoices.filter(v => typeof v.lang === 'string' && v.lang.toLowerCase().startsWith('zh'));
    if (!zhVoices.length) return null;

    const preferred = zhVoices.find(v => v.lang === 'zh-CN' && !isLikelyRoboticVoice(v)) ||
        zhVoices.find(v => v.lang === 'zh-Hans' && !isLikelyRoboticVoice(v)) ||
        zhVoices.find(v => !isLikelyRoboticVoice(v)) ||
        zhVoices[0];

    return preferred || null;
}

function getEnglishVoice() {
    if (!voicesLoaded) loadVoices();
    const enVoices = cachedVoices.filter(v => typeof v.lang === 'string' && v.lang.toLowerCase().startsWith('en'));
    if (!enVoices.length) return null;

    const preferred = enVoices.find(v => v.lang === 'en-US' && !isLikelyRoboticVoice(v)) ||
        enVoices.find(v => v.lang === 'en-GB' && !isLikelyRoboticVoice(v)) ||
        enVoices.find(v => !isLikelyRoboticVoice(v)) ||
        enVoices[0];

    return preferred || null;
}

function isFirefoxBrowser() {
    return typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent || '');
}

function containsChineseText(text) {
    return /[\u3400-\u9FFF]/.test((text || '').toString());
}

function shouldAvoidSpeechFallback(text) {
    if (!containsChineseText(text) || !isFirefoxBrowser()) {
        return false;
    }
    const chineseVoice = getChineseVoice();
    return !chineseVoice || isLikelyRoboticVoice(chineseVoice);
}

function canUseEdgeTtsBrowserSynthesis() {
    return typeof window !== 'undefined' &&
        typeof fetch === 'function' &&
        typeof Blob !== 'undefined' &&
        typeof Audio !== 'undefined';
}

function edgeTtsRateString(rate) {
    const clamped = clampTtsRate(typeof rate === 'number' ? rate : DEFAULT_TTS_RATE);
    const percent = Math.round((clamped - 1) * 100);
    return percent >= 0 ? `+${percent}%` : `${percent}%`;
}

async function loadEdgeTtsModule() {
    if (globalScope.__EdgeTTSUniversal) {
        return { EdgeTTS: globalScope.__EdgeTTSUniversal };
    }
    if (!globalScope.__edgeTtsModulePromise) {
        globalScope.__edgeTtsModulePromise = new Promise((resolve, reject) => {
            if (typeof document === 'undefined' || !document.head) {
                reject(new Error('Document head is not available for EdgeTTS loader'));
                return;
            }

            const readyEvent = '__edge_tts_ready__';
            const errorEvent = '__edge_tts_error__';

            const cleanup = () => {
                window.removeEventListener(readyEvent, handleReady);
                window.removeEventListener(errorEvent, handleError);
            };

            const handleReady = () => {
                cleanup();
                if (globalScope.__EdgeTTSUniversal) {
                    resolve({ EdgeTTS: globalScope.__EdgeTTSUniversal });
                } else {
                    reject(new Error('EdgeTTS loader signaled ready without a constructor'));
                }
            };

            const handleError = (event) => {
                cleanup();
                reject(new Error(event?.detail || 'Failed to load EdgeTTS browser module'));
            };

            window.addEventListener(readyEvent, handleReady, { once: true });
            window.addEventListener(errorEvent, handleError, { once: true });

            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                import('https://cdn.jsdelivr.net/npm/edge-tts-universal/dist/browser.js')
                    .then((module) => {
                        window.__EdgeTTSUniversal = module.EdgeTTS;
                        window.dispatchEvent(new CustomEvent('${readyEvent}'));
                    })
                    .catch((error) => {
                        window.dispatchEvent(new CustomEvent('${errorEvent}', {
                            detail: error?.message || String(error)
                        }));
                    });
            `;
            script.onerror = () => {
                window.dispatchEvent(new CustomEvent(errorEvent, { detail: 'Module script error while loading EdgeTTS' }));
            };
            document.head.appendChild(script);
        });
    }
    return globalScope.__edgeTtsModulePromise;
}

function playEdgeTtsChineseAudio(text, { rate, onPlaying, onFailure } = {}) {
    const trimmed = (text || '').toString().trim();
    if (!trimmed || !canUseEdgeTtsBrowserSynthesis()) return false;

    const token = Symbol('edge-tts-playback');
    const timeoutMs = 8000;
    globalScope.__pendingEdgeTtsToken = token;
    setTtsDebug('remote', 'edge-zh', 'synthesizing');
    updateAudioDiagnostics({ event: 'edge-synth-start', src: trimmed, error: '' });

    (async () => {
        try {
            const module = await loadEdgeTtsModule();
            if (globalScope.__pendingEdgeTtsToken !== token) return;
            updateAudioDiagnostics({ event: 'edge-module-ready' });
            const EdgeTTS = module?.EdgeTTS;
            if (typeof EdgeTTS !== 'function') {
                throw new Error('EdgeTTS module did not expose a constructor');
            }

            const tts = new EdgeTTS(trimmed, 'zh-CN-XiaoxiaoNeural', {
                rate: edgeTtsRateString(rate)
            });
            const result = await Promise.race([
                tts.synthesize(),
                new Promise((_, reject) => {
                    window.setTimeout(() => reject(new Error(`Edge TTS synthesis timed out after ${timeoutMs}ms`)), timeoutMs);
                })
            ]);
            if (globalScope.__pendingEdgeTtsToken !== token) return;
            updateAudioDiagnostics({
                event: 'edge-synth-complete',
                error: '',
                src: `edge-blob:${trimmed}`
            });

            if (!result?.audio || (typeof result.audio.size === 'number' && result.audio.size === 0)) {
                throw new Error('Edge TTS returned an empty audio blob');
            }

            const objectUrl = URL.createObjectURL(new Blob([result.audio], { type: 'audio/mpeg' }));
            const audio = primeAudioElement(new Audio(objectUrl));
            const cleanupUrl = () => {
                try {
                    URL.revokeObjectURL(objectUrl);
                } catch (_) {}
            };

            audio.addEventListener('ended', cleanupUrl, { once: true });
            audio.addEventListener('error', cleanupUrl, { once: true });

            playTrackedRemoteAudio(audio, {
                voiceLabel: 'edge-zh',
                onPlaying,
                onFailure: (error) => {
                    cleanupUrl();
                    if (typeof onFailure === 'function') {
                        onFailure(error);
                    }
                }
            });
        } catch (error) {
            if (globalScope.__pendingEdgeTtsToken !== token) return;
            updateAudioDiagnostics({ event: 'edge-synth-failure', error: describeAudioFailure(error) });
            if (typeof onFailure === 'function') {
                onFailure(error);
            }
        }
    })();

    return true;
}

function playTrackedRemoteAudio(audio, { voiceLabel, onPlaying, onFailure } = {}) {
    if (!audio) return false;

    clearDeferredAudioPlayback();
    if (typeof audio.__diagnosticCleanup === 'function') {
        try { audio.__diagnosticCleanup(); } catch (_) {}
    }
    audio.__diagnosticCleanup = attachAudioDiagnostics(audio, {
        engine: 'remote',
        voiceLabel,
        status: 'pending'
    });
    setActiveAudio(audio);
    setTtsDebug('remote', voiceLabel, 'pending');

    let settled = false;

    const cleanup = () => {
        audio.removeEventListener('playing', handlePlaying);
        audio.removeEventListener('error', handleFailure);
    };

    const handlePlaying = () => {
        if (settled) return;
        settled = true;
        cleanup();
        setTtsDebug('remote', voiceLabel, 'playing');
        if (typeof onPlaying === 'function') {
            onPlaying(audio);
        }
    };

    const handleFailure = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (globalScope.__activeAudio === audio) {
            stopActiveAudio();
        } else {
            detachActiveAudio(audio);
        }
        updateAudioDiagnostics({ event: 'play-failure', error: describeAudioFailure(error) || describeMediaError(audio.error) });
        if (typeof audio.__diagnosticCleanup === 'function') {
            try { audio.__diagnosticCleanup(); } catch (_) {}
            delete audio.__diagnosticCleanup;
        }
        if (isAutoplayBlockedError(error)) {
            setTtsDebug('remote', voiceLabel, 'blocked');
            queueDeferredAudioPlayback(() => {
                playTrackedRemoteAudio(audio, { voiceLabel, onPlaying, onFailure });
            });
            return;
        }
        setTtsDebug('remote', voiceLabel, 'error');
        if (typeof onFailure === 'function') {
            onFailure(error);
        }
    };

    audio.addEventListener('playing', handlePlaying, { once: true });
    audio.addEventListener('error', handleFailure, { once: true });

    try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(handleFailure);
        }
    } catch (error) {
        handleFailure(error);
    }

    return true;
}

function playChineseSpeechFallback(text, { rate, voice, debugStatus = 'speaking', forceVoice = false } = {}) {
    const trimmed = (text || '').toString().trim();
    if (!trimmed) return false;
    if (typeof window === 'undefined' ||
        typeof window.speechSynthesis === 'undefined' ||
        typeof window.SpeechSynthesisUtterance === 'undefined') {
        return false;
    }

    const chineseVoice = forceVoice ? (voice || null) : (voice || getChineseVoice());
    const utterance = new SpeechSynthesisUtterance(trimmed);
    clearDeferredAudioPlayback();
    utterance.lang = chineseVoice?.lang || 'zh-CN';
    utterance.rate = typeof rate === 'number'
        ? clampTtsRate(rate)
        : (typeof getQuizTtsRate === 'function' ? getQuizTtsRate() : DEFAULT_TTS_RATE);

    if (chineseVoice) {
        utterance.voice = chineseVoice;
    }

    setTtsDebug('speech', chineseVoice?.name || 'default', debugStatus);

    try {
        speechSynthesis.cancel();
    } catch (_) {}

    startSpeechSynthesis(utterance);

    return true;
}

function playGoogleChineseAudio(text, { allowSpeechFallback, rate, voice, onPlaying } = {}) {
    if (typeof Audio === 'undefined') {
        if (allowSpeechFallback) {
            return playChineseSpeechFallback(text, { rate, voice, debugStatus: 'fallback' });
        }
        return false;
    }

    return playTrackedRemoteAudio(
        primeAudioElement(new Audio(googleTtsUrl(text))),
        {
            voiceLabel: 'google',
            onPlaying,
            onFailure: () => {
                if (allowSpeechFallback) {
                    playChineseSpeechFallback(text, { rate, voice, debugStatus: 'fallback' });
                }
            }
        }
    );
}

// Play audio using TTS
function playTTS(chineseChar) {
    stopActiveAudio();

    const text = (chineseChar || '').toString().trim();
    if (!text) return;

    console.log(`Using TTS for: ${text}`);

    const hasSpeech = typeof window !== 'undefined' &&
        typeof window.speechSynthesis !== 'undefined' &&
        typeof window.SpeechSynthesisUtterance !== 'undefined';
    const isFirefox = isFirefoxBrowser();
    const hasChinese = containsChineseText(text);
    const avoidSpeechFallback = shouldAvoidSpeechFallback(text);
    const chineseVoice = hasSpeech ? getChineseVoice() : null;
    const isLikelyRobotic = isLikelyRoboticVoice(chineseVoice);
    const rate = typeof getQuizTtsRate === 'function' ? getQuizTtsRate() : DEFAULT_TTS_RATE;

    const preferRemote = hasChinese && (isFirefox || !chineseVoice || isLikelyRobotic);

    if (hasChinese && isFirefox) {
        const started = playEdgeTtsChineseAudio(text, {
            rate,
            onFailure: () => {
                if (hasSpeech) {
                    playChineseSpeechFallback(text, {
                        rate,
                        voice: chineseVoice,
                        debugStatus: avoidSpeechFallback ? 'robotic-fallback' : 'fallback',
                        forceVoice: avoidSpeechFallback
                    });
                    return;
                }

                const directStarted = typeof Audio !== 'undefined'
                    ? playTrackedRemoteAudio(
                        primeAudioElement(new Audio(sentenceTtsUrl(text, rate))),
                        {
                            voiceLabel: 'baidu',
                            onFailure: () => {
                                playGoogleChineseAudio(text, {
                                    allowSpeechFallback: false,
                                    rate,
                                    voice: chineseVoice
                                });
                            }
                        }
                    )
                    : false;
                if (!directStarted) {
                    console.warn('Firefox Chinese audio failed: Edge/blob path failed and no speech fallback is available.');
                }
            }
        });
        if (started) return;
    }

    if (!hasSpeech || preferRemote) {
        const started = typeof Audio !== 'undefined'
            ? playTrackedRemoteAudio(
                primeAudioElement(new Audio(sentenceTtsUrl(text, rate))),
                {
                    voiceLabel: 'baidu',
                    onFailure: () => {
                        playGoogleChineseAudio(text, {
                            allowSpeechFallback: hasSpeech && !avoidSpeechFallback,
                            rate,
                            voice: chineseVoice
                        });
                    }
                }
            )
            : false;

        if (!started && !hasSpeech) {
            console.warn('SpeechSynthesis not supported and Audio unavailable.');
        } else if (!started && hasSpeech && !avoidSpeechFallback) {
            playChineseSpeechFallback(text, { rate, voice: chineseVoice, debugStatus: 'fallback' });
        }
        return;
    }

    playChineseSpeechFallback(text, { rate, voice: chineseVoice, debugStatus: 'speaking' });
}

function playEnglishTTS(text) {
    stopActiveAudio();

    const trimmed = (text || '').toString().trim();
    if (!trimmed) return false;

    const hasSpeech = typeof window !== 'undefined' &&
        typeof window.speechSynthesis !== 'undefined' &&
        typeof window.SpeechSynthesisUtterance !== 'undefined';

    const playSpeechFallback = () => {
        if (!hasSpeech) {
            console.warn('English speech synthesis is not supported in this browser.');
            return false;
        }

        const utterance = new SpeechSynthesisUtterance(trimmed);
        const englishVoice = getEnglishVoice();
        utterance.lang = englishVoice?.lang || 'en-US';
        utterance.rate = typeof getQuizTtsRate === 'function' ? getQuizTtsRate() : DEFAULT_TTS_RATE;
        if (englishVoice) {
            utterance.voice = englishVoice;
        }

        try {
            speechSynthesis.cancel();
        } catch (_) {}

        startSpeechSynthesis(utterance);

        setTtsDebug('speech', englishVoice?.name || 'default', 'speaking');
        return true;
    };

    if (typeof Audio !== 'undefined') {
        const audio = new Audio(googleTtsUrl(trimmed, 'en-US'));
        setActiveAudio(audio);
        setTtsDebug('remote', 'google-en', 'pending');

        const onPlay = () => {
            setTtsDebug('remote', 'google-en', 'playing');
        };
        const onError = () => {
            audio.removeEventListener('error', onError);
            audio.removeEventListener('playing', onPlay);
            detachActiveAudio(audio);
            setTtsDebug('remote', 'google-en', 'error');
            playSpeechFallback();
        };

        audio.addEventListener('playing', onPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => onError());
        }
        return true;
    }

    return playSpeechFallback();
}

globalScope.playEnglishTTS = playEnglishTTS;

function mapRateToSentenceSpeed(rate) {
    const clamped = clampTtsRate(rate);
    const normalized = (clamped - MIN_TTS_RATE) / (MAX_TTS_RATE - MIN_TTS_RATE);
    const spd = Math.round(2 + normalized * 5); // map to range [2,7]
    return Math.min(9, Math.max(1, spd));
}

function sentenceTtsUrl(sentence, rate) {
    const effectiveRate = typeof rate === 'number' ? rate : getQuizTtsRate();
    const speedParam = mapRateToSentenceSpeed(effectiveRate);
    const base = `https://fanyi.baidu.com/gettts?lan=zh&spd=${speedParam}&source=web&text=`;
    return base + encodeURIComponent(sentence);
}

function googleTtsUrl(sentence, lang = 'zh-CN') {
    return `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(sentence)}`;
}

function playSentenceAudio(sentence) {
    if (!sentence || !sentence.trim()) return;

    const trimmedSentence = sentence.trim();
    const avoidSpeechFallback = shouldAvoidSpeechFallback(trimmedSentence);
    const rate = typeof getQuizTtsRate === 'function' ? getQuizTtsRate() : DEFAULT_TTS_RATE;
    const isFirefox = isFirefoxBrowser();

    if (containsChineseText(trimmedSentence) && isFirefox) {
        const started = playEdgeTtsChineseAudio(trimmedSentence, {
            rate,
            onPlaying: recordPromptAudioStart,
            onFailure: () => {
                if (typeof window !== 'undefined' &&
                    typeof window.speechSynthesis !== 'undefined' &&
                    typeof window.SpeechSynthesisUtterance !== 'undefined') {
                    playChineseSpeechFallback(trimmedSentence, {
                        rate,
                        debugStatus: avoidSpeechFallback ? 'robotic-fallback' : 'fallback',
                        forceVoice: avoidSpeechFallback
                    });
                    return;
                }

                const cachedFallback = getSentenceAudioInstance(trimmedSentence, rate);
                if (!cachedFallback) return;

                let { audio, cacheKey, cache } = cachedFallback;
                if (cache.has(cacheKey)) {
                    try {
                        audio.pause();
                        audio.currentTime = 0;
                    } catch (err) {
                        console.warn('Resetting cached audio failed, rebuilding instance', err);
                        cache.delete(cacheKey);
                        audio = primeAudioElement(new Audio(sentenceTtsUrl(trimmedSentence, rate)));
                        cache.set(cacheKey, audio);
                    }
                }

                const playGoogleFallback = () => {
                    playGoogleChineseAudio(trimmedSentence, {
                        allowSpeechFallback: false,
                        rate,
                        onPlaying: recordPromptAudioStart
                    });
                };

                const directStarted = playTrackedRemoteAudio(audio, {
                    voiceLabel: 'baidu',
                    onPlaying: recordPromptAudioStart,
                    onFailure: () => {
                        console.log(`Sentence audio failed for "${cacheKey}", using remote fallback`);
                        cache.delete(cacheKey);
                        playGoogleFallback();
                    }
                });

                if (!directStarted) {
                    cache.delete(cacheKey);
                    playGoogleFallback();
                }
            }
        });
        if (started) return;
    }

    if (typeof Audio === 'undefined') {
        console.warn('Audio element not available, using SpeechSynthesis fallback for sentence.');
        stopActiveAudio();
        playTTS(trimmedSentence);
        return;
    }

    const cached = getSentenceAudioInstance(trimmedSentence, rate);
    if (!cached) return;

    let { audio, cacheKey, cache } = cached;
    if (cache.has(cacheKey)) {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (err) {
            console.warn('Resetting cached audio failed, rebuilding instance', err);
            cache.delete(cacheKey);
            audio = primeAudioElement(new Audio(sentenceTtsUrl(trimmedSentence, rate)));
            cache.set(cacheKey, audio);
        }
    }

    const playGoogleFallback = () => {
        playGoogleChineseAudio(trimmedSentence, {
            allowSpeechFallback: !avoidSpeechFallback,
            rate,
            onPlaying: recordPromptAudioStart
        });
    };

    const started = playTrackedRemoteAudio(audio, {
        voiceLabel: 'baidu',
        onPlaying: recordPromptAudioStart,
        onFailure: () => {
            console.log(`Sentence audio failed for "${cacheKey}", using remote fallback`);
            cache.delete(cacheKey);
            playGoogleFallback();
        }
    });

    if (!started) {
        cache.delete(cacheKey);
        playGoogleFallback();
    }
}

// Play audio for pinyin - uses audio files with TTS fallback
function playPinyinAudio(pinyin, chineseChar) {
    const text = (chineseChar || '').trim();
    const isMultiChar = text.length > 1;
    const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent || '');
    console.log(`Playing audio for: ${pinyin} (${chineseChar}) -> ${isMultiChar ? 'sentence' : 'single-char'}`);

    if (isFirefox && text) {
        playSentenceAudio(text);
        return;
    }

    if (isMultiChar) {
        playSentenceAudio(text);
        return;
    }

    const cached = getPinyinAudioInstance(pinyin);
    if (!cached) return;

    const { audioKey, cache } = cached;
    let { audio } = cached;
    console.log(`Trying audio file: ${audioKey}.mp3`);

    try {
        audio.pause();
        audio.currentTime = 0;
    } catch (err) {
        console.warn('Resetting cached pinyin audio failed, rebuilding instance', err);
        cache.delete(audioKey);
        audio = primeAudioElement(new Audio(`https://www.purpleculture.net/mp3/${audioKey}.mp3`));
        cache.set(audioKey, audio);
    }

    setActiveAudio(audio);
    setTtsDebug('remote', 'purpleculture', 'pending');

    const onPlay = () => {
        setTtsDebug('remote', 'purpleculture', 'playing');
        recordPromptAudioStart();
    };

    const handleError = () => {
        console.log(`Audio file not found for ${audioKey}, falling back to TTS`);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('playing', onPlay);
        detachActiveAudio(audio);
        cache.delete(audioKey);
        setTtsDebug('remote', 'purpleculture', 'error');
        playTTS(chineseChar || pinyin);
    };

    audio.addEventListener('playing', onPlay, { once: true });
    audio.addEventListener('error', handleError, { once: true });

    audio.play().catch(e => {
        console.log(`Audio play failed for ${audioKey}, falling back to TTS:`, e);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('playing', onPlay);
        if (globalScope.__activeAudio === audio) {
            stopActiveAudio();
        } else {
            detachActiveAudio(audio);
        }
        cache.delete(audioKey);
        setTtsDebug('remote', 'purpleculture', 'error');
        playTTS(chineseChar || pinyin);
    });
}
