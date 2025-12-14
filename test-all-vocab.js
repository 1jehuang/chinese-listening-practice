#!/usr/bin/env node

// Comprehensive test for all vocabulary in the app

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPinyinUtils() {
    const source = fs.readFileSync(path.join(__dirname, 'js', 'pinyin-utils.js'), 'utf8');
    const context = { console };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

const pinyinUtils = loadPinyinUtils();
const { convertPinyinToToneNumbers, splitPinyinSyllables } = pinyinUtils;

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
    { char: 'V着', pinyin: 'V.zhe', expected: 'v5zhe5' },
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
    { char: '我们的', pinyin: 'wǒ.men.de', expected: 'wo3men5de5' },
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
