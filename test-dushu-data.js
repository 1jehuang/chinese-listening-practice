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
const vocabChars = new Set(vocab.map(item => item.char));

assert.ok(vocab.length > 0, 'dushu vocab should not be empty');
const missing = vocab.filter(item => !String(item?.category || '').trim()).map(item => item.char);
assert.deepStrictEqual(missing, [], `all dushu vocab entries should have a category, missing: ${missing.join(', ')}`);

assert.ok(dataset.sentenceMode, 'dushu sentence mode should exist');
assert.ok(Array.isArray(dataset.sentenceMode.items) && dataset.sentenceMode.items.length >= 20, 'dushu sentence mode should include a real sentence dataset');
assert.ok(Array.isArray(dataset.sentenceMode.difficulties) && dataset.sentenceMode.difficulties.length >= 5, 'dushu sentence mode should expose multiple difficulty levels');

const difficultyIds = Array.from(dataset.sentenceMode.difficulties, item => item.id);
assert.deepStrictEqual(
  difficultyIds,
  ['micro', 'tiny', 'basic', 'source-lite', 'source', 'source-full'],
  'dushu sentence mode should expose the expected low-to-high difficulty ladder'
);

const invalidTargets = Array.from(dataset.sentenceMode.items)
  .filter(item => item.target && !vocabChars.has(item.target))
  .map(item => item.target);
assert.deepStrictEqual(invalidTargets, [], `all dushu sentence targets should come from the dushu vocab list, invalid: ${invalidTargets.join(', ')}`);

const sourceSentences = Array.from(dataset.sentenceMode.items).filter(item => String(item.difficulty || '').startsWith('source'));
assert.ok(sourceSentences.length >= 8, 'dushu sentence mode should include real source-derived sentences');
assert.ok(sourceSentences.some(item => item.sentence.includes('中国人都很重视教育')), 'dushu source sentences should include the reading text');

console.log(`✓ dushu vocab categories present for ${vocab.length} entries`);
console.log(`✓ dushu sentence mode includes ${dataset.sentenceMode.items.length} source and scaffolded sentences`);
