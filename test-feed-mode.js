// Feed Mode Simulation with Learning Model
// Run with: node test-feed-mode.js [profile]
// Profiles: know-all, know-most, know-some, know-none, mixed (default)

const FEED_UCB_C = 1.5;
const FEED_MIN_HAND_SIZE = 3;
const FEED_MAX_HAND_SIZE = 10;
const FEED_DEFAULT_HAND_SIZE = 5;
const FEED_STREAK_TO_REMOVE = 2;
const FEED_WEAK_THRESHOLD = 0.6;

// Learning model parameters
const LEARNING_RATE = 0.12;        // How much each correct answer improves knowledge
const FORGETTING_RATE = 0.000;     // Disabled - focus on pure learning (no decay)
const MIN_KNOWLEDGE = 0.05;        // Floor - even unknown cards have some guess chance
const MAX_KNOWLEDGE = 0.95;        // Ceiling - never 100% certain

// Profile selection
const profile = process.argv[2] || 'mixed';

const PROFILES = {
    'know-all': {
        name: 'Know All',
        description: 'You already know all the words well (90% each)',
        getKnowledge: (i) => 0.9
    },
    'know-most': {
        name: 'Know Most',
        description: 'You know most words (80%), a few gaps (20%)',
        getKnowledge: (i) => i < 16 ? 0.8 : 0.2
    },
    'know-some': {
        name: 'Know Some',
        description: 'You know half the words (70%), half are weak (20%)',
        getKnowledge: (i) => i < 10 ? 0.7 : 0.2
    },
    'know-none': {
        name: 'Know None',
        description: 'Brand new - you know nothing (5% guess rate)',
        getKnowledge: (i) => 0.05
    },
    'mixed': {
        name: 'Mixed (Default)',
        description: 'Realistic mix: some known, some familiar, some new',
        getKnowledge: (i) => {
            if (i < 5) return 0.7;       // Cards 0-4: you kinda know these
            if (i < 10) return 0.4;      // Cards 5-9: seen before
            if (i < 15) return 0.2;      // Cards 10-14: vaguely familiar
            return 0.05;                  // Cards 15-19: brand new
        }
    }
};

const selectedProfile = PROFILES[profile] || PROFILES['mixed'];

// Simulate a pool of 20 cards with knowledge based on profile
const pool = [];
for (let i = 0; i < 20; i++) {
    const initialKnowledge = selectedProfile.getKnowledge(i);
    pool.push({
        char: `card${i}`,
        knowledge: initialKnowledge,
        initialKnowledge: initialKnowledge,
        timeSincePractice: 0
    });
}

let feedModeState = {
    hand: [],
    seen: {},
    totalPulls: 0
};

function getFeedUCBScore(char) {
    const stats = feedModeState.seen[char];
    const totalPulls = feedModeState.totalPulls || 1;

    if (!stats || stats.attempts === 0) {
        const explorationRatio = getFeedExplorationRatio();
        const baseScore = explorationRatio < 0.5 ? 3.0 : 2.0;
        return baseScore + Math.random() * 0.5;
    }

    const confidence = stats.correct / stats.attempts;
    const explorationBonus = FEED_UCB_C * Math.sqrt(Math.log(totalPulls) / stats.attempts);

    return (1 - confidence) + explorationBonus;
}

function getFeedExplorationRatio() {
    const poolSize = pool.length;
    if (poolSize === 0) return 1;
    const seenCount = Object.keys(feedModeState.seen).length;
    return seenCount / poolSize;
}

function getFeedTargetHandSize() {
    const poolSize = pool.length;
    if (poolSize === 0) return FEED_DEFAULT_HAND_SIZE;

    const explorationRatio = getFeedExplorationRatio();

    let weakCount = 0;
    for (const char of feedModeState.hand) {
        const stats = feedModeState.seen[char];
        if (stats && stats.attempts > 0) {
            const confidence = stats.correct / stats.attempts;
            if (confidence < FEED_WEAK_THRESHOLD) {
                weakCount++;
            }
        }
    }

    if (explorationRatio < 0.3) {
        return Math.min(FEED_MAX_HAND_SIZE, poolSize);
    } else if (explorationRatio < 0.6) {
        return Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_DEFAULT_HAND_SIZE + 2, weakCount + 3));
    } else {
        return Math.max(FEED_MIN_HAND_SIZE, Math.min(FEED_DEFAULT_HAND_SIZE, weakCount + 2));
    }
}

function ensureFeedHand() {
    const targetSize = getFeedTargetHandSize();

    feedModeState.hand = feedModeState.hand.filter(char => {
        const stats = feedModeState.seen[char];
        if (!stats) return true;
        return (stats.streak || 0) < FEED_STREAK_TO_REMOVE;
    });

    const unseenCards = pool.filter(item =>
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
            const score = getFeedUCBScore(feedModeState.hand[i]);
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

    while (feedModeState.hand.length < targetSize && feedModeState.hand.length < pool.length) {
        const candidates = pool.filter(item => !feedModeState.hand.includes(item.char));
        if (!candidates.length) break;

        let bestChar = null;
        let bestScore = -Infinity;

        for (const item of candidates) {
            const score = getFeedUCBScore(item.char);
            if (score > bestScore) {
                bestScore = score;
                bestChar = item.char;
            }
        }

        if (bestChar) {
            feedModeState.hand.push(bestChar);
        } else {
            break;
        }
    }
}

function selectFeedQuestion() {
    ensureFeedHand();
    const hand = feedModeState.hand;
    if (!hand.length) return null;

    let bestChar = null;
    let bestScore = -Infinity;

    for (const char of hand) {
        const score = getFeedUCBScore(char) + Math.random() * 0.1;
        if (score > bestScore) {
            bestScore = score;
            bestChar = char;
        }
    }

    return bestChar;
}

function recordOutcome(char, correct) {
    feedModeState.totalPulls++;

    if (!feedModeState.seen[char]) {
        feedModeState.seen[char] = { attempts: 0, correct: 0, streak: 0 };
    }

    const stats = feedModeState.seen[char];
    stats.attempts++;

    if (correct) {
        stats.correct++;
        stats.streak = (stats.streak || 0) + 1;
    } else {
        stats.streak = 0;
    }

    ensureFeedHand();
}

// LEARNING MODEL: Simulate answering based on current knowledge + update knowledge
function simulateAnswer(char) {
    const card = pool.find(c => c.char === char);
    if (!card) return false;

    // Answer based on current knowledge level
    const correct = Math.random() < card.knowledge;

    // Update knowledge based on outcome
    if (correct) {
        // Learning: knowledge increases
        card.knowledge = Math.min(MAX_KNOWLEDGE, card.knowledge + LEARNING_RATE * (1 - card.knowledge));
    } else {
        // Forgetting from failure (optional - getting wrong might not decrease much)
        card.knowledge = Math.max(MIN_KNOWLEDGE, card.knowledge - 0.05);
    }

    card.timeSincePractice = 0;
    return correct;
}

// Apply forgetting to all cards not practiced this turn
function applyForgetting(practicedChar) {
    for (const card of pool) {
        if (card.char !== practicedChar) {
            card.timeSincePractice++;
            // Gradual forgetting
            card.knowledge = Math.max(MIN_KNOWLEDGE, card.knowledge - FORGETTING_RATE);
        }
    }
}

// Run simulation
console.log("=== Feed Mode Simulation with Learning ===\n");
console.log(`Profile: ${selectedProfile.name}`);
console.log(`  ${selectedProfile.description}\n`);
console.log("Learning model:");
console.log(`  - Learning rate: ${LEARNING_RATE} (knowledge gain per correct answer)`);
console.log(`  - Forgetting rate: ${FORGETTING_RATE} (knowledge decay per turn when not practiced)`);
console.log(`  - Knowledge range: ${MIN_KNOWLEDGE} to ${MAX_KNOWLEDGE}\n`);

// Show initial distribution
const avgInitialStart = pool.reduce((sum, c) => sum + c.initialKnowledge, 0) / pool.length;
console.log(`Initial average knowledge: ${(avgInitialStart * 100).toFixed(0)}%\n`);

const NUM_QUESTIONS = 100;

// Simulate preview queue like the real app
let previewQueue = [];
let currentQuestion = null;
const PREVIEW_SIZE = 3;

function ensurePreviewQueueSim() {
    while (previewQueue.length < PREVIEW_SIZE) {
        const excludeChars = previewQueue.slice();
        if (currentQuestion) excludeChars.push(currentQuestion);

        // Find a card not in excludeChars
        const candidates = feedModeState.hand.filter(c => !excludeChars.includes(c));
        if (!candidates.length) break;

        // Pick by UCB score
        let best = null;
        let bestScore = -Infinity;
        for (const c of candidates) {
            const score = getFeedUCBScore(c) + Math.random() * 0.1;
            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        }
        if (best) previewQueue.push(best);
        else break;
    }
}

console.log("=== Selection Log (first 20 turns) ===\n");
console.log("Turn | Current    | Upcoming Queue        | Hand Size | Action");
console.log("-----|------------|----------------------|-----------|--------");

for (let i = 0; i < NUM_QUESTIONS; i++) {
    ensureFeedHand();
    ensurePreviewQueueSim();

    // Get next question from preview queue
    let char;
    if (previewQueue.length) {
        char = previewQueue.shift();
    } else {
        char = selectFeedQuestion();
    }
    if (!char) break;

    currentQuestion = char;
    ensurePreviewQueueSim(); // Refill after setting current

    const correct = simulateAnswer(char);
    recordOutcome(char, correct);
    applyForgetting(char);

    // Log first 20 turns
    if (i < 20) {
        const upcomingStr = previewQueue.slice(0, 3).join(', ').padEnd(20);
        const handSize = feedModeState.hand.length;
        const action = correct ? '✓' : '✗';
        console.log(`${String(i+1).padStart(4)} | ${char.padEnd(10)} | ${upcomingStr} | ${String(handSize).padStart(9)} | ${action}`);

        // Check for duplicates
        if (previewQueue.includes(char)) {
            console.log(`     ⚠️  DUPLICATE: ${char} is in both current and upcoming!`);
        }
    }
}

// Analysis
console.log(`=== Results after ${NUM_QUESTIONS} questions ===\n`);

// Group by initial difficulty
const easyCards = pool.slice(0, 5);
const mediumCards = pool.slice(5, 10);
const weakCards = pool.slice(10, 15);
const newCards = pool.slice(15, 20);

function avgKnowledge(cards) {
    return (cards.reduce((sum, c) => sum + c.knowledge, 0) / cards.length * 100).toFixed(0);
}

function avgInitialKnowledge(cards) {
    return (cards.reduce((sum, c) => sum + c.initialKnowledge, 0) / cards.length * 100).toFixed(0);
}

function showCount(cards) {
    return cards.reduce((sum, c) => {
        const stats = feedModeState.seen[c.char];
        return sum + (stats ? stats.attempts : 0);
    }, 0);
}

console.log("Knowledge change by group:");
console.log(`  Easy (started 70%):     ${avgInitialKnowledge(easyCards)}% → ${avgKnowledge(easyCards)}% (${showCount(easyCards)} shows)`);
console.log(`  Medium (started 40%):   ${avgInitialKnowledge(mediumCards)}% → ${avgKnowledge(mediumCards)}% (${showCount(mediumCards)} shows)`);
console.log(`  Weak (started 20%):     ${avgInitialKnowledge(weakCards)}% → ${avgKnowledge(weakCards)}% (${showCount(weakCards)} shows)`);
console.log(`  New (started 5%):       ${avgInitialKnowledge(newCards)}% → ${avgKnowledge(newCards)}% (${showCount(newCards)} shows)`);

console.log("\nCards seen:", Object.keys(feedModeState.seen).length, "of", pool.length);

// Show individual card progress
console.log("\nIndividual card progress (sorted by final knowledge):");
const sortedCards = [...pool].sort((a, b) => a.knowledge - b.knowledge);

for (const card of sortedCards) {
    const stats = feedModeState.seen[card.char];
    const shows = stats ? stats.attempts : 0;
    const correct = stats ? stats.correct : 0;
    const initial = (card.initialKnowledge * 100).toFixed(0);
    const final = (card.knowledge * 100).toFixed(0);
    const delta = card.knowledge - card.initialKnowledge;
    const deltaStr = delta >= 0 ? `+${(delta * 100).toFixed(0)}` : (delta * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(card.knowledge * 20)) + '░'.repeat(20 - Math.round(card.knowledge * 20));
    console.log(`  ${card.char.padEnd(7)} ${bar} ${initial}%→${final}% (${deltaStr}) [${shows} shows, ${correct} correct]`);
}

// Evaluation
console.log("\n=== Evaluation ===");

const avgFinalKnowledge = pool.reduce((sum, c) => sum + c.knowledge, 0) / pool.length;
const avgInitial = pool.reduce((sum, c) => sum + c.initialKnowledge, 0) / pool.length;

console.log(`Overall knowledge: ${(avgInitial * 100).toFixed(0)}% → ${(avgFinalKnowledge * 100).toFixed(0)}%`);

if (avgFinalKnowledge > avgInitial) {
    console.log("✓ GOOD: Overall knowledge increased");
} else {
    console.log("✗ BAD: Overall knowledge decreased");
}

// Check if weak cards improved more than easy cards
const weakImprovement = weakCards.reduce((sum, c) => sum + (c.knowledge - c.initialKnowledge), 0) / weakCards.length;
const easyImprovement = easyCards.reduce((sum, c) => sum + (c.knowledge - c.initialKnowledge), 0) / easyCards.length;

if (weakImprovement > easyImprovement) {
    console.log("✓ GOOD: Weak cards improved more than easy cards");
} else {
    console.log("? INFO: Easy cards improved more (might be okay if they were practiced)");
}

// Check if new cards got learned
const newCardsLearned = newCards.filter(c => c.knowledge > 0.3).length;
console.log(`✓ New cards learned (>30% knowledge): ${newCardsLearned}/${newCards.length}`);

// Check exploration
if (Object.keys(feedModeState.seen).length >= 15) {
    console.log("✓ GOOD: Explored most of the deck (>=75%)");
} else {
    console.log("✗ BAD: Didn't explore enough of the deck");
}

console.log("\n=== Simulation Complete ===");
