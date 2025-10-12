// Common utility functions shared across all quiz pages

const globalScope = typeof window !== 'undefined' ? window : globalThis;

// Sound effect functions
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

// Split pinyin into individual syllables
function splitPinyinSyllables(pinyin) {
    // Remove dots first
    pinyin = pinyin.replace(/\./g, '').replace(/\.\.\./g, '');

    // Match syllable pattern: optional consonant(s) + vowel(s) with tone + optional n/ng/r
    const syllablePattern = /[bpmfdtnlgkhjqxzcsrwy]?h?[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+n?g?r?/gi;
    const syllables = pinyin.match(syllablePattern) || [pinyin];

    return syllables;
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

// Play audio using TTS
function playTTS(chineseChar) {
    if (typeof window === 'undefined' ||
        typeof window.speechSynthesis === 'undefined' ||
        typeof window.SpeechSynthesisUtterance === 'undefined') {
        console.warn('SpeechSynthesis not supported in this browser.');
        return;
    }

    console.log(`Using TTS for: ${chineseChar}`);

    const utterance = new SpeechSynthesisUtterance(chineseChar);
    utterance.lang = 'zh-CN'; // Mandarin Chinese
    utterance.rate = 0.8; // Slightly slower for learning

    // Try to get a Chinese voice
    const voices = speechSynthesis.getVoices();
    const chineseVoice = voices.find(voice => voice.lang.startsWith('zh'));
    if (chineseVoice) {
        utterance.voice = chineseVoice;
    }

    if (typeof speechSynthesis.cancel === 'function') {
        speechSynthesis.cancel();
    }

    speechSynthesis.speak(utterance);
}

function sentenceTtsUrl(sentence) {
    const base = 'https://fanyi.baidu.com/gettts?lan=zh&spd=3&source=web&text=';
    return base + encodeURIComponent(sentence);
}

function playSentenceAudio(sentence) {
    if (!sentence || !sentence.trim()) return;

    const cacheKey = sentence.trim();
    if (typeof Audio === 'undefined') {
        console.warn('Audio element not available, using SpeechSynthesis fallback for sentence.');
        playTTS(cacheKey);
        return;
    }

    if (!globalScope.__sentenceAudioCache) {
        globalScope.__sentenceAudioCache = new Map();
    }

    let audio = globalScope.__sentenceAudioCache.get(cacheKey);
    if (!audio) {
        audio = new Audio(sentenceTtsUrl(cacheKey));
        audio.preload = 'auto';
        globalScope.__sentenceAudioCache.set(cacheKey, audio);
    } else {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (err) {
            console.warn('Resetting cached audio failed, rebuilding instance', err);
            globalScope.__sentenceAudioCache.delete(cacheKey);
            audio = new Audio(sentenceTtsUrl(cacheKey));
            audio.preload = 'auto';
            globalScope.__sentenceAudioCache.set(cacheKey, audio);
        }
    }

    const onError = () => {
        console.log(`Sentence audio failed for "${cacheKey}", using SpeechSynthesis fallback`);
        audio.removeEventListener('error', onError);
        globalScope.__sentenceAudioCache.delete(cacheKey);
        playTTS(cacheKey);
    };

    audio.addEventListener('error', onError, { once: true });

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(err => {
            console.log(`Sentence audio playback rejected for "${cacheKey}", fallback to SpeechSynthesis`, err);
            audio.removeEventListener('error', onError);
            globalScope.__sentenceAudioCache.delete(cacheKey);
            playTTS(cacheKey);
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
        playTTS(chineseChar || pinyin);
        return;
    }

    const audio = new Audio(audioUrl);

    const handleError = () => {
        console.log(`Audio file not found for ${audioKey}, falling back to TTS`);
        audio.removeEventListener('error', handleError);
        playTTS(chineseChar || pinyin);
    };

    audio.addEventListener('error', handleError);

    audio.play().catch(e => {
        console.log(`Audio play failed for ${audioKey}, falling back to TTS:`, e);
        audio.removeEventListener('error', handleError);
        playTTS(chineseChar || pinyin);
    });
}
