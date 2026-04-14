const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('./data/lessons/gaokao.js', 'utf8');
const ctx = vm.createContext({ window: {} });
vm.runInContext(source, ctx, { filename: 'data/lessons/gaokao.js' });

const dataset = ctx.window.__LESSON_DATASETS__?.gaokao;
assert.ok(dataset, 'gaokao dataset should load');

const part1 = [...(dataset.vocab?.part1 || [])];
const part2 = [...(dataset.vocab?.part2 || [])];
const vocab = [...part1, ...part2];

assert.strictEqual(part1.length, 14, 'gaokao part1 should have 14 vocab entries');
assert.strictEqual(part2.length, 22, 'gaokao part2 should have 22 vocab entries');
assert.strictEqual(vocab.length, 36, 'gaokao combined vocab should have 36 entries');

assert.strictEqual(part1[0]?.char, '高考', 'gaokao part1 should start with 高考');
assert.strictEqual(part1[part1.length - 1]?.char, '理解', 'gaokao part1 should end with 理解');
assert.strictEqual(part2[0]?.char, '训练', 'gaokao part2 should start with 训练');
assert.strictEqual(part2[part2.length - 1]?.char, '显然', 'gaokao part2 should end with 显然');

const missingCategory = vocab.filter(item => !String(item?.category || '').trim()).map(item => item.char);
assert.deepStrictEqual(missingCategory, [], `all gaokao vocab entries should have a category, missing: ${missingCategory.join(', ')}`);

assert.ok(dataset.sentenceMode, 'gaokao sentence mode should exist');
assert.ok(Array.isArray(dataset.sentenceMode.items) && dataset.sentenceMode.items.length >= 20, 'gaokao sentence mode should include study sentences');
assert.ok(Array.isArray(dataset.sentenceMode.difficulties) && dataset.sentenceMode.difficulties.length === 6, 'gaokao sentence mode should expose the expected difficulty ladder');

const vocabChars = new Set(vocab.map(item => item.char));
const invalidTargets = Array.from(dataset.sentenceMode.items)
  .filter(item => item.target && !vocabChars.has(item.target))
  .map(item => item.target);
assert.strictEqual(invalidTargets.length, 0, `all gaokao sentence targets should come from gaokao vocab, invalid: ${invalidTargets.join(', ')}`);

assert.ok(dataset.sentenceMode.items.some(item => item.sentence.includes('中国人把这个考试叫做高考')), 'gaokao study sentences should include the source reading');
assert.ok(dataset.sentenceMode.items.some(item => item.sentence.includes('显然中国教育给他们的训练是很不错的')), 'gaokao study sentences should include later-page source lines');

console.log(`✓ gaokao vocab categories present for ${vocab.length} entries`);
console.log(`✓ gaokao part1=${part1.length}, part2=${part2.length}`);
console.log(`✓ gaokao sentence mode includes ${dataset.sentenceMode.items.length} scaffolded and source sentences`);
