// Chat panel + dictation chat mode (global, no module tooling).

// Chat panel state
let chatPanelVisible = false;
let chatPanel = null;
let chatMessages = [];
const CHAT_PANEL_KEY = 'quiz_chat_panel_visible';

// Dictation chat mode state
let dictationChatMode = null;
let dictationChatMessages = [];
let dictationChatPromptSource = 'system';
let dictationChatAiPrompt = '';
let dictationChatPassed = false;
let dictationChatLastUserAnswer = '';
let dictationChatPromptGenerating = false;
let dictationChatMessagesEl = null;
let dictationChatInputEl = null;
let dictationChatSendBtn = null;
let dictationChatNextBtn = null;
let dictationChatSkipBtn = null;
let dictationChatPromptTextEl = null;
let dictationChatPromptSystemBtn = null;
let dictationChatPromptAiBtn = null;
let dictationChatStatusEl = null;
let dictationChatAudioSlot = null;
let dictationChatAudioHome = null;
let dictationChatAudioHomeNext = null;

function createChatPanel() {
    if (chatPanel) return chatPanel;

    chatPanel = document.createElement('div');
    chatPanel.id = 'chatPanel';
    chatPanel.className = 'fixed top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-lg flex flex-col z-50';
    chatPanel.style.cssText = 'transform: translateX(100%); transition: transform 0.2s ease;';
    chatPanel.innerHTML = `
        <div class="p-3 border-b border-gray-200 flex items-center justify-between">
            <div>
                <div class="text-sm font-semibold text-gray-900">Quiz Chat</div>
                <div class="text-xs text-gray-500">Ask about the current question</div>
            </div>
            <button id="chatCloseBtn" class="text-gray-400 hover:text-gray-600 p-1" title="Close (Ctrl+H or Esc)">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <div id="chatMessages" class="flex-1 overflow-y-auto p-3 space-y-3"></div>
        <div class="p-3 border-t border-gray-200">
            <div class="flex gap-2">
                <input type="text" id="chatInput" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" placeholder="Ask a question... (Enter to send)">
                <button id="chatSendBtn" class="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition">Send</button>
            </div>
            <div class="text-xs text-gray-400 mt-1">Ctrl+H to focus quiz • Ctrl+L to focus chat</div>
        </div>
    `;
    document.body.appendChild(chatPanel);

    const closeBtn = document.getElementById('chatCloseBtn');
    const sendBtn = document.getElementById('chatSendBtn');
    const chatInput = document.getElementById('chatInput');

    closeBtn?.addEventListener('click', () => setChatPanelVisible(false));
    sendBtn?.addEventListener('click', sendChatMessage);
    chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    return chatPanel;
}

function setChatPanelVisible(visible) {
    chatPanelVisible = Boolean(visible);
    createChatPanel();

    const pullTab = document.getElementById('confidencePullTab');

    if (chatPanelVisible) {
        chatPanel.style.transform = 'translateX(0)';
        setConfidencePanelVisible(false);
        if (pullTab) pullTab.style.display = 'none';
        setTimeout(() => {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) chatInput.focus();
        }, 200);
        if (chatMessages.length === 0) {
            addChatContext();
        }
    } else {
        chatPanel.style.transform = 'translateX(100%)';
        if (pullTab) pullTab.style.display = '';
        focusQuizInput();
    }

    updateRightSideSpacing();
    saveChatPanelVisibility();
}

function toggleChatPanel() {
    setChatPanelVisible(!chatPanelVisible);
}

function focusQuizInput() {
    if (mode === 'dictation-chat' && dictationChatInputEl && isElementReallyVisible(dictationChatInputEl)) {
        setTimeout(() => dictationChatInputEl.focus(), 100);
        return;
    }
    const input = document.getElementById('answerInput') || document.getElementById('fuzzyInput');
    if (input) {
        setTimeout(() => input.focus(), 100);
    }
}

function focusChatInput() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) chatInput.focus();
}

function addChatContext() {
    const contextMsg = buildQuizContext();
    chatMessages.push({
        role: 'system',
        content: contextMsg
    });
    appendChatMessage('assistant', `I have context about your quiz. Current question: "${currentQuestion?.char || 'None'}".\n\nAsk me anything about vocabulary, grammar, or the current sentence!`);
}

function buildQuizContext() {
    const context = [];
    context.push('You are a helpful Chinese language tutor assistant. The user is practicing Chinese.');

    if (currentQuestion) {
        context.push(`\nCurrent question:`);
        context.push(`- Chinese: ${currentQuestion.char}`);
        if (currentQuestion.pinyin) context.push(`- Pinyin: ${currentQuestion.pinyin}`);
        if (currentQuestion.meaning) context.push(`- Meaning: ${currentQuestion.meaning}`);
    }

    if (currentFullSentence && currentFullSentence !== currentQuestion) {
        context.push(`\nFull sentence context:`);
        context.push(`- Chinese: ${currentFullSentence.char}`);
        if (currentFullSentence.meaning) context.push(`- Meaning: ${currentFullSentence.meaning}`);
    }

    context.push(`\nQuiz mode: ${mode}`);
    context.push(`Score: ${score}/${total}`);

    const recentWords = quizCharacters.slice(0, 10).map(w => `${w.char} (${w.pinyin || ''}) - ${w.meaning || ''}`).join('\n');
    if (recentWords) {
        context.push(`\nSome vocabulary from this lesson:\n${recentWords}`);
    }

    context.push('\nHelp the user understand the Chinese. Explain grammar, vocabulary, or cultural context as needed. Keep responses concise.');

    return context.join('\n');
}

function appendChatMessage(role, content) {
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = role === 'user'
        ? 'ml-8 p-2 bg-blue-50 rounded-lg text-sm text-gray-800'
        : 'mr-8 p-2 bg-gray-100 rounded-lg text-sm text-gray-800';

    msgDiv.innerHTML = `<div class="text-xs text-gray-500 mb-1">${role === 'user' ? 'You' : 'Assistant'}</div><div class="whitespace-pre-wrap">${escapeHtml(content)}</div>`;
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = '';
    appendChatMessage('user', message);

    chatMessages.push({ role: 'user', content: message });

    const typingDiv = document.createElement('div');
    typingDiv.className = 'mr-8 p-2 bg-gray-100 rounded-lg text-sm text-gray-500';
    typingDiv.innerHTML = 'Thinking...';
    typingDiv.id = 'chatTyping';
    document.getElementById('chatMessages')?.appendChild(typingDiv);

    try {
        const systemMsg = chatMessages.find(m => m.role === 'system');
        const userMsgs = chatMessages.filter(m => m.role !== 'system').slice(-10);
        document.getElementById('chatTyping')?.remove();
        const reply = await callGroqChat({
            system: systemMsg?.content || buildQuizContext(),
            messages: userMsgs,
            maxTokens: 500,
            temperature: 0.7
        }) || 'Sorry, I could not generate a response.';

        chatMessages.push({ role: 'assistant', content: reply });
        appendChatMessage('assistant', reply);

    } catch (error) {
        document.getElementById('chatTyping')?.remove();
        if (error.code === 'MISSING_API_KEY') {
            appendChatMessage('assistant', 'Please set your Groq API key first. Press Ctrl+K and search for "Set Groq API Key".');
        } else {
            appendChatMessage('assistant', `Error: ${error.message}`);
        }
    }
}

function saveChatPanelVisibility() {
    try {
        localStorage.setItem(CHAT_PANEL_KEY, chatPanelVisible ? '1' : '0');
    } catch (e) {}
}

function loadChatPanelVisibility() {
    try {
        const stored = localStorage.getItem(CHAT_PANEL_KEY);
        if (stored === '1') {
            setChatPanelVisible(true);
        }
    } catch (e) {}
}

// ============================================================================
// DICTATION CHAT MODE
// ============================================================================

function ensureDictationChatMode() {
    if (dictationChatMode) return dictationChatMode;
    const inputSection = document.querySelector('.input-section');
    if (!inputSection) return null;

    let container = document.getElementById('dictationChatMode');
    if (!container) {
        container = document.createElement('div');
        container.id = 'dictationChatMode';
        container.className = 'dictation-chat-mode';
        container.innerHTML = `
            <div class="dictation-chat-shell flex flex-col gap-3">
                <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div class="text-[11px] uppercase tracking-[0.25em] text-slate-400">Prompt</div>
                            <div id="dictationChatPromptText" class="text-base font-semibold text-slate-800">Listen to the audio and explain the meaning in English.</div>
                        </div>
                        <div class="flex gap-2">
                            <button id="dictationChatPromptSystemBtn" type="button" class="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-300 text-slate-600 hover:border-slate-400">System</button>
                            <button id="dictationChatPromptAiBtn" type="button" class="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-300 text-slate-600 hover:border-slate-400">AI Prompt</button>
                        </div>
                    </div>
                    <div id="dictationChatAudioSlot" class="flex items-center justify-center"></div>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div id="dictationChatStatus" class="text-sm font-semibold text-amber-600">Status: In progress</div>
                        <div class="flex gap-2">
                            <button id="dictationChatNextBtn" type="button" class="px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-500 text-white disabled:opacity-50" disabled>Next (N)</button>
                            <button id="dictationChatSkipBtn" type="button" class="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-300 text-slate-600 hover:border-slate-400">Skip</button>
                        </div>
                    </div>
                </div>
                <div id="dictationChatMessages" class="h-60 md:h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3"></div>
                <div class="flex flex-col gap-2">
                    <div class="flex gap-2">
                        <textarea id="dictationChatInput" rows="2" class="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Type your reply..."></textarea>
                        <button id="dictationChatSendBtn" class="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition">Send</button>
                    </div>
                    <div class="text-xs text-slate-400">Enter to send • Shift+Enter for newline • N = next when passed • Type "next" or "skip"</div>
                </div>
            </div>
        `;
        inputSection.appendChild(container);
    }

    dictationChatMode = container;
    dictationChatMessagesEl = container.querySelector('#dictationChatMessages');
    dictationChatInputEl = container.querySelector('#dictationChatInput');
    dictationChatSendBtn = container.querySelector('#dictationChatSendBtn');
    dictationChatNextBtn = container.querySelector('#dictationChatNextBtn');
    dictationChatSkipBtn = container.querySelector('#dictationChatSkipBtn');
    dictationChatPromptTextEl = container.querySelector('#dictationChatPromptText');
    dictationChatPromptSystemBtn = container.querySelector('#dictationChatPromptSystemBtn');
    dictationChatPromptAiBtn = container.querySelector('#dictationChatPromptAiBtn');
    dictationChatStatusEl = container.querySelector('#dictationChatStatus');
    dictationChatAudioSlot = container.querySelector('#dictationChatAudioSlot');

    if (dictationChatInputEl) {
        dictationChatInputEl.setAttribute('autocomplete', 'off');
        dictationChatInputEl.setAttribute('autocorrect', 'off');
        dictationChatInputEl.setAttribute('autocapitalize', 'off');
        dictationChatInputEl.setAttribute('spellcheck', 'false');
    }

    if (!container.dataset.bound) {
        container.dataset.bound = 'true';
        dictationChatSendBtn?.addEventListener('click', sendDictationChatMessage);
        dictationChatInputEl?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                requestDictationChatNext({ allowSkip: true });
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                sendDictationChatMessage();
            }
        });
        dictationChatNextBtn?.addEventListener('click', () => requestDictationChatNext());
        dictationChatSkipBtn?.addEventListener('click', () => skipDictationChatPrompt());
        dictationChatPromptSystemBtn?.addEventListener('click', () => setDictationChatPromptSource('system'));
        dictationChatPromptAiBtn?.addEventListener('click', () => setDictationChatPromptSource('ai'));
    }

    container.style.display = 'none';
    return container;
}

function buildDictationChatSystemPrompt() {
    const lines = [
        'You are a Chinese listening tutor running a chat-based dictation drill.',
        'The student hears Chinese audio and explains what it means.',
        'Focus on meaning only. Ignore English grammar, typos, or phrasing.',
        'Accept paraphrases, synonyms, and partial phrasing if the meaning is right.',
        'If they are off, ask a clarifying question or give a hint instead of the full answer.',
        'When you believe they have the meaning, end your reply with: PASS: yes',
        'Otherwise end with: PASS: no',
        'Keep replies to 1-3 sentences. Be warm and concise.'
    ];

    if (currentQuestion) {
        lines.push('');
        lines.push('Target sentence:');
        lines.push(`Chinese: ${currentQuestion.char || ''}`);
        if (currentQuestion.pinyin) lines.push(`Pinyin: ${currentQuestion.pinyin}`);
        if (currentQuestion.meaning) lines.push(`Reference meaning: ${currentQuestion.meaning}`);
    }

    return lines.join('\n');
}

function updateDictationChatPromptButtons() {
    const isSystem = dictationChatPromptSource === 'system';
    if (dictationChatPromptSystemBtn) {
        dictationChatPromptSystemBtn.classList.toggle('bg-blue-500', isSystem);
        dictationChatPromptSystemBtn.classList.toggle('text-white', isSystem);
        dictationChatPromptSystemBtn.classList.toggle('border-blue-500', isSystem);
    }
    if (dictationChatPromptAiBtn) {
        dictationChatPromptAiBtn.classList.toggle('bg-blue-500', !isSystem);
        dictationChatPromptAiBtn.classList.toggle('text-white', !isSystem);
        dictationChatPromptAiBtn.classList.toggle('border-blue-500', !isSystem);
    }
}

function updateDictationChatPromptText() {
    if (!dictationChatPromptTextEl) return;
    if (dictationChatPromptSource === 'ai') {
        if (dictationChatPromptGenerating) {
            dictationChatPromptTextEl.textContent = 'Generating an AI prompt...';
        } else if (dictationChatAiPrompt) {
            dictationChatPromptTextEl.textContent = dictationChatAiPrompt;
        } else {
            dictationChatPromptTextEl.textContent = 'Click "AI Prompt" to generate a custom prompt.';
        }
    } else {
        dictationChatPromptTextEl.textContent = 'Listen to the audio and explain the meaning in English (paraphrase is fine).';
    }
}

function setDictationChatPromptSource(source) {
    dictationChatPromptSource = source === 'ai' ? 'ai' : 'system';
    updateDictationChatPromptButtons();
    updateDictationChatPromptText();
    if (dictationChatPromptSource === 'ai' && !dictationChatAiPrompt && !dictationChatPromptGenerating) {
        generateDictationChatAiPrompt();
    }
}

async function generateDictationChatAiPrompt() {
    if (!currentQuestion) return;

    dictationChatPromptGenerating = true;
    updateDictationChatPromptText();

    try {
        const prompt = await callGroqChat({
            system: 'You create short listening prompts for Chinese students. Write a single short prompt or question that asks the student to explain the meaning of the sentence. Do NOT include the answer. Reply with only the prompt text.',
            messages: [{
                role: 'user',
                content: `Chinese: ${currentQuestion.char}\nReference meaning: ${currentQuestion.meaning || ''}`
            }],
            maxTokens: 120,
            temperature: 0.6
        });

        dictationChatAiPrompt = (prompt || '').trim() || 'AI prompt unavailable.';
    } catch (error) {
        if (error.code === 'MISSING_API_KEY') {
            dictationChatAiPrompt = 'Set your Groq API key to enable AI prompts.';
        } else {
            dictationChatAiPrompt = `AI prompt error: ${error.message}`;
        }
    } finally {
        dictationChatPromptGenerating = false;
        updateDictationChatPromptText();
    }
}

function updateDictationChatStatus(message) {
    if (!dictationChatStatusEl) return;
    if (dictationChatPassed) {
        dictationChatStatusEl.textContent = 'Status: Passed ✅ (press N or type "next")';
        dictationChatStatusEl.className = 'text-sm font-semibold text-emerald-600';
    } else {
        dictationChatStatusEl.textContent = message || 'Status: In progress';
        dictationChatStatusEl.className = 'text-sm font-semibold text-amber-600';
    }
    if (dictationChatNextBtn) {
        dictationChatNextBtn.disabled = !dictationChatPassed;
    }
}

function resetDictationChatSession() {
    dictationChatPassed = false;
    dictationChatLastUserAnswer = '';
    dictationChatAiPrompt = '';
    dictationChatPromptGenerating = false;
    dictationChatMessages = [{ role: 'system', content: buildDictationChatSystemPrompt() }];

    if (dictationChatMessagesEl) {
        dictationChatMessagesEl.innerHTML = '';
    }

    const intro = 'New prompt ready. Listen to the audio above and explain what it means. I will mark PASS when you have it.';
    appendDictationChatMessage('assistant', intro);
    dictationChatMessages.push({ role: 'assistant', content: intro });

    updateDictationChatPromptButtons();
    updateDictationChatPromptText();
    updateDictationChatStatus();

    if (dictationChatPromptSource === 'ai') {
        generateDictationChatAiPrompt();
    }
}

function appendDictationChatMessage(role, content) {
    if (!dictationChatMessagesEl) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = role === 'user'
        ? 'ml-8 p-3 bg-blue-50 rounded-xl text-sm text-slate-800'
        : 'mr-8 p-3 bg-white rounded-xl text-sm text-slate-800 border border-slate-200';
    const bodyHtml = role === 'assistant'
        ? renderMarkdownSafe(content)
        : `<div class="whitespace-pre-wrap">${escapeHtml(content)}</div>`;
    msgDiv.innerHTML = `<div class="text-[11px] text-slate-400 mb-1">${role === 'user' ? 'You' : 'Assistant'}</div>${bodyHtml}`;
    dictationChatMessagesEl.appendChild(msgDiv);
    dictationChatMessagesEl.scrollTop = dictationChatMessagesEl.scrollHeight;
}

function isDictationChatNextCommand(message) {
    const text = message.trim().toLowerCase();
    return text === 'next' || text === 'next prompt' || text === 'continue' || text === 'go on';
}

function isDictationChatSkipCommand(message) {
    const text = message.trim().toLowerCase();
    return text === 'skip' || text === 'give up' || text === 'pass' || text === 'move on';
}

function requestDictationChatNext(options = {}) {
    if (!dictationChatPassed) {
        if (options.allowSkip) {
            skipDictationChatPrompt();
        } else {
            updateDictationChatStatus('Status: Not passed yet (type "skip" to move on).');
        }
        return;
    }
    advanceDictationChatPrompt();
}

function advanceDictationChatPrompt() {
    if (!currentQuestion) return;
    if (!dictationChatPassed) {
        updateDictationChatStatus('Status: Not passed yet (type "skip" to move on).');
        return;
    }
    translationUpcomingQuestion = null;
    generateQuestion();
}

function skipDictationChatPrompt() {
    if (!currentQuestion) return;
    if (dictationChatPassed) {
        advanceDictationChatPrompt();
        return;
    }

    if (!answered) {
        answered = true;
        total++;
        lastAnswerCorrect = false;
        markSchedulerOutcome(false);
        playWrongSound();
        updateStats();
    }

    translationPreviousQuestion = currentQuestion;
    translationPreviousResult = {
        grade: 0,
        explanation: 'Skipped',
        userAnswer: dictationChatLastUserAnswer || '(skipped)',
        colorCodedAnswer: escapeHtml(dictationChatLastUserAnswer || '(skipped)'),
        reference: currentQuestion.meaning || ''
    };

    translationUpcomingQuestion = null;
    generateQuestion();
}

function handleDictationChatPass(userAnswer) {
    if (dictationChatPassed) return;
    dictationChatPassed = true;
    dictationChatLastUserAnswer = userAnswer;

    if (!answered) {
        answered = true;
        total++;
        score++;
        lastAnswerCorrect = true;
        markSchedulerOutcome(true);
        playCorrectSound();
        updateStats();
    }

    translationPreviousQuestion = currentQuestion;
    translationPreviousResult = {
        grade: 100,
        explanation: '',
        userAnswer: userAnswer || '',
        colorCodedAnswer: escapeHtml(userAnswer || ''),
        reference: currentQuestion?.meaning || ''
    };

    translationInlineFeedback = { message: 'Passed — press N for next prompt', type: 'correct' };
    updateDictationChatStatus();
}

async function sendDictationChatMessage() {
    if (!dictationChatInputEl) return;
    const message = dictationChatInputEl.value.trim();
    if (!message) return;

    if (isDictationChatNextCommand(message)) {
        requestDictationChatNext();
        dictationChatInputEl.value = '';
        return;
    }
    if (isDictationChatSkipCommand(message)) {
        dictationChatInputEl.value = '';
        skipDictationChatPrompt();
        return;
    }

    dictationChatInputEl.value = '';
    appendDictationChatMessage('user', message);
    dictationChatMessages.push({ role: 'user', content: message });
    dictationChatLastUserAnswer = message;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'mr-8 p-3 bg-white rounded-xl text-sm text-slate-500 border border-slate-200';
    typingDiv.innerHTML = 'Thinking...';
    typingDiv.id = 'dictationChatTyping';
    dictationChatMessagesEl?.appendChild(typingDiv);
    if (dictationChatMessagesEl) {
        dictationChatMessagesEl.scrollTop = dictationChatMessagesEl.scrollHeight;
    }

    try {
        const systemMsg = dictationChatMessages.find(m => m.role === 'system') || { role: 'system', content: buildDictationChatSystemPrompt() };
        const recent = dictationChatMessages.filter(m => m.role !== 'system').slice(-10);

        document.getElementById('dictationChatTyping')?.remove();
        let reply = await callGroqChat({
            system: systemMsg?.content || buildDictationChatSystemPrompt(),
            messages: recent,
            maxTokens: 350,
            temperature: 0.5
        }) || 'Sorry, I could not generate a response.';

        const passMatch = reply.match(/PASS:\s*(yes|no)/i);
        const passed = passMatch ? passMatch[1].toLowerCase() === 'yes' : false;
        reply = reply.split('\n').filter(line => !/^\s*PASS:\s*/i.test(line)).join('\n').trim();

        if (reply) {
            appendDictationChatMessage('assistant', reply);
            dictationChatMessages.push({ role: 'assistant', content: reply });
        }

        if (passed) {
            handleDictationChatPass(message);
        }

    } catch (error) {
        document.getElementById('dictationChatTyping')?.remove();
        if (error.code === 'MISSING_API_KEY') {
            const info = 'Please set your Groq API key first. Press Ctrl+K and search for "Set Groq API Key".';
            appendDictationChatMessage('assistant', info);
            dictationChatMessages.push({ role: 'assistant', content: info });
        } else {
            const errText = `Error: ${error.message}`;
            appendDictationChatMessage('assistant', errText);
            dictationChatMessages.push({ role: 'assistant', content: errText });
        }
    }
}
