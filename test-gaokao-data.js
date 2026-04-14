const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('./data/lessons/gaokao.js', 'utf8');
const ctx = vm.createContext({ window: {} });
vm.runInContext(source, ctx, { filename: 'data/lessons/gaokao.js' });

const dataset = ctx.window.__LESSON_DATASETS__?.gaokao;
assert.ok(dataset, 'gaokao dataset should load');

const vocab = [...(dataset.vocab?.part1 || [])];
assert.strictEqual(vocab.length, 14, 'gaokao part1 should have 14 vocab entries');
assert.strictEqual(vocab[0]?.char, '高考', 'gaokao part1 should start with 高考');
assert.strictEqual(vocab[vocab.length - 1]?.char, '理解', 'gaokao part1 should end with 理解');

const missingCategory = vocab.filter(item => !String(item?.category || '').trim()).map(item => item.char);
assert.deepStrictEqual(missingCategory, [], `all gaokao vocab entries should have a category, missing: ${missingCategory.join(', ')}`);

assert.ok(dataset.sentenceMode, 'gaokao sentence mode should exist');
assert.ok(Array.isArray(dataset.sentenceMode.items) && dataset.sentenceMode.items.length >= 10, 'gaokao sentence mode should include study sentences');
assert.ok(Array.isArray(dataset.sentenceMode.difficulties) && dataset.sentenceMode.difficulties.length === 6, 'gaokao sentence mode should expose the expected difficulty ladder');

const vocabChars = new Set(vocab.map(item => item.char));
const invalidTargets = Array.from(dataset.sentenceMode.items)
  .filter(item => item.target && !vocabChars.has(item.target))
  .map(item => item.target);
assert.strictEqual(invalidTargets.length, 0, `all gaokao sentence targets should come from gaokao vocab, invalid: ${invalidTargets.join(', ')}`);
assert.ok(dataset.sentenceMode.items.some(item => item.sentence.includes('中国人把这个考试叫做高考')), 'gaokao study sentences should include the source reading');

console.log(`✓ gaokao vocab categories present for ${vocab.length} entries`);
console.log(`✓ gaokao sentence mode includes ${dataset.sentenceMode.items.length} scaffolded and source sentences`);
