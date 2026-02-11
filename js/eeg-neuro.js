// EEG Neuro Learning Module
// Provides: adaptive difficulty, flow detection, fatigue detection,
// per-character brain state tracking, cross-session analytics
//
// Depends on: eeg-bridge.js (window.eeg), quiz-engine.js globals

(function () {
    'use strict';

    // =========================================================================
    // STATE
    // =========================================================================

    const NEURO_STORE_KEY = 'eeg_neuro_data';
    const NEURO_SESSION_KEY = 'eeg_neuro_session';
    const NEURO_CROSS_SESSION_KEY = 'eeg_neuro_cross_sessions';

    let neuroState = {
        focusLevel: 0,           // 0-4 mapped from engagement
        flowStreak: 0,           // consecutive correct + focused answers
        inFlow: false,
        flowStartTime: null,
        fatigueScore: 0,         // 0-1, computed from theta/alpha trend
        thetaAlphaHistory: [],   // rolling 2-minute window
        lastBreakPrompt: 0,
        cognitiveLoad: 0,        // estimated from theta power
        sessionStartTime: Date.now(),
    };

    // Per-character brain state tracking (#3)
    let charBrainMap = {};  // { char: { thetaAvg, engagementAvg, responseAvg, attempts, correct, ... } }

    // Cross-session data (#4)
    let crossSessionData = [];  // [{ date, hour, avgEngagement, avgAccuracy, totalQuestions, durationMin }]

    // =========================================================================
    // #1 — ADAPTIVE DIFFICULTY
    // =========================================================================

    function getEEGDifficultyBias() {
        if (typeof eeg === 'undefined' || !eeg.state || !eeg.state.ready) return 0;

        var engagement = eeg.state.engagement || 0;
        var relaxation = eeg.state.relaxation || 0;

        // Use ML model if available for more accurate focus detection
        var mlLabel = typeof eeg.getMLFocusLabel === 'function' ? eeg.getMLFocusLabel() : null;
        var mlConf = typeof eeg.getMLFocusConfidence === 'function' ? eeg.getMLFocusConfidence() : 0;

        if (mlLabel && mlConf > 0.6) {
            if (mlLabel === 'focused' || mlLabel === 'active') return 1.2;
            if (mlLabel === 'relaxed') return -0.8;
            if (mlLabel === 'drowsy' || mlLabel === 'distracted') return -1.2;
        }

        // Factor in head movement — fidgeting suggests distraction
        var headMovement = eeg.state.headMovement || 0;
        var movementPenalty = headMovement > 0.5 ? -0.4 : 0;

        // High focus → serve harder cards (positive bias = harder)
        // Low focus → serve easier cards (negative bias = easier)
        // Range: -1.5 to +1.5
        if (engagement >= 0.4) return 1.2 + movementPenalty;
        if (engagement >= 0.25) return 0.6 + movementPenalty;
        if (engagement >= 0.15) return 0 + movementPenalty;
        if (relaxation >= 0.7) return -0.8;
        return -1.2;
    }

    function getEEGScoreModifier(charConfidence) {
        var bias = getEEGDifficultyBias();
        if (bias === 0) return 0;

        // bias > 0 (focused): boost low-confidence cards (harder ones)
        // bias < 0 (unfocused): boost high-confidence cards (easier ones)
        if (bias > 0) {
            return bias * (1 - charConfidence) * 1.5;
        } else {
            return -bias * charConfidence * 1.5;
        }
    }

    // =========================================================================
    // #3 — PER-CHARACTER BRAIN STATE TRACKING
    // =========================================================================

    function recordCharBrainState(char, correct, responseMs) {
        if (!char) return;
        if (typeof eeg === 'undefined' || !eeg.state || !eeg.state.ready) return;

        if (!charBrainMap[char]) {
            charBrainMap[char] = {
                thetaSum: 0, engagementSum: 0, responseSum: 0,
                attempts: 0, correct: 0,
                thetaOnCorrect: 0, thetaOnWrong: 0,
                correctCount: 0, wrongCount: 0,
                highBetaCorrect: 0, highBetaTotal: 0,
                mlFocusedCorrect: 0, mlFocusedTotal: 0,
                mlUnfocusedCorrect: 0, mlUnfocusedTotal: 0,
                movementSum: 0,
            };
        }

        var c = charBrainMap[char];
        var bands = eeg.state.bands || {};
        var theta = bands.theta || 0;
        var beta = bands.beta || 0;
        var eng = eeg.state.engagement || 0;

        c.attempts++;
        c.thetaSum += theta;
        c.engagementSum += eng;
        c.responseSum += (responseMs || 0);
        c.movementSum += (eeg.state.headMovement || 0);

        // Track ML model correlation with accuracy
        var mlLabel = typeof eeg.getMLFocusLabel === 'function' ? eeg.getMLFocusLabel() : null;
        if (mlLabel === 'focused' || mlLabel === 'active') {
            c.mlFocusedTotal++;
            if (correct) c.mlFocusedCorrect++;
        } else if (mlLabel) {
            c.mlUnfocusedTotal++;
            if (correct) c.mlUnfocusedCorrect++;
        }

        if (correct) {
            c.correct++;
            c.correctCount++;
            c.thetaOnCorrect += theta;

            if (beta > 0) {
                c.highBetaTotal++;
                c.highBetaCorrect++;
            }
        } else {
            c.wrongCount++;
            c.thetaOnWrong += theta;
            if (beta > 0) c.highBetaTotal++;
        }

        // Send quiz event back to the Python bridge for logging
        if (typeof eeg.sendToBridge === 'function') {
            eeg.sendToBridge('quiz-answer', {
                char: char,
                correct: correct,
                responseMs: responseMs,
                engagement: eng,
                mlLabel: mlLabel,
                headMovement: eeg.state.headMovement || 0,
            });
        }

        saveNeuroData();
    }

    function getCharBrainProfile(char) {
        var c = charBrainMap[char];
        if (!c || c.attempts === 0) return null;

        var avgTheta = c.thetaSum / c.attempts;
        var avgEngagement = c.engagementSum / c.attempts;
        var avgResponse = c.responseSum / c.attempts;
        var accuracy = c.correct / c.attempts;
        var avgMovement = (c.movementSum || 0) / c.attempts;

        // Fragile knowledge: correct but with high cognitive effort (high beta)
        var fragile = c.highBetaTotal >= 3
            ? (c.highBetaCorrect / c.highBetaTotal > 0.7 && avgResponse > 2500)
            : false;

        // Frustration: high theta on wrong answers vs correct
        var frustration = (c.wrongCount >= 2 && c.correctCount >= 2)
            ? (c.thetaOnWrong / c.wrongCount) - (c.thetaOnCorrect / c.correctCount)
            : 0;

        // ML focus correlation
        var mlFocusedAccuracy = c.mlFocusedTotal >= 2 ? c.mlFocusedCorrect / c.mlFocusedTotal : null;
        var mlUnfocusedAccuracy = c.mlUnfocusedTotal >= 2 ? c.mlUnfocusedCorrect / c.mlUnfocusedTotal : null;

        return {
            avgTheta: avgTheta,
            avgEngagement: avgEngagement,
            avgResponseMs: avgResponse,
            accuracy: accuracy,
            attempts: c.attempts,
            fragile: fragile,
            frustrationDelta: frustration,
            avgMovement: avgMovement,
            mlFocusedAccuracy: mlFocusedAccuracy,
            mlUnfocusedAccuracy: mlUnfocusedAccuracy,
        };
    }

    // =========================================================================
    // #5 — SMART FATIGUE DETECTION
    // =========================================================================

    function updateFatigueScore() {
        if (typeof eeg === 'undefined' || !eeg.state || !eeg.state.ready) return;

        var bands = eeg.state.bands || {};
        var theta = bands.theta || 0;
        var alpha = bands.alpha || 0;

        // theta/alpha ratio — higher = more fatigued
        var ratio = (alpha !== 0) ? theta / Math.abs(alpha) : 0;
        neuroState.thetaAlphaHistory.push({ ts: Date.now(), ratio: ratio });

        // Keep 2 minutes of history
        var cutoff = Date.now() - 120000;
        neuroState.thetaAlphaHistory = neuroState.thetaAlphaHistory.filter(function (e) {
            return e.ts > cutoff;
        });

        if (neuroState.thetaAlphaHistory.length < 8) {
            neuroState.fatigueScore = 0;
            return;
        }

        // Compare first half to second half — rising ratio = fatigue
        var half = Math.floor(neuroState.thetaAlphaHistory.length / 2);
        var firstHalf = neuroState.thetaAlphaHistory.slice(0, half);
        var secondHalf = neuroState.thetaAlphaHistory.slice(half);

        var avgFirst = firstHalf.reduce(function (s, e) { return s + e.ratio; }, 0) / firstHalf.length;
        var avgSecond = secondHalf.reduce(function (s, e) { return s + e.ratio; }, 0) / secondHalf.length;

        // Positive trend = getting more fatigued
        var trend = avgSecond - avgFirst;
        neuroState.fatigueScore = Math.min(1, Math.max(0, trend * 2 + neuroState.fatigueScore * 0.3));
    }

    function shouldPromptBreak() {
        if (neuroState.fatigueScore < 0.6) return false;
        if (Date.now() - neuroState.lastBreakPrompt < 300000) return false; // max once per 5 min

        var sessionMin = (Date.now() - neuroState.sessionStartTime) / 60000;
        if (sessionMin < 10) return false; // don't prompt in first 10 min

        return true;
    }

    function markBreakPrompted() {
        neuroState.lastBreakPrompt = Date.now();
    }

    // =========================================================================
    // #7 — FLOW STATE DETECTION
    // =========================================================================

    var FLOW_MIN_STREAK = 4;
    var FLOW_MIN_ENGAGEMENT = 0.2;
    var FLOW_MAX_RESPONSE_MS = 4000;

    function updateFlowState(correct, responseMs) {
        if (typeof eeg === 'undefined' || !eeg.state || !eeg.state.ready) {
            return;
        }

        var eng = eeg.state.engagement || 0;

        if (correct && eng >= FLOW_MIN_ENGAGEMENT && responseMs < FLOW_MAX_RESPONSE_MS) {
            neuroState.flowStreak++;
        } else {
            neuroState.flowStreak = 0;
        }

        var wasInFlow = neuroState.inFlow;
        neuroState.inFlow = neuroState.flowStreak >= FLOW_MIN_STREAK;

        if (neuroState.inFlow && !wasInFlow) {
            neuroState.flowStartTime = Date.now();
            fireNeuroEvent('flow-enter', { streak: neuroState.flowStreak });
        } else if (!neuroState.inFlow && wasInFlow) {
            var duration = neuroState.flowStartTime ? Date.now() - neuroState.flowStartTime : 0;
            fireNeuroEvent('flow-exit', { duration: duration, streak: neuroState.flowStreak });
            neuroState.flowStartTime = null;
        }
    }

    function getFlowDuration() {
        if (!neuroState.inFlow || !neuroState.flowStartTime) return 0;
        return Date.now() - neuroState.flowStartTime;
    }

    // =========================================================================
    // #4 — CROSS-SESSION ANALYTICS
    // =========================================================================

    function recordSessionSummary(avgEngagement, avgAccuracy, totalQuestions, durationMin) {
        var now = new Date();
        crossSessionData.push({
            date: now.toISOString().slice(0, 10),
            hour: now.getHours(),
            dayOfWeek: now.getDay(),
            avgEngagement: avgEngagement,
            avgAccuracy: avgAccuracy,
            totalQuestions: totalQuestions,
            durationMin: durationMin,
        });

        // Keep last 100 sessions
        if (crossSessionData.length > 100) {
            crossSessionData = crossSessionData.slice(-100);
        }

        saveCrossSessionData();
    }

    function getOptimalStudyTimes() {
        if (crossSessionData.length < 5) return null;

        // Group by hour of day
        var hourBuckets = {};
        for (var i = 0; i < crossSessionData.length; i++) {
            var s = crossSessionData[i];
            var h = s.hour;
            if (!hourBuckets[h]) {
                hourBuckets[h] = { engSum: 0, accSum: 0, count: 0 };
            }
            hourBuckets[h].engSum += s.avgEngagement;
            hourBuckets[h].accSum += s.avgAccuracy;
            hourBuckets[h].count++;
        }

        var results = [];
        for (var hour in hourBuckets) {
            var b = hourBuckets[hour];
            if (b.count >= 2) {
                results.push({
                    hour: parseInt(hour),
                    avgEngagement: b.engSum / b.count,
                    avgAccuracy: b.accSum / b.count,
                    sessions: b.count,
                    score: (b.engSum / b.count) * 0.5 + (b.accSum / b.count) * 0.5,
                });
            }
        }

        results.sort(function (a, b) { return b.score - a.score; });
        return results;
    }

    // =========================================================================
    // #2 — SESSION TIMELINE (data collection for dashboard)
    // =========================================================================

    var sessionTimeline = [];  // { ts, engagement, relaxation, correct, responseMs, char, inFlow }

    function recordTimelinePoint(eventType, detail) {
        if (typeof eeg === 'undefined' || !eeg.state) return;

        sessionTimeline.push({
            ts: Date.now(),
            eventType: eventType,
            engagement: eeg.state.engagement || 0,
            relaxation: eeg.state.relaxation || 0,
            bands: eeg.state.bands ? Object.assign({}, eeg.state.bands) : null,
            blinkRate: typeof eeg._blinkTimestamps !== 'undefined' ? eeg._blinkTimestamps.length : 0,
            inFlow: neuroState.inFlow,
            fatigueScore: neuroState.fatigueScore,
            correct: detail ? detail.correct : undefined,
            responseMs: detail ? detail.responseMs : undefined,
            char: detail ? detail.char : undefined,
        });
    }

    function getSessionTimeline() {
        return sessionTimeline.slice();
    }

    function getSessionSummary() {
        if (!sessionTimeline.length) return null;

        var answers = sessionTimeline.filter(function (e) { return e.eventType === 'answer'; });
        if (!answers.length) return null;

        var correct = 0, totalEng = 0, totalMs = 0;
        for (var i = 0; i < answers.length; i++) {
            if (answers[i].correct) correct++;
            totalEng += answers[i].engagement;
            totalMs += answers[i].responseMs || 0;
        }

        var durationMin = (Date.now() - neuroState.sessionStartTime) / 60000;

        return {
            totalQuestions: answers.length,
            accuracy: correct / answers.length,
            avgEngagement: totalEng / answers.length,
            avgResponseMs: totalMs / answers.length,
            durationMin: durationMin,
            flowTime: neuroState.inFlow ? getFlowDuration() : 0,
            fatigueScore: neuroState.fatigueScore,
        };
    }

    // =========================================================================
    // EVENT SYSTEM
    // =========================================================================

    var neuroListeners = [];

    function onNeuro(event, callback) {
        neuroListeners.push({ event: event, fn: callback });
    }

    function fireNeuroEvent(event, data) {
        for (var i = 0; i < neuroListeners.length; i++) {
            if (neuroListeners[i].event === event) {
                try { neuroListeners[i].fn(data); } catch (e) {}
            }
        }
    }

    // =========================================================================
    // PERSISTENCE
    // =========================================================================

    function saveNeuroData() {
        try {
            localStorage.setItem(NEURO_STORE_KEY, JSON.stringify(charBrainMap));
        } catch (e) {}
    }

    function loadNeuroData() {
        try {
            var data = localStorage.getItem(NEURO_STORE_KEY);
            if (data) charBrainMap = JSON.parse(data);
        } catch (e) {
            charBrainMap = {};
        }
    }

    function saveCrossSessionData() {
        try {
            localStorage.setItem(NEURO_CROSS_SESSION_KEY, JSON.stringify(crossSessionData));
        } catch (e) {}
    }

    function loadCrossSessionData() {
        try {
            var data = localStorage.getItem(NEURO_CROSS_SESSION_KEY);
            if (data) crossSessionData = JSON.parse(data);
        } catch (e) {
            crossSessionData = [];
        }
    }

    // =========================================================================
    // HOOKS — integrate with eeg-bridge events
    // =========================================================================

    function init() {
        loadNeuroData();
        loadCrossSessionData();

        if (typeof eeg !== 'undefined') {
            eeg.on('update', function () {
                updateFatigueScore();

                if (shouldPromptBreak()) {
                    markBreakPrompted();
                    fireNeuroEvent('break-prompt', {
                        fatigueScore: neuroState.fatigueScore,
                        sessionMin: (Date.now() - neuroState.sessionStartTime) / 60000,
                    });
                }
            });

            eeg.on('quiz-event', function (entry) {
                if (entry.eventType === 'answer' && entry.detail) {
                    var d = entry.detail;
                    recordCharBrainState(d.char, d.correct, d.responseMs);
                    updateFlowState(d.correct, d.responseMs || 99999);
                    recordTimelinePoint('answer', d);
                } else if (entry.eventType === 'question-shown') {
                    recordTimelinePoint('question', entry.detail);
                }
            });
        }

        // Save session summary on unload
        window.addEventListener('beforeunload', function () {
            var summary = getSessionSummary();
            if (summary && summary.totalQuestions >= 3) {
                recordSessionSummary(
                    summary.avgEngagement,
                    summary.accuracy,
                    summary.totalQuestions,
                    summary.durationMin
                );
            }
        });
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.neuro = {
        // #1 Adaptive difficulty
        getEEGDifficultyBias: getEEGDifficultyBias,
        getEEGScoreModifier: getEEGScoreModifier,

        // #3 Per-character brain state
        recordCharBrainState: recordCharBrainState,
        getCharBrainProfile: getCharBrainProfile,
        getCharBrainMap: function () { return charBrainMap; },

        // #4 Cross-session
        getOptimalStudyTimes: getOptimalStudyTimes,
        getCrossSessionData: function () { return crossSessionData; },

        // #5 Fatigue
        getFatigueScore: function () { return neuroState.fatigueScore; },
        shouldPromptBreak: shouldPromptBreak,

        // #7 Flow
        isInFlow: function () { return neuroState.inFlow; },
        getFlowStreak: function () { return neuroState.flowStreak; },
        getFlowDuration: getFlowDuration,

        // #2 Session timeline
        getSessionTimeline: getSessionTimeline,
        getSessionSummary: getSessionSummary,

        // Events
        on: onNeuro,

        // State
        state: neuroState,
    };
})();
