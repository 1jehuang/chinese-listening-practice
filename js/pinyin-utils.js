// =============================================================================
// PINYIN UTILITIES
// =============================================================================

// Tone mark mappings
const TONE_MARK_TO_BASE = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
    'ü': 'v'
};

const TONE_MARK_TO_NUMBER = {
    'ā': '1', 'á': '2', 'ǎ': '3', 'à': '4',
    'ē': '1', 'é': '2', 'ě': '3', 'è': '4',
    'ī': '1', 'í': '2', 'ǐ': '3', 'ì': '4',
    'ō': '1', 'ó': '2', 'ǒ': '3', 'ò': '4',
    'ū': '1', 'ú': '2', 'ǔ': '3', 'ù': '4',
    'ǖ': '1', 'ǘ': '2', 'ǚ': '3', 'ǜ': '4'
};

const PINYIN_FINAL_LETTERS = new Set(['a', 'e', 'i', 'o', 'u', 'v', 'n', 'r']);
// NOTE: Keep ':' out of the separator regex so `u:` (ü) notation like `lu:4` stays in a single token.
const PINYIN_SEPARATOR_REGEX = /[\s.,/;!?'"""''—–\-…，。、？！；：（）【】《》·]/;
const PINYIN_STRIP_REGEX = /[\s.,/;:!?'"""''—–\-…，。、？！；：（）【】《》·]/g;
const TONE_SEQUENCE = ['1', '2', '3', '4', '5'];
const TONE_MARK_MAP = {
    'a': ['ā', 'á', 'ǎ', 'à'],
    'e': ['ē', 'é', 'ě', 'è'],
    'i': ['ī', 'í', 'ǐ', 'ì'],
    'o': ['ō', 'ó', 'ǒ', 'ò'],
    'u': ['ū', 'ú', 'ǔ', 'ù'],
    'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ']
};
const PINYIN_WORD_SEPARATOR_REGEX = /[\s,，、。！？；：;（）()【】《》「」『』…—–-]+/;

/**
 * Convert pinyin with tone marks or numbers to tone number format (e.g., "hǎo" -> "hao3")
 * @param {string} pinyin - Pinyin string with tone marks or numbers
 * @returns {string} Pinyin in tone number format
 */
function convertPinyinToToneNumbers(pinyin) {
    const syllables = splitPinyinSyllables(pinyin);
    if (syllables.length === 0) return '';

    return syllables.map(syl => {
        let tone = '5';
        let base = '';

        for (let i = 0; i < syl.length; i++) {
            const char = syl[i];

            if (/[1-5]/.test(char)) {
                tone = char;
                continue;
            }

            const lower = char.toLowerCase();

            if (TONE_MARK_TO_NUMBER[lower]) {
                tone = TONE_MARK_TO_NUMBER[lower];
                base += TONE_MARK_TO_BASE[lower];
            } else if (lower === 'ü') {
                base += 'v';
            } else if (lower === 'u' && syl[i + 1] === ':') {
                base += 'v';
            } else if (char === ':') {
                continue;
            } else {
                base += lower;
            }
        }

        if (base.length === 0) {
            base = syl.replace(/[1-5]/g, '') || syl;
        }

        return base + tone;
    }).join('');
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
    // 2. Normalize ü/u: variants to 'v'
    // 3. Remove all separators/punctuation
    // 4. Remove all tone numbers
    // 5. Remove all tone marks
    // 6. Result: pure letters only (e.g., "zhongguo")

    let result = pinyin.toLowerCase().trim();

    // Normalize ü/u: variants to 'v'
    result = result.replace(/u:/g, 'v');

    // Remove all separators and punctuation
    result = result.replace(PINYIN_STRIP_REGEX, '');

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

/**
 * Split pinyin string into individual syllables
 * @param {string} pinyin - Pinyin string (with tone marks, numbers, or neutral)
 * @returns {string[]} Array of syllables
 */
function splitPinyinSyllables(pinyin) {
    if (!pinyin) return [];

    const text = pinyin.trim();
    if (!text) return [];

    const syllables = [];
    let current = '';
    let pendingBoundary = false;
    let lastNonDigitChar = '';

    const flush = () => {
        if (current) {
            syllables.push(current);
        }
        current = '';
        pendingBoundary = false;
        lastNonDigitChar = '';
    };

    const isSeparator = (char) => {
        if (!char) return false;
        return PINYIN_SEPARATOR_REGEX.test(char);
    };

    const isToneMark = (char) => {
        if (!char) return false;
        return Boolean(TONE_MARK_TO_NUMBER[char.toLowerCase()]);
    };

    const isFinalLetter = (char, previousChar) => {
        if (!char) return false;
        const lower = char.toLowerCase();
        if (PINYIN_FINAL_LETTERS.has(lower)) return true;
        if (lower === 'g') {
            if (!previousChar) return false;
            return previousChar.toLowerCase() === 'n';
        }
        if (lower === ':') return true;
        return false;
    };

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (isSeparator(char)) {
            flush();
            continue;
        }

        if (pendingBoundary && !/[1-5]/.test(char) && !isToneMark(char)) {
            // After a tone mark, if we encounter something that's NOT a valid continuation, split
            const charLower = char.toLowerCase();
            const prevLower = lastNonDigitChar.toLowerCase();

            // Check if this is part of a compound final (ai, ei, ao, ou, etc.)
            const prevIsVowel = /[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(prevLower);
            const charIsVowel = /[aeiouü]/.test(charLower);

            // Common compound finals: ai, ei, ao, ou, ia, ie, ua, uo, üe, etc.
            const isCompoundFinal = prevIsVowel && charIsVowel;

            // Check if this could be a syllable ending (n, ng, r after vowels)
            const isValidEnding = (
                (charLower === 'n' || charLower === 'r') ||
                (charLower === 'g' && prevLower === 'n')
            );

            // If it's a compound final or valid ending, keep it in the same syllable
            if (!isCompoundFinal && !isValidEnding) {
                // This is a consonant starting a new syllable
                flush();
            } else if (isValidEnding) {
                // Even if it looks like an ending, check if the NEXT character suggests otherwise
                // e.g., in "xīnán", after "n" we see "á" which means "n" starts a new syllable
                const nextChar = i + 1 < text.length ? text[i + 1].toLowerCase() : '';
                const nextIsVowel = /[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(nextChar);

                if (nextIsVowel) {
                    // This "n" starts a new syllable like "nán"
                    flush();
                }
            }
        }

        current += char;

        if (/[1-5]/.test(char)) {
            const nextChar = text[i + 1];
            if (nextChar && nextChar.toLowerCase() === 'r') {
                const nextNext = text[i + 2];
                if (!nextNext || isSeparator(nextNext)) {
                    // Keep erhua r as part of the same syllable (e.g., wan2r)
                    continue;
                }
            }
            flush();
            continue;
        }

        if (!/[1-5]/.test(char)) {
            lastNonDigitChar = char;
        }

        if (isToneMark(char)) {
            pendingBoundary = true;
        }
    }

    flush();

    return syllables.length > 0 ? syllables : [text];
}

/**
 * Format a pinyin syllable with tone marks
 * @param {string} baseSyllable - Base syllable without tones (e.g., "hao")
 * @param {number|string} toneNumber - Tone number (1-5)
 * @returns {string} Syllable with tone mark (e.g., "hǎo")
 */
function formatSyllableWithToneMark(baseSyllable, toneNumber) {
    if (!baseSyllable) return '';

    const tone = Number(toneNumber);
    const normalized = baseSyllable
        .toLowerCase()
        .replace(/u:/g, 'v');
    const displaySyllable = normalized.replace(/v/g, 'ü');

    if (!Number.isFinite(tone) || tone === 5 || tone < 1 || tone > 4) {
        return displaySyllable;
    }

    let toneIndex = -1;
    if (displaySyllable.includes('a')) {
        toneIndex = displaySyllable.indexOf('a');
    } else if (displaySyllable.includes('e')) {
        toneIndex = displaySyllable.indexOf('e');
    } else if (displaySyllable.includes('ou')) {
        toneIndex = displaySyllable.indexOf('o');
    } else {
        for (let i = displaySyllable.length - 1; i >= 0; i--) {
            if ('aeiouü'.includes(displaySyllable[i])) {
                toneIndex = i;
                break;
            }
        }
    }

    if (toneIndex === -1) return displaySyllable;

    const vowel = displaySyllable[toneIndex];
    const replacements = TONE_MARK_MAP[vowel];
    if (!replacements) return displaySyllable;

    const tonedVowel = replacements[tone - 1];
    if (!tonedVowel) return displaySyllable;

    return displaySyllable.slice(0, toneIndex) + tonedVowel + displaySyllable.slice(toneIndex + 1);
}

/**
 * Apply original casing to formatted pinyin
 * @param {string} original - Original text with case
 * @param {string} formatted - Formatted text without case
 * @returns {string} Formatted text with original casing applied
 */
function applyOriginalCasing(original, formatted) {
    if (!formatted) return formatted;
    if (!original) return formatted;
    if (original === original.toUpperCase()) {
        return formatted.toUpperCase();
    }
    if (original[0] === original[0].toUpperCase()) {
        return formatted[0].toUpperCase() + formatted.slice(1);
    }
    return formatted;
}

/**
 * Get next tone number in sequence
 * @param {string|number} currentTone - Current tone (1-5)
 * @param {number} step - Step size (default 1, negative to go backwards)
 * @returns {string} Next tone number
 */
function getToneNumberWithStep(currentTone, step = 1) {
    const tone = String(currentTone);
    if (!Number.isFinite(step)) step = 1;
    const offset = Math.trunc(step);
    if (offset === 0) return tone;

    let idx = TONE_SEQUENCE.indexOf(tone);
    if (idx === -1) idx = 0;

    let nextIdx = (idx + offset) % TONE_SEQUENCE.length;
    if (nextIdx < 0) {
        nextIdx += TONE_SEQUENCE.length;
    }
    return TONE_SEQUENCE[nextIdx];
}

/**
 * Find the range of a pinyin token in a string at a given position
 * @param {string} value - Input string
 * @param {number} caretPos - Cursor position
 * @returns {Object|null} {start, end} or null if not found
 */
function findPinyinTokenRange(value, caretPos) {
    if (typeof value !== 'string' || value.length === 0) return null;

    const length = value.length;
    let pos = typeof caretPos === 'number' ? caretPos : length;
    if (pos < 0) pos = 0;
    if (pos > length) pos = length;

    const isWhitespace = (idx) => idx >= 0 && idx < length && /\s/.test(value[idx]);

    let index = pos;

    if (pos > 0 && pos <= length && !isWhitespace(pos - 1)) {
        index = pos - 1;
    } else if (pos < length && !isWhitespace(pos)) {
        index = pos;
    } else {
        let left = pos - 1;
        while (left >= 0 && isWhitespace(left)) left--;
        if (left >= 0) {
            index = left;
        } else {
            let right = pos;
            while (right < length && isWhitespace(right)) right++;
            if (right < length) {
                index = right;
            } else {
                return null;
            }
        }
    }

    let start = index;
    while (start > 0 && !isWhitespace(start - 1)) start--;

    let end = index + 1;
    while (end < length && !isWhitespace(end)) end++;

    return { start, end };
}

/**
 * Cycle tone marks in an input field at cursor position
 * @param {HTMLInputElement} inputEl - Input element
 * @param {number} direction - Direction to cycle (1 for forward, -1 for backward)
 * @returns {boolean} True if tone was cycled successfully
 */
function cycleToneForInputField(inputEl, direction = 1) {
    if (!inputEl || typeof inputEl.value !== 'string') return false;

    const value = inputEl.value;
    if (!value.trim()) return false;

    const selectionStart = typeof inputEl.selectionStart === 'number' ? inputEl.selectionStart : value.length;
    const selectionEnd = typeof inputEl.selectionEnd === 'number' ? inputEl.selectionEnd : selectionStart;
    const caretPos = selectionEnd;
    const range = findPinyinTokenRange(value, caretPos);

    if (!range) return false;

    const token = value.slice(range.start, range.end);
    if (!token || !/^[a-zA-Z:üÜǕǗǙǛǖǘǚǜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ1-5]+$/.test(token)) return false;

    const trimmedToken = token.trim();
    if (!trimmedToken) return false;

    const syllables = splitPinyinSyllables(trimmedToken);
    if (syllables.length !== 1) return false;

    const numbered = convertPinyinToToneNumbers(trimmedToken);
    if (!numbered) return false;

    const match = numbered.match(/^([a-z]+)([1-5])$/);
    if (!match) return false;

    const [, base, currentTone] = match;
    const step = direction < 0 ? -1 : 1;
    const nextTone = getToneNumberWithStep(currentTone, step);
    const formatted = formatSyllableWithToneMark(base, Number(nextTone));
    const adjusted = applyOriginalCasing(trimmedToken, formatted);
    const finalValue = value.slice(0, range.start) + adjusted + value.slice(range.end);

    if (finalValue === value) return false;

    inputEl.value = finalValue;
    if (typeof inputEl.setSelectionRange === 'function') {
        try {
            const newCaret = range.start + adjusted.length;
            inputEl.setSelectionRange(newCaret, newCaret);
        } catch (_) {
            // Ignore selection errors (e.g., unsupported input types)
        }
    }
    return true;
}
