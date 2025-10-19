// Command Palette - works on all pages and can be customized per page

const DEFAULT_PAGES = [
    { name: 'Home', url: 'home.html', type: 'page', keywords: 'dashboard start overview' },
    { name: 'Pinyin Practice', url: 'pinyin-practice.html', type: 'page', keywords: 'typing drill listening' },
    { name: 'Pinyin Chart', url: 'pinyin-chart.html', type: 'page', keywords: 'reference initials finals table' },
    { name: 'Toneless Minimal Pairs', url: 'toneless-minimal-pairs.html', type: 'page', keywords: 'tones listening minimal pairs' },
    { name: 'Radical Practice', url: 'radicals.html', type: 'page', keywords: 'radicals components drill' },
    { name: 'Radical Practice 2', url: 'radical-practice-2.html', type: 'page', keywords: 'radicals components drill advanced' },
    { name: 'Character Sheet 1', url: 'character-sheet-1-quiz.html', type: 'page', keywords: 'lesson 1 characters quiz' },
    { name: 'Character Sheet 1 (Temp)', url: 'character-sheet-1-quiz-temp.html', type: 'page', keywords: 'lesson 1 staging temp' },
    { name: 'Character Sheet 2', url: 'character-sheet-2-quiz.html', type: 'page', keywords: 'lesson 2 characters quiz' },
    { name: 'Character Sheet 3', url: 'character-sheet-3-quiz.html', type: 'page', keywords: 'lesson 3 characters quiz' },
    { name: 'Character Sheet 4', url: 'character-sheet-4-quiz.html', type: 'page', keywords: 'lesson 4 characters quiz' },
    { name: 'Most Common 2500 Characters', url: 'common-characters.html', type: 'page', keywords: 'frequency list common 2500 quiz' },
    { name: 'Lesson 1 Quiz', url: 'lesson-1-quiz.html', type: 'page', keywords: 'lesson 1 two maps quiz' },
    { name: 'Lesson 1 Hard Subset', url: 'lesson-1-hard-subset.html', type: 'page', keywords: 'lesson 1 challenge drill' },
    { name: 'Lesson 1 Dictation', url: 'lesson-1-dictation.html', type: 'page', keywords: 'lesson 1 listening dictation' },
    { name: 'Lesson 2 Part 1', url: 'lesson-2-part-1.html', type: 'page', keywords: 'lesson 2 part1 quiz' },
    { name: 'Lesson 2 Part 2', url: 'lesson-2-part-2.html', type: 'page', keywords: 'lesson 2 part2 quiz' },
    { name: 'Lesson 2 Cumulative', url: 'lesson-2-cumulative.html', type: 'page', keywords: 'lesson 2 cumulative all quiz' },
    { name: 'Lesson 2 Dictation', url: 'lesson-2-dictation.html', type: 'page', keywords: 'lesson 2 listening dictation' },
    { name: 'Lesson 3 Part 1', url: 'lesson-3-part-1.html', type: 'page', keywords: 'lesson 3 part1 quiz americans' },
    { name: 'Lesson 3 Part 2', url: 'lesson-3-part-2.html', type: 'page', keywords: 'lesson 3 part2 quiz americans' },
    { name: 'Lesson 3 Cumulative', url: 'lesson-3-cumulative.html', type: 'page', keywords: 'lesson 3 cumulative all quiz americans' },
    { name: 'Test 1 Practice', url: 'test1-practice.html', type: 'page', keywords: 'test 1 practice review' },
    { name: 'Test 1 Review', url: 'test1-review.html', type: 'page', keywords: 'test 1 review analysis' },
    { name: 'Modular Quiz Sandbox', url: 'test-modular-quiz.html', type: 'page', keywords: 'sandbox modular dev' },
    { name: 'Audio Prompt Tester', url: 'test-audio.html', type: 'page', keywords: 'audio sound test harness' },
    { name: 'Pinyin Input Tester', url: 'test-pinyin-input.html', type: 'page', keywords: 'pinyin input ime tester' },
    { name: 'Syllable Entry Harness', url: 'test-syllable-entry.html', type: 'page', keywords: 'syllable entry experiment' }
];

const PALETTE_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function initCommandPalette(config = []) {
    const normalizedConfig = normalizeConfig(config);

    if (window.__commandPaletteState) {
        window.__commandPaletteState.updateConfig(normalizedConfig);
        return;
    }

    const paletteHTML = `
        <div id="commandPalette" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" style="display: none;">
            <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4">
                <input type="text" id="paletteSearch"
                       class="w-full px-6 py-4 text-lg border-b border-gray-200 focus:outline-none"
                       placeholder="${normalizedConfig.searchPlaceholder}">
                <div id="paletteResults" class="max-h-96 overflow-y-auto"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', paletteHTML);

    const palette = document.getElementById('commandPalette');
    const search = document.getElementById('paletteSearch');
    const results = document.getElementById('paletteResults');

    let baseItems = normalizedConfig.items;
    let filteredItems = baseItems;
    let availableItems = [];
    let selectedIndex = 0;

    function isElementVisible(el) {
        if (!el) return false;
        if (el.offsetParent !== null) return true;
        if (typeof el.getClientRects === 'function' && el.getClientRects().length > 0) return true;
        return false;
    }

    function getInputLabel(el) {
        if (!el) return null;
        const datasetLabel = el.dataset.commandLabel || el.dataset.commandName;
        const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
        const placeholder = el.placeholder;
        const title = el.title;
        const nameAttr = el.name;
        const idAttr = el.id;

        const label = datasetLabel || ariaLabel || placeholder || title || nameAttr || idAttr;
        if (!label) return null;
        return label.trim();
    }

    function getFocusableInputs() {
        const selector = 'input, textarea, [contenteditable="true"]';
        const allowedTypes = new Set(['', 'text', 'search', 'email', 'tel', 'url', 'number', 'password']);

        return Array.from(document.querySelectorAll(selector))
            .filter(el => {
                if (!el || el.dataset.commandFocusable === 'false') return false;
                if (el.id === 'paletteSearch') return false;
                if (el.disabled) return false;
                if (el.readOnly) return false;
                if (el.tagName === 'INPUT') {
                    const type = (el.type || '').toLowerCase();
                    if (type === 'hidden' || (!allowedTypes.has(type) && type !== '')) return false;
                }
                return true;
            })
            .map(el => ({ element: el, label: getInputLabel(el) }))
            .filter(item => Boolean(item.label));
    }

    function focusElement(el) {
        if (!el) return;
        try {
            if (typeof el.focus === 'function') {
                el.focus({ preventScroll: false });
            }
        } catch (err) {
            console.warn('Failed to focus element', err);
        }

        if (typeof el.select === 'function') {
            try {
                el.select();
            } catch (err) {
                // Some inputs (e.g., type=number) might not support select; ignore.
            }
        } else if (el.isContentEditable) {
            const range = document.createRange();
            range.selectNodeContents(el);
            const selection = window.getSelection && window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    function computeAvailableItems() {
        return baseItems.filter(item => {
            if (typeof item.available === 'function') {
                try {
                    return item.available();
                } catch (err) {
                    console.warn('Command palette availability check failed', err);
                    return false;
                }
            }
            return true;
        });
    }

    function filterItems(query, items) {
        const trimmed = query.trim().toLowerCase();
        if (!trimmed) return items.slice();

        const condensedQuery = trimmed.replace(/\s+/g, '');
        const results = [];

        items.forEach(item => {
            const score = computeItemScore(trimmed, condensedQuery, item);
            if (score > Number.NEGATIVE_INFINITY) {
                results.push({ item, score });
            }
        });

        results.sort((a, b) => {
            if (b.score === a.score) {
                return a.item.name.localeCompare(b.item.name);
            }
            return b.score - a.score;
        });

        return results.map(entry => entry.item);
    }

    function getActionLabel(item) {
        if (item.actionLabel) return item.actionLabel;
        switch (item.type) {
            case 'mode':
                return 'Switch Mode';
            case 'page':
                return 'Navigate';
            default:
                return 'Run Command';
        }
    }

    function renderResults(items) {
        filteredItems = items;
        if (!filteredItems.length) {
            results.innerHTML = `
                <div class="px-6 py-8 text-center text-gray-500">
                    No commands match “${search.value.trim()}”.
                </div>
            `;
            selectedIndex = -1;
            return;
        }

        selectedIndex = 0;
        results.innerHTML = filteredItems.map((item, index) => {
            const description = item.description || getDefaultDescription(item);
            const hasShortcut = Boolean(item.shortcut);
            const shortcutBadge = hasShortcut
                ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 border border-gray-200 rounded px-2 py-0.5 ml-2">${item.shortcut}</span>`
                : '';
            const actionLabelClass = hasShortcut ? 'ml-3' : '';
            return `
                <div class="palette-item px-6 py-3 cursor-pointer hover:bg-blue-50 flex items-center justify-between ${index === 0 ? 'bg-blue-100' : ''}"
                     data-index="${index}">
                    <div>
                        <div class="font-semibold">${item.name}</div>
                        <div class="text-sm text-gray-500">${description}</div>
                    </div>
                    <div class="flex items-center text-sm text-gray-400">
                        ${shortcutBadge}
                        <span class="${actionLabelClass}">${getActionLabel(item)}</span>
                    </div>
                </div>
            `;
        }).join('');

        results.querySelectorAll('.palette-item').forEach((el) => {
            el.addEventListener('click', () => {
                const index = Number(el.dataset.index);
                if (filteredItems[index]) {
                    selectItem(filteredItems[index]);
                }
            });
        });
    }

    function updateSelection(newIndex) {
        if (!filteredItems.length) return;
        const itemEls = results.querySelectorAll('.palette-item');
        if (itemEls[selectedIndex]) {
            itemEls[selectedIndex].classList.remove('bg-blue-100');
        }
        selectedIndex = Math.max(0, Math.min(newIndex, filteredItems.length - 1));
        if (itemEls[selectedIndex]) {
            itemEls[selectedIndex].classList.add('bg-blue-100');
            itemEls[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function selectItem(item) {
        closePalette();

        if (item.type === 'mode') {
            const btn = document.querySelector(`[data-mode="${item.mode}"]`);
            if (btn) btn.click();
            return;
        }

        if (item.type === 'page') {
            window.location.href = item.url;
            return;
        }

        if (typeof item.action === 'function') {
            try {
                item.action();
            } catch (err) {
                console.error('Command palette action failed', err);
            }
        } else if (typeof item.onSelect === 'function') {
            try {
                item.onSelect();
            } catch (err) {
                console.error('Command palette onSelect failed', err);
            }
        }
    }

    function openPalette({ keepQuery = false } = {}) {
        palette.style.display = 'flex';
        if (!keepQuery) {
            search.value = '';
        }
        availableItems = computeAvailableItems();
        const itemsToRender = filterItems(search.value, availableItems);
        renderResults(itemsToRender);
        setTimeout(() => search.focus(), 10);
    }

    function closePalette() {
        palette.style.display = 'none';
        search.value = '';
        filteredItems = baseItems;
        selectedIndex = 0;
    }

    function togglePalette(triggeredByShortcut) {
        const isOpen = palette.style.display !== 'none';
        if (isOpen) {
            closePalette();
        } else {
            openPalette({ keepQuery: triggeredByShortcut && search.value.length > 0 });
        }
    }

    function isTypingContext(target) {
        if (!target) return false;
        if (PALETTE_INPUT_TAGS.has(target.tagName)) return true;
        return Boolean(target.isContentEditable);
    }

    document.addEventListener('keydown', (e) => {
        const target = e.target;
        const paletteVisible = palette.style.display !== 'none';
        const inTypingContext = isTypingContext(target);

        const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
        if (isCtrlK) {
            e.preventDefault();
            togglePalette(true);
            return;
        }

        if (!paletteVisible && !inTypingContext && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === ':') {
            e.preventDefault();
            openPalette();
        }
    });

    search.addEventListener('input', () => {
        availableItems = computeAvailableItems();
        const items = filterItems(search.value, availableItems);
        renderResults(items);
    });

    search.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            updateSelection(selectedIndex + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            updateSelection(selectedIndex - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
                selectItem(filteredItems[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closePalette();
        }
    });

    palette.addEventListener('click', (e) => {
        if (e.target === palette) {
            closePalette();
        }
    });

    window.__commandPaletteState = {
        updateConfig(newConfig) {
            baseItems = newConfig.items;
            if (typeof newConfig.searchPlaceholder === 'string') {
                search.placeholder = newConfig.searchPlaceholder;
            }

            availableItems = computeAvailableItems();

            if (palette.style.display !== 'none') {
                const items = filterItems(search.value, availableItems);
                renderResults(items);
            }
        },
        open: openPalette,
        close: closePalette
    };

    function normalizeItem(rawItem) {
        if (!rawItem || typeof rawItem !== 'object') return null;
        if (!rawItem.name) return null;

        const item = { ...rawItem };
        if (!item.type) {
            if (item.mode) {
                item.type = 'mode';
            } else if (item.url) {
                item.type = 'page';
            } else {
                item.type = 'action';
            }
        }

        if (typeof item.keywords === 'undefined') {
            item.keywords = '';
        } else if (Array.isArray(item.keywords)) {
            item.keywords = item.keywords.join(' ');
        }

        if (typeof item.description !== 'string') {
            item.description = '';
        }

        const searchTokens = [
            item.name,
            item.mode,
            item.url,
            item.keywords,
            item.description,
            item.shortcut
        ].filter(Boolean).join(' ').toLowerCase();

        item.searchTokens = searchTokens;
        item.compactTokens = searchTokens.replace(/\s+/g, '');
        item.nameLower = (item.name || '').toLowerCase();
        item.initials = (item.name || '')
            .split(/[\s/:-]+/)
            .filter(Boolean)
            .map(part => part[0])
            .join('')
            .toLowerCase();
        return item;
    }

    function normalizeConfig(rawConfig) {
        const base = {
            modes: [],
            actions: [],
            extraItems: [],
            pages: DEFAULT_PAGES.map(page => ({ ...page })),
            searchPlaceholder: 'Search pages, modes, and commands…'
        };

        let configObject = rawConfig;
        if (Array.isArray(rawConfig)) {
            configObject = { modes: rawConfig };
        }

        if (!configObject || typeof configObject !== 'object') {
            configObject = {};
        }

        if (Array.isArray(configObject.modes)) {
            base.modes = configObject.modes.slice();
        }
        if (Array.isArray(configObject.actions)) {
            base.actions = configObject.actions.slice();
        }
        if (Array.isArray(configObject.extraItems)) {
            base.extraItems = configObject.extraItems.slice();
        }

        if (configObject.pages === null) {
            base.pages = [];
        } else if (Array.isArray(configObject.pages)) {
            base.pages = configObject.pages.slice();
        }

        if (typeof configObject.searchPlaceholder === 'string' && configObject.searchPlaceholder.trim()) {
            base.searchPlaceholder = configObject.searchPlaceholder.trim();
        }

        const contextualActions = createContextualActions();
        const combinedItems = [
            ...base.actions,
            ...contextualActions,
            ...base.modes,
            ...base.pages,
            ...base.extraItems
        ].map(normalizeItem).filter(Boolean);

        const dedupedItems = dedupeItems(combinedItems);

        return {
            items: dedupedItems,
            searchPlaceholder: base.searchPlaceholder
        };
    }

    function dedupeItems(items) {
        const seen = new Set();
        const result = [];
        items.forEach(item => {
            const key = `${item.type || 'action'}::${item.mode || item.url || item.name}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(item);
            }
        });
        return result;
    }

    function getDefaultDescription(item) {
        switch (item.type) {
            case 'mode':
                return 'Quiz Mode';
            case 'page':
                return 'Page';
            default:
                return 'Action';
        }
    }

    function createContextualActions() {
        const actions = [];

        const answerInput = document.getElementById('answerInput');
        if (answerInput) {
            actions.push({
                name: 'Focus Answer Input',
                type: 'action',
                description: 'Move the cursor to the main answer field',
                keywords: 'focus answer input field cursor',
                shortcut: '/',
                action: () => {
                    const input = document.getElementById('answerInput');
                    if (input) {
                        input.focus();
                        if (typeof input.select === 'function') {
                            input.select();
                        }
                    }
                },
                available: () => {
                    const input = document.getElementById('answerInput');
                    return Boolean(input && input.offsetParent !== null);
                }
            });

            actions.push({
                name: 'Clear Answer Input',
                type: 'action',
                description: 'Erase what you have typed so far',
                keywords: 'clear erase answer input reset',
                action: () => {
                    const input = document.getElementById('answerInput');
                    if (input) {
                        input.value = '';
                        input.focus();
                    }
                },
                available: () => {
                    const input = document.getElementById('answerInput');
                    return Boolean(input && input.offsetParent !== null && input.value);
                }
            });
        }

        if (typeof window.checkAnswer === 'function') {
            actions.push({
                name: 'Check Answer',
                type: 'action',
                description: 'Submit your response for grading',
                keywords: 'submit check grade answer enter',
                shortcut: 'Enter',
                action: () => window.checkAnswer(),
                available: () => typeof window.checkAnswer === 'function'
            });
        }

        if (typeof window.generateQuestion === 'function') {
            actions.push({
                name: 'Skip Question',
                type: 'action',
                description: 'Move on to the next prompt immediately',
                keywords: 'skip next question new prompt',
                shortcut: 'Ctrl+J',
                action: () => window.generateQuestion()
            });
        }

        actions.push({
            name: 'Replay Audio Prompt',
            type: 'action',
            description: 'Play the current audio clue again',
            keywords: 'audio sound replay listen',
            action: () => {
                if (typeof window.currentAudioPlayFunc === 'function') {
                    window.currentAudioPlayFunc();
                } else {
                    const btn = document.getElementById('playAudioBtn');
                    if (btn) btn.click();
                }
            },
            available: () => typeof window.currentAudioPlayFunc === 'function' || Boolean(document.getElementById('playAudioBtn'))
        });

        if (typeof window.clearCanvas === 'function') {
            actions.push({
                name: 'Clear Drawing Canvas',
                type: 'action',
                description: 'Erase your strokes in draw mode',
                keywords: 'clear drawing canvas erase handwriting',
                action: () => window.clearCanvas(),
                available: () => typeof window.clearCanvas === 'function' && window.mode === 'draw-char'
            });
        }

        if (typeof window.submitDrawing === 'function') {
            actions.push({
                name: 'Submit Drawing',
                type: 'action',
                description: 'Send your handwriting to recognizer',
                keywords: 'submit drawing handwriting check ocr',
                action: () => window.submitDrawing(),
                available: () => typeof window.submitDrawing === 'function' && window.mode === 'draw-char'
            });
        }

        if (typeof window.revealDrawingAnswer === 'function') {
            actions.push({
                name: 'Reveal Draw Answer',
                type: 'action',
                description: 'Show the correct character for draw mode',
                keywords: 'reveal answer drawing handwriting show',
                action: () => window.revealDrawingAnswer(),
                available: () => typeof window.revealDrawingAnswer === 'function' && window.mode === 'draw-char'
            });
        }

        const studyList = document.getElementById('studyList');
        if (studyList) {
            actions.push({
                name: 'Scroll to Study List',
                type: 'action',
                description: 'Jump down to the study reference section',
                keywords: 'study list reference review',
                action: () => {
                    const el = document.getElementById('studyList');
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                },
                available: () => Boolean(document.getElementById('studyList'))
            });
        }

        const statsBar = document.getElementById('stats');
        if (statsBar) {
            actions.push({
                name: 'Scroll to Stats',
                type: 'action',
                description: 'View your current score and streak',
                keywords: 'stats score streak progress',
                action: () => {
                    const el = document.getElementById('stats');
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                },
                available: () => Boolean(document.getElementById('stats'))
            });
        }

        actions.push({
            name: 'Reload Page',
            type: 'action',
            description: 'Refresh the current page',
            keywords: 'reload refresh restart reset',
            shortcut: 'Ctrl+R',
            action: () => window.location.reload()
        });

        const seenLabels = new Set();
        getFocusableInputs().forEach(({ element, label }) => {
            const normalizedLabel = label || '';
            if (!normalizedLabel) return;
            const stableLabel = normalizedLabel.toLowerCase();
            if (element.id === 'answerInput') return;
            if (seenLabels.has(stableLabel)) return;
            seenLabels.add(stableLabel);

            const actionLabel = normalizedLabel.length > 40
                ? `${normalizedLabel.slice(0, 37)}…`
                : normalizedLabel;

            actions.push({
                name: `Focus “${actionLabel}” Field`,
                type: 'action',
                description: `Move the cursor to “${normalizedLabel}”`,
                keywords: `focus ${normalizedLabel} input field text bar`,
                action: () => focusElement(element),
                available: () => element.isConnected && isElementVisible(element)
            });
        });

        return actions;
    }

    function computeItemScore(query, condensedQuery, item) {
        if (!item) return Number.NEGATIVE_INFINITY;

        let best = Number.NEGATIVE_INFINITY;
        const nameLower = item.nameLower || '';
        const tokens = item.searchTokens || '';
        const compact = item.compactTokens || '';
        const initials = item.initials || '';

        if (!query) return 0;

        if (nameLower.startsWith(query)) {
            best = Math.max(best, 1000);
        }

        if (query.length > 1) {
            const nameWords = nameLower.split(/\s+/);
            nameWords.forEach(word => {
                if (word && word.startsWith(query)) {
                    best = Math.max(best, 920);
                }
            });
        }

        const nameIndex = nameLower.indexOf(query);
        if (nameIndex !== -1) {
            best = Math.max(best, 880 - nameIndex * 5);
        }

        const tokensIndex = tokens.indexOf(query);
        if (tokensIndex !== -1) {
            best = Math.max(best, 840 - tokensIndex);
        }

        const queryParts = query.split(/\s+/).filter(Boolean);
        if (queryParts.length > 1) {
            const allFound = queryParts.every(part => tokens.indexOf(part) !== -1);
            if (allFound) {
                best = Math.max(best, 820 - (queryParts.length - 1) * 5);
            }
        }

        if (condensedQuery) {
            const compactIndex = compact.indexOf(condensedQuery);
            if (compactIndex !== -1) {
                best = Math.max(best, 780 - compactIndex);
            }

            if (initials && initials.indexOf(condensedQuery) !== -1) {
                best = Math.max(best, 760 - initials.indexOf(condensedQuery) * 10);
            }

            const subseq = subsequenceScore(condensedQuery, compact);
            if (subseq > Number.NEGATIVE_INFINITY) {
                best = Math.max(best, 600 + subseq);
            }
        }

        return best;
    }

    function subsequenceScore(query, text) {
        if (!query || !text) return Number.NEGATIVE_INFINITY;

        let score = 0;
        let lastIndex = -1;

        for (let i = 0; i < query.length; i++) {
            const char = query[i];
            const foundIndex = text.indexOf(char, lastIndex + 1);
            if (foundIndex === -1) {
                return Number.NEGATIVE_INFINITY;
            }

            const gap = lastIndex === -1 ? foundIndex : foundIndex - lastIndex - 1;
            score += Math.max(1, 12 - Math.min(gap, 11));
            lastIndex = foundIndex;
        }

        const spreadPenalty = Math.max(0, lastIndex - (query.length - 1));
        score -= Math.min(spreadPenalty, 20);
        return score;
    }
}
