(() => {
    const DEFAULT_CONFIG = {
        dataUrl: 'data/context-listening.json',
        autoAdvanceDelay: 2200,
        replayShortcut: { code: 'KeyA', shift: true, ctrl: false, alt: false, label: '⇧+A' },
        datasetKey: null
    };

    const STOP_WORDS = new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'get', 'in', 'into',
        'is', 'it', 'its', 'of', 'on', 'or', 'out', 'than', 'that', 'the', 'their', 'then',
        'there', 'this', 'to', 'up', 'was', 'were', 'with', 'your'
    ]);

    let config = { ...DEFAULT_CONFIG };
    let prompts = [];
    const state = { index: 0, completed: false };
    let advanceTimeout = null;

    let sentenceDisplay;
    let targetPrompt;
    let questionNumber;
    let meaningText;
    let meaningPanel;
    let toggleMeaningBtn;
    let feedback;
    let answerInput;
    let checkBtn;
    let choiceOptions;
    let replayAudioBtn;
    let audioUnsupported;
    let keyboardHint;
    let audioContext = null;
    let pendingShiftReplay = false;

    const isFileProtocol = () => window.location.protocol === 'file:';

    document.addEventListener('DOMContentLoaded', () => {
        const rawConfig = window.CONTEXT_DRILL_CONFIG || {};
        delete window.CONTEXT_DRILL_CONFIG;
        config = buildConfig(rawConfig);

        if (typeof initCommandPalette === 'function') {
            initCommandPalette();
        }

        cacheElements();
        bindEvents();
        updateKeyboardHint();
        setReplayButtonEnabled(false);
        loadPrompts();
    });

    function buildConfig(overrides) {
        const merged = { ...DEFAULT_CONFIG, ...overrides };
        merged.autoAdvanceDelay = typeof merged.autoAdvanceDelay === 'number'
            ? merged.autoAdvanceDelay
            : DEFAULT_CONFIG.autoAdvanceDelay;
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
        targetPrompt = document.getElementById('targetPrompt');
        questionNumber = document.getElementById('questionNumber');
        meaningText = document.getElementById('meaningText');
        meaningPanel = document.getElementById('meaningPanel');
        toggleMeaningBtn = document.getElementById('toggleMeaningBtn');
        feedback = document.getElementById('feedback');
        answerInput = document.getElementById('answerInput');
        checkBtn = document.getElementById('checkBtn');
        choiceOptions = document.getElementById('choiceOptions');
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
            checkBtn.addEventListener('click', handleTypeCheck);
        }

        if (answerInput) {
            answerInput.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleTypeCheck();
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
            'Enter check'
        ];
        if (config.replayShortcut && config.replayShortcut.label) {
            parts.push(`${config.replayShortcut.label} replay audio`);
        }
        if (config.autoAdvanceDelay <= 0) {
            parts.push('Correct answers auto-advance');
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
                prompts = data.filter(item => item && item.sentence && item.target && item.meaning);
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
        const requiresShift = shortcut.shift;
        const requiresCtrl = shortcut.ctrl;
        const requiresAlt = shortcut.alt;

        if (requiresShift !== undefined && requiresShift !== event.shiftKey) return false;
        if (requiresCtrl !== undefined && requiresCtrl !== event.ctrlKey) return false;
        if (requiresAlt !== undefined && requiresAlt !== event.altKey) return false;

        if (shortcut.code) {
            return event.code === shortcut.code;
        }
        if (shortcut.key) {
            return event.key.toLowerCase() === shortcut.key.toLowerCase();
        }
        return false;
    }

    function renderCurrentPrompt() {
        if (!prompts.length) return;
        clearAdvanceTimer();
        cancelSpeech();

        const item = prompts[state.index];
        if (sentenceDisplay) {
            sentenceDisplay.innerHTML = highlightTarget(item.sentence, item.target);
        }
        if (targetPrompt) {
            targetPrompt.textContent = item.target;
        }
        if (meaningText) {
            meaningText.textContent = item.meaning;
        }
        if (questionNumber) {
            questionNumber.textContent = `${state.index + 1} / ${prompts.length}`;
        }

        resetAnswerState();
        populateMultipleChoice();
        if (answerInput) {
            answerInput.focus({ preventScroll: true });
        }
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
        if (choiceOptions) choiceOptions.innerHTML = '';
    }

    function populateMultipleChoice() {
        if (!choiceOptions || !prompts.length) return;
        const options = buildChoiceOptions(state.index);
        choiceOptions.innerHTML = '';
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn w-full text-left px-4 py-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-gray-800';
            btn.textContent = option.text;
            btn.dataset.correct = option.correct ? '1' : '0';
            btn.disabled = false;
            btn.addEventListener('click', () => handleChoiceSelection(btn));
            choiceOptions.appendChild(btn);
        });
    }

    function buildChoiceOptions(index) {
        const correctMeaning = prompts[index].meaning;
        const pool = prompts
            .map(item => item.meaning)
            .filter((meaning, idx) => idx !== index);
        shuffleArray(pool);
        const distractors = pool.slice(0, Math.min(3, pool.length));
        const options = [{ text: correctMeaning, correct: true }];
        distractors.forEach(text => options.push({ text, correct: false }));
        return shuffleArray(options);
    }

    function handleChoiceSelection(button) {
        if (state.completed) return;
        const correct = button.dataset.correct === '1';
        if (correct) {
            handleCorrectAnswer('Correct! Nice work.');
        } else {
            button.disabled = true;
            button.classList.add('border-red-500', 'bg-red-50', 'opacity-70');
            setFeedback(false, 'Not quite. Try again or type your own meaning.');
            playFeedbackSound('error');
        }
    }

    function handleTypeCheck() {
        if (state.completed) return;
        if (!answerInput) return;
        const input = answerInput.value.trim();
        if (!input) {
            setFeedback(false, 'Enter what you think it means before checking.');
            playFeedbackSound('error');
            return;
        }
        const item = prompts[state.index];
        if (isFuzzyMatch(input, item)) {
            handleCorrectAnswer('Looks good! Your phrasing captures the meaning.');
        } else {
            setFeedback(false, 'Close? Compare with the reveal, tweak your wording, or listen again.');
            playFeedbackSound('error');
        }
    }

    function handleCorrectAnswer(message) {
        setFeedback(true, message);
        showMeaning();
        state.completed = true;
        if (answerInput) answerInput.disabled = true;
        if (checkBtn) checkBtn.disabled = true;
        revealCorrectChoice();
        playFeedbackSound('success');
        scheduleAdvance();
    }

    function revealCorrectChoice() {
        if (!choiceOptions) return;
        const buttons = choiceOptions.querySelectorAll('.choice-btn');
        buttons.forEach(btn => {
            const isCorrect = btn.dataset.correct === '1';
            btn.disabled = true;
            btn.classList.remove('border-red-500', 'bg-red-50', 'opacity-70', 'hover:border-blue-400', 'hover:bg-blue-50');
            if (isCorrect) {
                btn.classList.add('border-green-500', 'bg-green-50');
            } else {
                btn.classList.add('opacity-70');
            }
        });
    }

    function scheduleAdvance() {
        clearAdvanceTimer();
        if (prompts.length <= 1) return;
        const delay = config.autoAdvanceDelay;
        if (delay <= 0) {
            goToOffset(1);
            return;
        }
        advanceTimeout = setTimeout(() => {
            goToOffset(1);
        }, delay);
    }

    function clearAdvanceTimer() {
        if (advanceTimeout) {
            clearTimeout(advanceTimeout);
            advanceTimeout = null;
        }
    }

    function isFuzzyMatch(input, item) {
        const normalizedInput = normalizeAnswer(input);
        if (!normalizedInput) return false;
        const candidates = getCandidateAnswers(item);
        for (const candidate of candidates) {
            const normalizedCandidate = normalizeAnswer(candidate);
            if (!normalizedCandidate) continue;
            if (normalizedCandidate === normalizedInput) return true;
            if (normalizedCandidate.includes(normalizedInput) && normalizedInput.length >= Math.min(5, normalizedCandidate.length)) {
                return true;
            }
            if (normalizedInput.includes(normalizedCandidate) && normalizedCandidate.length >= 5) {
                return true;
            }
            const similarity = stringSimilarity(normalizedInput, normalizedCandidate);
            if (similarity >= 0.72) return true;
            const overlap = wordOverlap(normalizedInput, normalizedCandidate);
            if (overlap >= 0.6) return true;
        }
        return false;
    }

    function getCandidateAnswers(item) {
        const answers = new Set();
        answers.add(item.meaning);
        const noParens = item.meaning.replace(/\s*\([^)]*\)/g, '').trim();
        if (noParens) answers.add(noParens);
        item.meaning.split(/[;,]/).forEach(part => {
            const trimmed = part.trim();
            if (trimmed) answers.add(trimmed);
        });
        if (Array.isArray(item.acceptedAnswers)) {
            item.acceptedAnswers.forEach(ans => {
                const trimmed = (ans || '').trim();
                if (trimmed) answers.add(trimmed);
            });
        }
        return Array.from(answers);
    }

    function normalizeAnswer(text) {
        return text
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function wordOverlap(a, b) {
        const wordsA = tokenizeMeaning(a);
        const wordsB = tokenizeMeaning(b);
        if (wordsA.size === 0 || wordsB.size === 0) return 0;
        let matches = 0;
        wordsA.forEach(word => {
            if (wordsB.has(word)) matches += 1;
        });
        const base = Math.max(wordsA.size, wordsB.size);
        return base === 0 ? 0 : matches / base;
    }

    function tokenizeMeaning(text) {
        const result = new Set();
        text.split(' ').forEach(word => {
            if (word.length <= 2) return;
            if (STOP_WORDS.has(word)) return;
            result.add(word);
        });
        return result;
    }

    function stringSimilarity(a, b) {
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        const distance = levenshtein(a, b);
        return 1 - distance / maxLen;
    }

    function levenshtein(a, b) {
        const matrix = Array.from({ length: a.length + 1 }, (_, i) => {
            const row = new Array(b.length + 1);
            row[0] = i;
            return row;
        });
        for (let j = 0; j <= b.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                if (a[i - 1] === b[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j - 1] + 1
                    );
                }
            }
        }
        return matrix[a.length][b.length];
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

    function highlightTarget(sentence, target) {
        const index = sentence.indexOf(target);
        if (index === -1) {
            return escapeHTML(sentence);
        }
        const before = sentence.slice(0, index);
        const match = sentence.slice(index, index + target.length);
        const after = sentence.slice(index + target.length);
        return (
            escapeHTML(before) +
            '<span class="bg-yellow-200 text-gray-900 px-1 rounded">' +
            escapeHTML(match) +
            '</span>' +
            escapeHTML(after)
        );
    }

    const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    function escapeHTML(text) {
        return text.replace(/[&<>"']/g, char => escapeMap[char] || char);
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

    function goToOffset(offset) {
        if (!prompts.length) return;
        clearAdvanceTimer();
        cancelSpeech();
        const length = prompts.length;
        state.index = (state.index + offset + length) % length;
        renderCurrentPrompt();
    }

    function goToRandom() {
        if (!prompts.length) return;
        if (prompts.length <= 1) return;
        clearAdvanceTimer();
        cancelSpeech();
        let next = state.index;
        while (next === state.index) {
            next = Math.floor(Math.random() * prompts.length);
        }
        state.index = next;
        renderCurrentPrompt();
    }

    function showMeaning() {
        if (!meaningPanel || !toggleMeaningBtn) return;
        meaningPanel.classList.remove('hidden');
        toggleMeaningBtn.textContent = 'Hide meaning';
        toggleMeaningBtn.setAttribute('aria-expanded', 'true');
    }

    function hideMeaning() {
        if (!meaningPanel || !toggleMeaningBtn) return;
        meaningPanel.classList.add('hidden');
        toggleMeaningBtn.textContent = 'Show meaning';
        toggleMeaningBtn.setAttribute('aria-expanded', 'false');
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function setReplayButtonEnabled(enabled) {
        if (!replayAudioBtn) return;
        replayAudioBtn.disabled = !enabled;
        replayAudioBtn.classList.toggle('opacity-60', !enabled);
        replayAudioBtn.classList.toggle('cursor-not-allowed', !enabled);
    }
})();
