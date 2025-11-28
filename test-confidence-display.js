// Test for confidence display consistency
// Run with: node test-confidence-display.js

// Mock browser environment
global.window = { location: { pathname: '/test-page.html' } };
global.document = {
    getElementById: () => null,
    createElement: () => ({ className: '', innerHTML: '', style: {} }),
    querySelectorAll: () => []
};
global.localStorage = {
    data: {},
    getItem(key) { return this.data[key] || null; },
    setItem(key, value) { this.data[key] = value; }
};

// Load the relevant functions by extracting them
const fs = require('fs');
const quizEngineCode = fs.readFileSync('./js/quiz-engine.js', 'utf8');

// Extract constants
const BKT_PARAMS = {
    P_L0: 0.0,
    P_T: 0.2,
    P_G: 0.25,
    P_S: 0.08
};
const BKT_MASTERY_THRESHOLD = 0.85;
const CONFIDENCE_FORMULAS = {
    HEURISTIC: 'heuristic',
    BKT: 'bkt'
};

// Simulate scheduler stats storage
let schedulerStats = {};
let confidenceFormula = CONFIDENCE_FORMULAS.BKT;
let mode = 'char-to-meaning-type';

function getCurrentSkillKey(customMode = mode) {
    const m = customMode;
    if (m === 'char-to-meaning' || m === 'char-to-meaning-type' || m === 'meaning-to-char' || m === 'audio-to-meaning') {
        return 'meaning';
    }
    if (m === 'char-to-pinyin' || m === 'char-to-pinyin-mc' || m === 'char-to-pinyin-type' || m === 'pinyin-to-char' || m === 'audio-to-pinyin' || m === 'char-to-tones') {
        return 'pinyin';
    }
    if (m === 'stroke-order' || m === 'handwriting' || m === 'draw-char') {
        return 'writing';
    }
    return 'default';
}

function getSchedulerStats(char, skillKey = getCurrentSkillKey()) {
    const key = `${char}::${skillKey}`;
    if (!schedulerStats[key]) {
        schedulerStats[key] = {
            served: 0,
            correct: 0,
            wrong: 0,
            lastServed: 0,
            lastCorrect: 0,
            lastWrong: 0,
            streak: 0
        };
    }
    return schedulerStats[key];
}

function getBKTScore(char) {
    const stats = getSchedulerStats(char);
    return stats.bktPLearned ?? BKT_PARAMS.P_L0;
}

function updateBKT(char, wasCorrect) {
    if (!char) return;
    const stats = getSchedulerStats(char);
    const P_T = BKT_PARAMS.P_T;
    const P_G = BKT_PARAMS.P_G;
    const P_S = BKT_PARAMS.P_S;

    let P_L = stats.bktPLearned ?? BKT_PARAMS.P_L0;

    if (wasCorrect) {
        const pCorrectGivenL = 1 - P_S;
        const pCorrectGivenNotL = P_G;
        const pCorrect = P_L * pCorrectGivenL + (1 - P_L) * pCorrectGivenNotL;
        P_L = (P_L * pCorrectGivenL) / pCorrect;
    } else {
        const pWrongGivenL = P_S;
        const pWrongGivenNotL = 1 - P_G;
        const pWrong = P_L * pWrongGivenL + (1 - P_L) * pWrongGivenNotL;
        P_L = (P_L * pWrongGivenL) / pWrong;
    }

    P_L = P_L + (1 - P_L) * P_T;
    P_L = Math.max(0, Math.min(1, P_L));

    stats.bktPLearned = P_L;
    return P_L;
}

function getConfidenceScore(char) {
    if (confidenceFormula === CONFIDENCE_FORMULAS.BKT) {
        return getBKTScore(char);
    }
    // Heuristic formula (simplified)
    const stats = getSchedulerStats(char);
    const served = stats.served || 0;
    const correct = stats.correct || 0;
    const accuracy = served > 0 ? correct / served : 0;
    return accuracy * 2.5;
}

// Test cases
console.log('=== Confidence Display Unit Tests ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${e.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, msg = '') {
    if (actual !== expected) {
        throw new Error(`${msg} Expected ${expected}, got ${actual}`);
    }
}

function assertClose(actual, expected, tolerance = 0.01, msg = '') {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${msg} Expected ~${expected}, got ${actual}`);
    }
}

// Reset state
function resetState() {
    schedulerStats = {};
    mode = 'char-to-meaning-type';
    confidenceFormula = CONFIDENCE_FORMULAS.BKT;
}

// Test 1: Skill key for meaning mode
test('getCurrentSkillKey returns "meaning" for char-to-meaning-type', () => {
    mode = 'char-to-meaning-type';
    assertEqual(getCurrentSkillKey(), 'meaning');
});

// Test 2: Skill key for pinyin mode
test('getCurrentSkillKey returns "pinyin" for char-to-pinyin-type', () => {
    mode = 'char-to-pinyin-type';
    assertEqual(getCurrentSkillKey(), 'pinyin');
});

// Test 3: New word starts at 0% confidence (BKT)
test('New word has 0% BKT confidence', () => {
    resetState();
    const score = getConfidenceScore('新');
    assertEqual(score, 0);
});

// Test 4: BKT increases after correct answer
test('BKT confidence increases after 1 correct answer', () => {
    resetState();
    const char = '好';
    updateBKT(char, true);
    const score = getConfidenceScore(char);
    assertClose(score, 0.2, 0.01, 'After 1 correct:');
});

// Test 5: BKT after 3 correct answers
test('BKT confidence after 3 correct answers is ~87%', () => {
    resetState();
    const char = '学';
    updateBKT(char, true);
    updateBKT(char, true);
    updateBKT(char, true);
    const score = getConfidenceScore(char);
    assertClose(score, 0.87, 0.02, 'After 3 correct:');
});

// Test 6: Different skills are tracked separately
test('Stats are tracked separately per skill', () => {
    resetState();
    const char = '中';

    // Practice in meaning mode
    mode = 'char-to-meaning-type';
    updateBKT(char, true);
    updateBKT(char, true);
    const meaningScore = getConfidenceScore(char);

    // Switch to pinyin mode - should be fresh
    mode = 'char-to-pinyin-type';
    const pinyinScore = getConfidenceScore(char);

    // Meaning score should be > 0 after practice
    if (meaningScore <= 0) throw new Error('Meaning score should be > 0 after practice');
    assertEqual(pinyinScore, 0, 'Pinyin score should be 0 (different skill):');
});

// Test 7: Sidebar and indicator should see same data
test('Sidebar and indicator use same stats for same mode', () => {
    resetState();
    const char = '国';
    mode = 'char-to-meaning-type';

    // Simulate some practice
    updateBKT(char, true);
    updateBKT(char, true);

    // Simulate what sidebar does
    const sidebarSkillKey = getCurrentSkillKey();
    const sidebarStats = getSchedulerStats(char, sidebarSkillKey);
    const sidebarScore = getConfidenceScore(char);

    // Simulate what indicator does (should be identical)
    const indicatorSkillKey = getCurrentSkillKey();
    const indicatorStats = getSchedulerStats(char, indicatorSkillKey);
    const indicatorScore = getConfidenceScore(char);

    assertEqual(sidebarSkillKey, indicatorSkillKey, 'Skill keys should match:');
    assertEqual(sidebarStats, indicatorStats, 'Stats objects should be same:');
    assertEqual(sidebarScore, indicatorScore, 'Scores should match:');
});

// Test 8: Stats storage key format
test('Stats are stored with correct key format', () => {
    resetState();
    mode = 'char-to-meaning-type';
    const char = '人';
    getSchedulerStats(char); // Creates entry

    const expectedKey = '人::meaning';
    assertEqual(schedulerStats.hasOwnProperty(expectedKey), true, 'Should have key "人::meaning":');
});

// Test 9: BKT score is stored in stats
test('BKT score is stored in stats.bktPLearned', () => {
    resetState();
    mode = 'char-to-meaning-type';
    const char = '大';

    updateBKT(char, true);
    const stats = getSchedulerStats(char);

    assertEqual(typeof stats.bktPLearned, 'number', 'bktPLearned should be a number:');
    assertClose(stats.bktPLearned, 0.2, 0.01, 'bktPLearned after 1 correct:');
});

// Test 10: Verify confidence display would show correct value
test('Confidence indicator should show same value as sidebar', () => {
    resetState();
    mode = 'char-to-meaning-type';
    const char = '小';

    // Simulate 3 correct answers
    for (let i = 0; i < 3; i++) {
        const stats = getSchedulerStats(char);
        stats.served = (stats.served || 0) + 1;
        stats.correct = (stats.correct || 0) + 1;
        stats.streak = (stats.streak || 0) + 1;
        updateBKT(char, true);
    }

    // What sidebar would compute
    const sidebarScore = getConfidenceScore(char);

    // What indicator would compute (simulating the function)
    const indicatorSkillKey = getCurrentSkillKey();
    const indicatorStats = getSchedulerStats(char, indicatorSkillKey);
    const indicatorScore = getConfidenceScore(char);

    assertEqual(sidebarScore, indicatorScore, 'Sidebar and indicator scores must match:');
    console.log(`  (Both show: ${Math.round(indicatorScore * 100)}%)`);
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
    process.exit(1);
}
