// EEG Decision Factors
// Shows why the current card was chosen in any Feed mode.
// Renders a slim left-edge panel with score components.
// Auto-shows in feed modes, auto-hides otherwise.
//
// Depends on: quiz-engine.js, eeg-bridge.js, eeg-neuro.js

(function () {
    'use strict';

    var PANEL_ID = 'eeg-decision-panel';
    var STORAGE_KEY = 'decision_panel_visible';
    var panelEl = null;
    var lastData = null;
    var uiLoadPromise = null;

    function ensureUiLibrary() {
        if (window.JcodeEegDecisionUI && window.JcodeEegDecisionUI.render) {
            return Promise.resolve(window.JcodeEegDecisionUI);
        }
        if (uiLoadPromise) return uiLoadPromise;
        uiLoadPromise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = 'js/eeg-decision-ui.js';
            script.async = true;
            script.onload = function () {
                if (window.JcodeEegDecisionUI && window.JcodeEegDecisionUI.render) resolve(window.JcodeEegDecisionUI);
                else reject(new Error('EEG decision UI loaded but renderer is unavailable.'));
            };
            script.onerror = function () { reject(new Error('Failed to load EEG decision UI bundle.')); };
            (document.head || document.body || document.documentElement).appendChild(script);
        }).finally(function () { uiLoadPromise = null; });
        return uiLoadPromise;
    }

    function isEnabled() {
        try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
        catch (e) { return false; }
    }

    function setEnabled(v) {
        try { localStorage.setItem(STORAGE_KEY, v ? 'true' : 'false'); }
        catch (e) { /* ignore */ }
    }

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
            top: '50%',
            right: '16px',
            transform: 'translateY(-50%)',
            zIndex: '9998',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            fontSize: '11px',
            background: 'rgba(18, 18, 22, 0.92)',
            color: '#ccc',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            overflowY: 'auto',
            maxHeight: '70vh',
            width: '210px',
            lineHeight: '1.45',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            display: 'none',
            pointerEvents: 'auto',
        });
        document.body.appendChild(panelEl);
    }

    function show() {
        ensurePanel();
        panelEl.style.display = '';
    }

    function hide() {
        if (panelEl) panelEl.style.display = 'none';
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
        if (!isEnabled()) { hide(); return; }
        show();

        var d = lastData.chosenData;
        // Figure out what we can safely show without spoiling the answer
        var m = (typeof mode !== 'undefined') ? mode : '';
        var showChar = true, showMeaning = true, showPinyin = true;
        if (/pinyin-to-char|meaning-to-char|draw-char|handwriting|stroke-order|char-building/.test(m)) showChar = false;
        if (/char-to-meaning|audio-to-meaning/.test(m)) showMeaning = false;
        if (/char-to-pinyin|audio-to-pinyin|char-to-tones/.test(m)) showPinyin = false;
        var charLabel = showChar ? d.char : '?';
        if (showChar && showMeaning && typeof quizCharacters !== 'undefined' && Array.isArray(quizCharacters)) {
            var found = quizCharacters.find(function (q) { return q.char === d.char; });
            if (found && found.meaning) charLabel += ' <span style="color:#777;font-size:11px">' + found.meaning + '</span>';
        }
        var statsLabel = '';
        if (!d.isUnseen) {
            var bits = [];
            if (d.sessionAcc !== null) bits.push(Math.round(d.sessionAcc * 100) + '% acc');
            if (d.attempts) bits.push(d.attempts + '×');
            if (d.recallProb !== null) bits.push('P=' + d.recallProb.toFixed(2));
            if (bits.length) statsLabel = bits.join(' · ');
        } else {
            statsLabel = 'New card';
        }
        var mx = Math.max(d.total, 1);
        var factors = [
            { label: 'Urgency', value: d.urgency * 1.6, max: mx, color: '#ff7043' },
            { label: 'Difficulty', value: d.difficulty * 0.75, max: mx, color: '#ffb74d' },
            { label: 'Explore', value: d.exploration * 0.5, max: mx, color: '#4fc3f7' },
            { label: 'Due boost', value: d.dueBoost, max: mx, color: '#ff7043' },
            { label: 'New card', value: d.freshBoost, max: mx, color: '#78909c' },
            { label: 'SR boost', value: d.srBoost, max: mx, color: '#26c6da' },
            { label: 'Marking', value: d.markingBoost, max: mx, color: d.markingBoost > 0 ? '#ef5350' : '#546e7a' },
            { label: '🧠 Focus', value: d.eegFocusMod, max: mx, color: '#9575cd' },
            { label: '🧠 Bias', value: d.eegDifficultyBias, max: mx, color: '#9575cd' },
            { label: '🧠 Brain', value: d.eegBrainProfile, max: mx, color: '#66bb6a' },
            { label: '🤯 Fidget', value: d.eegHeadPenalty, max: mx, color: '#ef5350' }
        ].filter(function (factor) { return Math.abs(factor.value) >= 0.005; });
        var eegSummary = lastData.isEEG && d.eegEngagement !== null
            ? {
                focus: Math.round((d.eegEngagement || 0) * 100),
                calm: Math.round((d.eegRelaxation || 0) * 100),
                mlLabel: d.eegMlLabel || '',
                signalOk: d.eegSignalOk !== false
            }
            : null;
        var runners = (lastData.runners || []).map(function (ru) {
            var ruLabel = showChar ? ru.char : '?';
            if (showChar && showMeaning && typeof quizCharacters !== 'undefined' && Array.isArray(quizCharacters)) {
                var foundRunner = quizCharacters.find(function (q) { return q.char === ru.char; });
                if (foundRunner && foundRunner.meaning) ruLabel += ' ' + foundRunner.meaning;
            }
            return { label: ruLabel, score: ru.total };
        });

        ensureUiLibrary()
            .then(function (ui) {
                ui.render(panelEl, {
                    title: lastData.isEEG ? '🧠 Why this card?' : '📊 Why this card?',
                    charLabel: charLabel,
                    statsLabel: statsLabel,
                    totalScore: d.total,
                    factors: factors,
                    fragile: !!d.brainFragile,
                    eegSummary: eegSummary,
                    runners: runners,
                    handSize: lastData.handSize || 0
                });
            })
            .catch(function (error) {
                console.error('Failed to render EEG decision UI:', error);
            });
    }

    // ── Hooks ──────────────────────────────────────────────────────────

    function hookEvents() {
        document.addEventListener('feed-question-served', function () {
            setTimeout(capture, 5);
        });
    }

    function toggle() {
        var nowEnabled = !isEnabled();
        setEnabled(nowEnabled);
        if (nowEnabled) {
            ensurePanel();
            show();
            if (lastData) render();
        } else {
            hide();
        }
    }

    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggle();
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
        show: function () { setEnabled(true); show(); if (lastData) render(); },
        hide: function () { setEnabled(false); hide(); },
        toggle: toggle,
        isEnabled: isEnabled,
        decompose: decompose,
    };

})();
