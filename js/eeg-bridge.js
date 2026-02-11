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
    let _focusDipNotified = 0;

    function getBlinkRate() {
        var now = Date.now();
        var cutoff = now - 60000;
        _blinkTimestamps = _blinkTimestamps.filter(function (t) { return t > cutoff; });
        return _blinkTimestamps.length;
    }

    function getFocusZone(engagement, relaxation) {
        if (engagement >= 0.4) return { label: 'Deep Focus', color: '#4fc3f7', icon: '🎯' };
        if (engagement >= 0.2) return { label: 'Focused', color: '#66bb6a', icon: '✅' };
        if (engagement >= 0.1 && relaxation < 0.7) return { label: 'Light Focus', color: '#ffb74d', icon: '💡' };
        if (relaxation >= 0.7) return { label: 'Relaxed', color: '#9575cd', icon: '😌' };
        return { label: 'Drifting', color: '#ef5350', icon: '💤' };
    }

    function getSessionMinutes() {
        return Math.floor((Date.now() - _sessionStartTime) / 60000);
    }

    function getFatigueLevel(blinkRate, sessionMin) {
        if (blinkRate > 30 && sessionMin > 45) return { label: 'Take a break', color: '#ef5350' };
        if (blinkRate > 25 && sessionMin > 30) return { label: 'Getting tired', color: '#ffb74d' };
        return null;
    }

    // Overlay UI
    function createOverlay() {
        if (overlayEl) return;
        overlayEl = document.createElement('div');
        overlayEl.id = 'eeg-overlay';
        overlayEl.style.cssText = [
            'position: fixed',
            'bottom: 12px',
            'right: 12px',
            'z-index: 9999',
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            'font-size: 12px',
            'background: rgba(30, 30, 30, 0.92)',
            'color: #e0e0e0',
            'padding: 10px 14px',
            'border-radius: 10px',
            'border: 1px solid rgba(255,255,255,0.1)',
            'backdrop-filter: blur(8px)',
            'pointer-events: auto',
            'cursor: pointer',
            'transition: all 200ms ease',
            'min-width: 150px',
            'line-height: 1.5',
        ].join(';');
        overlayEl.title = 'Click to expand/collapse';

        var expanded = false;
        overlayEl.addEventListener('click', function () {
            expanded = !expanded;
            overlayEl.dataset.expanded = expanded ? '1' : '';
            updateOverlay();
        });

        document.body.appendChild(overlayEl);
    }

    function updateOverlay() {
        if (!overlayEl) return;
        var expanded = overlayEl.dataset.expanded === '1';

        if (!state.connected) {
            overlayEl.innerHTML = '<span style="color:#78909c">🧠 EEG offline</span>';
            overlayEl.style.borderColor = 'rgba(120,144,156,0.3)';
            return;
        }

        if (!state.museConnected || !state.ready) {
            overlayEl.innerHTML = '<span style="color:#ffb74d">🧠 Connecting to Muse…</span>';
            overlayEl.style.borderColor = 'rgba(255,183,77,0.3)';
            return;
        }

        var engAvg = rollingAvg(state._engagementHistory);
        var relAvg = rollingAvg(state._relaxationHistory);
        var zone = getFocusZone(engAvg, relAvg);
        var blinkRate = getBlinkRate();
        var sessionMin = getSessionMinutes();
        var fatigue = getFatigueLevel(blinkRate, sessionMin);

        overlayEl.style.borderColor = zone.color.replace(')', ', 0.4)').replace('rgb', 'rgba');

        if (!expanded) {
            var html = '<span style="color:' + zone.color + '">' + zone.icon + ' ' + zone.label + '</span>';
            if (fatigue) {
                html += ' <span style="color:' + fatigue.color + ';font-size:10px">⚠ ' + fatigue.label + '</span>';
            }
            overlayEl.innerHTML = html;
            return;
        }

        // Expanded view — study-relevant info
        var engBar = makeBar(engAvg, '#4fc3f7');
        var relBar = makeBar(relAvg, '#9575cd');

        var lines = [
            '<div style="font-weight:600;color:' + zone.color + ';margin-bottom:4px">' + zone.icon + ' ' + zone.label + '</div>',
            '<div style="display:flex;justify-content:space-between;align-items:center"><span>Focus</span>' + engBar + '</div>',
            '<div style="display:flex;justify-content:space-between;align-items:center"><span>Calm</span>' + relBar + '</div>',
            '<div style="margin-top:4px;color:#b0bec5;font-size:11px">Blinks: ' + blinkRate + '/min · ' + sessionMin + ' min session</div>',
        ];

        if (fatigue) {
            lines.push('<div style="margin-top:3px;color:' + fatigue.color + ';font-weight:600">⚠ ' + fatigue.label + '</div>');
        }

        lines.push('<div style="margin-top:3px;color:#546e7a;font-size:10px">🔋 ' + state.battery.toFixed(0) + '%</div>');

        overlayEl.innerHTML = lines.join('');
    }

    function makeBar(value, color) {
        var pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
        return '<div style="display:inline-flex;align-items:center;gap:5px;margin-left:8px">' +
            '<div style="width:60px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">' +
            '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px;transition:width 0.5s"></div>' +
            '</div>' +
            '<span style="font-size:10px;color:' + color + ';min-width:28px;text-align:right">' + pct + '%</span>' +
            '</div>';
    }

    // Auto-start
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
