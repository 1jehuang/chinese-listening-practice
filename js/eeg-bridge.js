// EEG Bridge Client — connects to the Muse EEG WebSocket server
// and provides real-time brain metrics to the quiz engine.
//
// Usage:
//   <script src="js/eeg-bridge.js"></script>
//   // Auto-connects on load. Access via window.eeg

(function () {
    'use strict';

    const WS_URL = 'ws://localhost:8765';
    const RECONNECT_DELAY_MS = 3000;
    const SESSION_LOG_KEY = 'eeg_quiz_session';

    const state = {
        connected: false,
        museConnected: false,
        ready: false,
        bands: null,         // { delta, theta, alpha, beta, gamma } in dB
        engagement: 0,       // β / (α + θ)
        relaxation: 0,       // α / (α + β)
        alphaAsymmetry: 0,   // log(right_α) - log(left_α)
        blinkTotal: 0,
        lastBlink: false,
        battery: 0,
        ts: 0,
        // Rolling averages (5-second window for smoothing)
        _engagementHistory: [],
        _relaxationHistory: [],
        _asymmetryHistory: [],
        _historyMaxLen: 20,  // 20 samples × 250ms = 5s
    };

    let ws = null;
    let reconnectTimer = null;
    let sessionLog = [];
    let overlayEl = null;
    let listeners = [];

    function connect() {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

        try {
            ws = new WebSocket(WS_URL);
        } catch (e) {
            scheduleReconnect();
            return;
        }

        ws.onopen = function () {
            state.connected = true;
            updateOverlay();
            console.log('[EEG] Connected to bridge');
        };

        ws.onmessage = function (event) {
            try {
                const m = JSON.parse(event.data);
                state.ts = m.ts || Date.now() / 1000;
                state.museConnected = Boolean(m.connected);
                state.ready = Boolean(m.ready);
                state.battery = m.battery || 0;
                state.blinkTotal = m.blink_total || 0;
                state.lastBlink = Boolean(m.blink);

                if (m.bands) {
                    state.bands = m.bands;
                }
                if (m.engagement !== undefined) {
                    state.engagement = m.engagement;
                    pushRolling(state._engagementHistory, m.engagement);
                }
                if (m.relaxation !== undefined) {
                    state.relaxation = m.relaxation;
                    pushRolling(state._relaxationHistory, m.relaxation);
                }
                if (m.alpha_asymmetry !== undefined) {
                    state.alphaAsymmetry = m.alpha_asymmetry;
                    pushRolling(state._asymmetryHistory, m.alpha_asymmetry);
                }

                if (state.lastBlink) {
                    _blinkTimestamps.push(Date.now());
                    fireEvent('blink', { total: state.blinkTotal, ts: state.ts });
                }

                updateOverlay();
                fireEvent('update', snapshot());
            } catch (e) {
                // ignore parse errors
            }
        };

        ws.onclose = function () {
            state.connected = false;
            updateOverlay();
            scheduleReconnect();
        };

        ws.onerror = function () {
            // onclose will fire after this
        };
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(function () {
            reconnectTimer = null;
            connect();
        }, RECONNECT_DELAY_MS);
    }

    function pushRolling(arr, val) {
        arr.push(val);
        if (arr.length > state._historyMaxLen) arr.shift();
    }

    function rollingAvg(arr) {
        if (!arr.length) return 0;
        let sum = 0;
        for (let i = 0; i < arr.length; i++) sum += arr[i];
        return sum / arr.length;
    }

    // Public: get a snapshot of the current EEG state
    function snapshot() {
        return {
            ts: state.ts,
            connected: state.connected,
            museConnected: state.museConnected,
            ready: state.ready,
            bands: state.bands ? Object.assign({}, state.bands) : null,
            engagement: state.engagement,
            engagementAvg: rollingAvg(state._engagementHistory),
            relaxation: state.relaxation,
            relaxationAvg: rollingAvg(state._relaxationHistory),
            alphaAsymmetry: state.alphaAsymmetry,
            asymmetryAvg: rollingAvg(state._asymmetryHistory),
            blinkTotal: state.blinkTotal,
            battery: state.battery,
        };
    }

    // Public: log a quiz event with correlated EEG snapshot
    function logQuizEvent(eventType, detail) {
        const entry = {
            eventType: eventType,
            time: Date.now(),
            eeg: snapshot(),
            detail: detail || {},
        };
        sessionLog.push(entry);
        saveSessionLog();
        fireEvent('quiz-event', entry);
        return entry;
    }

    function saveSessionLog() {
        try {
            const key = SESSION_LOG_KEY + '_' + getSessionId();
            localStorage.setItem(key, JSON.stringify(sessionLog));
        } catch (e) { /* quota exceeded, etc */ }
    }

    function getSessionId() {
        let id = sessionStorage.getItem('eeg_session_id');
        if (!id) {
            id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            sessionStorage.setItem('eeg_session_id', id);
        }
        return id;
    }

    // Public: export the full session log
    function exportLog() {
        return {
            sessionId: getSessionId(),
            startTime: sessionLog.length ? sessionLog[0].time : null,
            events: sessionLog.slice(),
        };
    }

    // Public: download session log as JSON
    function downloadLog() {
        const data = exportLog();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'eeg-quiz-session-' + getSessionId() + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Event system
    function on(event, callback) {
        listeners.push({ event: event, fn: callback });
    }

    function off(event, callback) {
        listeners = listeners.filter(function (l) {
            return !(l.event === event && l.fn === callback);
        });
    }

    function fireEvent(event, data) {
        for (let i = 0; i < listeners.length; i++) {
            if (listeners[i].event === event) {
                try { listeners[i].fn(data); } catch (e) { console.warn('[EEG] listener error:', e); }
            }
        }
    }

    // Blink rate tracking (blinks per minute, rolling 60s window)
    let _blinkTimestamps = [];
    let _sessionStartTime = Date.now();

    // Per-session quiz tracking for the overlay
    let _quizAnswers = [];         // { ts, correct, responseMs, engagement, char }
    let _focusHistory = [];        // rolling engagement samples for sparkline
    let _focusHistoryMaxLen = 120; // 120 × 250ms = 30s of sparkline data
    let _peakEngagement = 0;
    let _engagementBaseline = null; // calibrated after first 20 samples

    function getBlinkRate() {
        var now = Date.now();
        _blinkTimestamps = _blinkTimestamps.filter(function (t) { return t > now - 60000; });
        return _blinkTimestamps.length;
    }

    function getFocusZone(engagement, relaxation) {
        if (engagement >= 0.4) return { label: 'Deep Focus', color: '#4fc3f7', icon: '🎯', level: 4 };
        if (engagement >= 0.2) return { label: 'Focused', color: '#66bb6a', icon: '✅', level: 3 };
        if (engagement >= 0.1 && relaxation < 0.7) return { label: 'Light Focus', color: '#ffb74d', icon: '💡', level: 2 };
        if (relaxation >= 0.7) return { label: 'Relaxed', color: '#9575cd', icon: '😌', level: 1 };
        return { label: 'Drifting', color: '#ef5350', icon: '💤', level: 0 };
    }

    function getSessionMinutes() {
        return Math.floor((Date.now() - _sessionStartTime) / 60000);
    }

    function getFatigueLevel(blinkRate, sessionMin) {
        if (blinkRate > 30 && sessionMin > 45) return { label: 'Take a break!', color: '#ef5350' };
        if (blinkRate > 25 && sessionMin > 30) return { label: 'Getting tired', color: '#ffb74d' };
        return null;
    }

    function getQuizStats() {
        var answers = _quizAnswers;
        if (!answers.length) return null;
        var correct = 0;
        var totalMs = 0;
        var count = answers.length;
        var recent = answers.slice(-10);
        var recentCorrect = 0;
        var recentMs = 0;
        var focusedCorrect = 0;
        var focusedTotal = 0;
        var unfocusedCorrect = 0;
        var unfocusedTotal = 0;

        for (var i = 0; i < count; i++) {
            if (answers[i].correct) correct++;
            totalMs += answers[i].responseMs || 0;
            if (answers[i].engagement >= 0.2) {
                focusedTotal++;
                if (answers[i].correct) focusedCorrect++;
            } else {
                unfocusedTotal++;
                if (answers[i].correct) unfocusedCorrect++;
            }
        }
        for (var j = 0; j < recent.length; j++) {
            if (recent[j].correct) recentCorrect++;
            recentMs += recent[j].responseMs || 0;
        }

        return {
            total: count,
            correct: correct,
            accuracy: count > 0 ? Math.round(correct / count * 100) : 0,
            avgResponseMs: count > 0 ? Math.round(totalMs / count) : 0,
            recentAccuracy: recent.length > 0 ? Math.round(recentCorrect / recent.length * 100) : 0,
            recentAvgMs: recent.length > 0 ? Math.round(recentMs / recent.length) : 0,
            focusedAccuracy: focusedTotal > 0 ? Math.round(focusedCorrect / focusedTotal * 100) : null,
            unfocusedAccuracy: unfocusedTotal > 0 ? Math.round(unfocusedCorrect / unfocusedTotal * 100) : null,
            focusedTotal: focusedTotal,
            unfocusedTotal: unfocusedTotal,
        };
    }

    function buildSparkline(data, width, height, color) {
        if (!data || data.length < 2) return '';
        var min = Infinity, max = -Infinity;
        for (var i = 0; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }
        var range = max - min || 1;
        var step = width / (data.length - 1);
        var points = [];
        for (var j = 0; j < data.length; j++) {
            var x = (j * step).toFixed(1);
            var y = (height - ((data[j] - min) / range) * height).toFixed(1);
            points.push(x + ',' + y);
        }
        return '<svg width="' + width + '" height="' + height + '" style="display:block">' +
            '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>';
    }

    // Track quiz answers from the event system
    on('quiz-event', function (entry) {
        if (entry.eventType === 'answer' && entry.detail) {
            _quizAnswers.push({
                ts: entry.time,
                correct: Boolean(entry.detail.correct),
                responseMs: entry.detail.responseMs || 0,
                engagement: entry.eeg ? entry.eeg.engagement : 0,
                char: entry.detail.char || '',
            });
        }
    });

    // Overlay UI
    var panelEl = null;

    function createOverlay() {
        if (overlayEl) return;

        // Small toggle button
        overlayEl = document.createElement('div');
        overlayEl.id = 'eeg-toggle';
        overlayEl.style.cssText = [
            'position: fixed',
            'bottom: 12px',
            'right: 12px',
            'z-index: 10000',
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            'font-size: 12px',
            'background: rgba(30, 30, 30, 0.92)',
            'color: #e0e0e0',
            'padding: 8px 12px',
            'border-radius: 10px',
            'border: 1px solid rgba(255,255,255,0.15)',
            'backdrop-filter: blur(8px)',
            'cursor: pointer',
            'transition: all 200ms ease',
            'user-select: none',
        ].join(';');

        overlayEl.addEventListener('click', function () {
            if (panelEl) {
                var visible = panelEl.style.display !== 'none';
                panelEl.style.display = visible ? 'none' : 'block';
                overlayEl.style.display = visible ? '' : 'none';
            }
        });

        // Expanded panel
        panelEl = document.createElement('div');
        panelEl.id = 'eeg-panel';
        panelEl.style.cssText = [
            'position: fixed',
            'bottom: 12px',
            'right: 12px',
            'z-index: 10000',
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            'font-size: 12px',
            'background: rgba(22, 22, 26, 0.95)',
            'color: #e0e0e0',
            'padding: 14px 16px',
            'border-radius: 12px',
            'border: 1px solid rgba(255,255,255,0.1)',
            'backdrop-filter: blur(12px)',
            'width: 260px',
            'max-height: 90vh',
            'overflow-y: auto',
            'line-height: 1.5',
            'display: none',
        ].join(';');

        // Close button inside panel
        var closeBtn = document.createElement('div');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'position:absolute;top:8px;right:10px;cursor:pointer;color:#78909c;font-size:14px;';
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            panelEl.style.display = 'none';
            overlayEl.style.display = '';
        });
        panelEl.appendChild(closeBtn);

        document.body.appendChild(overlayEl);
        document.body.appendChild(panelEl);
    }

    function updateOverlay() {
        if (!overlayEl) return;

        // Update the small toggle button
        if (!state.connected) {
            overlayEl.innerHTML = '<span style="color:#78909c">🧠 EEG offline</span>';
            overlayEl.style.borderColor = 'rgba(120,144,156,0.3)';
            if (panelEl) panelEl.style.display = 'none';
            overlayEl.style.display = '';
            return;
        }

        if (!state.museConnected || !state.ready) {
            overlayEl.innerHTML = '<span style="color:#ffb74d">🧠 Connecting…</span>';
            overlayEl.style.borderColor = 'rgba(255,183,77,0.3)';
            return;
        }

        var engAvg = rollingAvg(state._engagementHistory);
        var relAvg = rollingAvg(state._relaxationHistory);
        var zone = getFocusZone(engAvg, relAvg);

        // Update toggle button
        overlayEl.style.borderColor = zone.color + '66';
        overlayEl.innerHTML = '<span style="color:' + zone.color + '">' + zone.icon + ' ' + zone.label + '</span>';

        // Track focus history for sparkline
        _focusHistory.push(engAvg);
        if (_focusHistory.length > _focusHistoryMaxLen) _focusHistory.shift();
        if (engAvg > _peakEngagement) _peakEngagement = engAvg;

        // Calibrate baseline from first 20 samples
        if (!_engagementBaseline && state._engagementHistory.length >= 20) {
            _engagementBaseline = rollingAvg(state._engagementHistory);
        }

        // Update expanded panel
        if (!panelEl || panelEl.style.display === 'none') return;

        var blinkRate = getBlinkRate();
        var sessionMin = getSessionMinutes();
        var fatigue = getFatigueLevel(blinkRate, sessionMin);
        var quizStats = getQuizStats();
        var asym = state.alphaAsymmetry;
        var bands = state.bands || {};

        var html = [];

        // Header with zone
        html.push('<div style="font-weight:700;font-size:14px;color:' + zone.color + ';margin-bottom:8px;padding-right:20px">' + zone.icon + ' ' + zone.label + '</div>');

        // Focus sparkline (30 seconds)
        html.push('<div style="margin-bottom:8px">');
        html.push('<div style="color:#78909c;font-size:10px;margin-bottom:2px">FOCUS (last 30s)</div>');
        html.push(buildSparkline(_focusHistory, 228, 28, zone.color));
        html.push('</div>');

        // Focus & Calm bars
        html.push(metricBar('Focus', engAvg, '#4fc3f7'));
        html.push(metricBar('Calm', relAvg, '#9575cd'));

        // Brain waves section
        html.push('<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">');
        html.push('<div style="color:#78909c;font-size:10px;margin-bottom:4px">BRAIN WAVES</div>');
        html.push(waveBars(bands));
        html.push('</div>');

        // Asymmetry
        var asymLabel = asym > 0.2 ? 'Approach ↗' : asym < -0.2 ? 'Withdraw ↙' : 'Balanced';
        var asymColor = asym > 0.2 ? '#66bb6a' : asym < -0.2 ? '#ef5350' : '#78909c';
        html.push('<div style="margin-top:6px;display:flex;justify-content:space-between">');
        html.push('<span style="color:#78909c">L/R Balance</span>');
        html.push('<span style="color:' + asymColor + '">' + asymLabel + ' (' + asym.toFixed(2) + ')</span>');
        html.push('</div>');

        // Blink rate & session
        html.push('<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">');
        html.push('<div style="color:#78909c;font-size:10px;margin-bottom:4px">BODY</div>');
        html.push('<div style="display:flex;justify-content:space-between">');
        html.push('<span>Blink rate</span><span>' + blinkRate + '/min</span>');
        html.push('</div>');
        html.push('<div style="display:flex;justify-content:space-between">');
        html.push('<span>Session</span><span>' + sessionMin + ' min</span>');
        html.push('</div>');
        if (fatigue) {
            html.push('<div style="color:' + fatigue.color + ';font-weight:600;margin-top:4px">⚠ ' + fatigue.label + '</div>');
        }
        html.push('</div>');

        // Quiz performance correlated with EEG
        if (quizStats && quizStats.total > 0) {
            html.push('<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">');
            html.push('<div style="color:#78909c;font-size:10px;margin-bottom:4px">QUIZ × BRAIN</div>');

            html.push('<div style="display:flex;justify-content:space-between">');
            html.push('<span>Accuracy</span><span>' + quizStats.accuracy + '% (' + quizStats.correct + '/' + quizStats.total + ')</span>');
            html.push('</div>');

            html.push('<div style="display:flex;justify-content:space-between">');
            html.push('<span>Avg response</span><span>' + formatMs(quizStats.avgResponseMs) + '</span>');
            html.push('</div>');

            if (quizStats.total >= 5) {
                html.push('<div style="display:flex;justify-content:space-between">');
                html.push('<span>Last 10</span><span>' + quizStats.recentAccuracy + '% · ' + formatMs(quizStats.recentAvgMs) + '</span>');
                html.push('</div>');
            }

            // The key insight: accuracy when focused vs unfocused
            if (quizStats.focusedTotal >= 3 && quizStats.unfocusedTotal >= 3) {
                var focusColor = '#4fc3f7';
                var unfocusColor = '#ef5350';
                html.push('<div style="margin-top:6px;padding:6px 8px;background:rgba(255,255,255,0.04);border-radius:6px">');
                html.push('<div style="font-size:10px;color:#78909c;margin-bottom:3px">FOCUS IMPACT</div>');
                html.push('<div style="display:flex;justify-content:space-between">');
                html.push('<span style="color:' + focusColor + '">Focused</span>');
                html.push('<span style="color:' + focusColor + '">' + quizStats.focusedAccuracy + '% (' + quizStats.focusedTotal + ' q)</span>');
                html.push('</div>');
                html.push('<div style="display:flex;justify-content:space-between">');
                html.push('<span style="color:' + unfocusColor + '">Unfocused</span>');
                html.push('<span style="color:' + unfocusColor + '">' + quizStats.unfocusedAccuracy + '% (' + quizStats.unfocusedTotal + ' q)</span>');
                html.push('</div>');
                html.push('</div>');
            }

            html.push('</div>');
        }

        // Baseline comparison
        if (_engagementBaseline !== null) {
            var vsBaseline = engAvg - _engagementBaseline;
            var bColor = vsBaseline > 0.05 ? '#66bb6a' : vsBaseline < -0.05 ? '#ef5350' : '#78909c';
            var bLabel = vsBaseline > 0.05 ? 'Above baseline ↑' : vsBaseline < -0.05 ? 'Below baseline ↓' : 'At baseline';
            html.push('<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between">');
            html.push('<span style="color:#78909c;font-size:10px">vs. your baseline</span>');
            html.push('<span style="color:' + bColor + ';font-size:11px">' + bLabel + '</span>');
            html.push('</div>');
        }

        // Battery
        html.push('<div style="margin-top:6px;color:#546e7a;font-size:10px;text-align:right">🔋 ' + state.battery.toFixed(0) + '%</div>');

        // Keep the close button, replace everything after it
        while (panelEl.childNodes.length > 1) {
            panelEl.removeChild(panelEl.lastChild);
        }
        var content = document.createElement('div');
        content.innerHTML = html.join('');
        panelEl.appendChild(content);
    }

    function metricBar(label, value, color) {
        var pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
        return '<div style="display:flex;align-items:center;justify-content:space-between;margin:3px 0">' +
            '<span style="min-width:40px">' + label + '</span>' +
            '<div style="flex:1;margin:0 8px;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">' +
            '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px;transition:width 0.4s"></div>' +
            '</div>' +
            '<span style="font-size:10px;color:' + color + ';min-width:30px;text-align:right">' + pct + '%</span>' +
            '</div>';
    }

    function waveBars(bands) {
        var names = ['δ', 'θ', 'α', 'β', 'γ'];
        var keys = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        var colors = ['#9575cd', '#4fc3f7', '#66bb6a', '#ffb74d', '#ef5350'];
        var minDb = -20, maxDb = 15;
        var html = '<div style="display:flex;gap:4px;align-items:flex-end;height:32px">';
        for (var i = 0; i < keys.length; i++) {
            var v = bands[keys[i]];
            var pct = v !== undefined ? Math.round(Math.max(0, Math.min(1, (v - minDb) / (maxDb - minDb))) * 100) : 0;
            html += '<div style="flex:1;text-align:center">';
            html += '<div style="height:24px;display:flex;align-items:flex-end;justify-content:center">';
            html += '<div style="width:100%;height:' + pct + '%;background:' + colors[i] + ';border-radius:2px 2px 0 0;min-height:2px;transition:height 0.3s"></div>';
            html += '</div>';
            html += '<div style="font-size:9px;color:' + colors[i] + ';margin-top:2px">' + names[i] + '</div>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function formatMs(ms) {
        if (!ms) return '—';
        return (ms / 1000).toFixed(1) + 's';
    }

    // Auto-start
    // Page visibility tracking — know when user is actually on this tab
    let _pageVisible = !document.hidden;
    let _visibilityLog = [];     // { ts, visible }
    let _totalVisibleMs = 0;
    let _lastVisibleStart = _pageVisible ? Date.now() : null;

    document.addEventListener('visibilitychange', function () {
        var now = Date.now();
        _pageVisible = !document.hidden;
        _visibilityLog.push({ ts: now, visible: _pageVisible });

        if (_pageVisible) {
            _lastVisibleStart = now;
        } else if (_lastVisibleStart) {
            _totalVisibleMs += now - _lastVisibleStart;
            _lastVisibleStart = null;
        }

        if (typeof eeg !== 'undefined' && eeg.logQuizEvent) {
            eeg.logQuizEvent(_pageVisible ? 'tab-focus' : 'tab-blur', {});
        }
    });

    function getActiveStudyMinutes() {
        var active = _totalVisibleMs;
        if (_pageVisible && _lastVisibleStart) {
            active += Date.now() - _lastVisibleStart;
        }
        return Math.floor(active / 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            createOverlay();
            connect();
        });
    } else {
        createOverlay();
        connect();
    }

    // Public API
    window.eeg = {
        snapshot: snapshot,
        logQuizEvent: logQuizEvent,
        exportLog: exportLog,
        downloadLog: downloadLog,
        on: on,
        off: off,
        state: state,
        getSessionId: getSessionId,
    };
})();
