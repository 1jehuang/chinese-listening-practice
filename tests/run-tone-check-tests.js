const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadQuizEngine() {
  const quizPath = path.join(__dirname, '..', 'js', 'quiz-engine.js');
  const source = fs.readFileSync(quizPath, 'utf8');
  const context = { console };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function loadLessonOneCharacters() {
  const htmlPath = path.join(__dirname, '..', 'lesson-1-quiz.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/const characters = \[(.*?)\];/s);
  if (!match) {
    throw new Error('Unable to locate lesson 1 character data');
  }

  const script = new vm.Script('lessonCharacters = [' + match[1] + '];');
  const context = {};
  vm.createContext(context);
  script.runInContext(context);

  return context.lessonCharacters;
}

function mutateToneMark(pinyin) {
  const cycles = {
    'ā': 'á', 'á': 'ǎ', 'ǎ': 'à', 'à': 'ā',
    'ē': 'é', 'é': 'ě', 'ě': 'è', 'è': 'ē',
    'ī': 'í', 'í': 'ǐ', 'ǐ': 'ì', 'ì': 'ī',
    'ō': 'ó', 'ó': 'ǒ', 'ǒ': 'ò', 'ò': 'ō',
    'ū': 'ú', 'ú': 'ǔ', 'ǔ': 'ù', 'ù': 'ū',
    'ǖ': 'ǘ', 'ǘ': 'ǚ', 'ǚ': 'ǜ', 'ǜ': 'ǖ'
  };

  for (let i = 0; i < pinyin.length; i += 1) {
    const char = pinyin[i];
    if (cycles[char]) {
      return pinyin.slice(0, i) + cycles[char] + pinyin.slice(i + 1);
    }
  }
  return null;
}

function mutateToneNumber(pinyin, helpers) {
  const syllables = helpers.splitPinyinSyllables(helpers.convertPinyinToToneNumbers(pinyin));
  let changed = false;
  const mutated = syllables.map((syl) => {
    const match = syl.match(/^([a-zv:]+)([1-5])$/i);
    if (!match) return syl;

    const base = match[1];
    const tone = match[2];
    if (tone === '5') return syl;

    changed = true;
    const next = tone === '4' ? '1' : String(parseInt(tone, 10) + 1);
    return base + next;
  });

  if (!changed) return null;
  return mutated.join(' ');
}

function main() {
  const engine = loadQuizEngine();
  const {
    checkPinyinMatch,
    splitPinyinSyllables,
    convertPinyinToToneNumbers,
    extractToneSequence,
  } = engine;

  const lessonCharacters = loadLessonOneCharacters();

  const tests = [
    {
      name: 'Accepts tone-mark answer',
      fn: () => assert.strictEqual(checkPinyinMatch('dì', 'dì'), true),
    },
    {
      name: 'Accepts tone-number answer',
      fn: () => assert.strictEqual(checkPinyinMatch('di4', 'dì'), true),
    },
    {
      name: 'Rejects missing tone',
      fn: () => assert.strictEqual(checkPinyinMatch('di', 'dì'), false),
    },
    {
      name: 'Rejects wrong tone mark',
      fn: () => assert.strictEqual(checkPinyinMatch('dī', 'dì'), false),
    },
    {
      name: 'Allows multi-syllable tone marks',
      fn: () => assert.strictEqual(checkPinyinMatch('shén.me', 'shén.me'), true),
    },
    {
      name: 'Allows multi-syllable tone numbers',
      fn: () => assert.strictEqual(checkPinyinMatch('shen2 me', 'shén.me'), true),
    },
    {
      name: 'Rejects toneless multi-syllable answer',
      fn: () => assert.strictEqual(checkPinyinMatch('shenme', 'shén.me'), false),
    },
    {
      name: 'Neutral syllables accepted without tone',
      fn: () => assert.strictEqual(checkPinyinMatch('le', 'le'), true),
    },
    {
      name: 'Handles ü variants',
      fn: () => {
        assert.strictEqual(checkPinyinMatch('lü4', 'lü4'), true);
        assert.strictEqual(checkPinyinMatch('lv4', 'lü4'), true);
        assert.strictEqual(checkPinyinMatch('lu:4', 'lü4'), true);
      },
    },
    {
      name: 'Splits tone-mark syllables correctly',
      fn: () => {
        const syllables = Array.from(splitPinyinSyllables('dìtú'), (value) => String(value));
        assert.deepStrictEqual(syllables, ['dì', 'tú']);
      },
    },
    {
      name: 'Convert keeps existing tone numbers',
      fn: () => assert.strictEqual(convertPinyinToToneNumbers('ma3'), 'ma3'),
    },
    {
      name: 'Extract tone sequence from mixed formatting',
      fn: () => assert.strictEqual(extractToneSequence('wèishén.me'), '425'),
    },
    {
      name: 'Rejects wrong tones for lesson 1 dataset',
      fn: () => {
        lessonCharacters.forEach(({ pinyin }) => {
          const options = pinyin.split('/').map((item) => item.trim()).filter(Boolean);
          options.forEach((option) => {
            const wrongMark = mutateToneMark(option);
            if (wrongMark) {
              assert.strictEqual(
                checkPinyinMatch(wrongMark, option),
                false,
                `Accepted wrong tone mark "${wrongMark}" for "${option}"`,
              );
            }

            const wrongNumber = mutateToneNumber(option, {
              splitPinyinSyllables,
              convertPinyinToToneNumbers,
            });
            if (wrongNumber) {
              assert.strictEqual(
                checkPinyinMatch(wrongNumber, option),
                false,
                `Accepted wrong tone number "${wrongNumber}" for "${option}"`,
              );
            }
          });
        });
      },
    },
  ];

  let failures = 0;

  tests.forEach(({ name, fn }) => {
    try {
      fn();
      console.log(`✓ ${name}`);
    } catch (err) {
      failures += 1;
      console.error(`✗ ${name}`);
      if (err && err.stack) {
        console.error(err.stack);
      } else {
        console.error(err);
      }
    }
  });

  if (failures === 0) {
    console.log('All tone-check tests passed.');
  } else {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
