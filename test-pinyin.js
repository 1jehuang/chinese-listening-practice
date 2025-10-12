#!/usr/bin/env node

// Simple CLI test for pinyin tone number conversion

// Copy the conversion logic from quiz-engine.js
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

    const isSeparator = (char) => /\s/.test(char) || char === '.' || char === '·' || char === '/';

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
            // After a tone mark, if we encounter something that's NOT a final letter, split
            const charLower = char.toLowerCase();
            const prevLower = lastNonDigitChar.toLowerCase();

            // Check if this could be a syllable ending (n, ng, r after vowels)
            const isValidEnding = (
                (charLower === 'n' || charLower === 'r') ||
                (charLower === 'g' && prevLower === 'n')
            );

            // If it's not a valid ending, this must be the start of a new syllable
            if (!isValidEnding) {
                flush();
            } else {
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

// Test runner
let passCount = 0;
let failCount = 0;

function test(description, actual, expected) {
    const passed = actual === expected;
    if (passed) {
        console.log(`✓ PASS: ${description}`);
        passCount++;
    } else {
        console.log(`✗ FAIL: ${description}`);
        console.log(`  Expected: "${expected}"`);
        console.log(`  Got:      "${actual}"`);
        failCount++;
    }
}

console.log('Testing Pinyin Tone Number Conversion\n');
console.log('=' .repeat(50));

// Test cases for 西南 (xīnán) = xi1nan2
console.log('\n西南 (xīnán) tests:');
console.log('DEBUG: Splitting "xīnán":', splitPinyinSyllables('xīnán'));
test('xīnán -> xi1nan2', convertPinyinToToneNumbers('xīnán'), 'xi1nan2');
test('xi1nan2 -> xi1nan2', convertPinyinToToneNumbers('xi1nan2'), 'xi1nan2');

// Test cases for 虽然 (suīrán) = sui1ran2
console.log('\n虽然 (suīrán) tests:');
test('suīrán -> sui1ran2', convertPinyinToToneNumbers('suīrán'), 'sui1ran2');
test('sui1ran2 -> sui1ran2', convertPinyinToToneNumbers('sui1ran2'), 'sui1ran2');

// Additional test cases
console.log('\nAdditional tests:');
test('xī -> xi1', convertPinyinToToneNumbers('xī'), 'xi1');
test('nán -> nan2', convertPinyinToToneNumbers('nán'), 'nan2');

// Summary
console.log('\n' + '='.repeat(50));
const total = passCount + failCount;
console.log(`\nTotal Tests: ${total}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Success Rate: ${((passCount/total)*100).toFixed(1)}%`);

// Exit with error code if any tests failed
process.exit(failCount > 0 ? 1 : 0);
