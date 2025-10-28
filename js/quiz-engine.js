// Shared Quiz Engine
// Used by all quiz pages (character sheets, lessons, practice tests)
// Each page only needs to define characters array and call initQuiz()

// Quiz state
let currentQuestion = null;
let mode = 'char-to-pinyin';
let answered = false;
let score = 0;
let total = 0;
let enteredSyllables = [];
let enteredTones = '';
let quizCharacters = [];
let config = {};

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

// Timer state
let timerEnabled = false;
let timerSeconds = 10;
let timerIntervalId = null;
let timerRemainingSeconds = 0;
const TIMER_ENABLED_KEY = 'quizTimerEnabled';
const TIMER_SECONDS_KEY = 'quizTimerSeconds';

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
// PINYIN UTILITIES
// =============================================================================

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
const PINYIN_SEPARATOR_REGEX = /[\s.,/;:!?'"“”‘’—–\-…，。、？！；：（）【】《》·]/;
const PINYIN_STRIP_REGEX = /[\s.,/;:!?'"“”‘’—–\-…，。、？！；：（）【】《》·]/g;
const TONE_SEQUENCE = ['1', '2', '3', '4', '5'];
const TONE_MARK_MAP = {
    'a': ['ā', 'á', 'ǎ', 'à'],
    'e': ['ē', 'é', 'ě', 'è'],
    'i': ['ī', 'í', 'ǐ', 'ì'],
    'o': ['ō', 'ó', 'ǒ', 'ò'],
    'u': ['ū', 'ú', 'ǔ', 'ù'],
    'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ']
};
const PINYIN_WORD_SEPARATOR_REGEX = /[\s,，、。！？；：:;（）()【】《》「」『』…—–-]+/;

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

function getRandomQuestion() {
    if (!Array.isArray(quizCharacters) || quizCharacters.length === 0) return null;
    const index = Math.floor(Math.random() * quizCharacters.length);
    return quizCharacters[index];
}

function isPreviewModeActive() {
    if (!previewQueueEnabled || !previewElement) return false;
    if (!Array.isArray(quizCharacters) || quizCharacters.length === 0) return false;
    if (Array.isArray(previewApplicableModes) && previewApplicableModes.length > 0) {
        return previewApplicableModes.includes(mode);
    }
    return true;
}

function ensurePreviewQueue() {
    if (!previewQueueEnabled || !previewElement) return;
    if (!Array.isArray(previewQueue)) {
        previewQueue = [];
    }
    while (previewQueue.length < previewQueueSize) {
        const candidate = getRandomQuestion();
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

    questionDisplay.innerHTML = `
        <div class="dictation-sentence text-center text-5xl md:text-6xl my-8 font-normal text-gray-800 leading-snug">
            ${sentenceHtml}
        </div>
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

function generateQuestion() {
    clearPendingNextQuestion();
    stopTimer();
    enteredSyllables = [];
    enteredTones = '';
    answered = false;
    feedback.textContent = '';
    hint.textContent = '';
    hint.className = 'text-center text-2xl font-semibold my-4';
    answerInput.value = '';
    questionAttemptRecorded = false;
    lastAnswerCorrect = false;
    clearComponentBreakdown();
    hideDrawNextButton();

    const previewActive = isPreviewModeActive();
    let nextQuestion = null;

    if (previewActive) {
        ensurePreviewQueue();
        if (previewQueue.length) {
            nextQuestion = previewQueue.shift();
        }
        ensurePreviewQueue();
    }

    if (!nextQuestion) {
        nextQuestion = getRandomQuestion();
    }

    if (!nextQuestion) {
        questionDisplay.innerHTML = `<div class="text-center text-2xl text-red-600 my-8">No questions available.</div>`;
        return;
    }

    currentQuestion = nextQuestion;
    updatePreviewDisplay();
    window.currentQuestion = currentQuestion;

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
    } else if (mode === 'pinyin-to-char' && choiceMode) {
        questionDisplay.innerHTML = `<div style="text-align: center; font-size: 48px; margin: 40px 0;">${currentQuestion.pinyin}</div>`;
        generateCharOptions();
        choiceMode.style.display = 'block';
    } else if (mode === 'char-to-meaning' && choiceMode) {
        renderMeaningQuestionLayout();
        generateMeaningOptions();
        choiceMode.style.display = 'block';
    } else if (mode === 'char-to-meaning-type' && fuzzyMode) {
        renderMeaningQuestionLayout();
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
        const charCount = currentQuestion.char.length;
        const charText = charCount > 1 ? `Practice ${charCount} characters: ` : 'Practice: ';
        questionDisplay.innerHTML = `<div class="text-center text-6xl my-8 font-bold text-gray-700">${charText}${currentQuestion.pinyin}</div>`;
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

    // Start timer for the new question
    if (timerEnabled) {
        startTimer();
    }
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

        const select = document.createElement('select');
        select.id = 'ttsSpeedSelect';
        select.className = 'border-2 border-gray-300 rounded-lg px-3 py-1 bg-white text-sm focus:border-blue-500 focus:outline-none';

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

            feedback.textContent = `✗ Wrong. The answer is: ${expectedTones} (${currentQuestion.pinyin})`;
            feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
            hint.textContent = `Meaning: ${currentQuestion.meaning}`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-red-600';
            renderCharacterComponents(currentQuestion);

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

    if (mode === 'audio-to-pinyin') {
        feedback.textContent = `✗ Wrong. The answer is: ${currentQuestion.pinyin} (${currentQuestion.char})`;
    } else {
        feedback.textContent = `✗ Wrong. The answer is: ${currentQuestion.pinyin}`;
    }
    feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
    hint.textContent = `Meaning: ${currentQuestion.meaning}`;
    hint.className = 'text-center text-2xl font-semibold my-4 text-red-600';
    renderCharacterComponents(currentQuestion);
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

    const currentPinyin = currentQuestion.pinyin.split('/')[0].trim();
    const wrongOptions = [];

    while (wrongOptions.length < 3) {
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
        const randomPinyin = random.pinyin.split('/')[0].trim();
        if (random.char !== currentQuestion.char && !wrongOptions.includes(randomPinyin)) {
            wrongOptions.push(randomPinyin);
        }
    }

    const allOptions = [...wrongOptions, currentPinyin];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'px-6 py-4 text-xl bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition';
        btn.textContent = option;
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
    fuzzyInput.value = '';

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

    if (correct) {
        answered = true;
        playCorrectSound();
        if (isFirstAttempt) {
            score++;
        }
        lastAnswerCorrect = true;
        feedback.textContent = `✓ Correct! ${currentQuestion.char} (${currentQuestion.pinyin})`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        renderMeaningHint(currentQuestion, 'correct');
        renderCharacterComponents(currentQuestion);
        updateStats();
        if (fuzzyInput) {
            fuzzyInput.value = '';
        }
        scheduleNextQuestion(1500);
    } else {
        answered = false;
        playWrongSound();
        lastAnswerCorrect = false;
        feedback.textContent = `✗ Wrong! Correct: ${currentQuestion.meaning} - ${currentQuestion.char} (${currentQuestion.pinyin})`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-red-600';
        renderMeaningHint(currentQuestion, 'incorrect');
        renderCharacterComponents(currentQuestion);
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
        const pinyinOptions = currentQuestion.pinyin.split('/').map(p => p.trim());
        correct = pinyinOptions.includes(answer);
        correctAnswer = currentQuestion.pinyin;
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
        feedback.textContent = `✓ Correct!`;
        feedback.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        lastAnswerCorrect = true;
        if (mode === 'char-to-meaning' || mode === 'audio-to-meaning') {
            renderMeaningHint(currentQuestion, 'correct');
        } else {
            hint.textContent = `${currentQuestion.char} (${currentQuestion.pinyin}) - ${currentQuestion.meaning}`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-green-600';
        }
        renderCharacterComponents(currentQuestion);

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
        if (mode === 'char-to-meaning' || mode === 'audio-to-meaning') {
            renderMeaningHint(currentQuestion, 'incorrect');
        } else {
            hint.textContent = `${currentQuestion.char} (${currentQuestion.pinyin}) - ${currentQuestion.meaning}`;
            hint.className = 'text-center text-2xl font-semibold my-4 text-red-600';
        }
        renderCharacterComponents(currentQuestion);

        // Play audio for char-to-pinyin-mc mode
        if (mode === 'char-to-pinyin-mc') {
            const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
            playPinyinAudio(firstPinyin, currentQuestion.char);
        }

        scheduleNextQuestion(1500);
    }

    updateStats();
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
        if (storedEnabled === '1') {
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
    generateQuestion();
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
        generateQuestion();
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

    // Create HanziWriter instances for all characters
    const chars = currentQuestion.char.split('');
    const writers = [];

    // Adjust size based on number of characters
    const charWidth = chars.length > 1 ? 250 : 300;
    const charHeight = chars.length > 1 ? 250 : 300;

    chars.forEach(char => {
        const charDiv = document.createElement('div');
        charDiv.style.display = 'inline-block';
        charDiv.style.margin = '0 10px';
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

    if (hwShowBtn) {
        hwShowBtn.onclick = () => {
            // Show and animate all characters
            writers.forEach((w, index) => {
                setTimeout(() => {
                    w.showCharacter();
                    w.showOutline();
                    w.animateCharacter();
                }, index * 1000); // Stagger animations by 1 second
            });

            feedback.textContent = `${currentQuestion.char} (${currentQuestion.pinyin}) - ${currentQuestion.meaning}`;
            feedback.className = 'text-center text-2xl font-semibold my-4 text-blue-600';
        };
    }

    if (hwNextBtn) {
        hwNextBtn.onclick = () => {
            generateQuestion();
        };
    }
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
    let showAnswerBtn = document.getElementById('showDrawAnswerBtn');
    const recognitionContainer = drawCharMode
        ? drawCharMode.querySelector('.text-center.mb-4')
        : null;

    if (recognitionContainer && !document.getElementById('ocrCandidates')) {
        const candidateContainer = document.createElement('div');
        candidateContainer.id = 'ocrCandidates';
        candidateContainer.className = 'flex flex-wrap justify-center gap-2 mt-2';
        candidateContainer.style.minHeight = '64px';
        candidateContainer.style.maxHeight = '96px';
        candidateContainer.style.overflowY = 'auto';
        recognitionContainer.appendChild(candidateContainer);
    }

    if (!showAnswerBtn && clearBtn && clearBtn.parentElement) {
        showAnswerBtn = document.createElement('button');
        showAnswerBtn.id = 'showDrawAnswerBtn';
        showAnswerBtn.className = 'bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg transition';
        showAnswerBtn.textContent = '🤔 Show Answer';
        clearBtn.parentElement.appendChild(showAnswerBtn);
    }

    // Add control buttons (undo/redo/zoom/reset)
    if (clearBtn && clearBtn.parentElement && !document.getElementById('undoBtn')) {
        const undoBtn = document.createElement('button');
        undoBtn.id = 'undoBtn';
        undoBtn.className = 'bg-gray-300 text-gray-500 px-4 py-2 rounded-lg transition cursor-not-allowed';
        undoBtn.textContent = '↶ Undo';
        undoBtn.disabled = true;
        undoBtn.onclick = undoStroke;
        clearBtn.parentElement.insertBefore(undoBtn, clearBtn);

        const redoBtn = document.createElement('button');
        redoBtn.id = 'redoBtn';
        redoBtn.className = 'bg-gray-300 text-gray-500 px-4 py-2 rounded-lg transition cursor-not-allowed';
        redoBtn.textContent = '↷ Redo';
        redoBtn.disabled = true;
        redoBtn.onclick = redoStroke;
        clearBtn.parentElement.insertBefore(redoBtn, clearBtn);
    }

    // Add zoom/reset buttons in a separate row
    if (drawCharMode && !document.getElementById('zoomControls')) {
        const zoomContainer = document.createElement('div');
        zoomContainer.id = 'zoomControls';
        zoomContainer.className = 'flex gap-2 justify-center mt-2';

        const zoomInBtn = document.createElement('button');
        zoomInBtn.className = 'bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-sm transition';
        zoomInBtn.textContent = '🔍+ Zoom In';
        zoomInBtn.onclick = zoomIn;

        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.className = 'bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-sm transition';
        zoomOutBtn.textContent = '🔍- Zoom Out';
        zoomOutBtn.onclick = zoomOut;

        const resetBtn = document.createElement('button');
        resetBtn.className = 'bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-sm transition';
        resetBtn.textContent = '⟲ Reset View';
        resetBtn.onclick = resetView;

        const helpText = document.createElement('div');
        helpText.className = 'text-xs text-gray-500 mt-1';
        helpText.textContent = 'Tip: Hold Space + drag to pan, or scroll to zoom';

        zoomContainer.appendChild(zoomInBtn);
        zoomContainer.appendChild(zoomOutBtn);
        zoomContainer.appendChild(resetBtn);

        const canvasParent = canvas.parentElement;
        canvasParent.insertBefore(zoomContainer, canvas);
        canvasParent.insertBefore(helpText, canvas);
    }

    if (clearBtn) {
        clearBtn.onclick = clearCanvas;
    }

    if (submitBtn) {
        submitBtn.onclick = submitDrawing;
    }

    if (showAnswerBtn) {
        showAnswerBtn.onclick = revealDrawingAnswer;
    }

    updateOcrCandidates();
    updateUndoRedoButtons();
}

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // Transform coordinates based on zoom and pan
    const x = (clientX - rect.left - canvasOffsetX) / canvasScale;
    const y = (clientY - rect.top - canvasOffsetY) / canvasScale;

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
        const rect = canvas.getBoundingClientRect();
        panStartX = e.clientX - canvasOffsetX;
        panStartY = e.clientY - canvasOffsetY;
        canvas.style.cursor = 'grabbing';
    } else if (e.button === 0) {
        // Left mouse = draw
        startDrawing(e);
    }
}

function handleCanvasMouseMove(e) {
    if (isPanning) {
        e.preventDefault();
        canvasOffsetX = e.clientX - panStartX;
        canvasOffsetY = e.clientY - panStartY;
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
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

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

    if (undoBtn) {
        undoBtn.disabled = strokes.length === 0;
        undoBtn.className = strokes.length === 0
            ? 'bg-gray-300 text-gray-500 px-4 py-2 rounded-lg transition cursor-not-allowed'
            : 'bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition';
    }

    if (redoBtn) {
        redoBtn.disabled = undoneStrokes.length === 0;
        redoBtn.className = undoneStrokes.length === 0
            ? 'bg-gray-300 text-gray-500 px-4 py-2 rounded-lg transition cursor-not-allowed'
            : 'bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition';
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
        button.className = 'px-3 py-1 text-xl rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition';
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

    const correct = recognized === currentQuestion.char;
    const isFirstAttempt = !answered;

    if (isFirstAttempt) {
        answered = true;
        total++;
        if (correct) {
            score++;
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
    const drawCharMode = document.getElementById('drawCharMode');
    if (!drawCharMode) return;

    let nextBtn = document.getElementById('drawNextBtn');
    if (!nextBtn) {
        const buttonContainer = drawCharMode.querySelector('.flex.gap-3.justify-center.mt-4') ||
                               drawCharMode.querySelector('.text-center.mb-4');
        if (buttonContainer) {
            nextBtn = document.createElement('button');
            nextBtn.id = 'drawNextBtn';
            nextBtn.className = 'bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition font-semibold';
            nextBtn.textContent = '→ Next';
            nextBtn.onclick = () => {
                clearCanvas();
                generateQuestion();
                nextBtn.style.display = 'none';
            };
            buttonContainer.appendChild(nextBtn);
        }
    }
    if (nextBtn) {
        nextBtn.style.display = 'inline-block';
    }
}

function hideDrawNextButton() {
    const nextBtn = document.getElementById('drawNextBtn');
    if (nextBtn) {
        nextBtn.style.display = 'none';
    }
}

function populateStudyList() {
    const studyList = document.getElementById('studyList');
    if (!studyList) return;

    studyList.innerHTML = '';

    quizCharacters.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition';

        const firstPinyin = item.pinyin.split('/')[0].trim();
        div.innerHTML = `
            <button class="flex-shrink-0 w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition"
                    onclick="playPinyinAudio('${firstPinyin}', '${item.char}')">
                🔊
            </button>
            <div class="flex-grow grid grid-cols-3 gap-4 items-center">
                <div class="text-4xl font-bold">${item.char}</div>
                <div class="text-xl text-gray-700">${item.pinyin}</div>
                <div class="text-lg text-gray-600">${item.meaning}</div>
            </div>
        `;

        studyList.appendChild(div);
    });
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
    if (mode === 'char-to-meaning-type' && fuzzyInput && isElementReallyVisible(fuzzyInput)) {
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
        { name: 'Char → Pinyin (MC)', mode: 'char-to-pinyin-mc', type: 'mode' },
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

    const paletteItems = Array.isArray(config?.commandPaletteItems) && config.commandPaletteItems.length
        ? config.commandPaletteItems
        : defaultModes;

    if (typeof initCommandPalette === 'function') {
        initCommandPalette({
            modes: paletteItems,
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
                available: () => Boolean(previewElement)
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
            available: () => Boolean(answerInput)
        });

        actions.push({
            name: 'Toggle Component Hints',
            type: 'action',
            description: 'Show or hide radical/phonetic breakdowns for the current quiz',
            keywords: 'component breakdown hint radical phonetic toggle',
            action: () => {
                toggleComponentBreakdownVisibility();
            },
            available: () => Boolean(componentBreakdown || document.querySelector('.meaning-question-layout'))
        });

        actions.push({
            name: 'Next Quiz Mode',
            type: 'action',
            description: 'Cycle forward through the available quiz modes',
            keywords: 'mode next cycle forward',
            action: () => cycleQuizMode(1),
            available: () => document.querySelectorAll('.mode-btn').length > 1
        });

        actions.push({
            name: 'Previous Quiz Mode',
            type: 'action',
            description: 'Go back to the previous quiz mode',
            keywords: 'mode previous back cycle',
            action: () => cycleQuizMode(-1),
            available: () => document.querySelectorAll('.mode-btn').length > 1
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
            available: () => Boolean(window.currentQuestion?.char)
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
            available: () => Boolean(window.currentQuestion?.char && window.currentQuestion?.pinyin)
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
            available: () => Boolean(getCurrentPromptText())
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
            available: () => Boolean(window.currentQuestion?.pinyin) && typeof window.playPinyinAudio === 'function'
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
    quizCharacters = charactersData;
    config = userConfig || {};

    loadComponentPreference();
    loadTimerSettings();

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
    studyMode = document.getElementById('studyMode');
    radicalPracticeMode = document.getElementById('radicalPracticeMode');
    audioSection = document.getElementById('audioSection');

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

    // Start first question
    generateQuestion();
}
