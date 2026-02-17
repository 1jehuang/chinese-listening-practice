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
        // ML focus model predictions from Python
        focusModel: null,    // { label, model, confidence, probs }
        // Signal quality per channel
        signalQuality: null, // { TP9: { clip_frac, std_uv, usable }, AF7: ..., AF8: ..., TP10: ... }
        // Head movement from accelerometer + gyroscope
        headMovement: 0,     // 0-1 normalized movement intensity
        headMovementRaw: null, // { accel: {x,y,z}, gyro: {x,y,z} }
        _accelHistory: [],   // rolling acceleration magnitude history
        _gyroHistory: [],    // rolling gyro magnitude history
        _movementHistoryMaxLen: 40, // 40 × 250ms = 10s window
        // Rolling averages (5-second window for smoothing)
        _engagementHistory: [],
        _relaxationHistory: [],
        _asymmetryHistory: [],
        _focusConfidenceHistory: [],
        _historyMaxLen: 20,  // 20 samples × 250ms = 5s
    };

    let ws = null;
    let reconnectTimer = null;
    let sessionLog = [];
    let overlayEl = null;
    let listeners = [];

    var _overlayRafPending = false;

    function scheduleOverlayUpdate() {
        if (_overlayRafPending) return;
        _overlayRafPending = true;
        requestAnimationFrame(function () {
            _overlayRafPending = false;
            updateOverlay();
        });
    }

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
            scheduleOverlayUpdate();
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

                if (m.focus_model) {
                    state.focusModel = m.focus_model;
                    if (m.focus_model.confidence !== undefined) {
                        pushRolling(state._focusConfidenceHistory, m.focus_model.confidence);
                    }
                    fireEvent('focus-model', state.focusModel);
                }

                if (m.signal_quality) {
                    state.signalQuality = m.signal_quality;
                }

                if (m.raw_accel || m.raw_gyro) {
                    updateHeadMovement(m.raw_accel, m.raw_gyro);
                }

                if (state.lastBlink) {
                    _blinkTimestamps.push(Date.now());
                    fireEvent('blink', { total: state.blinkTotal, ts: state.ts });
                }

                scheduleOverlayUpdate();
                fireEvent('update', snapshot());
            } catch (e) {
                // ignore parse errors
            }
        };

        ws.onclose = function () {
            state.connected = false;
            scheduleOverlayUpdate();
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

    function updateHeadMovement(rawAccel, rawGyro) {
        if (rawAccel) {
            state.headMovementRaw = state.headMovementRaw || {};
            state.headMovementRaw.accel = rawAccel;
            var ax = rawAccel.x, ay = rawAccel.y, az = rawAccel.z;
            if (Array.isArray(ax)) ax = ax[ax.length - 1];
            if (Array.isArray(ay)) ay = ay[ay.length - 1];
            if (Array.isArray(az)) az = az[az.length - 1];
            if (ax != null && ay != null && az != null) {
                var mag = Math.sqrt(ax * ax + ay * ay + az * az);
                pushRolling(state._accelHistory, mag);
            }
        }
        if (rawGyro) {
            state.headMovementRaw = state.headMovementRaw || {};
            state.headMovementRaw.gyro = rawGyro;
            var gx = rawGyro.x, gy = rawGyro.y, gz = rawGyro.z;
            if (Array.isArray(gx)) gx = gx[gx.length - 1];
            if (Array.isArray(gy)) gy = gy[gy.length - 1];
            if (Array.isArray(gz)) gz = gz[gz.length - 1];
            if (gx != null && gy != null && gz != null) {
                var gyroMag = Math.sqrt(gx * gx + gy * gy + gz * gz);
                pushRolling(state._gyroHistory, gyroMag);
            }
        }
        var movement = computeHeadMovementLevel();
        state.headMovement = movement;
        if (movement > 0.7) {
            fireEvent('movement-high', { level: movement });
        }
    }

    function computeHeadMovementLevel() {
        if (state._gyroHistory.length < 4) return 0;
        var recent = state._gyroHistory.slice(-10);
        var mean = 0;
        for (var i = 0; i < recent.length; i++) mean += recent[i];
        mean /= recent.length;
        var variance = 0;
        for (var j = 0; j < recent.length; j++) {
            var d = recent[j] - mean;
            variance += d * d;
        }
        variance /= recent.length;
        var std = Math.sqrt(variance);
        return Math.min(1, std / 5000);
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
            focusModel: state.focusModel,
            focusConfidenceAvg: rollingAvg(state._focusConfidenceHistory),
            signalQuality: state.signalQuality,
            headMovement: state.headMovement,
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
        if (engagement >= 0.4) return { label: 'Deep Focus', color: '#4fc3f7', level: 4 };
        if (engagement >= 0.2) return { label: 'Focused', color: '#66bb6a', level: 3 };
        if (engagement >= 0.1 && relaxation < 0.7) return { label: 'Light Focus', color: '#ffb74d', level: 2 };
        if (relaxation >= 0.7) return { label: 'Relaxed', color: '#9575cd', level: 1 };
        return { label: 'Drifting', color: '#ef5350', level: 0 };
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
            overlayEl.innerHTML = '<span style="color:#78909c">EEG offline</span>';
            overlayEl.style.borderColor = 'rgba(120,144,156,0.3)';
            if (panelEl) panelEl.style.display = 'none';
            overlayEl.style.display = '';
            return;
        }

        if (!state.museConnected || !state.ready) {
            overlayEl.innerHTML = '<span style="color:#ffb74d">EEG connecting…</span>';
            overlayEl.style.borderColor = 'rgba(255,183,77,0.3)';
            return;
        }

        var engAvg = rollingAvg(state._engagementHistory);
        var relAvg = rollingAvg(state._relaxationHistory);
        var zone = getFocusZone(engAvg, relAvg);

        // Update toggle button
        overlayEl.style.borderColor = zone.color + '66';
        overlayEl.innerHTML = '<span style="color:' + zone.color + '">' + zone.label + '</span>';

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
        html.push('<div style="font-weight:700;font-size:14px;color:' + zone.color + ';margin-bottom:8px;padding-right:20px">' + zone.label + '</div>');

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
        html.push(bandInterpretation(bands));
        html.push(waveBars(bands));
        html.push('</div>');

        // ML Focus Model prediction
        if (state.focusModel && state.focusModel.label) {
            var fm = state.focusModel;
            var mlLabel = fm.label;
            var mlConf = fm.confidence !== undefined ? (fm.confidence * 100).toFixed(0) + '%' : '';
            var mlColor = mlLabel === 'focused' ? '#4fc3f7' : mlLabel === 'relaxed' ? '#9575cd' : '#ffb74d';
            html.push('<div style="margin-top:8px;padding:6px 8px;background:rgba(255,255,255,0.04);border-radius:6px">');
            html.push('<div style="font-size:10px;color:#78909c;margin-bottom:2px">ML MODEL</div>');
            html.push('<div style="display:flex;justify-content:space-between;align-items:center">');
            html.push('<span style="color:' + mlColor + ';font-weight:600;text-transform:capitalize">' + mlLabel + '</span>');
            html.push('<span style="font-size:10px;color:#78909c">' + mlConf + (fm.model ? ' · ' + fm.model : '') + '</span>');
            html.push('</div>');
            if (fm.probs) {
                var probKeys = Object.keys(fm.probs);
                html.push('<div style="display:flex;gap:3px;margin-top:4px">');
                for (var pi = 0; pi < probKeys.length; pi++) {
                    var pk = probKeys[pi];
                    var pv = fm.probs[pk];
                    var pPct = (pv * 100).toFixed(0);
                    var pColor = pk === mlLabel ? mlColor : 'rgba(255,255,255,0.3)';
                    html.push('<div style="flex:1;text-align:center">');
                    html.push('<div style="height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">');
                    html.push('<div style="width:' + pPct + '%;height:100%;background:' + pColor + '"></div>');
                    html.push('</div>');
                    html.push('<div style="font-size:8px;color:#546e7a;margin-top:1px">' + pk + '</div>');
                    html.push('</div>');
                }
                html.push('</div>');
            }
            html.push('</div>');
        }

        // Asymmetry
        var asymLabel = asym > 0.2 ? 'Approach ↗' : asym < -0.2 ? 'Withdraw ↙' : 'Balanced';
        var asymColor = asym > 0.2 ? '#66bb6a' : asym < -0.2 ? '#ef5350' : '#78909c';
        html.push('<div style="margin-top:6px;display:flex;justify-content:space-between">');
        html.push('<span style="color:#78909c">L/R Balance</span>');
        html.push('<span style="color:' + asymColor + '">' + asymLabel + ' (' + asym.toFixed(2) + ')</span>');
        html.push('</div>');

        // Signal Quality indicator
        if (state.signalQuality) {
            html.push('<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">');
            html.push('<div style="color:#78909c;font-size:10px;margin-bottom:4px">SIGNAL QUALITY</div>');
            html.push('<div style="display:flex;gap:6px">');
            var sqChannels = ['TP9', 'AF7', 'AF8', 'TP10'];
            for (var si = 0; si < sqChannels.length; si++) {
                var ch = sqChannels[si];
                var sq = state.signalQuality[ch];
                if (!sq) continue;
                var sqUsable = sq.usable;
                var sqClip = sq.clip_frac || 0;
                var sqColor = sqUsable ? (sqClip < 0.01 ? '#66bb6a' : '#ffb74d') : '#ef5350';
                var sqLabel = sqUsable ? (sqClip < 0.01 ? '●' : '◐') : '○';
                html.push('<div style="flex:1;text-align:center">');
                html.push('<div style="font-size:14px;color:' + sqColor + '">' + sqLabel + '</div>');
                html.push('<div style="font-size:8px;color:#546e7a">' + ch + '</div>');
                html.push('</div>');
            }
            html.push('</div>');
            html.push('</div>');
        }

        // Blink rate, head movement & session
        html.push('<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">');
        html.push('<div style="color:#78909c;font-size:10px;margin-bottom:4px">BODY</div>');
        html.push('<div style="display:flex;justify-content:space-between">');
        html.push('<span>Blink rate</span><span>' + blinkRate + '/min</span>');
        html.push('</div>');
        var movePct = Math.round(state.headMovement * 100);
        var moveColor = movePct > 70 ? '#ef5350' : movePct > 30 ? '#ffb74d' : '#66bb6a';
        var moveLabel = movePct > 70 ? 'Fidgeting' : movePct > 30 ? 'Some movement' : 'Still';
        html.push('<div style="display:flex;justify-content:space-between">');
        html.push('<span>Head</span><span style="color:' + moveColor + '">' + moveLabel + '</span>');
        html.push('</div>');
        html.push('<div style="display:flex;justify-content:space-between">');
        html.push('<span>Session</span><span>' + sessionMin + ' min</span>');
        html.push('</div>');
        if (fatigue) {
            html.push('<div style="color:' + fatigue.color + ';font-weight:600;margin-top:4px">' + fatigue.label + '</div>');
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
        html.push('<div style="margin-top:6px;color:#546e7a;font-size:10px;text-align:right">Batt ' + state.battery.toFixed(0) + '%</div>');

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

    function bandInterpretation(bands) {
        if (!bands) return '';
        var d = bands.delta, t = bands.theta, a = bands.alpha, b = bands.beta, g = bands.gamma;
        if (d === undefined && t === undefined) return '';

        // Convert dB to linear power for ratio comparisons
        var tL = Math.pow(10, (t || -20) / 10);
        var aL = Math.pow(10, (a || -20) / 10);
        var bL = Math.pow(10, (b || -20) / 10);
        var gL = Math.pow(10, (g || -20) / 10);
        var dL = Math.pow(10, (d || -20) / 10);

        var tags = [];

        // Dominant band
        var max = Math.max(dL, tL, aL, bL, gL);
        if (max === bL || max === gL) {
            if (bL > aL * 1.5 && bL > tL * 1.5) {
                tags.push({ text: 'Active thinking', color: '#ffb74d' });
            }
            if (gL > aL * 1.2 && gL > tL * 1.2) {
                tags.push({ text: 'Intense processing', color: '#ef5350' });
            }
        }

        // High beta + gamma together = deep focus or muscle artifact
        if (b > 5 && g > 5) {
            tags.push({ text: 'Deep focus', color: '#ff7043' });
        } else if (b > 5 && g <= 0) {
            tags.push({ text: 'Engaged', color: '#ffb74d' });
        }

        // Alpha dominant = relaxed / eyes closed / idle
        if (aL > bL * 1.3 && aL > tL * 1.2) {
            tags.push({ text: 'Relaxed', color: '#66bb6a' });
        }

        // Theta dominant = drowsy / deep thought / fatigue
        if (tL > bL * 1.3 && tL > aL * 0.9) {
            if (tL > aL * 1.3) {
                tags.push({ text: 'Drowsy', color: '#9575cd' });
            } else {
                tags.push({ text: 'Reflective', color: '#9575cd' });
            }
        }

        // Theta/beta ratio — classic attention metric
        var tbr = bL > 0 ? tL / bL : 0;
        if (tbr > 2.5) {
            tags.push({ text: 'Low alertness', color: '#78909c' });
        } else if (tbr < 0.5 && bL > aL) {
            tags.push({ text: 'High alertness', color: '#4fc3f7' });
        }

        // Alpha asymmetry context (frontal alpha suppression)
        if (a > 5 && b < 0) {
            tags.push({ text: 'Idling', color: '#78909c' });
        }

        // Delta high = movement artifact or deep sleep (shouldn't happen while studying)
        if (dL > bL * 2 && dL > aL * 2) {
            tags.push({ text: 'Movement artifact?', color: '#546e7a' });
        }

        if (!tags.length) {
            tags.push({ text: 'Neutral', color: '#78909c' });
        }

        // Deduplicate and cap at 2 tags
        var seen = {};
        var unique = [];
        for (var i = 0; i < tags.length; i++) {
            if (!seen[tags[i].text]) {
                seen[tags[i].text] = true;
                unique.push(tags[i]);
            }
        }
        tags = unique.slice(0, 2);

        var html = '<div style="margin-bottom:4px;display:flex;gap:4px;flex-wrap:wrap">';
        for (var j = 0; j < tags.length; j++) {
            html += '<span style="font-size:10px;padding:1px 6px;border-radius:4px;' +
                'background:' + tags[j].color + '22;color:' + tags[j].color + ';' +
                'border:1px solid ' + tags[j].color + '44">' + tags[j].text + '</span>';
        }
        html += '</div>';
        return html;
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

    // Send a message back to the Python bridge via WebSocket
    function sendToBridge(type, payload) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        try {
            ws.send(JSON.stringify({ type: type, ts: Date.now() / 1000, payload: payload }));
            return true;
        } catch (e) {
            return false;
        }
    }

    // Get the ML focus label for use by quiz engine
    function getMLFocusLabel() {
        if (!state.focusModel || !state.focusModel.label) return null;
        return state.focusModel.label;
    }

    function getMLFocusConfidence() {
        if (!state.focusModel) return 0;
        return state.focusModel.confidence || 0;
    }

    function getMLFocusProb(label) {
        if (!state.focusModel || !state.focusModel.probs) return 0;
        return state.focusModel.probs[label] || 0;
    }

    // Composite focus score: combines ratio-based engagement with ML model
    // Returns 0-1 where higher = more focused
    function getCompositeFocusScore() {
        var ratioScore = state.engagement || 0;
        var mlScore = 0;
        if (state.focusModel && state.focusModel.probs) {
            mlScore = state.focusModel.probs['focused'] || state.focusModel.probs['active'] || 0;
        }
        if (mlScore > 0) {
            return ratioScore * 0.4 + mlScore * 0.6;
        }
        return ratioScore;
    }

    // Is signal quality good enough for reliable readings?
    function isSignalUsable() {
        if (!state.signalQuality) return false;
        var usableCount = 0;
        var channels = ['TP9', 'AF7', 'AF8', 'TP10'];
        for (var i = 0; i < channels.length; i++) {
            var sq = state.signalQuality[channels[i]];
            if (sq && sq.usable) usableCount++;
        }
        return usableCount >= 2;
    }

    // EEG-aware break suggestion banner (injected into quiz UI, not just overlay)
    var _breakBannerEl = null;
    var _breakBannerDismissed = false;

    function showBreakBanner(fatigueScore, sessionMin) {
        if (_breakBannerDismissed) return;
        if (_breakBannerEl) return;

        _breakBannerEl = document.createElement('div');
        _breakBannerEl.id = 'eeg-break-banner';
        _breakBannerEl.style.cssText = [
            'position: fixed',
            'top: 0',
            'left: 0',
            'right: 0',
            'z-index: 9999',
            'background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            'color: #e0e0e0',
            'padding: 16px 24px',
            'display: flex',
            'align-items: center',
            'justify-content: center',
            'gap: 16px',
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            'font-size: 14px',
            'border-bottom: 2px solid #9575cd',
            'box-shadow: 0 4px 20px rgba(0,0,0,0.3)',
            'animation: eeg-slide-down 0.4s ease-out',
        ].join(';');

        var style = document.createElement('style');
        style.textContent = '@keyframes eeg-slide-down { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }';
        document.head.appendChild(style);

        _breakBannerEl.innerHTML = [
            '<span style="font-size: 24px">🧠</span>',
            '<div>',
            '<div style="font-weight: 600">Your brain signals suggest fatigue</div>',
            '<div style="font-size: 12px; color: #9ca3af">' + sessionMin + ' min session · Consider a 5-minute break to recharge</div>',
            '</div>',
            '<button id="eeg-break-dismiss" style="padding: 6px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; cursor: pointer; font-size: 13px;">Got it</button>',
            '<button id="eeg-break-snooze" style="padding: 6px 16px; background: rgba(149,117,205,0.3); border: 1px solid rgba(149,117,205,0.5); color: white; border-radius: 6px; cursor: pointer; font-size: 13px;">Snooze 10m</button>',
        ].join('');

        document.body.appendChild(_breakBannerEl);

        document.getElementById('eeg-break-dismiss').addEventListener('click', function () {
            dismissBreakBanner();
        });
        document.getElementById('eeg-break-snooze').addEventListener('click', function () {
            dismissBreakBanner();
            _breakBannerDismissed = false;
            setTimeout(function () { _breakBannerDismissed = false; }, 600000);
        });
    }

    function dismissBreakBanner() {
        _breakBannerDismissed = true;
        if (_breakBannerEl && _breakBannerEl.parentElement) {
            _breakBannerEl.parentElement.removeChild(_breakBannerEl);
        }
        _breakBannerEl = null;
    }

    // End-of-session summary
    function getSessionSummary() {
        var quizStats = getQuizStats();
        var activeMin = getActiveStudyMinutes();
        var sessionMin = getSessionMinutes();
        var engHistory = state._engagementHistory.slice();
        var peakEng = _peakEngagement;
        var baseline = _engagementBaseline;

        var summary = {
            sessionId: getSessionId(),
            sessionMinutes: sessionMin,
            activeStudyMinutes: activeMin,
            peakEngagement: peakEng,
            baselineEngagement: baseline,
            currentEngagement: rollingAvg(state._engagementHistory),
            blinkRate: getBlinkRate(),
            headMovement: state.headMovement,
            focusModel: state.focusModel,
            signalQuality: state.signalQuality,
            quiz: quizStats,
            events: sessionLog.length,
        };

        if (typeof neuro !== 'undefined') {
            summary.fatigueScore = neuro.getFatigueScore();
            summary.inFlow = neuro.isInFlow();
            summary.flowDuration = neuro.getFlowDuration();
            summary.optimalStudyTimes = neuro.getOptimalStudyTimes();
            summary.neuroSummary = neuro.getSessionSummary();
        }

        return summary;
    }

    // Auto-trigger break banner from neuro events
    if (typeof addEventListener === 'function') {
        var _neuroBreakCheck = setInterval(function () {
            if (typeof neuro !== 'undefined' && neuro.on) {
                clearInterval(_neuroBreakCheck);
                neuro.on('break-prompt', function (data) {
                    showBreakBanner(data.fatigueScore, Math.round(data.sessionMin));
                });
            }
        }, 1000);
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
        sendToBridge: sendToBridge,
        getMLFocusLabel: getMLFocusLabel,
        getMLFocusConfidence: getMLFocusConfidence,
        getMLFocusProb: getMLFocusProb,
        getCompositeFocusScore: getCompositeFocusScore,
        isSignalUsable: isSignalUsable,
        showBreakBanner: showBreakBanner,
        dismissBreakBanner: dismissBreakBanner,
        getSessionSummary: getSessionSummary,
        getActiveStudyMinutes: getActiveStudyMinutes,
    };
})();
