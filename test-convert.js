// Test convertPinyinToToneNumbers function

function convertPinyinToToneNumbers(pinyin) {
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

    let text = pinyin.toLowerCase();
    let result = '';
    let i = 0;

    const isVowel = (c) => 'aeiouv'.includes(c);
    const isEndingConsonant = (c) => 'ngr'.includes(c); // Only n, g, r can end a syllable

    while (i < text.length) {
        const char = text[i];

        if (toneMarkToNumber[char]) {
            const toneNum = toneMarkToNumber[char];
            const baseVowel = toneMarkToBase[char];
            result += baseVowel;

            // After tone-marked vowel, collect: more vowels OR ending consonants (n/g/r)
            let j = i + 1;
            while (j < text.length && text[j] !== ' ' && text[j] !== '.' && !toneMarkToNumber[text[j]]) {
                const nextChar = text[j];
                if (isVowel(nextChar) || isEndingConsonant(nextChar)) {
                    result += nextChar;
                    j++;
                } else {
                    // Hit a non-ending consonant (starts new syllable)
                    break;
                }
            }

            result += toneNum;
            i = j;
        } else {
            result += char;
            i++;
        }
    }

    return result;
}

// Test cases
const tests = [
    { input: 'nǐ hǎo', expected: 'ni3 hao3' },
    { input: 'Zhōng.guó', expected: 'zhong1.guo2' },
    { input: 'xièxiè', expected: 'xie4xie4' },
    { input: 'wèishén.me', expected: 'wei4shen2.me' },
];

console.log('Testing convertPinyinToToneNumbers:\n');

let passed = 0;
let failed = 0;

tests.forEach((test, i) => {
    const result = convertPinyinToToneNumbers(test.input);
    const pass = result === test.expected;

    if (pass) {
        passed++;
        console.log(`✓ Test ${i + 1}: PASS`);
    } else {
        failed++;
        console.log(`✗ Test ${i + 1}: FAIL`);
        console.log(`  Input:    "${test.input}"`);
        console.log(`  Expected: "${test.expected}"`);
        console.log(`  Got:      "${result}"`);
    }
});

console.log(`\n${passed}/${tests.length} passed (${Math.round(passed/tests.length * 100)}%)`);
