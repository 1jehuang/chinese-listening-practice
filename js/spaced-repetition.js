// =============================================================================
// SPACED REPETITION (FSRS-4.5 Algorithm)
// =============================================================================
// This module provides spaced repetition functionality using the FSRS-4.5 algorithm.
// All functions use global variables from quiz-engine.js for compatibility.
// Constants (FSRS_PARAMS, SR_ENABLED_KEY) are defined in quiz-engine.js

// =============================================================================
// SPACED REPETITION STATE MANAGEMENT
// =============================================================================

function getSRPageKey() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1).replace('.html', '');
    return `sr_${filename}`;
}

function loadSRData() {
    try {
        const stored = localStorage.getItem(SR_ENABLED_KEY);
        // Default to enabled if not set
        srEnabled = stored === null ? true : stored === 'true';
        srPageKey = getSRPageKey();
        const data = localStorage.getItem(srPageKey);
        srData = data ? JSON.parse(data) : {};
    } catch (e) {
        console.warn('Failed to load SR data', e);
        srData = {};
    }
}

function saveSRData() {
    try {
        localStorage.setItem(srPageKey, JSON.stringify(srData));
    } catch (e) {
        console.warn('Failed to save SR data', e);
    }
}

function toggleSREnabled() {
    srEnabled = !srEnabled;
    try {
        localStorage.setItem(SR_ENABLED_KEY, srEnabled.toString());
    } catch (e) {
        console.warn('Failed to save SR enabled state', e);
    }

    // Re-apply SR filtering without reloading
    // Access variables from quiz-engine.js (same global scope)
    if (typeof originalQuizCharacters !== 'undefined' && originalQuizCharacters.length > 0) {
        quizCharacters = applySRFiltering(originalQuizCharacters);
        
        // Update banner
        showSRBanner();
        
        // Refresh preview queue if it exists
        if (typeof ensurePreviewQueue === 'function') {
            ensurePreviewQueue();
            if (typeof updatePreviewDisplay === 'function') {
                updatePreviewDisplay();
            }
        }
        
        // Refresh current question if quiz is initialized
        if (typeof generateQuestion === 'function' && typeof questionDisplay !== 'undefined') {
            generateQuestion();
        }
    } else {
        // Fallback: reload if originalQuizCharacters not available
        window.location.reload();
    }
}

// Expose to window for banner button
window.toggleSREnabled = toggleSREnabled;

function resetSRData() {
    if (!confirm('Reset all spaced repetition data for this page? This cannot be undone.')) {
        return;
    }

    try {
        localStorage.removeItem(srPageKey);
        srData = {};
        window.location.reload();
    } catch (e) {
        console.warn('Failed to reset SR data', e);
    }
}

// =============================================================================
// FSRS ALGORITHM IMPLEMENTATION
// =============================================================================

function initStability(grade) {
    const w = FSRS_PARAMS.w;
    return Math.max(w[grade - 1], 0.1);
}

function initDifficulty(grade) {
    const w = FSRS_PARAMS.w;
    return Math.min(Math.max(w[4] - (grade - 3) * w[5], 1), 10);
}

function forgettingCurve(elapsedDays, stability) {
    return Math.pow(1 + elapsedDays / (9 * stability), FSRS_PARAMS.decay);
}

function nextInterval(stability) {
    const newInterval = stability / FSRS_PARAMS.decay * (Math.pow(FSRS_PARAMS.requestRetention, 1 / FSRS_PARAMS.decay) - 1);
    return Math.min(Math.max(Math.round(newInterval), 1), FSRS_PARAMS.maximumInterval);
}

function nextDifficulty(difficulty, grade) {
    const w = FSRS_PARAMS.w;
    const nextD = difficulty - w[6] * (grade - 3);
    return Math.min(Math.max(nextD, 1), 10);
}

function nextStability(difficulty, stability, retrievability, grade) {
    const w = FSRS_PARAMS.w;
    let hardPenalty = 1;
    let easyBonus = 1;

    if (grade === 2) hardPenalty = w[15];
    if (grade === 4) easyBonus = w[16];

    return stability * (
        1 +
        Math.exp(w[8]) *
        (11 - difficulty) *
        Math.pow(stability, -w[9]) *
        (Math.exp(w[10] * (1 - retrievability)) - 1) *
        hardPenalty *
        easyBonus
    );
}

function nextForgetStability(difficulty, stability, retrievability) {
    const w = FSRS_PARAMS.w;
    return Math.max(
        w[11] *
        Math.pow(difficulty, -w[12]) *
        (Math.pow(stability + 1, w[13]) - 1) *
        Math.exp(w[14] * (1 - retrievability)),
        0.1
    );
}

function getResponseTimeGrade(responseTimeMs, correct) {
    if (!correct) return 1; // Again

    // Map response time to grade (2=Hard, 3=Good, 4=Easy)
    if (responseTimeMs < 3000) return 4;  // Fast = Easy
    if (responseTimeMs < 8000) return 3;  // Medium = Good
    return 2;                              // Slow = Hard
}

// =============================================================================
// SR CARD MANAGEMENT
// =============================================================================

function getSRCardData(char) {
    if (!srData[char]) {
        srData[char] = {
            due: Date.now(),
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0, // 0=new, 1=learning, 2=review, 3=relearning
            lastReview: null
        };
    }
    return srData[char];
}

function isCardDue(char) {
    const card = getSRCardData(char);
    return Date.now() >= card.due;
}

function updateSRCard(char, correct, responseTimeMs = 3000) {
    const card = getSRCardData(char);
    const now = Date.now();
    const grade = getResponseTimeGrade(responseTimeMs, correct);

    // Calculate elapsed time since last review
    let elapsedDays = 0;
    if (card.lastReview) {
        elapsedDays = (now - card.lastReview) / (24 * 60 * 60 * 1000);
    }
    card.elapsedDays = elapsedDays;

    // Calculate retrievability if card has been reviewed before
    let retrievability = 1;
    if (card.state >= 2 && card.stability > 0) {
        retrievability = forgettingCurve(elapsedDays, card.stability);
    }

    // Update based on grade
    if (grade === 1) {
        // Failed review
        card.lapses++;
        card.state = card.state === 0 ? 1 : 3; // new->learning, review->relearning
        card.stability = card.state === 1
            ? initStability(grade)
            : nextForgetStability(card.difficulty, card.stability, retrievability);
        card.difficulty = card.state === 1
            ? initDifficulty(grade)
            : nextDifficulty(card.difficulty, grade);
        card.scheduledDays = 0;
        card.due = now + 10 * 60 * 1000; // Review in 10 minutes
    } else {
        // Successful review
        card.reps++;

        if (card.state === 0) {
            // New card
            card.stability = initStability(grade);
            card.difficulty = initDifficulty(grade);
            card.state = 1; // -> learning
        } else {
            // Update existing card
            card.stability = nextStability(card.difficulty, card.stability, retrievability, grade);
            card.difficulty = nextDifficulty(card.difficulty, grade);
        }

        // Transition to review state if stability is high enough
        if (card.state === 1 && card.stability >= 1) {
            card.state = 2; // learning -> review
        } else if (card.state === 3 && card.stability >= 1) {
            card.state = 2; // relearning -> review
        }

        // Calculate next review
        card.scheduledDays = nextInterval(card.stability);
        card.due = now + card.scheduledDays * 24 * 60 * 60 * 1000;
    }

    card.lastReview = now;
    saveSRData();
}

function applySRFiltering(characters) {
    if (!srEnabled || !Array.isArray(characters)) {
        return characters;
    }

    const dueCards = [];
    const notDueCards = [];

    characters.forEach(char => {
        if (isCardDue(char.char)) {
            dueCards.push(char);
        } else {
            notDueCards.push(char);
        }
    });

    srDueCount = dueCards.length;

    // Shuffle due cards and put them first
    const shuffledDue = dueCards.sort(() => Math.random() - 0.5);
    const shuffledNotDue = notDueCards.sort(() => Math.random() - 0.5);

    return [...shuffledDue, ...shuffledNotDue];
}

function getSRStats() {
    if (!srEnabled) {
        return { enabled: false };
    }

    let dueToday = 0;
    let total = 0;

    quizCharacters.forEach(char => {
        total++;
        if (isCardDue(char.char)) {
            dueToday++;
        }
    });

    return {
        enabled: true,
        dueToday,
        total,
        reviewed: Object.keys(srData).length
    };
}

function showSRBanner() {
    // Remove existing banner first
    const existingBanner = document.getElementById('srBanner');
    if (existingBanner) {
        existingBanner.remove();
    }
    
    if (!srEnabled || srDueCount === 0) {
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'srBanner';
    banner.className = 'bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-4 rounded';
    banner.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <span class="font-semibold">📅 Spaced Repetition Active</span>
                <span class="ml-2">${srDueCount} card${srDueCount !== 1 ? 's' : ''} due for review</span>
            </div>
            <button onclick="toggleSREnabled()" class="text-sm underline hover:no-underline">Disable</button>
        </div>
    `;

    const container = document.querySelector('.max-w-3xl');
    if (container && container.firstChild) {
        container.insertBefore(banner, container.firstChild);
    }
}
