const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('./data/lessons/dushu.js', 'utf8');
const ctx = vm.createContext({ window: {} });
vm.runInContext(source, ctx, { filename: 'data/lessons/dushu.js' });

const dataset = ctx.window.__LESSON_DATASETS__?.dushu;
assert.ok(dataset, 'dushu dataset should load');

const vocab = [
  ...(dataset.vocab?.part1 || []),
  ...(dataset.vocab?.part2 || [])
];

assert.ok(vocab.length > 0, 'dushu vocab should not be empty');
const missing = vocab.filter(item => !String(item?.category || '').trim()).map(item => item.char);
assert.deepStrictEqual(missing, [], `all dushu vocab entries should have a category, missing: ${missing.join(', ')}`);

console.log(`✓ dushu vocab categories present for ${vocab.length} entries`);
