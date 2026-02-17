// EEG Decision Factors
// Shows why the current card was chosen in any Feed mode.
// Renders a slim left-edge panel with score components.
// Auto-shows in feed modes, auto-hides otherwise.
//
// Depends on: quiz-engine.js, eeg-bridge.js, eeg-neuro.js

(function () {
    'use strict';

    var PANEL_ID = 'eeg-decision-panel';
    var panelEl = null;
    var lastData = null;

    // ── Score decomposition (mirrors getFeedUCBScore) ──────────────────

    function decompose(char) {
        if (typeof feedModeState === 'undefined') return null;
        if (typeof SCHEDULER_MODES === 'undefined') return null;

        var stats = feedModeState.seen ? feedModeState.seen[char] : null;
        var totalPulls = feedModeState.totalPulls || 1;
        var isEEG = (typeof schedulerMode !== 'undefined') &&
            schedulerMode === SCHEDULER_MODES.FEED_EEG;
        var isSR = (typeof schedulerMode !== 'undefined') &&
            (schedulerMode === SCHEDULER_MODES.FEED_SR || isEEG);

        var r = {
            char: char, isUnseen: !stats || !stats.attempts,
            urgency: 0, difficulty: 0, exploration: 0,
            dueBoost: 0, freshBoost: 0, srBoost: 0, markingBoost: 0,
            eegDifficultyBias: 0, eegFocusMod: 0, eegBrainProfile: 0, eegHeadPenalty: 0,
            total: 0,
            sessionAcc: null, recallProb: null, attempts: 0, streak: 0,
            avgResponseMs: null, eegEngagement: null, eegRelaxation: null,
            eegMlLabel: null, eegHeadMovement: null, eegSignalOk: true,
            brainFragile: false,
        };

        var marking = (typeof getWordMarking === 'function') ? getWordMarking(char) : null;

        if (!stats || stats.attempts === 0) {
            var expRatio = (typeof getFeedExplorationRatio === 'function') ? getFeedExplorationRatio() : 0;
            r.freshBoost = expRatio < 0.5 ? 3.0 : 2.0;
            if (typeof getConfidenceScore === 'function' && typeof getConfidenceMasteryThreshold === 'function') {
                var s1 = getConfidenceScore(char), th1 = getConfidenceMasteryThreshold();
                r.srBoost = isSR ? Math.max(0, (th1 - s1) / th1) * 1.5 : Math.max(0, (th1 - s1) / th1) * 0.6;
            }
            if (marking === 'needs-work') r.markingBoost = 1.4;
            else if (marking === 'learned') r.markingBoost = -1.8;
            if (isEEG && typeof neuro !== 'undefined') {
                var bias = neuro.getEEGDifficultyBias();
                r.eegDifficultyBias = bias > 0 ? bias * 0.8 : -Math.abs(bias) * 0.5;
                if (typeof eeg !== 'undefined' && typeof eeg.isSignalUsable === 'function' && !eeg.isSignalUsable()) r.eegSignalOk = false;
                if (typeof neuro.getCharBrainProfile === 'function') {
                    var bp = neuro.getCharBrainProfile(char);
                    if (bp && bp.mlUnfocusedAccuracy !== null && bp.mlUnfocusedAccuracy < 0.5) r.eegBrainProfile = 0.6;
                }
            }
            r.total = r.freshBoost + r.srBoost + r.markingBoost + r.eegDifficultyBias + r.eegBrainProfile;
            snapEEG(r);
            return r;
        }

        r.attempts = stats.attempts;
        r.streak = stats.streak || 0;
        r.sessionAcc = stats.correct / stats.attempts;
        r.avgResponseMs = stats.avgResponseMs;
        r.recallProb = (typeof getFeedRecallProbability === 'function') ? getFeedRecallProbability(char) : null;

        var furg = Number.isFinite(r.recallProb) ? (1 - r.recallProb) : (1 - r.sessionAcc);
        r.urgency = furg;

        var dueTh = 0.5, dueB = 2.5;
        if (typeof window.FEED_FORGET_DUE_THRESHOLD !== 'undefined') dueTh = window.FEED_FORGET_DUE_THRESHOLD;
        r.dueBoost = (Number.isFinite(r.recallProb) && r.recallProb < dueTh) ? (dueTh - r.recallProb) * dueB : 0;

        var rTarget = 3000;
        if (typeof window.FEED_RESPONSE_TARGET_MS !== 'undefined') rTarget = window.FEED_RESPONSE_TARGET_MS;
        var rPen = Number.isFinite(stats.avgResponseMs) ? Math.min(1, Math.max(0, (stats.avgResponseMs - rTarget) / rTarget)) : 0;
        r.difficulty = (1 - r.sessionAcc) * 0.7 + rPen * 0.3;

        var ucbC = 1.0;
        if (typeof window.FEED_UCB_C !== 'undefined') ucbC = window.FEED_UCB_C;
        r.exploration = ucbC * Math.sqrt(Math.log(totalPulls) / stats.attempts);

        var elapsed = Number.isFinite(stats.lastSeen) ? (Date.now() - stats.lastSeen) / 60000 : 0;
        r.freshBoost = (stats.attempts < 2) ? Math.min(1.4, Math.max(0, (1 - elapsed / 5) * 1.4)) : 0;

        var score = 1.6 * r.urgency + 0.75 * r.difficulty + 0.5 * r.exploration + r.dueBoost + r.freshBoost;

        if (typeof getConfidenceScore === 'function' && typeof getConfidenceMasteryThreshold === 'function') {
            var s2 = isSR ? (typeof normalizeConfidenceScore === 'function' ? normalizeConfidenceScore(getConfidenceScore(char)) : getConfidenceScore(char)) : getConfidenceScore(char);
            var th2 = getConfidenceMasteryThreshold();
            r.srBoost = isSR ? Math.max(0, (th2 - s2) / th2) * 0.6 : Math.max(0, (th2 - s2) / th2) * 0.25;
            score += r.srBoost;
        }
        if (marking === 'needs-work') r.markingBoost = 1.4;
        else if (marking === 'learned') r.markingBoost = -1.8;
        score += r.markingBoost;

        if (isEEG && typeof eeg !== 'undefined' && eeg.state && eeg.state.ready) {
            var sigOk = typeof eeg.isSignalUsable === 'function' ? eeg.isSignalUsable() : true;
            r.eegSignalOk = sigOk;
            if (sigOk) {
                var cf = typeof eeg.getCompositeFocusScore === 'function' ? eeg.getCompositeFocusScore() : (eeg.state.engagement || 0);
                var hm = eeg.state.headMovement || 0;
                var fb = Math.max(-1.5, Math.min(1.5, (cf - 0.2) * 3.0));
                r.eegFocusMod = fb > 0
                    ? fb * r.difficulty * 0.8 + fb * r.exploration * 0.3
                    : Math.abs(fb) * (1 - r.difficulty) * 0.6 - Math.abs(fb) * r.exploration * 0.2;
                score += r.eegFocusMod;
                if (hm > 0.5) { r.eegHeadPenalty = -(hm - 0.5) * r.difficulty * 1.2; score += r.eegHeadPenalty; }
                if (typeof neuro !== 'undefined' && typeof neuro.getCharBrainProfile === 'function') {
                    var bp2 = neuro.getCharBrainProfile(char);
                    if (bp2) {
                        if (bp2.mlUnfocusedAccuracy !== null && bp2.mlUnfocusedAccuracy < 0.5 && fb > 0.3) r.eegBrainProfile += 0.8;
                        if (bp2.fragile && fb > 0) r.eegBrainProfile += 0.5;
                        r.brainFragile = !!bp2.fragile;
                    }
                }
                score += r.eegBrainProfile;
            }
        }
        r.total = score;
        snapEEG(r);
        return r;
    }

    function snapEEG(r) {
        if (typeof eeg !== 'undefined' && eeg.state) {
            r.eegEngagement = eeg.state.engagement || null;
            r.eegRelaxation = eeg.state.relaxation || null;
            r.eegMlLabel = typeof eeg.getMLFocusLabel === 'function' ? eeg.getMLFocusLabel() : null;
            r.eegHeadMovement = eeg.state.headMovement || null;
        }
    }

    // ── Capture on question serve ──────────────────────────────────────

    function capture() {
        if (typeof schedulerMode === 'undefined' || typeof SCHEDULER_MODES === 'undefined') return;
        var isFeed = schedulerMode === SCHEDULER_MODES.FEED ||
            schedulerMode === SCHEDULER_MODES.FEED_SR ||
            schedulerMode === SCHEDULER_MODES.FEED_EEG;
        if (!isFeed) { hide(); return; }
        if (typeof feedModeState === 'undefined' || !feedModeState.hand) return;
        if (typeof currentQuestion === 'undefined' || !currentQuestion) return;

        var chosen = currentQuestion.char;
        var scores = [];
        for (var i = 0; i < feedModeState.hand.length; i++) {
            var d = decompose(feedModeState.hand[i]);
            if (d) scores.push(d);
        }
        scores.sort(function (a, b) { return b.total - a.total; });

        lastData = {
            chosen: chosen,
            winner: scores.length ? scores[0] : null,
            chosenData: null,
            runners: [],
            isEEG: schedulerMode === SCHEDULER_MODES.FEED_EEG,
            handSize: feedModeState.hand.length,
        };
        for (var j = 0; j < scores.length; j++) {
            if (scores[j].char === chosen) lastData.chosenData = scores[j];
            else if (lastData.runners.length < 3) lastData.runners.push(scores[j]);
        }
        if (!lastData.chosenData && scores.length) lastData.chosenData = scores[0];

        render();
    }

    // ── Panel creation ─────────────────────────────────────────────────

    function ensurePanel() {
        if (panelEl) return;
        panelEl = document.createElement('div');
        panelEl.id = PANEL_ID;
        Object.assign(panelEl.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            bottom: '0',
            width: '220px',
            zIndex: '9998',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            fontSize: '11px',
            background: 'rgba(18, 18, 22, 0.92)',
            color: '#ccc',
            padding: '10px 12px',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            overflowY: 'auto',
            lineHeight: '1.45',
            backdropFilter: 'blur(10px)',
            display: 'none',
        });
        document.body.appendChild(panelEl);

        // push page content right
        var style = document.createElement('style');
        style.textContent = '#' + PANEL_ID + ':not([hidden]) ~ *, body.eeg-panel-open .app-container { margin-left: 220px; }';
        document.head.appendChild(style);
    }

    function show() {
        ensurePanel();
        panelEl.style.display = '';
        document.body.classList.add('eeg-panel-open');
    }

    function hide() {
        if (panelEl) panelEl.style.display = 'none';
        document.body.classList.remove('eeg-panel-open');
    }

    // ── Rendering ──────────────────────────────────────────────────────

    function bar(val, max, color) {
        var pct = max > 0 ? Math.min(100, Math.max(0, val / max * 100)) : 0;
        return '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin:1px 0">' +
            '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:2px"></div></div>';
    }

    function factorLine(label, val, max, color) {
        if (Math.abs(val) < 0.005) return '';
        var sign = val < 0 ? '−' : '+';
        return '<div style="margin:3px 0">' +
            '<div style="display:flex;justify-content:space-between;font-size:10px">' +
            '<span style="color:#888">' + label + '</span>' +
            '<span style="color:' + color + '">' + sign + Math.abs(val).toFixed(2) + '</span></div>' +
            bar(Math.abs(val), max, color) + '</div>';
    }

    function render() {
        if (!lastData || !lastData.chosenData) return;
        show();

        var d = lastData.chosenData;
        var html = [];

        // ── Header
        html.push('<div style="font-weight:700;font-size:12px;color:#9575cd;margin-bottom:6px">');
        html.push(lastData.isEEG ? '🧠 Why this card?' : '📊 Why this card?');
        html.push('</div>');

        // ── Chosen character
        var charLabel = d.char;
        if (typeof quizCharacters !== 'undefined' && Array.isArray(quizCharacters)) {
            var found = quizCharacters.find(function (q) { return q.char === d.char; });
            if (found && found.meaning) charLabel += ' <span style="color:#777;font-size:11px">' + found.meaning + '</span>';
        }
        html.push('<div style="font-size:18px;font-weight:600;margin:4px 0">' + charLabel + '</div>');

        // ── Stats
        if (!d.isUnseen) {
            var bits = [];
            if (d.sessionAcc !== null) bits.push(Math.round(d.sessionAcc * 100) + '% acc');
            if (d.attempts) bits.push(d.attempts + '×');
            if (d.recallProb !== null) bits.push('P=' + d.recallProb.toFixed(2));
            if (bits.length) html.push('<div style="font-size:10px;color:#777;margin-bottom:4px">' + bits.join(' · ') + '</div>');
        } else {
            html.push('<div style="font-size:10px;color:#777;margin-bottom:4px">New card</div>');
        }

        // ── Score total
        html.push('<div style="font-size:14px;font-weight:700;color:#e0e0e0;margin:4px 0 8px">' + d.total.toFixed(2) + ' <span style="font-size:10px;color:#666;font-weight:400">score</span></div>');

        // ── Factors
        var mx = Math.max(d.total, 1);
        html.push(factorLine('Urgency', d.urgency * 1.6, mx, '#ff7043'));
        html.push(factorLine('Difficulty', d.difficulty * 0.75, mx, '#ffb74d'));
        html.push(factorLine('Explore', d.exploration * 0.5, mx, '#4fc3f7'));
        html.push(factorLine('Due boost', d.dueBoost, mx, '#ff7043'));
        html.push(factorLine('New card', d.freshBoost, mx, '#78909c'));
        html.push(factorLine('SR boost', d.srBoost, mx, '#26c6da'));
        html.push(factorLine('Marking', d.markingBoost, mx, d.markingBoost > 0 ? '#ef5350' : '#546e7a'));
        html.push(factorLine('🧠 Focus', d.eegFocusMod, mx, '#9575cd'));
        html.push(factorLine('🧠 Bias', d.eegDifficultyBias, mx, '#9575cd'));
        html.push(factorLine('🧠 Brain', d.eegBrainProfile, mx, '#66bb6a'));
        html.push(factorLine('🤯 Fidget', d.eegHeadPenalty, mx, '#ef5350'));
        if (d.brainFragile) html.push('<div style="font-size:9px;color:#ffb74d;margin-top:2px">⚠ Fragile</div>');

        // ── EEG state (if active)
        if (lastData.isEEG && d.eegEngagement !== null) {
            html.push('<div style="margin-top:8px;padding:6px;background:rgba(149,117,205,0.08);border-radius:5px;font-size:10px">');
            html.push('Focus <b style="color:#4fc3f7">' + Math.round((d.eegEngagement || 0) * 100) + '%</b> · ');
            html.push('Calm <b style="color:#9575cd">' + Math.round((d.eegRelaxation || 0) * 100) + '%</b>');
            if (d.eegMlLabel) html.push(' · ML: <b>' + d.eegMlLabel + '</b>');
            if (!d.eegSignalOk) html.push('<div style="color:#ef5350;margin-top:2px">⚠ Poor signal</div>');
            html.push('</div>');
        }

        // ── Runners up (compact)
        if (lastData.runners.length) {
            html.push('<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.06);padding-top:6px">');
            html.push('<div style="font-size:9px;color:#666;margin-bottom:4px">Also considered (' + lastData.handSize + ' in hand)</div>');
            for (var i = 0; i < lastData.runners.length; i++) {
                var ru = lastData.runners[i];
                var ruLabel = ru.char;
                if (typeof quizCharacters !== 'undefined' && Array.isArray(quizCharacters)) {
                    var f2 = quizCharacters.find(function (q) { return q.char === ru.char; });
                    if (f2 && f2.meaning) ruLabel += ' ' + f2.meaning;
                }
                html.push('<div style="display:flex;justify-content:space-between;font-size:10px;padding:2px 0;color:#888">');
                html.push('<span>' + ruLabel + '</span>');
                html.push('<span>' + ru.total.toFixed(1) + '</span>');
                html.push('</div>');
            }
            html.push('</div>');
        }

        panelEl.innerHTML = html.join('');
    }

    // ── Hooks ──────────────────────────────────────────────────────────

    function hookEvents() {
        document.addEventListener('feed-question-served', function () {
            setTimeout(capture, 5);
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            if (!panelEl || panelEl.style.display === 'none') {
                ensurePanel();
                show();
                if (lastData) render();
            } else {
                hide();
            }
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(hookEvents, 500); });
    } else {
        setTimeout(hookEvents, 500);
    }

    window.eegDecision = {
        capture: capture,
        getLastDecision: function () { return lastData; },
        show: function () { show(); if (lastData) render(); },
        hide: hide,
        decompose: decompose,
    };

})();
