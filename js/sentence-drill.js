(() => {
    const DEFAULT_CONFIG = {
        dataUrl: 'data/context-sentence.json',
        replayShortcut: { code: 'KeyA', shift: true, ctrl: false, alt: false, label: '⇧+A' },
        datasetKey: null
    };

    let config = { ...DEFAULT_CONFIG };
    let prompts = [];
    const state = { index: 0, completed: false };

    let sentenceDisplay;
    let promptText;
    let questionNumber;
    let meaningText;
    let meaningPanel;
    let toggleMeaningBtn;
    let feedback;
    let answerInput;
    let checkBtn;
    let replayAudioBtn;
    let audioUnsupported;
    let keyboardHint;
    let audioContext = null;
    let pendingShiftReplay = false;

    const isFileProtocol = () => window.location.protocol === 'file:';

    document.addEventListener('DOMContentLoaded', () => {
        const rawConfig = window.SENTENCE_DRILL_CONFIG || {};
        delete window.SENTENCE_DRILL_CONFIG;
        config = normalizeConfig(rawConfig);

        if (typeof initCommandPalette === 'function') {
            initCommandPalette();
        }

        cacheElements();
        bindEvents();
        updateKeyboardHint();
        setReplayButtonEnabled(false);
        loadPrompts();
    });

    function normalizeConfig(overrides) {
        const merged = { ...DEFAULT_CONFIG, ...overrides };
        merged.replayShortcut = normalizeShortcut(overrides.replayShortcut || DEFAULT_CONFIG.replayShortcut);
        merged.datasetKey = overrides.datasetKey || DEFAULT_CONFIG.datasetKey;
        return merged;
    }

    function normalizeShortcut(value) {
        const fallback = { code: 'KeyA', shift: true, ctrl: false, alt: false, label: '⇧+A' };
        if (!value) return fallback;

        if (typeof value === 'string') {
            const parts = value.split('+').map(p => p.trim()).filter(Boolean);
            const shortcut = { code: null, key: null, shift: false, ctrl: false, alt: false };
            parts.forEach(part => {
                const upper = part.toUpperCase();
                if (upper === 'SHIFT') shortcut.shift = true;
                else if (upper === 'CTRL' || upper === 'CONTROL') shortcut.ctrl = true;
                else if (upper === 'ALT' || upper === 'OPTION') shortcut.alt = true;
                else if (upper.startsWith('KEY')) shortcut.code = part;
                else shortcut.key = part;
            });
            shortcut.code = shortcut.code || (shortcut.key ? `Key${shortcut.key.toUpperCase()}` : fallback.code);
            shortcut.label = shortcutLabel(shortcut);
            return { ...fallback, ...shortcut };
        }

        if (typeof value === 'object') {
            const shortcut = {
                code: value.code || (value.key ? `Key${String(value.key).toUpperCase()}` : fallback.code),
                key: value.key || null,
                shift: Boolean(value.shift),
                ctrl: Boolean(value.ctrl),
                alt: Boolean(value.alt)
            };
            shortcut.label = value.label || shortcutLabel(shortcut);
            return { ...fallback, ...shortcut };
        }

        return fallback;
    }

    function shortcutLabel(shortcut) {
        const parts = [];
        if (shortcut.ctrl) parts.push('Ctrl');
        if (shortcut.alt) parts.push('Alt');
        if (shortcut.shift) parts.push('⇧');
        const keyPart = shortcut.key
            ? shortcut.key.toUpperCase()
            : (shortcut.code && shortcut.code.startsWith('Key'))
                ? shortcut.code.slice(3).toUpperCase()
                : 'A';
        parts.push(keyPart);
        return parts.join('+');
    }

    function cacheElements() {
        sentenceDisplay = document.getElementById('sentenceDisplay');
        promptText = document.getElementById('promptText');
        questionNumber = document.getElementById('questionNumber');
        meaningText = document.getElementById('meaningText');
        meaningPanel = document.getElementById('meaningPanel');
        toggleMeaningBtn = document.getElementById('toggleMeaningBtn');
        feedback = document.getElementById('feedback');
        answerInput = document.getElementById('answerInput');
        checkBtn = document.getElementById('checkBtn');
        replayAudioBtn = document.getElementById('replayAudioBtn');
        audioUnsupported = document.getElementById('audioUnsupported');
        keyboardHint = document.getElementById('keyboardHint');
    }

    function bindEvents() {
        if (toggleMeaningBtn) {
            toggleMeaningBtn.addEventListener('click', () => {
                meaningPanel.classList.contains('hidden') ? showMeaning() : hideMeaning();
            });
        }

        if (checkBtn) {
            checkBtn.addEventListener('click', handleCheck);
        }

        if (answerInput) {
            answerInput.addEventListener('keydown', event => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    handleCheck();
                }
            });
        }

        if (replayAudioBtn) {
            replayAudioBtn.addEventListener('click', () => speakCurrentSentence());
        }

        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const randomBtn = document.getElementById('randomBtn');
        if (prevBtn) prevBtn.addEventListener('click', () => goToOffset(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => goToOffset(1));
        if (randomBtn) randomBtn.addEventListener('click', goToRandom);

        document.addEventListener('keydown', handleGlobalKeydown);
        document.addEventListener('keyup', handleGlobalKeyup);

        if (!('speechSynthesis' in window) && audioUnsupported) {
            audioUnsupported.classList.remove('hidden');
        }
    }

    function updateKeyboardHint() {
        if (!keyboardHint) return;
        const parts = [
            'Keyboard: ← previous',
            '→ next',
            'Space reveal meaning',
            'Ctrl+Enter submit'
        ];
        if (config.replayShortcut && config.replayShortcut.label) {
            parts.push(`${config.replayShortcut.label} replay audio`);
        }
        parts.push('Tap Shift replay audio');
        keyboardHint.textContent = parts.join(' • ');
    }

    function loadPrompts() {
        if (!sentenceDisplay) return;
        sentenceDisplay.textContent = 'Loading prompts…';
        if (answerInput) answerInput.disabled = true;
        if (checkBtn) checkBtn.disabled = true;

        loadDataset(config.dataUrl)
            .then(data => {
                if (!Array.isArray(data)) {
                    throw new Error('Invalid prompt format (expected array).');
                }
                prompts = data.filter(item => item && item.sentence && item.meaning);
                if (!prompts.length) {
                    throw new Error('No prompts found in data file.');
                }
                state.index = 0;
                if (answerInput) answerInput.disabled = false;
                if (checkBtn) checkBtn.disabled = false;
                setReplayButtonEnabled('speechSynthesis' in window);
                renderCurrentPrompt();
            })
            .catch(error => {
                console.error(error);
                sentenceDisplay.textContent = 'Unable to load prompts. Please try again later.';
                if (questionNumber) questionNumber.textContent = '0 / 0';
                const extra = isFileProtocol()
                    ? ' Tip: when opening these files directly from disk, the browser blocks loading JSON. Run a simple local server (e.g., python -m http.server) and open the page via http://localhost to unlock the dataset.'
                    : '';
                setFeedback(false, 'Failed to load prompt data.' + extra);
                setReplayButtonEnabled(false);
            });
    }

    function loadDataset(path) {
        const resolvedUrl = resolveUrl(path);
        if (isFileProtocol()) {
            const embedded = getEmbeddedDataset();
            if (embedded) {
                return Promise.resolve(embedded);
            }
        }

        return fetch(resolvedUrl, { cache: 'no-store' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load prompts: ${response.status}`);
                }
                return response.json();
            })
            .catch(err => tryFetchViaXHR(resolvedUrl, err))
            .catch(err => {
                const embedded = getEmbeddedDataset();
                if (embedded) return embedded;
                throw err;
            });
    }

    function resolveUrl(path) {
        try {
            return new URL(path, window.location.href).href;
        } catch (err) {
            return path;
        }
    }

    function tryFetchViaXHR(url, originalError) {
        if (!isFileProtocol()) {
            return Promise.reject(originalError);
        }
        return fetchViaXHR(url).catch(() => Promise.reject(originalError));
    }

    function fetchViaXHR(url) {
        return new Promise((resolve, reject) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.onreadystatechange = () => {
                    if (xhr.readyState !== XMLHttpRequest.DONE) return;
                    if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            resolve(data);
                        } catch (parseError) {
                            reject(parseError);
                        }
                    } else {
                        reject(new Error(`XHR failed with status ${xhr.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error('XHR network error'));
                xhr.send();
            } catch (error) {
                reject(error);
            }
        });
    }

    function handleGlobalKeydown(event) {
        const targetTag = event.target && event.target.tagName;
        const isInputTarget = targetTag === 'INPUT' || targetTag === 'TEXTAREA';

        if (event.key === 'Shift') {
            pendingShiftReplay = true;
            return;
        }

        if (isReplayShortcut(event)) {
            event.preventDefault();
            pendingShiftReplay = false;
            speakCurrentSentence();
            return;
        }

        if (pendingShiftReplay) {
            pendingShiftReplay = false;
        }

        if (isInputTarget) {
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            goToOffset(1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            goToOffset(-1);
        } else if (event.key === ' ') {
            event.preventDefault();
            meaningPanel.classList.contains('hidden') ? showMeaning() : hideMeaning();
        }
    }

    function handleGlobalKeyup(event) {
        if (event.key === 'Shift') {
            if (pendingShiftReplay) {
                speakCurrentSentence();
            }
            pendingShiftReplay = false;
        }
    }

    function isReplayShortcut(event) {
        const shortcut = config.replayShortcut;
        if (!shortcut) return false;
        if (shortcut.shift !== undefined && shortcut.shift !== event.shiftKey) return false;
        if (shortcut.ctrl !== undefined && shortcut.ctrl !== event.ctrlKey) return false;
        if (shortcut.alt !== undefined && shortcut.alt !== event.altKey) return false;
        if (shortcut.code) return event.code === shortcut.code;
        if (shortcut.key) return event.key.toLowerCase() === shortcut.key.toLowerCase();
        return false;
    }

    function renderCurrentPrompt() {
        if (!prompts.length) return;
        cancelSpeech();
        const item = prompts[state.index];
        if (sentenceDisplay) sentenceDisplay.textContent = item.sentence;
        if (promptText) promptText.textContent = item.prompt || 'Explain the sentence meaning.';
        if (meaningText) meaningText.textContent = item.meaning;
        if (questionNumber) questionNumber.textContent = `${state.index + 1} / ${prompts.length}`;
        resetAnswerState();
        if (answerInput) answerInput.focus({ preventScroll: true });
        speakCurrentSentence();
    }

    function resetAnswerState() {
        state.completed = false;
        hideMeaning();
        setFeedback(null, '');
        if (answerInput) {
            answerInput.value = '';
            answerInput.disabled = false;
        }
        if (checkBtn) checkBtn.disabled = false;
    }

    function handleCheck() {
        if (state.completed) return;
        if (!answerInput) return;
        const input = answerInput.value.trim();
        if (!input) {
            setFeedback(false, 'Type your interpretation before checking.');
            playFeedbackSound('error');
            return;
        }
        // For now we accept any non-empty response; this drill is reflective.
        setFeedback(true, 'Nice! Compare with the suggested meaning and move on.');
        showMeaning();
        state.completed = true;
        answerInput.disabled = true;
        checkBtn.disabled = true;
        playFeedbackSound('success');
    }

    function goToOffset(offset) {
        if (!prompts.length) return;
        cancelSpeech();
        const length = prompts.length;
        state.index = (state.index + offset + length) % length;
        renderCurrentPrompt();
    }

    function goToRandom() {
        if (!prompts.length) return;
        if (prompts.length <= 1) return;
        cancelSpeech();
        let next = state.index;
        while (next === state.index) {
            next = Math.floor(Math.random() * prompts.length);
        }
        state.index = next;
        renderCurrentPrompt();
    }

    function speakCurrentSentence() {
        if (!prompts.length) return;
        const sentence = prompts[state.index].sentence;
        if (!sentence) return;
        cancelSpeech();
        if (typeof playSentenceAudio === 'function') {
            playSentenceAudio(sentence);
            return;
        }
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = 'zh-CN';
        if (typeof getQuizTtsRate === 'function') {
            utterance.rate = getQuizTtsRate();
        }
        window.speechSynthesis.speak(utterance);
    }

    function cancelSpeech() {
        if (typeof stopActiveAudio === 'function') {
            stopActiveAudio();
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }

    function showMeaning() {
        if (!meaningPanel || !toggleMeaningBtn) return;
        meaningPanel.classList.remove('hidden');
        toggleMeaningBtn.textContent = 'Hide suggested meaning';
        toggleMeaningBtn.setAttribute('aria-expanded', 'true');
    }

    function hideMeaning() {
        if (!meaningPanel || !toggleMeaningBtn) return;
        meaningPanel.classList.add('hidden');
        toggleMeaningBtn.textContent = 'Show suggested meaning';
        toggleMeaningBtn.setAttribute('aria-expanded', 'false');
    }

    function setFeedback(status, message) {
        if (!feedback) return;
        feedback.textContent = message || '';
        feedback.className = 'mt-4 text-center text-lg font-semibold';
        if (!message) return;
        if (status === true) {
            feedback.classList.add('text-green-600');
        } else if (status === false) {
            feedback.classList.add('text-red-600');
        } else {
            feedback.classList.add('text-gray-600');
        }
    }

    function setReplayButtonEnabled(enabled) {
        if (!replayAudioBtn) return;
        replayAudioBtn.disabled = !enabled;
        replayAudioBtn.classList.toggle('opacity-60', !enabled);
        replayAudioBtn.classList.toggle('cursor-not-allowed', !enabled);
    }

    function getEmbeddedDataset() {
        if (!config.datasetKey) return null;
        const store = window.__CONTEXT_DATASETS__;
        if (!store) return null;
        const data = store[config.datasetKey];
        if (!Array.isArray(data)) return null;
        return cloneDataset(data);
    }

    function cloneDataset(data) {
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (err) {
            return data.slice ? data.slice() : data;
        }
    }

    function playFeedbackSound(type) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioContext) {
            audioContext = new AudioCtx();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        const ctx = audioContext;
        const startTime = ctx.currentTime + 0.01;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, startTime);
            osc.frequency.linearRampToValueAtTime(880, startTime + 0.25);
        } else {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, startTime);
            osc.frequency.linearRampToValueAtTime(160, startTime + 0.2);
        }

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
    }
})();
