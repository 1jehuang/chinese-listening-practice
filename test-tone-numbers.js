// Test tone number inputs for Lesson 1
// Run with: node test-tone-numbers.js

// Copy the necessary functions from quiz-engine.js
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

    // Split on dots and spaces first to handle syllable boundaries correctly
    const syllables = text.split(/[\s.]+/).filter(s => s.length > 0);

    const convertedSyllables = syllables.map(syl => {
        let result = '';
        let toneFound = false;
        let tone = '5'; // Default neutral tone

        for (let i = 0; i < syl.length; i++) {
            const char = syl[i];

            if (toneMarkToNumber[char]) {
                // Found tone mark
                tone = toneMarkToNumber[char];
                result += toneMarkToBase[char];
                toneFound = true;
            } else {
                result += char;
            }
        }

        // Add tone number at end
        return result + tone;
    });

    return convertedSyllables.join('');
}

function normalizePinyin(pinyin) {
    let result = pinyin.toLowerCase().trim();

    // Remove all separators
    result = result.replace(/[\s.]+/g, '');

    // Remove tone numbers (1-5)
    result = result.replace(/[1-5]/g, '');

    // Remove tone marks by replacing with base vowels
    const toneMarkToBase = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
        'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
        'ü': 'v'
    };

    for (const [marked, base] of Object.entries(toneMarkToBase)) {
        result = result.replace(new RegExp(marked, 'g'), base);
    }

    return result;
}

function checkPinyinMatch(userAnswer, correct) {
    const user = userAnswer.toLowerCase().trim();
    const correctLower = correct.toLowerCase().trim();

    if (correctLower.includes('/')) {
        const options = correctLower.split('/').map(o => o.trim());
        return options.some(option => checkPinyinMatch(user, option));
    }

    if (user === correctLower) return true;

    const userNormalized = normalizePinyin(user);
    const correctNormalized = normalizePinyin(correctLower);

    return userNormalized === correctNormalized;
}

// Test data
const characters = [
    { char: '第', pinyin: 'dì', toneNumber: 'di4' },
    { char: '课', pinyin: 'kè', toneNumber: 'ke4' },
    { char: '两', pinyin: 'liǎng', toneNumber: 'liang3' },
    { char: '张', pinyin: 'zhāng', toneNumber: 'zhang1' },
    { char: '地图', pinyin: 'dìtú', toneNumber: 'di4tu2' },
    { char: '甲', pinyin: 'jiǎ', toneNumber: 'jia3' },
    { char: '这', pinyin: 'zhè', toneNumber: 'zhe4' },
    { char: '是', pinyin: 'shì', toneNumber: 'shi4' },
    { char: '什么', pinyin: 'shén.me', toneNumber: 'shen2me5' },
    { char: '比', pinyin: 'bǐ', toneNumber: 'bi3' },
    { char: '大', pinyin: 'dà', toneNumber: 'da4' },
    { char: '一点儿', pinyin: 'yìdiǎnr', toneNumber: 'yi4dian3r5' },
    { char: '年', pinyin: 'nián', toneNumber: 'nian2' },
    { char: '以前', pinyin: 'yǐqián', toneNumber: 'yi3qian2' },
    { char: '那时', pinyin: 'nàshí', toneNumber: 'na4shi2' },
    { char: '还', pinyin: 'hái', toneNumber: 'hai2' },
    { char: '包括', pinyin: 'bāokuò', toneNumber: 'bao1kuo4' },
    { char: '现在', pinyin: 'xiànzài', toneNumber: 'xian4zai4' },
    { char: '蒙古国', pinyin: 'Měnggǔguó', toneNumber: 'meng3gu3guo2' },
    { char: '哦', pinyin: 'ò', toneNumber: 'o4' },
    { char: '我', pinyin: 'wǒ', toneNumber: 'wo3' },
    { char: '懂', pinyin: 'dǒng', toneNumber: 'dong3' },
    { char: '了', pinyin: 'le', toneNumber: 'le5' },
    { char: '历史', pinyin: 'lì.shi', toneNumber: 'li4shi5' },
    { char: '上', pinyin: 'shàng', toneNumber: 'shang4' },
    { char: '对了', pinyin: 'duì.le', toneNumber: 'dui4le5' },
    { char: '可是', pinyin: 'kě.shì', toneNumber: 'ke3shi4' },
    { char: '完全', pinyin: 'wánquán', toneNumber: 'wan2quan2' },
    { char: '他们', pinyin: 'tā.men', toneNumber: 'ta1men5' },
    { char: '搬', pinyin: 'bān', toneNumber: 'ban1' },
    { char: '到…去', pinyin: 'dào...qù', toneNumber: 'dao4qu4' },
    { char: '台湾', pinyin: 'Táiwān', toneNumber: 'tai2wan1' },
    { char: '就是', pinyin: 'jiù.shì', toneNumber: 'jiu4shi4' },
    { char: '和', pinyin: 'hé', toneNumber: 'he2' },
    { char: '政府', pinyin: 'zhèng.fǔ', toneNumber: 'zheng4fu3' },
    { char: '都', pinyin: 'dōu', toneNumber: 'dou1' },
    { char: '说', pinyin: 'shuō', toneNumber: 'shuo1' },
    { char: '只有', pinyin: 'zhǐyǒu', toneNumber: 'zhi3you3' },
    { char: '个', pinyin: 'gè', toneNumber: 'ge4' },
    { char: '而', pinyin: 'ér', toneNumber: 'er2' },
    { char: '部分', pinyin: 'bù.fèn', toneNumber: 'bu4fen4' },
    { char: '国家', pinyin: 'guójiā', toneNumber: 'guo2jia1' },
    { char: '对不对', pinyin: 'duì.bu.duì', toneNumber: 'dui4bu5dui4' },
    { char: '很难说', pinyin: 'hěnnánshuō', toneNumber: 'hen3nan2shuo1' },
    { char: '乙', pinyin: 'yǐ', toneNumber: 'yi3' },
    { char: '中国', pinyin: 'Zhōng.guo', toneNumber: 'zhong1guo2' },
    { char: '那么', pinyin: 'nà.me', toneNumber: 'na4me5' },
    { char: '那', pinyin: 'nà', toneNumber: 'na4' },
    { char: '呢', pinyin: 'ne', toneNumber: 'ne5' },
    { char: '也', pinyin: 'yě', toneNumber: 'ye3' },
    { char: '为什么', pinyin: 'wèishén.me', toneNumber: 'wei4shen2me5' },
    { char: '不', pinyin: 'bù', toneNumber: 'bu4' },
    { char: '一样', pinyin: 'yīyàng', toneNumber: 'yi1yang4' },
    { char: '因为', pinyin: 'yīn.wèi', toneNumber: 'yin1wei4' },
    { char: '中华', pinyin: 'Zhōnghuá', toneNumber: 'zhong1hua2' },
    { char: '民国', pinyin: 'mínguó', toneNumber: 'min2guo2' },
    { char: '人民', pinyin: 'rénmín', toneNumber: 'ren2min2' },
    { char: '共和国', pinyin: 'gònghéguó', toneNumber: 'gong4he2guo2' },
    { char: '的', pinyin: 'de', toneNumber: 'de5' }
];

// Run tests
console.log('Testing tone number inputs for Lesson 1...\n');

let passed = 0;
let failed = 0;
let failures = [];

characters.forEach(item => {
    const result = checkPinyinMatch(item.toneNumber, item.pinyin);

    if (result) {
        passed++;
        console.log(`✓ ${item.char} (${item.toneNumber})`);
    } else {
        failed++;
        failures.push(item);

        // Debug info
        const userNorm = normalizePinyin(item.toneNumber);
        const correctNorm = normalizePinyin(item.pinyin);

        console.log(`✗ ${item.char} FAILED`);
        console.log(`  Input: "${item.toneNumber}" → normalized: "${userNorm}"`);
        console.log(`  Expected: "${item.pinyin}" → normalized: "${correctNorm}"`);
    }
});

console.log('\n' + '='.repeat(50));
console.log(`Total: ${characters.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Pass rate: ${((passed/characters.length)*100).toFixed(1)}%`);

if (failures.length > 0) {
    console.log('\nFailed words:');
    failures.forEach(f => {
        console.log(`  - ${f.char} (${f.toneNumber} ≠ ${f.pinyin})`);
    });
}
