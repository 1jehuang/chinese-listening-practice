// Command Palette - Works on all pages
// Can be customized per page by passing modes

function initCommandPalette(modes = []) {
    // Create command palette HTML
    const paletteHTML = `
        <div id="commandPalette" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" style="display: none;">
            <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4">
                <input type="text" id="paletteSearch"
                       class="w-full px-6 py-4 text-lg border-b border-gray-200 focus:outline-none"
                       placeholder="Search modes and pages...">
                <div id="paletteResults" class="max-h-96 overflow-y-auto"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', paletteHTML);

    const palette = document.getElementById('commandPalette');
    const search = document.getElementById('paletteSearch');
    const results = document.getElementById('paletteResults');

    let selectedIndex = 0;

    const pages = [
        { name: 'Home', url: 'home.html', type: 'page' },
        { name: 'Pinyin Practice', url: 'pinyin-practice.html', type: 'page' },
        { name: 'Radical Practice', url: 'radicals.html', type: 'page' },
        { name: 'Radical Practice 2', url: 'radical-practice-2.html', type: 'page' },
        { name: 'Character Sheet 1', url: 'character-sheet-1-quiz.html', type: 'page' },
        { name: 'Character Sheet 2', url: 'character-sheet-2-quiz.html', type: 'page' },
        { name: 'Character Sheet 3', url: 'character-sheet-3-quiz.html', type: 'page' },
        { name: 'Character Sheet 4', url: 'character-sheet-4-quiz.html', type: 'page' },
        { name: 'Pinyin Chart', url: 'pinyin-chart.html', type: 'page' },
        { name: 'Test 1 Review', url: 'test1-review.html', type: 'page' },
        { name: 'Test 1 Practice', url: 'test1-practice.html', type: 'page' },
        { name: 'Lesson 1: Two Maps', url: 'lesson-1-quiz.html', type: 'page' },
        { name: 'Lesson 1: Hard Subset', url: 'lesson-1-hard-subset.html', type: 'page' },
        { name: 'Dictation: Lesson 1', url: 'lesson-1-dictation.html', type: 'page' },
        { name: 'Test Modular Quiz', url: 'test-modular-quiz.html', type: 'page' }
    ];

    const allItems = [...modes, ...pages];

    function filterItems(query) {
        if (!query.trim()) return allItems;
        const lower = query.toLowerCase();
        return allItems.filter(item =>
            item.name.toLowerCase().includes(lower) ||
            (item.mode && item.mode.toLowerCase().includes(lower))
        );
    }

    function renderResults(items) {
        selectedIndex = 0;
        results.innerHTML = items.map((item, i) => `
            <div class="palette-item px-6 py-3 cursor-pointer hover:bg-blue-50 flex items-center justify-between ${i === 0 ? 'bg-blue-100' : ''}"
                 data-index="${i}">
                <div>
                    <div class="font-semibold">${item.name}</div>
                    <div class="text-sm text-gray-500">${item.type === 'mode' ? 'Quiz Mode' : 'Page'}</div>
                </div>
                <div class="text-sm text-gray-400">${item.type === 'mode' ? '→ Switch Mode' : '↗ Navigate'}</div>
            </div>
        `).join('');

        // Add click handlers
        results.querySelectorAll('.palette-item').forEach((el, i) => {
            el.addEventListener('click', () => selectItem(items[i]));
        });
    }

    function updateSelection(newIndex, items) {
        const itemEls = results.querySelectorAll('.palette-item');
        if (itemEls[selectedIndex]) {
            itemEls[selectedIndex].classList.remove('bg-blue-100');
        }
        selectedIndex = newIndex;
        if (itemEls[selectedIndex]) {
            itemEls[selectedIndex].classList.add('bg-blue-100');
            itemEls[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function selectItem(item) {
        if (item.type === 'mode') {
            const btn = document.querySelector(`[data-mode="${item.mode}"]`);
            if (btn) btn.click();
        } else if (item.type === 'page') {
            window.location.href = item.url;
        }
        closePalette();
    }

    function openPalette() {
        palette.style.display = 'flex';
        search.value = '';
        renderResults(allItems);
        setTimeout(() => search.focus(), 10);
    }

    function closePalette() {
        palette.style.display = 'none';
        search.value = '';
    }

    // Keyboard shortcut: Ctrl+K or Cmd+K
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (palette.style.display === 'none') {
                openPalette();
            } else {
                closePalette();
            }
        }
    });

    // Search input
    search.addEventListener('input', () => {
        const items = filterItems(search.value);
        renderResults(items);
    });

    // Arrow key navigation
    search.addEventListener('keydown', (e) => {
        const items = filterItems(search.value);
        const itemEls = results.querySelectorAll('.palette-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex < items.length - 1) {
                updateSelection(selectedIndex + 1, items);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex > 0) {
                updateSelection(selectedIndex - 1, items);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items[selectedIndex]) {
                selectItem(items[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closePalette();
        }
    });

    // Close on background click
    palette.addEventListener('click', (e) => {
        if (e.target === palette) {
            closePalette();
        }
    });
}
