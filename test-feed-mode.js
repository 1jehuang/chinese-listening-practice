// Feed Mode Simulation with Forgetting Curve + Response Time
// Run with: node test-feed-mode.js [profile]
// Profiles: new, mixed (default), know-some, know-most

const FEED_UCB_C = 1.5;
const FEED_MIN_HAND_SIZE = 3;
const FEED_MAX_HAND_SIZE = 10;
const FEED_DEFAULT_HAND_SIZE = 5;
const FEED_STREAK_TO_REMOVE = 2;
const FEED_WEAK_THRESHOLD = 0.6;
const FEED_FORGET_MIN_HALFLIFE_HOURS = 0.02;      // ~1.2 minutes
const FEED_FORGET_MAX_HALFLIFE_HOURS = 120;       // 5 days
const FEED_FORGET_INITIAL_HALFLIFE_HOURS = 0.08;  // ~4.8 minutes
const FEED_FORGET_CORRECT_GROWTH = 0.65;
const FEED_FORGET_WRONG_SHRINK = 0.45;
const FEED_FORGET_DUE_THRESHOLD = 0.82;
const FEED_FORGET_DUE_BOOST = 1.1;
const FEED_RESPONSE_TARGET_MS = 3000;
const FEED_RESPONSE_MIN_MS = 300;
const FEED_RESPONSE_MAX_MS = 20000;
const FEED_SCORE_URGENCY_WEIGHT = 1.6;
const FEED_SCORE_DIFFICULTY_WEIGHT = 0.75;
const FEED_SCORE_UCB_WEIGHT = 0.5;

// Simulation settings
const NUM_CARDS = 20;
const NUM_QUESTIONS = 200;
const BASE_OVERHEAD_MS = 450; // time between questions (UI + transition)

const profile = process.argv[2] || 'mixed';

const PROFILES = {
    'new': {
        name: 'Brand New (Default)',
        description: 'All cards are brand new (10% initial mastery)',
        getMastery: () => 0.1
    },
    'mixed': {
        name: 'Mixed',
        description: 'Some known, some familiar, some new',
        getMastery: (i) => {
            if (i < 5) return 0.55;
            if (i < 10) return 0.35;
            if (i < 15) return 0.2;
            return 0.1;
        }
    },
    'know-some': {
        name: 'Know Some',
        description: 'Half are decent, half are weak',
        getMastery: (i) => (i < 10 ? 0.5 : 0.2)
    },
    'know-most': {
        name: 'Know Most',
        description: 'Most are solid, a few weak',
        getMastery: (i) => (i < 16 ? 0.7 : 0.25)
    }
};

const selectedProfile = PROFILES[profile] || PROFILES['mixed'];

const clampNumber = (value, min, max) => {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
};

const pool = [];
for (let i = 0; i < NUM_CARDS; i++) {
    const mastery = selectedProfile.getMastery(i);
    pool.push({
        char: `card${i}`,
        mastery,
        initialMastery: mastery,
        trueHalfLifeHours: FEED_FORGET_INITIAL_HALFLIFE_HOURS,
        lastSeen: 0,
        avgResponseMs: null
    });
}
const poolMap = new Map(pool.map(c => [c.char, c]));

let feedModeState = {
    hand: [],
    seen: {},
    totalPulls: 0
};

let simNow = 0;

function getConfidenceScore(char) {
    return poolMap.get(char)?.mastery || 0.1;
}

function getConfidenceMasteryThreshold() {
    return 0.85;
}

function getFeedResponseFactor(responseMs) {
    if (!Number.isFinite(responseMs)) return 1;
    const clamped = clampNumber(responseMs, FEED_RESPONSE_MIN_MS, FEED_RESPONSE_MAX_MS);
    const ratio = FEED_RESPONSE_TARGET_MS / clamped;
    return clampNumber(ratio, 0.45, 1.2);
}

function getFeedRecallProbability(char, now) {
    const stats = feedModeState.seen[char];
    if (!stats || !stats.lastSeen) return null;
    const halfLife = Number.isFinite(stats.halfLifeHours)
        ? stats.halfLifeHours
        : FEED_FORGET_INITIAL_HALFLIFE_HOURS;
    const elapsedHours = Math.max(0, (now - stats.lastSeen) / 3600000);
    const safeHalfLife = Math.max(FEED_FORGET_MIN_HALFLIFE_HOURS, halfLife);
    return Math.pow(0.5, elapsedHours / safeHalfLife);
}

function getTrueRecallProbability(card, now) {
    if (!card.lastSeen) return 0.15;
    const elapsedHours = Math.max(0, (now - card.lastSeen) / 3600000);
    const safeHalfLife = Math.max(FEED_FORGET_MIN_HALFLIFE_HOURS, card.trueHalfLifeHours);
    return Math.pow(0.5, elapsedHours / safeHalfLife);
}

function getFeedDifficultyScore(stats) {
    if (!stats || !stats.attempts) return 1;
    const sessionConfidence = stats.correct / stats.attempts;
    const responsePenalty = Number.isFinite(stats.avgResponseMs)
        ? clampNumber((stats.avgResponseMs - FEED_RESPONSE_TARGET_MS) / FEED_RESPONSE_TARGET_MS, 0, 1)
        : 0;
    return clampNumber((1 - sessionConfidence) * 0.7 + responsePenalty * 0.3, 0, 1.5);
}

function getFeedExplorationRatio() {
    const poolSize = pool.length;
    if (poolSize === 0) return 0;
    const seenCount = Object.keys(feedModeState.seen || {}).length;
    return seenCount / poolSize;
}

function getFeedTargetHandSize() {
    const poolSize = pool.length;
    if (poolSize === 0) return FEED_DEFAULT_HAND_SIZE;

    const explorationRatio = getFeedExplorationRatio();
    const seenCount = Object.keys(feedModeState.seen || {}).length;

    let weakCount = 0;
    for (const char of Object.keys(feedModeState.seen || {})) {
        const stats = feedModeState.seen[char];
        if (stats && stats.attempts > 0) {
            const confidence = stats.correct / stats.attempts;
            if (confidence < FEED_WEAK_THRESHOLD) {
                weakCount++;
            }
        }
    }

    if (seenCount < 2) return 2;
    if (explorationRatio < 0.15) return Math.min(4, Math.max(2, weakCount + 2));
    if (explorationRatio < 0.3) return Math.min(6, Math.max(3, weakCount + 2));
    if (explorationRatio < 0.6) return Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_DEFAULT_HAND_SIZE + 2, weakCount + 3));
    return Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_DEFAULT_HAND_SIZE, weakCount + 2));
}

function getFeedUCBScore(char, now) {
    const stats = feedModeState.seen[char];
    const totalPulls = feedModeState.totalPulls || 1;

    if (!stats || stats.attempts === 0) {
        const explorationRatio = getFeedExplorationRatio();
        let baseScore = explorationRatio < 0.5 ? 3.0 : 2.0;
        const srScore = getConfidenceScore(char);
        const threshold = getConfidenceMasteryThreshold();
        const srBoost = Math.max(0, (threshold - srScore) / threshold);
        baseScore += srBoost * 0.6;
        return baseScore + Math.random() * 0.5;
    }

    const sessionConfidence = stats.correct / stats.attempts;
    const recallProb = getFeedRecallProbability(char, now);
    const forgettingUrgency = Number.isFinite(recallProb) ? (1 - recallProb) : (1 - sessionConfidence);
    const dueBoost = Number.isFinite(recallProb) && recallProb < FEED_FORGET_DUE_THRESHOLD
        ? (FEED_FORGET_DUE_THRESHOLD - recallProb) * FEED_FORGET_DUE_BOOST
        : 0;
    const difficultyScore = getFeedDifficultyScore(stats);
    const elapsedMinutes = Number.isFinite(stats.lastSeen) ? (now - stats.lastSeen) / 60000 : 0;
    const freshBoost = (stats.attempts < 2)
        ? clampNumber((1 - (elapsedMinutes / 5)) * 1.4, 0, 1.4)
        : 0;
    const explorationBonus = FEED_UCB_C * Math.sqrt(Math.log(totalPulls) / stats.attempts);

    let score = (FEED_SCORE_URGENCY_WEIGHT * forgettingUrgency)
        + (FEED_SCORE_DIFFICULTY_WEIGHT * difficultyScore)
        + (FEED_SCORE_UCB_WEIGHT * explorationBonus)
        + dueBoost
        + freshBoost;

    const srScore = getConfidenceScore(char);
    const threshold = getConfidenceMasteryThreshold();
    const srBoost = Math.max(0, (threshold - srScore) / threshold);
    score += srBoost * 0.25;

    return score;
}

function ensureFeedHand(now) {
    const fullPool = pool.slice();
    if (!fullPool.length) {
        feedModeState.hand = [];
        return;
    }

    const targetSize = getFeedTargetHandSize();

    feedModeState.hand = feedModeState.hand.filter(char => {
        const stats = feedModeState.seen[char];
        if (!stats) return true;
        const recallProb = getFeedRecallProbability(char, now);
        const attempts = stats.attempts || 0;
        if (attempts < 2) return true;
        if (Number.isFinite(recallProb) && recallProb < FEED_FORGET_DUE_THRESHOLD) return true;
        return (stats.streak || 0) < FEED_STREAK_TO_REMOVE;
    });

    const unseenCards = fullPool.filter(item =>
        !feedModeState.hand.includes(item.char) &&
        (!feedModeState.seen[item.char] || feedModeState.seen[item.char].attempts === 0)
    );
    const explorationRatio = getFeedExplorationRatio();
    const handHasUnseen = feedModeState.hand.some(char =>
        !feedModeState.seen[char] || feedModeState.seen[char].attempts === 0
    );

    if (explorationRatio < 0.8 && unseenCards.length > 0 && !handHasUnseen && feedModeState.hand.length > 0) {
        let worstIdx = 0;
        let worstScore = Infinity;
        for (let i = 0; i < feedModeState.hand.length; i++) {
            const score = getFeedUCBScore(feedModeState.hand[i], now);
            if (score < worstScore) {
                worstScore = score;
                worstIdx = i;
            }
        }
        feedModeState.hand.splice(worstIdx, 1);
    }

    const reservedSlots = explorationRatio < 0.8 && unseenCards.length > 0 ? Math.min(2, Math.ceil(targetSize * 0.3)) : 0;
    for (let i = 0; i < reservedSlots && feedModeState.hand.length < targetSize && unseenCards.length > 0; i++) {
        const idx = Math.floor(Math.random() * unseenCards.length);
        const randomUnseen = unseenCards[idx];
        if (randomUnseen && !feedModeState.hand.includes(randomUnseen.char)) {
            feedModeState.hand.push(randomUnseen.char);
            unseenCards.splice(idx, 1);
        }
    }

    while (feedModeState.hand.length < targetSize && feedModeState.hand.length < fullPool.length) {
        const candidates = fullPool.filter(item => !feedModeState.hand.includes(item.char));
        if (!candidates.length) break;

        let bestChar = null;
        let bestScore = -Infinity;

        for (const item of candidates) {
            const score = getFeedUCBScore(item.char, now);
            if (score > bestScore) {
                bestScore = score;
                bestChar = item.char;
            }
        }

        if (!bestChar) break;
        feedModeState.hand.push(bestChar);
    }

    feedModeState.hand = Array.from(new Set(feedModeState.hand));
}

function selectFeedQuestion(now) {
    ensureFeedHand(now);
    const hand = feedModeState.hand;
    if (!hand.length) return null;

    let bestChar = null;
    let bestScore = -Infinity;

    for (const char of hand) {
        const score = getFeedUCBScore(char, now) + Math.random() * 0.1;
        if (score > bestScore) {
            bestScore = score;
            bestChar = char;
        }
    }

    return bestChar;
}

function recordFeedOutcome(char, correct, responseMs, now) {
    feedModeState.totalPulls += 1;

    if (!feedModeState.seen[char]) {
        feedModeState.seen[char] = {
            attempts: 0,
            correct: 0,
            streak: 0,
            lastSeen: 0,
            halfLifeHours: FEED_FORGET_INITIAL_HALFLIFE_HOURS,
            lastResponseMs: null,
            avgResponseMs: null
        };
    }

    const stats = feedModeState.seen[char];
    stats.attempts += 1;
    const prevSeen = Number.isFinite(stats.lastSeen) ? stats.lastSeen : 0;
    stats.lastSeen = now;

    if (correct) {
        stats.correct += 1;
        stats.streak = (stats.streak || 0) + 1;
    } else {
        stats.streak = 0;
    }

    const responseFactor = getFeedResponseFactor(responseMs);
    const confidenceNorm = clampNumber(getConfidenceScore(char), 0, 1);
    const elapsedHours = prevSeen ? Math.max(0, (now - prevSeen) / 3600000) : 0;
    const spacingBoost = elapsedHours > stats.halfLifeHours ? 1.15 : 1.0;

    if (!Number.isFinite(stats.halfLifeHours)) {
        stats.halfLifeHours = FEED_FORGET_INITIAL_HALFLIFE_HOURS;
    }

    if (correct) {
        const growth = FEED_FORGET_CORRECT_GROWTH * responseFactor * (0.6 + 0.4 * confidenceNorm) * spacingBoost;
        stats.halfLifeHours = clampNumber(stats.halfLifeHours * (1 + growth), FEED_FORGET_MIN_HALFLIFE_HOURS, FEED_FORGET_MAX_HALFLIFE_HOURS);
    } else {
        const shrink = FEED_FORGET_WRONG_SHRINK * (1 + (1 - responseFactor) * 0.5);
        stats.halfLifeHours = clampNumber(stats.halfLifeHours * shrink, FEED_FORGET_MIN_HALFLIFE_HOURS, FEED_FORGET_MAX_HALFLIFE_HOURS);
    }

    if (Number.isFinite(responseMs)) {
        const clamped = clampNumber(responseMs, FEED_RESPONSE_MIN_MS, FEED_RESPONSE_MAX_MS);
        stats.lastResponseMs = Math.round(clamped);
        stats.avgResponseMs = Number.isFinite(stats.avgResponseMs)
            ? (stats.avgResponseMs * 0.8 + clamped * 0.2)
            : clamped;
    }
}

function simulateResponseMs(card, recallProb) {
    const base = 1200 + (1 - card.mastery) * 2600;
    const recallPenalty = (1 - recallProb) * 1400;
    const jitter = (Math.random() - 0.5) * 500;
    return clampNumber(base + recallPenalty + jitter, FEED_RESPONSE_MIN_MS, FEED_RESPONSE_MAX_MS);
}

function simulateCorrect(card, recallProb) {
    const prob = clampNumber(0.15 + 0.85 * card.mastery * recallProb, 0.05, 0.98);
    return Math.random() < prob;
}

function updateTrueMemory(card, correct, responseMs, now) {
    const responseFactor = getFeedResponseFactor(responseMs);
    const spacingBoost = card.lastSeen ? ((now - card.lastSeen) / 3600000) > card.trueHalfLifeHours ? 1.15 : 1.0 : 1.0;

    if (correct) {
        card.mastery = clampNumber(card.mastery + 0.12 * (1 - card.mastery), 0.05, 0.98);
        const growth = FEED_FORGET_CORRECT_GROWTH * responseFactor * spacingBoost;
        card.trueHalfLifeHours = clampNumber(card.trueHalfLifeHours * (1 + growth), FEED_FORGET_MIN_HALFLIFE_HOURS, FEED_FORGET_MAX_HALFLIFE_HOURS);
    } else {
        card.mastery = clampNumber(card.mastery - 0.08 * card.mastery, 0.05, 0.98);
        const shrink = FEED_FORGET_WRONG_SHRINK * (1 + (1 - responseFactor) * 0.5);
        card.trueHalfLifeHours = clampNumber(card.trueHalfLifeHours * shrink, FEED_FORGET_MIN_HALFLIFE_HOURS, FEED_FORGET_MAX_HALFLIFE_HOURS);
    }

    card.lastSeen = now;
    if (Number.isFinite(responseMs)) {
        card.avgResponseMs = Number.isFinite(card.avgResponseMs)
            ? (card.avgResponseMs * 0.8 + responseMs * 0.2)
            : responseMs;
    }
}

console.log("=== Feed Mode Simulation (Forgetting Curve + Response Time) ===\n");
console.log(`Profile: ${selectedProfile.name}`);
console.log(`  ${selectedProfile.description}\n`);

const avgInitial = pool.reduce((sum, c) => sum + c.mastery, 0) / pool.length;
console.log(`Initial avg mastery: ${(avgInitial * 100).toFixed(0)}%`);

let totalCorrect = 0;
let totalResponseMs = 0;
let totalRecallProb = 0;
let dueCount = 0;

console.log("\n=== First 20 Turns ===\n");
console.log("Turn | Card     | Recall% | Resp(ms) | Result | Hand");
console.log("-----|----------|---------|----------|--------|-----");

for (let i = 0; i < NUM_QUESTIONS; i++) {
    const char = selectFeedQuestion(simNow);
    if (!char) break;

    const card = poolMap.get(char);
    const recallProb = getTrueRecallProbability(card, simNow);
    const responseMs = simulateResponseMs(card, recallProb);
    const correct = simulateCorrect(card, recallProb);

    recordFeedOutcome(char, correct, responseMs, simNow);
    updateTrueMemory(card, correct, responseMs, simNow);

    totalCorrect += correct ? 1 : 0;
    totalResponseMs += responseMs;
    totalRecallProb += recallProb;
    if (recallProb < FEED_FORGET_DUE_THRESHOLD) dueCount += 1;

    if (i < 20) {
        const recallPct = Math.round(recallProb * 100);
        const resp = Math.round(responseMs);
        const action = correct ? '✓' : '✗';
        const handSize = feedModeState.hand.length;
        console.log(`${String(i + 1).padStart(4)} | ${char.padEnd(8)} | ${String(recallPct).padStart(6)}% | ${String(resp).padStart(8)} | ${action.padStart(6)} | ${handSize}`);
    }

    simNow += responseMs + BASE_OVERHEAD_MS;
}

const avgAccuracy = totalCorrect / NUM_QUESTIONS;
const avgResponse = totalResponseMs / NUM_QUESTIONS;
const avgRecall = totalRecallProb / NUM_QUESTIONS;
const avgFinal = pool.reduce((sum, c) => sum + c.mastery, 0) / pool.length;
const avgHalfLife = Object.values(feedModeState.seen)
    .reduce((sum, s) => sum + (s.halfLifeHours || 0), 0) / Math.max(1, Object.keys(feedModeState.seen).length);

console.log(`\n=== Results after ${NUM_QUESTIONS} questions ===`);
console.log(`Total elapsed time: ${(simNow / 60000).toFixed(1)} minutes`);
console.log(`Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
console.log(`Avg response time: ${Math.round(avgResponse)} ms`);
console.log(`Avg recall probability at review: ${(avgRecall * 100).toFixed(1)}%`);
console.log(`Due rate (<${Math.round(FEED_FORGET_DUE_THRESHOLD * 100)}%): ${(dueCount / NUM_QUESTIONS * 100).toFixed(1)}%`);
console.log(`Avg half-life (model): ${(avgHalfLife * 60).toFixed(1)} min`);
console.log(`Avg mastery: ${(avgInitial * 100).toFixed(0)}% → ${(avgFinal * 100).toFixed(0)}%`);

const sorted = [...pool].sort((a, b) => a.mastery - b.mastery);
console.log("\nLowest mastery cards:");
sorted.slice(0, 5).forEach(card => {
    const stats = feedModeState.seen[card.char];
    const shows = stats ? stats.attempts : 0;
    const final = (card.mastery * 100).toFixed(0);
    console.log(`  ${card.char}: ${final}% mastery · ${shows} shows · half-life ${(card.trueHalfLifeHours * 60).toFixed(1)} min`);
});

console.log("\nHighest mastery cards:");
sorted.slice(-5).reverse().forEach(card => {
    const stats = feedModeState.seen[card.char];
    const shows = stats ? stats.attempts : 0;
    const final = (card.mastery * 100).toFixed(0);
    console.log(`  ${card.char}: ${final}% mastery · ${shows} shows · half-life ${(card.trueHalfLifeHours * 60).toFixed(1)} min`);
});

console.log("\n=== Simulation Complete ===");
