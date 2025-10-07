#!/usr/bin/env node

// Test audio availability for all Lesson 1 vocabulary

const https = require('https');

// Copy of pinyinToAudioKey from utils.js
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

    let result = pinyin.toLowerCase().replace(/\./g, '');
    let tone = '5';

    for (const [marked, toneNum] of Object.entries(toneMarkToNumber)) {
        if (result.includes(marked)) {
            tone = toneNum;
            break;
        }
    }

    for (const [marked, base] of Object.entries(toneMarkToBase)) {
        result = result.replace(new RegExp(marked, 'g'), base);
    }

    return result + tone;
}

// Lesson 1 vocabulary
const vocabulary = [
    { char: '第', pinyin: 'dì', meaning: 'ordinal prefix (-st, -nd, -rd, -th)' },
    { char: '课', pinyin: 'kè', meaning: 'lesson' },
    { char: '两', pinyin: 'liǎng', meaning: 'two (used with AN)' },
    { char: '张', pinyin: 'zhāng', meaning: 'measure word for flat things' },
    { char: '地图', pinyin: 'dìtú', meaning: 'map' },
    { char: '甲', pinyin: 'jiǎ', meaning: 'person A' },
    { char: '这', pinyin: 'zhè', meaning: 'this; these' },
    { char: '是', pinyin: 'shì', meaning: 'is; am; are' },
    { char: '什么', pinyin: 'shém.me', meaning: 'what' },
    { char: '比', pinyin: 'bǐ', meaning: 'compare' },
    { char: '大', pinyin: 'dà', meaning: 'big' },
    { char: '一点儿', pinyin: 'yìdiǎnr', meaning: 'a little' },
    { char: '年', pinyin: 'nián', meaning: 'year' },
    { char: '以前', pinyin: 'yǐqián', meaning: 'before' },
    { char: '那时', pinyin: 'nàshí', meaning: 'that time' },
    { char: '还', pinyin: 'hái', meaning: 'still; also' },
    { char: '包括', pinyin: 'bāokuò', meaning: 'include' },
    { char: '现在', pinyin: 'xiànzài', meaning: 'now' },
    { char: '蒙古国', pinyin: 'Měnggǔguó', meaning: 'Mongolia' },
    { char: '哦', pinyin: 'ò', meaning: 'oh; I see' },
    { char: '我', pinyin: 'wǒ', meaning: 'I; me' },
    { char: '懂', pinyin: 'dǒng', meaning: 'understand' },
    { char: '了', pinyin: 'le', meaning: 'particle for new situation' },
    { char: '历史', pinyin: 'lì.shi', meaning: 'history' },
    { char: '上', pinyin: 'shàng', meaning: 'in; on' },
    { char: '对了', pinyin: 'duì.le', meaning: "that's right" },
    { char: '可是', pinyin: 'kě.shì', meaning: 'however; but' },
    { char: '完全', pinyin: 'wánquán', meaning: 'completely; entirely' },
    { char: '他们', pinyin: 'tā.men', meaning: 'they' },
    { char: '搬', pinyin: 'bān', meaning: 'move' },
    { char: '到…去', pinyin: 'dào...qù', meaning: 'go to...' },
    { char: '台湾', pinyin: 'Táiwān', meaning: 'Taiwan' },
    { char: '就是', pinyin: 'jiù.shì', meaning: 'be exactly' },
    { char: '和', pinyin: 'hé', meaning: 'and' },
    { char: '政府', pinyin: 'zhèng.fǔ', meaning: 'government' },
    { char: '都', pinyin: 'dōu', meaning: 'in all cases' },
    { char: '说', pinyin: 'shuō', meaning: 'speak; say; talk' },
    { char: '只有', pinyin: 'zhǐyǒu', meaning: "there's only" },
    { char: '个', pinyin: 'gè', meaning: 'general measure word' },
    { char: '而', pinyin: 'ér', meaning: 'and; yet' },
    { char: '部分', pinyin: 'bù.fèn', meaning: 'part' },
    { char: '国家', pinyin: 'guójiā', meaning: 'country' },
    { char: '对不对', pinyin: 'duì.bu.duì', meaning: 'Is it correct?' },
    { char: '很难说', pinyin: 'hěnnánshuō', meaning: "It's hard to say" }
];

function checkAudioExists(audioKey) {
    return new Promise((resolve) => {
        const url = `https://www.purpleculture.net/mp3/${audioKey}.mp3`;

        https.get(url, (res) => {
            resolve({
                audioKey,
                exists: res.statusCode === 200,
                statusCode: res.statusCode
            });
            res.resume(); // Consume response data
        }).on('error', () => {
            resolve({ audioKey, exists: false, statusCode: 'ERROR' });
        });
    });
}

async function testAllAudio() {
    console.log('Testing audio availability for Lesson 1 vocabulary...\n');
    console.log('=' .repeat(80));

    let available = 0;
    let unavailable = 0;
    const unavailableList = [];

    for (const word of vocabulary) {
        const firstPinyin = word.pinyin.split('/')[0].trim();
        const audioKey = pinyinToAudioKey(firstPinyin);
        const result = await checkAudioExists(audioKey);

        const status = result.exists ? '✓ AVAILABLE' : '✗ UNAVAILABLE';
        const color = result.exists ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';

        console.log(`${color}${status}${reset} | ${word.char.padEnd(6)} | ${firstPinyin.padEnd(15)} → ${audioKey.padEnd(15)} | ${word.meaning}`);

        if (result.exists) {
            available++;
        } else {
            unavailable++;
            unavailableList.push({ char: word.char, pinyin: firstPinyin, audioKey });
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('=' .repeat(80));
    console.log(`\nResults: ${available} available, ${unavailable} unavailable (${vocabulary.length} total)`);
    console.log(`Success rate: ${((available / vocabulary.length) * 100).toFixed(1)}%\n`);

    if (unavailableList.length > 0) {
        console.log('Words without audio:');
        unavailableList.forEach(item => {
            console.log(`  - ${item.char} (${item.pinyin}) → ${item.audioKey}.mp3`);
        });
    }
}

testAllAudio().catch(console.error);
