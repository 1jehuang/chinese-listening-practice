// Common utility functions shared across all quiz pages

const globalScope = typeof window !== 'undefined' ? window : globalThis;

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

// Fuzzy matching function for text input
function fuzzyMatch(input, target) {
    if (input === target) return 1000;
    if (target.startsWith(input)) return 100 + input.length;
    if (target.includes(input)) return 50 + input.length;
    let score = 0;
    for (let char of input) {
        if (target.includes(char)) score += 1;
    }
    return score;
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

function loadVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        cachedVoices = voices;
        voicesLoaded = true;
    }
}

// Initialize voices on page load
if (typeof window !== 'undefined' && window.speechSynthesis) {
    loadVoices();
    // iOS Safari fires voiceschanged after getVoices() returns empty
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function getChineseVoice() {
    if (!voicesLoaded) loadVoices();
    // Prefer zh-CN, fall back to any zh voice
    return cachedVoices.find(v => v.lang === 'zh-CN') ||
           cachedVoices.find(v => v.lang.startsWith('zh'));
}

// Play audio using TTS
function playTTS(chineseChar) {
    stopActiveAudio();

    if (typeof window === 'undefined' ||
        typeof window.speechSynthesis === 'undefined' ||
        typeof window.SpeechSynthesisUtterance === 'undefined') {
        console.warn('SpeechSynthesis not supported in this browser.');
        return;
    }

    console.log(`Using TTS for: ${chineseChar}`);

    const utterance = new SpeechSynthesisUtterance(chineseChar);
    utterance.lang = 'zh-CN'; // Mandarin Chinese
    if (typeof getQuizTtsRate === 'function') {
        utterance.rate = getQuizTtsRate();
    } else {
        utterance.rate = DEFAULT_TTS_RATE;
    }

    // Use cached Chinese voice (iOS-compatible)
    const chineseVoice = getChineseVoice();
    if (chineseVoice) {
        utterance.voice = chineseVoice;
    }

    // Cancel any ongoing speech before starting new one
    if (typeof speechSynthesis.cancel === 'function') {
        speechSynthesis.cancel();
    }

    // iOS Safari workaround: sometimes needs a small delay after cancel
    setTimeout(() => {
        speechSynthesis.speak(utterance);
    }, 10);
}

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

function playSentenceAudio(sentence) {
    if (!sentence || !sentence.trim()) return;

    const trimmedSentence = sentence.trim();
    const rate = typeof getQuizTtsRate === 'function' ? getQuizTtsRate() : DEFAULT_TTS_RATE;
    const cacheKey = `${trimmedSentence}|${rate.toFixed(2)}`;
    if (typeof Audio === 'undefined') {
        console.warn('Audio element not available, using SpeechSynthesis fallback for sentence.');
        stopActiveAudio();
        playTTS(trimmedSentence);
        return;
    }

    if (!globalScope.__sentenceAudioCache) {
        globalScope.__sentenceAudioCache = new Map();
    }

    let audio = globalScope.__sentenceAudioCache.get(cacheKey);
    if (!audio) {
        audio = new Audio(sentenceTtsUrl(trimmedSentence, rate));
        audio.preload = 'auto';
        globalScope.__sentenceAudioCache.set(cacheKey, audio);
    } else {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (err) {
            console.warn('Resetting cached audio failed, rebuilding instance', err);
            globalScope.__sentenceAudioCache.delete(cacheKey);
            audio = new Audio(sentenceTtsUrl(trimmedSentence, rate));
            audio.preload = 'auto';
            globalScope.__sentenceAudioCache.set(cacheKey, audio);
        }
    }

    setActiveAudio(audio);

    const onError = () => {
        console.log(`Sentence audio failed for "${cacheKey}", using SpeechSynthesis fallback`);
        audio.removeEventListener('error', onError);
        detachActiveAudio(audio);
        globalScope.__sentenceAudioCache.delete(cacheKey);
        playTTS(trimmedSentence);
    };

    audio.addEventListener('error', onError, { once: true });

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(err => {
            console.log(`Sentence audio playback rejected for "${cacheKey}", fallback to SpeechSynthesis`, err);
            audio.removeEventListener('error', onError);
            if (globalScope.__activeAudio === audio) {
                stopActiveAudio();
            } else {
                detachActiveAudio(audio);
            }
            globalScope.__sentenceAudioCache.delete(cacheKey);
            playTTS(trimmedSentence);
        });
    }
}

// Play audio for pinyin - uses audio files with TTS fallback
function playPinyinAudio(pinyin, chineseChar) {
    const text = (chineseChar || '').trim();
    const isMultiChar = text.length > 1;
    console.log(`Playing audio for: ${pinyin} (${chineseChar}) -> ${isMultiChar ? 'sentence' : 'single-char'}`);

    if (isMultiChar) {
        playSentenceAudio(text);
        return;
    }

    const audioKey = pinyinToAudioKey(pinyin);
    const audioUrl = `https://www.purpleculture.net/mp3/${audioKey}.mp3`;
    console.log(`Trying audio file: ${audioKey}.mp3`);

    if (typeof Audio === 'undefined') {
        console.warn('Audio element not available, using SpeechSynthesis fallback.');
        stopActiveAudio();
        playTTS(chineseChar || pinyin);
        return;
    }

    const audio = new Audio(audioUrl);
    setActiveAudio(audio);

    const handleError = () => {
        console.log(`Audio file not found for ${audioKey}, falling back to TTS`);
        audio.removeEventListener('error', handleError);
        detachActiveAudio(audio);
        playTTS(chineseChar || pinyin);
    };

    audio.addEventListener('error', handleError);

    audio.play().catch(e => {
        console.log(`Audio play failed for ${audioKey}, falling back to TTS:`, e);
        audio.removeEventListener('error', handleError);
        if (globalScope.__activeAudio === audio) {
            stopActiveAudio();
        } else {
            detachActiveAudio(audio);
        }
        playTTS(chineseChar || pinyin);
    });
}
