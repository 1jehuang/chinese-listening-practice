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

// Convert pinyin with tone marks to audio key format
function pinyinToAudioKey(pinyin) {
    const toneMarkToNumber = {
        'ā': 'a1', 'á': 'a2', 'ǎ': 'a3', 'à': 'a4',
        'ē': 'e1', 'é': 'e2', 'ě': 'e3', 'è': 'e4',
        'ī': 'i1', 'í': 'i2', 'ǐ': 'i3', 'ì': 'i4',
        'ō': 'o1', 'ó': 'o2', 'ǒ': 'o3', 'ò': 'o4',
        'ū': 'u1', 'ú': 'u2', 'ǔ': 'u3', 'ù': 'u4',
        'ǖ': 'v1', 'ǘ': 'v2', 'ǚ': 'v3', 'ǜ': 'v4',
        'ü': 'v'
    };

    // Remove dots (e.g., "shém.me" -> "shemme", "lì.shi" -> "lishi")
    let result = pinyin.toLowerCase().replace(/\./g, '');

    // Replace tone marks with tone numbers
    for (const [marked, numbered] of Object.entries(toneMarkToNumber)) {
        result = result.replace(new RegExp(marked, 'g'), numbered);
    }

    // Add tone 5 for neutral tone if no tone number exists
    if (!/\d/.test(result)) {
        result += '5';
    }

    return result;
}
