// EEG Decision Visualization
// Shows a breakdown of why each card was chosen in Feed+EEG mode.
// Renders a small panel each time a question is served, showing the
// score components: urgency, difficulty, UCB exploration, EEG bias,
// brain profile, and the final weighted score for the top candidates.
//
// Depends on: quiz-engine.js (feedModeState, getFeedUCBScore, etc.),
//             eeg-bridge.js (window.eeg), eeg-neuro.js (window.neuro)

(function () {
    'use strict';

    var PANEL_ID = 'eeg-decision-panel';
    var TOGGLE_KEY = 'eeg_decision_panel_visible';
    var panelEl = null;
    var lastDecisionData = null;

    var COLORS = {
        urgency: '#ff7043',
        difficulty: '#ffb74d',
        exploration: '#4fc3f7',
        eegFocus: '#9575cd',
        eegBrain: '#66bb6a',
        srBoost: '#26c6da',
        marking: '#ef5350',
        freshNew: '#78909c',
        total: '#e0e0e0',
        dimmed: '#546e7a',
        bar: 'rgba(255,255,255,0.08)',
        bg: 'rgba(22, 22, 26, 0.95)',
        border: 'rgba(255,255,255,0.1)',
    };

    // =========================================================================
    // SCORE DECOMPOSITION — mirrors getFeedUCBScore but returns components
    // =========================================================================

    function decomposeFeedScore(char) {
        if (typeof feedModeState === 'undefined') return null;
        if (typeof SCHEDULER_MODES === 'undefined') return null;

        var stats = feedModeState.seen ? feedModeState.seen[char] : null;
        var totalPulls = feedModeState.totalPulls || 1;
        var isEEG = (typeof schedulerMode !== 'undefined') &&
            schedulerMode === SCHEDULER_MODES.FEED_EEG;
        var isSR = (typeof schedulerMode !== 'undefined') &&
            (schedulerMode === SCHEDULER_MODES.FEED_SR || isEEG);

        var result = {
            char: char,
            isUnseen: !stats || !stats.attempts,
            urgency: 0,
            difficulty: 0,
            exploration: 0,
            dueBoost: 0,
            freshBoost: 0,
            srBoost: 0,
            markingBoost: 0,
            eegDifficultyBias: 0,
            eegFocusMod: 0,
            eegBrainProfile: 0,
            eegHeadPenalty: 0,
            total: 0,
            // Raw data for display
            sessionAcc: null,
            recallProb: null,
            attempts: 0,
            streak: 0,
            avgResponseMs: null,
            eegEngagement: null,
            eegRelaxation: null,
            eegMlLabel: null,
            eegHeadMovement: null,
            eegSignalOk: true,
            brainFragile: false,
            brainUnfocusedAcc: null,
        };

        var marking = (typeof getWordMarking === 'function') ? getWordMarking(char) : null;
        var MARKING_NEEDS_WORK_BOOST = 1.4;
        var MARKING_LEARNED_PENALTY = 1.8;

        // Unseen card
        if (!stats || stats.attempts === 0) {
            var explorationRatio = (typeof getFeedExplorationRatio === 'function')
                ? getFeedExplorationRatio() : 0;
            var baseScore = explorationRatio < 0.5 ? 3.0 : 2.0;
            result.freshBoost = baseScore;

            if (typeof getConfidenceScore === 'function' && typeof getConfidenceMasteryThreshold === 'function') {
                var srScore = getConfidenceScore(char);
                var threshold = getConfidenceMasteryThreshold();
                var srBoost = Math.max(0, (threshold - srScore) / threshold);
                result.srBoost = isSR ? srBoost * 1.5 : srBoost * 0.6;
            }

            if (marking === 'needs-work') result.markingBoost = MARKING_NEEDS_WORK_BOOST;
            else if (marking === 'learned') result.markingBoost = -MARKING_LEARNED_PENALTY;

            // EEG bias for unseen
            if (isEEG && typeof neuro !== 'undefined') {
                var eegBias = neuro.getEEGDifficultyBias();
                result.eegDifficultyBias = eegBias > 0 ? eegBias * 0.8 : -Math.abs(eegBias) * 0.5;
                if (typeof eeg !== 'undefined' && typeof eeg.isSignalUsable === 'function' && !eeg.isSignalUsable()) {
                    result.eegSignalOk = false;
                }

                if (typeof neuro.getCharBrainProfile === 'function') {
                    var bp = neuro.getCharBrainProfile(char);
                    if (bp && bp.mlUnfocusedAccuracy !== null && bp.mlUnfocusedAccuracy < 0.5) {
                        result.eegBrainProfile = 0.6;
                    }
                }
            }

            result.total = result.freshBoost + result.srBoost + result.markingBoost +
                result.eegDifficultyBias + result.eegBrainProfile;

            // Capture EEG state
            captureEEGState(result);
            return result;
        }

        // Seen card — full scoring
        result.attempts = stats.attempts;
        result.streak = stats.streak || 0;
        result.sessionAcc = stats.correct / stats.attempts;
        result.avgResponseMs = stats.avgResponseMs;

        var recallProb = (typeof getFeedRecallProbability === 'function')
            ? getFeedRecallProbability(char) : null;
        result.recallProb = recallProb;

        var forgettingUrgency = Number.isFinite(recallProb) ? (1 - recallProb) : (1 - result.sessionAcc);
        result.urgency = forgettingUrgency;

        var FEED_FORGET_DUE_THRESHOLD = 0.5;
        var FEED_FORGET_DUE_BOOST = 2.5;
        if (typeof window.FEED_FORGET_DUE_THRESHOLD !== 'undefined') FEED_FORGET_DUE_THRESHOLD = window.FEED_FORGET_DUE_THRESHOLD;
        result.dueBoost = (Number.isFinite(recallProb) && recallProb < FEED_FORGET_DUE_THRESHOLD)
            ? (FEED_FORGET_DUE_THRESHOLD - recallProb) * FEED_FORGET_DUE_BOOST : 0;

        var FEED_RESPONSE_TARGET_MS = 3000;
        if (typeof window.FEED_RESPONSE_TARGET_MS !== 'undefined') FEED_RESPONSE_TARGET_MS = window.FEED_RESPONSE_TARGET_MS;
        var responsePenalty = Number.isFinite(stats.avgResponseMs)
            ? Math.min(1, Math.max(0, (stats.avgResponseMs - FEED_RESPONSE_TARGET_MS) / FEED_RESPONSE_TARGET_MS))
            : 0;
        result.difficulty = (1 - result.sessionAcc) * 0.7 + responsePenalty * 0.3;

        var FEED_UCB_C = 1.0;
        if (typeof window.FEED_UCB_C !== 'undefined') FEED_UCB_C = window.FEED_UCB_C;
        result.exploration = FEED_UCB_C * Math.sqrt(Math.log(totalPulls) / stats.attempts);

        var elapsedMinutes = Number.isFinite(stats.lastSeen) ? (Date.now() - stats.lastSeen) / 60000 : 0;
        result.freshBoost = (stats.attempts < 2)
            ? Math.min(1.4, Math.max(0, (1 - (elapsedMinutes / 5)) * 1.4))
            : 0;

        // Weighted sum
        var FEED_SCORE_URGENCY_WEIGHT = 1.6;
        var FEED_SCORE_DIFFICULTY_WEIGHT = 0.75;
        var FEED_SCORE_UCB_WEIGHT = 0.5;

        var score = (FEED_SCORE_URGENCY_WEIGHT * result.urgency)
            + (FEED_SCORE_DIFFICULTY_WEIGHT * result.difficulty)
            + (FEED_SCORE_UCB_WEIGHT * result.exploration)
            + result.dueBoost
            + result.freshBoost;

        // SR confidence
        if (typeof getConfidenceScore === 'function' && typeof getConfidenceMasteryThreshold === 'function') {
            var srScore2 = isSR ? (typeof normalizeConfidenceScore === 'function' ? normalizeConfidenceScore(getConfidenceScore(char)) : getConfidenceScore(char)) : getConfidenceScore(char);
            var threshold2 = getConfidenceMasteryThreshold();
            var srBoost2 = Math.max(0, (threshold2 - srScore2) / threshold2);
            result.srBoost = isSR ? srBoost2 * 0.6 : srBoost2 * 0.25;
            score += result.srBoost;
        }

        // Marking
        if (marking === 'needs-work') { result.markingBoost = MARKING_NEEDS_WORK_BOOST; }
        else if (marking === 'learned') { result.markingBoost = -MARKING_LEARNED_PENALTY; }
        score += result.markingBoost;

        // EEG modulation
        if (isEEG && typeof eeg !== 'undefined' && eeg.state && eeg.state.ready) {
            var eegSignalOk = typeof eeg.isSignalUsable === 'function' ? eeg.isSignalUsable() : true;
            result.eegSignalOk = eegSignalOk;

            if (eegSignalOk) {
                var compositeFocus = typeof eeg.getCompositeFocusScore === 'function'
                    ? eeg.getCompositeFocusScore() : (eeg.state.engagement || 0);
                var headMove = eeg.state.headMovement || 0;

                var focusBias = (compositeFocus - 0.2) * 3.0;
                focusBias = Math.max(-1.5, Math.min(1.5, focusBias));

                if (focusBias > 0) {
                    result.eegFocusMod = focusBias * result.difficulty * 0.8
                        + focusBias * result.exploration * 0.3;
                } else {
                    result.eegFocusMod = Math.abs(focusBias) * (1 - result.difficulty) * 0.6
                        - Math.abs(focusBias) * result.exploration * 0.2;
                }
                score += result.eegFocusMod;

                if (headMove > 0.5) {
                    result.eegHeadPenalty = -(headMove - 0.5) * result.difficulty * 1.2;
                    score += result.eegHeadPenalty;
                }

                if (typeof neuro !== 'undefined' && typeof neuro.getCharBrainProfile === 'function') {
                    var brainProfile = neuro.getCharBrainProfile(char);
                    if (brainProfile) {
                        if (brainProfile.mlUnfocusedAccuracy !== null && brainProfile.mlUnfocusedAccuracy < 0.5 && focusBias > 0.3) {
                            result.eegBrainProfile += 0.8;
                        }
                        if (brainProfile.fragile && focusBias > 0) {
                            result.eegBrainProfile += 0.5;
                        }
                        result.brainFragile = !!brainProfile.fragile;
                        result.brainUnfocusedAcc = brainProfile.mlUnfocusedAccuracy;
                    }
                }
                score += result.eegBrainProfile;
            }
        }

        result.total = score;
        captureEEGState(result);
        return result;
    }

    function captureEEGState(result) {
        if (typeof eeg !== 'undefined' && eeg.state) {
            result.eegEngagement = eeg.state.engagement || null;
            result.eegRelaxation = eeg.state.relaxation || null;
            result.eegMlLabel = typeof eeg.getMLFocusLabel === 'function' ? eeg.getMLFocusLabel() : null;
            result.eegHeadMovement = eeg.state.headMovement || null;
        }
    }

    // =========================================================================
    // CAPTURE DECISION — called when a question is generated
    // =========================================================================

    function captureDecision() {
        if (typeof schedulerMode === 'undefined') return;
        if (typeof SCHEDULER_MODES === 'undefined') return;
        var isEEGMode = schedulerMode === SCHEDULER_MODES.FEED_EEG;
        var isFeedMode = schedulerMode === SCHEDULER_MODES.FEED ||
            schedulerMode === SCHEDULER_MODES.FEED_SR || isEEGMode;
        if (!isFeedMode) return;
        if (typeof feedModeState === 'undefined' || !feedModeState.hand) return;
        if (typeof currentQuestion === 'undefined' || !currentQuestion) return;

        var hand = feedModeState.hand;
        var scores = [];

        for (var i = 0; i < hand.length; i++) {
            var d = decomposeFeedScore(hand[i]);
            if (d) scores.push(d);
        }

        scores.sort(function (a, b) { return b.total - a.total; });

        lastDecisionData = {
            chosen: currentQuestion.char,
            candidates: scores,
            ts: Date.now(),
            isEEG: isEEGMode,
        };

        renderPanel();
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    function createPanel() {
        if (panelEl) return;

        panelEl = document.createElement('div');
        panelEl.id = PANEL_ID;
        panelEl.style.cssText = [
            'position: fixed',
            'top: 12px',
            'left: 12px',
            'z-index: 9999',
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            'font-size: 11px',
            'background: ' + COLORS.bg,
            'color: #e0e0e0',
            'padding: 12px 14px',
            'border-radius: 12px',
            'border: 1px solid ' + COLORS.border,
            'backdrop-filter: blur(12px)',
            'width: 300px',
            'max-height: 80vh',
            'overflow-y: auto',
            'line-height: 1.4',
            'transition: opacity 0.3s ease',
        ].join(';');

        document.body.appendChild(panelEl);

        var stored = localStorage.getItem(TOGGLE_KEY);
        if (stored === 'false') panelEl.style.display = 'none';
    }

    function componentBar(label, value, maxVal, color, suffix) {
        var pct = maxVal > 0 ? Math.min(100, Math.max(0, (value / maxVal) * 100)) : 0;
        var displayVal = value.toFixed(2);
        if (suffix) displayVal += suffix;
        return '<div style="display:flex;align-items:center;margin:2px 0;gap:4px">' +
            '<span style="min-width:70px;color:' + COLORS.dimmed + ';font-size:10px">' + label + '</span>' +
            '<div style="flex:1;height:5px;background:' + COLORS.bar + ';border-radius:3px;overflow:hidden">' +
            '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px"></div>' +
            '</div>' +
            '<span style="min-width:36px;text-align:right;font-size:10px;color:' + color + '">' + displayVal + '</span>' +
            '</div>';
    }

    function candidateRow(d, isChosen, maxScore) {
        var html = [];
        var border = isChosen ? '2px solid ' + COLORS.eegFocus : '1px solid rgba(255,255,255,0.06)';
        var bg = isChosen ? 'rgba(149,117,205,0.12)' : 'rgba(255,255,255,0.02)';

        html.push('<div style="padding:8px 10px;margin:4px 0;border-radius:8px;border:' + border + ';background:' + bg + '">');

        // Character + total score
        var charDisplay = d.char;
        if (typeof quizCharacters !== 'undefined' && Array.isArray(quizCharacters)) {
            var found = quizCharacters.find(function (q) { return q.char === d.char; });
            if (found && found.meaning) charDisplay += ' <span style="color:' + COLORS.dimmed + '">' + found.meaning + '</span>';
        }
        html.push('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">');
        html.push('<span style="font-size:16px;font-weight:600">' + charDisplay + '</span>');
        html.push('<span style="font-size:13px;font-weight:700;color:' + COLORS.total + '">' + d.total.toFixed(2) + '</span>');
        html.push('</div>');

        // Stats line
        if (!d.isUnseen) {
            var statsLine = [];
            if (d.sessionAcc !== null) statsLine.push(Math.round(d.sessionAcc * 100) + '% acc');
            if (d.attempts) statsLine.push(d.attempts + ' tries');
            if (d.recallProb !== null) statsLine.push('P(recall)=' + d.recallProb.toFixed(2));
            if (d.avgResponseMs !== null) statsLine.push(Math.round(d.avgResponseMs) + 'ms');
            html.push('<div style="font-size:9px;color:' + COLORS.dimmed + ';margin-bottom:4px">' + statsLine.join(' · ') + '</div>');
        } else {
            html.push('<div style="font-size:9px;color:' + COLORS.dimmed + ';margin-bottom:4px">New card</div>');
        }

        // Score bars
        if (!d.isUnseen) {
            html.push(componentBar('Urgency', d.urgency * 1.6, maxScore, COLORS.urgency));
            html.push(componentBar('Difficulty', d.difficulty * 0.75, maxScore, COLORS.difficulty));
            html.push(componentBar('Explore', d.exploration * 0.5, maxScore, COLORS.exploration));
            if (d.dueBoost > 0.01) html.push(componentBar('Due boost', d.dueBoost, maxScore, COLORS.urgency));
            if (d.freshBoost > 0.01) html.push(componentBar('Fresh', d.freshBoost, maxScore, COLORS.freshNew));
        } else {
            html.push(componentBar('New card', d.freshBoost, maxScore, COLORS.freshNew));
        }

        if (Math.abs(d.srBoost) > 0.01) html.push(componentBar('SR boost', d.srBoost, maxScore, COLORS.srBoost));
        if (Math.abs(d.markingBoost) > 0.01) html.push(componentBar('Marking', d.markingBoost, maxScore, d.markingBoost > 0 ? COLORS.marking : COLORS.dimmed));

        // EEG components
        if (Math.abs(d.eegFocusMod) > 0.01) {
            var focusLabel = d.eegFocusMod > 0 ? '🧠 Focus↑' : '🧠 Focus↓';
            html.push(componentBar(focusLabel, Math.abs(d.eegFocusMod), maxScore, COLORS.eegFocus));
        }
        if (Math.abs(d.eegDifficultyBias) > 0.01) {
            html.push(componentBar('🧠 Bias', Math.abs(d.eegDifficultyBias), maxScore, COLORS.eegFocus));
        }
        if (d.eegBrainProfile > 0.01) {
            html.push(componentBar('🧠 Brain', d.eegBrainProfile, maxScore, COLORS.eegBrain));
        }
        if (d.eegHeadPenalty < -0.01) {
            html.push(componentBar('🤯 Fidget', Math.abs(d.eegHeadPenalty), maxScore, COLORS.marking));
        }
        if (d.brainFragile) {
            html.push('<div style="font-size:9px;color:#ffb74d;margin-top:2px">⚠ Fragile knowledge</div>');
        }

        html.push('</div>');
        return html.join('');
    }

    function renderPanel() {
        createPanel();
        if (!lastDecisionData || panelEl.style.display === 'none') return;

        var data = lastDecisionData;
        var html = [];

        // Header
        html.push('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">');
        html.push('<span style="font-weight:700;font-size:13px;color:' + COLORS.eegFocus + '">');
        html.push(data.isEEG ? '🧠 Feed+EEG Decision' : '📊 Feed Decision');
        html.push('</span>');
        html.push('<span id="eeg-decision-close" style="cursor:pointer;color:' + COLORS.dimmed + ';font-size:14px;padding:2px 4px">✕</span>');
        html.push('</div>');

        // EEG state summary (if available)
        if (data.isEEG && data.candidates.length > 0) {
            var c0 = data.candidates[0];
            if (c0.eegEngagement !== null) {
                var engPct = Math.round((c0.eegEngagement || 0) * 100);
                var relPct = Math.round((c0.eegRelaxation || 0) * 100);
                var headPct = Math.round((c0.eegHeadMovement || 0) * 100);
                var mlLabel = c0.eegMlLabel || '—';

                html.push('<div style="padding:6px 8px;background:rgba(149,117,205,0.1);border-radius:6px;margin-bottom:8px">');
                html.push('<div style="display:flex;gap:12px;font-size:10px">');
                html.push('<span>Focus <b style="color:#4fc3f7">' + engPct + '%</b></span>');
                html.push('<span>Calm <b style="color:#9575cd">' + relPct + '%</b></span>');
                html.push('<span>Head <b>' + headPct + '%</b></span>');
                html.push('<span>ML: <b>' + mlLabel + '</b></span>');
                html.push('</div>');
                if (!c0.eegSignalOk) {
                    html.push('<div style="font-size:9px;color:#ef5350;margin-top:2px">⚠ Poor signal — EEG influence reduced</div>');
                }
                html.push('</div>');
            }
        }

        // Show top candidates (winner + next 4)
        var maxScore = 0;
        for (var i = 0; i < data.candidates.length; i++) {
            maxScore = Math.max(maxScore, data.candidates[i].total);
        }
        maxScore = Math.max(maxScore, 1);

        var showCount = Math.min(data.candidates.length, 5);
        html.push('<div style="font-size:10px;color:' + COLORS.dimmed + ';margin-bottom:4px">');
        html.push('Top ' + showCount + ' of ' + data.candidates.length + ' in hand');
        html.push('</div>');

        for (var j = 0; j < showCount; j++) {
            var isChosen = data.candidates[j].char === data.chosen;
            html.push(candidateRow(data.candidates[j], isChosen, maxScore));
        }

        panelEl.innerHTML = html.join('');

        // Bind close button
        var closeBtn = document.getElementById('eeg-decision-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                panelEl.style.display = 'none';
                localStorage.setItem(TOGGLE_KEY, 'false');
            });
        }
    }

    // =========================================================================
    // HOOK INTO QUIZ ENGINE
    // =========================================================================

    function hookQuestionGeneration() {
        document.addEventListener('feed-question-served', function () {
            setTimeout(captureDecision, 5);
        });
    }

    // Toggle from keyboard (Ctrl+Shift+D)
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            if (!panelEl) createPanel();
            var visible = panelEl.style.display !== 'none';
            panelEl.style.display = visible ? 'none' : 'block';
            localStorage.setItem(TOGGLE_KEY, visible ? 'false' : 'true');
            if (!visible && lastDecisionData) renderPanel();
        }
    });

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(hookQuestionGeneration, 500);
        });
    } else {
        setTimeout(hookQuestionGeneration, 500);
    }

    // Public API
    window.eegDecision = {
        capture: captureDecision,
        getLastDecision: function () { return lastDecisionData; },
        show: function () {
            createPanel();
            panelEl.style.display = 'block';
            localStorage.setItem(TOGGLE_KEY, 'true');
            if (lastDecisionData) renderPanel();
        },
        hide: function () {
            if (panelEl) panelEl.style.display = 'none';
            localStorage.setItem(TOGGLE_KEY, 'false');
        },
        toggle: function () {
            if (!panelEl) { this.show(); return; }
            if (panelEl.style.display === 'none') this.show();
            else this.hide();
        },
        decompose: decomposeFeedScore,
    };

})();
