#!/usr/bin/env node

// Comprehensive test for all vocabulary in the app

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

// All vocabulary from all lessons
const allVocabulary = [
    // Lesson 2 Part 1 - Page 18
    { char: '我的', pinyin: 'wǒ.de', expected: 'wo3de5' },
    { char: '家', pinyin: 'jiā', expected: 'jia1' },
    { char: '在', pinyin: 'zài', expected: 'zai4' },
    { char: '哪儿', pinyin: 'nǎr', expected: 'nar3' },
    { char: '父亲', pinyin: 'fù.qin', expected: 'fu4qin5' },
    { char: '书', pinyin: 'shū', expected: 'shu1' },
    { char: '书房', pinyin: 'shūfáng', expected: 'shu1fang2' },
    { char: '里', pinyin: 'lǐ', expected: 'li3' },
    { char: '挂', pinyin: 'guà', expected: 'gua4' },
    { char: 'V着', pinyin: 'V.zhe', expected: 'vzhe5' },
    { char: '小', pinyin: 'xiǎo', expected: 'xiao3' },
    { char: '时候', pinyin: 'shí.hou', expected: 'shi2hou5' },
    { char: '他', pinyin: 'tā', expected: 'ta1' },
    { char: '常', pinyin: 'cháng', expected: 'chang2' },
    { char: '指', pinyin: 'zhǐ', expected: 'zhi3' },
    { char: '西南', pinyin: 'xīnán', expected: 'xi1nan2' },
    // Page 19
    { char: '边', pinyin: 'biān', expected: 'bian1' },
    { char: '黑', pinyin: 'hēi', expected: 'hei1' },
    { char: '点', pinyin: 'diǎn', expected: 'dian3' },
    { char: '我们的', pinyin: 'wǒ.men.de', expected: 'wo3mende5' },
    { char: '老家', pinyin: 'lǎojiā', expected: 'lao3jia1' },
    { char: '觉得', pinyin: 'jué.de', expected: 'jue2de5' },
    { char: '很', pinyin: 'hěn', expected: 'hen3' },
    { char: '奇怪', pinyin: 'qíguài', expected: 'qi2guai4' },
    { char: '纽约', pinyin: 'Niǔyuē', expected: 'niu3yue1' },
    { char: '怎么', pinyin: 'zěn.me', expected: 'zen3me5' },
    { char: '会', pinyin: 'huì', expected: 'hui4' },
    { char: '后来', pinyin: 'hòulái', expected: 'hou4lai2' },
    { char: '才', pinyin: 'cái', expected: 'cai2' },
    { char: '知道', pinyin: 'zhīdao', expected: 'zhi1dao5' },
    { char: '成都', pinyin: 'Chéngdū', expected: 'cheng2du1' },
    { char: '虽然', pinyin: 'suīrán', expected: 'sui1ran2' },
    { char: '来', pinyin: 'lái', expected: 'lai2' },
    { char: '美国', pinyin: 'Měiguó', expected: 'mei3guo2' },
    { char: '快…了', pinyin: 'kuài... .le', expected: 'kuai4le5' },

    // Lesson 2 Part 2 - Page 20
    { char: '总', pinyin: 'zǒng', expected: 'zong3' },
    { char: '还是', pinyin: 'hái.shì', expected: 'hai2shi4' },
    { char: '四川', pinyin: 'Sìchuān', expected: 'si4chuan1' },
    { char: '才', pinyin: 'cái', expected: 'cai2' },
    { char: '生', pinyin: 'shēng', expected: 'sheng1' },
    { char: '长', pinyin: 'zhǎng', expected: 'zhang3' },
    { char: '从小', pinyin: 'cóngxiǎo', expected: 'cong2xiao3' },
    { char: '就', pinyin: 'jiù', expected: 'jiu4' },
    { char: '跟', pinyin: 'gēn', expected: 'gen1' },
    { char: '中文', pinyin: 'Zhōngwén', expected: 'zhong1wen2' },
    { char: '吃', pinyin: 'chī', expected: 'chi1' },
    { char: '菜', pinyin: 'cài', expected: 'cai4' },
    { char: '有时', pinyin: 'yǒushí', expected: 'you3shi2' },
    { char: '看', pinyin: 'kàn', expected: 'kan4' },
    { char: '电视', pinyin: 'diànshì', expected: 'dian4shi4' },
    { char: '节目', pinyin: 'jiémù', expected: 'jie2mu4' },
    { char: '星期', pinyin: 'xīngqī', expected: 'xing1qi1' },
    { char: '星期六', pinyin: 'xīngqīliù', expected: 'xing1qi1liu4' },
];

// Test runner
let passCount = 0;
let failCount = 0;
const failures = [];

console.log('Testing ALL Vocabulary Pinyin Conversion\n');
console.log('=' .repeat(70));

allVocabulary.forEach((item) => {
    const result = convertPinyinToToneNumbers(item.pinyin);
    const passed = result === item.expected;

    if (passed) {
        passCount++;
        console.log(`✓ ${item.char.padEnd(8)} ${item.pinyin.padEnd(20)} → ${result}`);
    } else {
        failCount++;
        console.log(`✗ ${item.char.padEnd(8)} ${item.pinyin.padEnd(20)} → ${result} (expected: ${item.expected})`);
        failures.push({
            char: item.char,
            pinyin: item.pinyin,
            expected: item.expected,
            got: result,
            syllables: splitPinyinSyllables(item.pinyin)
        });
    }
});

// Summary
console.log('\n' + '='.repeat(70));
const total = passCount + failCount;
console.log(`\nTotal Tests: ${total}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Success Rate: ${((passCount/total)*100).toFixed(1)}%`);

if (failures.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('FAILURES DETAIL:\n');
    failures.forEach(f => {
        console.log(`${f.char} (${f.pinyin})`);
        console.log(`  Syllables: [${f.syllables.join(', ')}]`);
        console.log(`  Expected:  ${f.expected}`);
        console.log(`  Got:       ${f.got}`);
        console.log('');
    });
}

// Exit with error code if any tests failed
process.exit(failCount > 0 ? 1 : 0);
