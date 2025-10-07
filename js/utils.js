// Common utility functions shared across all quiz pages

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

// Play audio for pinyin - uses TTS for multi-character words, audio files for single characters
function playPinyinAudio(pinyin, chineseChar) {
    // Use character count to determine if multi-syllable (more reliable than pinyin parsing)
    const isMultiChar = chineseChar && chineseChar.length > 1;
    console.log(`Playing audio for: ${pinyin} (${chineseChar}) -> ${isMultiChar ? 'multi-char' : 'single-char'}`);

    // If multi-character word, use Web Speech API (TTS)
    if (isMultiChar) {
        console.log(`Using TTS for multi-character word: ${chineseChar}`);

        // Use Web Speech API
        const utterance = new SpeechSynthesisUtterance(chineseChar);
        utterance.lang = 'zh-CN'; // Mandarin Chinese
        utterance.rate = 0.8; // Slightly slower for learning

        // Try to get a Chinese voice
        const voices = speechSynthesis.getVoices();
        const chineseVoice = voices.find(voice => voice.lang.startsWith('zh'));
        if (chineseVoice) {
            utterance.voice = chineseVoice;
        }

        speechSynthesis.speak(utterance);
    } else {
        // Single character - use audio file
        const audioKey = pinyinToAudioKey(pinyin);
        const audioUrl = `https://www.purpleculture.net/mp3/${audioKey}.mp3`;
        console.log(`Using audio file: ${audioKey}.mp3`);

        const audio = new Audio(audioUrl);
        audio.play().catch(e => console.log(`Audio play failed for ${audioKey}:`, e));
    }
}
