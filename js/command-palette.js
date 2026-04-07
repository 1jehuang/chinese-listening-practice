// Command Palette - works on all pages and can be customized per page

const EXPERIMENTAL_UI_KEY = 'experimental_ui_enabled';
const GROQ_API_KEY_STORAGE = 'groq_api_key';

const DEFAULT_PAGES = [
    { name: 'Home', url: 'home.html', type: 'page', keywords: 'dashboard start overview' },
    { name: 'Pinyin Practice', url: 'pinyin-practice.html', type: 'page', keywords: 'typing drill listening' },
    { name: 'Pinyin Chart', url: 'pinyin-chart.html', type: 'page', keywords: 'reference initials finals table' },
    { name: 'Context Listening Comprehension', url: 'listening-context.html', type: 'page', keywords: 'context listening comprehension vocabulary sentence meaning audio' },
    { name: 'Context Listening · Easy', url: 'listening-context-easy.html', type: 'page', keywords: 'context listening easy comprehension beginner audio' },
    { name: 'Sentence Meaning Drill', url: 'context-sentence.html', type: 'page', keywords: 'sentence listening comprehension summary audio meaning' },
    { name: 'Phrase Meaning Drill', url: 'phrase-meaning-quiz.html', type: 'page', keywords: 'phrase meaning comprehension quiz' },
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
    { name: 'Lesson 3 Dictation', url: 'lesson-3-dictation.html', type: 'page', keywords: 'lesson 3 listening dictation' },
    { name: 'Lesson 4 Part 1', url: 'lesson-4-part-1.html', type: 'page', keywords: 'lesson 4 part1 quiz americans study chinese pages 46 47 48' },
    { name: 'Lesson 4 Part 2', url: 'lesson-4-part-2.html', type: 'page', keywords: 'lesson 4 part2 quiz americans study chinese registration dialogue' },
    { name: 'Lesson 4 Cumulative', url: 'lesson-4-cumulative.html', type: 'page', keywords: 'lesson 4 cumulative all quiz americans study chinese' },
    { name: 'Lessons 1-4 Common Words', url: 'lesson-1-4-common-words.html', type: 'page', keywords: 'lessons 1 2 3 4 common words vocab dialogue combined' },
    { name: 'Lesson 5 Part 1', url: 'lesson-5-part-1.html', type: 'page', keywords: 'lesson 5 part1 quiz am i from sichuan vocabulary' },
    { name: 'Lesson 5 Part 2', url: 'lesson-5-part-2.html', type: 'page', keywords: 'lesson 5 part2 quiz vocabulary page 64' },
    { name: 'Lesson 5 Cumulative', url: 'lesson-5-cumulative.html', type: 'page', keywords: 'lesson 5 cumulative quiz vocabulary set' },
    { name: 'Lesson 5 Dictation', url: 'lesson-5-dictation.html', type: 'page', keywords: 'lesson 5 dictation dialogue listening' },
    { name: 'Lesson 6 Part 1', url: 'lesson-6-part-1.html', type: 'page', keywords: 'lesson 6 part1 quiz don\'t worry bie danxin pages 76 77' },
    { name: 'Lesson 6 Part 2', url: 'lesson-6-part-2.html', type: 'page', keywords: 'lesson 6 part2 quiz vocabulary pages 78 79 bie danxin' },
    { name: 'Lesson 6 Cumulative', url: 'lesson-6-cumulative.html', type: 'page', keywords: 'lesson 6 cumulative quiz vocabulary set bie danxin' },
    { name: 'Lesson 6 Dictation', url: 'lesson-6-dictation.html', type: 'page', keywords: 'lesson 6 dictation dialogue bie danxin listening' },
    { name: 'Lesson 7 Part 1', url: 'lesson-7-part-1.html', type: 'page', keywords: 'lesson 7 part1 quiz pages 88 89 vocab nannv tongzhu' },
    { name: 'Lesson 7 Part 2', url: 'lesson-7-part-2.html', type: 'page', keywords: 'lesson 7 part2 quiz pages 90 91 92 vocab nannv tongzhu' },
    { name: 'Lesson 7 Cumulative', url: 'lesson-7-cumulative.html', type: 'page', keywords: 'lesson 7 cumulative pages 88 89 90 91 92 nannv tongzhu' },
    { name: 'Lesson 7 Dictation', url: 'lesson-7-dictation.html', type: 'page', keywords: 'lesson 7 dictation textbook nannv tongzhu' },
    { name: 'Lessons 4-7 Common Words', url: 'lesson-4-7-common-words.html', type: 'page', keywords: 'lessons 4 5 6 7 common words dialogue vocab combined' },
    { name: 'Lesson 8 Part 1', url: 'lesson-8-part-1.html', type: 'page', keywords: 'lesson 8 part1 quiz pages 104 105 vocab kan dianying movie' },
    { name: 'Lesson 8 Part 2', url: 'lesson-8-part-2.html', type: 'page', keywords: 'lesson 8 part2 quiz pages 106 107 vocab kan dianying' },
    { name: 'Lesson 8 Cumulative', url: 'lesson-8-cumulative.html', type: 'page', keywords: 'lesson 8 cumulative vocab kan dianying' },
    { name: 'Lesson 8 Dictation', url: 'lesson-8-dictation.html', type: 'page', keywords: 'lesson 8 dictation movie watching' },
    { name: 'Lessons 1-8 Cumulative', url: 'lesson-1-8-cumulative.html', type: 'page', keywords: 'lessons 1 2 3 4 5 6 7 8 cumulative vocab review milestone' },
    { name: 'Lesson 9 Part 1', url: 'lesson-9-part-1.html', type: 'page', keywords: 'lesson 9 part1 quiz pages 116 117 wo yao qu zhongguo 我要去中国' },
    { name: 'Lesson 9 Part 2', url: 'lesson-9-part-2.html', type: 'page', keywords: 'lesson 9 part2 quiz pages 118 119 wo yao qu zhongguo 我要去中国' },
    { name: 'Lesson 9 Cumulative', url: 'lesson-9-cumulative.html', type: 'page', keywords: 'lesson 9 cumulative vocab wo yao qu zhongguo 我要去中国' },
    { name: 'Lesson 9 Dictation', url: 'lesson-9-dictation.html', type: 'page', keywords: 'lesson 9 dictation letter listening 我要去中国' },
    { name: 'Lesson 10 Part 1', url: 'lesson-10-part-1.html', type: 'page', keywords: 'lesson 10 part1 quiz pages 124 125 chuguo qian de zhunbei 出国前的准备' },
    { name: 'Lesson 10 Part 2', url: 'lesson-10-part-2.html', type: 'page', keywords: 'lesson 10 part2 quiz pages 126 127 chuguo qian de zhunbei 出国前的准备' },
    { name: 'Lesson 10 Cumulative', url: 'lesson-10-cumulative.html', type: 'page', keywords: 'lesson 10 cumulative vocab chuguo qian de zhunbei 出国前的准备' },
    { name: 'Lesson 10 Dictation', url: 'lesson-10-dictation.html', type: 'page', keywords: 'lesson 10 dictation listening 出国前的准备' },
    { name: 'Lesson 11 Part 1', url: 'lesson-11-part-1.html', type: 'page', keywords: 'lesson 11 part1 quiz pages 132 133 weishenme xue zhongwen 为什么学中文' },
    { name: 'Lesson 11 Part 2', url: 'lesson-11-part-2.html', type: 'page', keywords: 'lesson 11 part2 quiz pages 134 135 weishenme xue zhongwen 为什么学中文' },
    { name: 'Lesson 11 Cumulative', url: 'lesson-11-cumulative.html', type: 'page', keywords: 'lesson 11 cumulative vocab weishenme xue zhongwen 为什么学中文' },
    { name: 'Lesson 11 Dictation', url: 'lesson-11-dictation.html', type: 'page', keywords: 'lesson 11 dictation listening 为什么学中文' },
    { name: 'Lesson 12 Part 1', url: 'lesson-12-part-1.html', type: 'page', keywords: 'lesson 12 part1 quiz pages 144 145 zuo haizi ye bu rongyi 做孩子也不容易' },
    { name: 'Lesson 12 Part 2', url: 'lesson-12-part-2.html', type: 'page', keywords: 'lesson 12 part2 quiz pages 146 147 zuo haizi ye bu rongyi 做孩子也不容易' },
    { name: 'Lesson 12 Cumulative', url: 'lesson-12-cumulative.html', type: 'page', keywords: 'lesson 12 cumulative vocab zuo haizi ye bu rongyi 做孩子也不容易' },
    { name: 'Lesson 12 Dictation', url: 'lesson-12-dictation.html', type: 'page', keywords: 'lesson 12 dictation listening 做孩子也不容易' },
    { name: 'Lesson 13 Part 1', url: 'lesson-13-part-1.html', type: 'page', keywords: 'lesson 13 part1 quiz pages 154 155 shuo biaozhun de putonghua 说标准的普通话' },
    { name: 'Lesson 13 Part 2', url: 'lesson-13-part-2.html', type: 'page', keywords: 'lesson 13 part2 quiz page 156 shuo biaozhun de putonghua 说标准的普通话' },
    { name: 'Lesson 13 Cumulative', url: 'lesson-13-cumulative.html', type: 'page', keywords: 'lesson 13 cumulative vocab shuo biaozhun de putonghua 说标准的普通话' },
    { name: 'Lesson 13 Dictation', url: 'lesson-13-dictation.html', type: 'page', keywords: 'lesson 13 dictation listening 说标准的普通话' },
    { name: 'Lesson 14 Part 1', url: 'lesson-14-part-1.html', type: 'page', keywords: 'lesson 14 part1 quiz pages 166 167 fantizi he jiantizi 繁体字和简体字' },
    { name: 'Lesson 14 Part 2', url: 'lesson-14-part-2.html', type: 'page', keywords: 'lesson 14 part2 quiz pages 168 169 fantizi he jiantizi 繁体字和简体字' },
    { name: 'Lesson 14 Cumulative', url: 'lesson-14-cumulative.html', type: 'page', keywords: 'lesson 14 cumulative vocab fantizi he jiantizi 繁体字和简体字' },
    { name: 'Lesson 14 Dictation', url: 'lesson-14-dictation.html', type: 'page', keywords: 'lesson 14 dictation listening fantizi he jiantizi 繁体字和简体字' },
    { name: 'Lesson 15 Part 1', url: 'lesson-15-part-1.html', type: 'page', keywords: 'lesson 15 part1 quiz pages 178 179 dou guai ni mama 都怪你妈妈' },
    { name: 'Lesson 15 Part 2', url: 'lesson-15-part-2.html', type: 'page', keywords: 'lesson 15 part2 quiz pages 180 181 182 dou guai ni mama 都怪你妈妈' },
    { name: 'Lesson 15 Cumulative', url: 'lesson-15-cumulative.html', type: 'page', keywords: 'lesson 15 cumulative vocab dou guai ni mama 都怪你妈妈' },
    { name: 'Lesson 15 Dictation', url: 'lesson-15-dictation.html', type: 'page', keywords: 'lesson 15 dictation listening dou guai ni mama 都怪你妈妈' },
    { name: 'Lesson 16 Part 1', url: 'lesson-16-part-1.html', type: 'page', keywords: 'lesson 16 part1 quiz page 193 wo bu yao qu zhongguocheng 我不要去中国城' },
    { name: 'Lesson 16 Part 2', url: 'lesson-16-part-2.html', type: 'page', keywords: 'lesson 16 part2 quiz page 194 wo bu yao qu zhongguocheng 我不要去中国城' },
    { name: 'Lesson 16 Cumulative', url: 'lesson-16-cumulative.html', type: 'page', keywords: 'lesson 16 cumulative vocab wo bu yao qu zhongguocheng 我不要去中国城' },
    { name: 'Lesson 16 Dictation', url: 'lesson-16-dictation.html', type: 'page', keywords: 'lesson 16 dictation listening wo bu yao qu zhongguocheng 我不要去中国城' },
    { name: 'Lessons 9-11 Cumulative', url: 'lesson-9-12-cumulative.html', type: 'page', keywords: 'midterm milestone lessons 9 10 11 cumulative vocab review' },
    { name: 'Lessons 9-11 Dictation', url: 'lesson-9-12-dictation.html', type: 'page', keywords: 'midterm milestone lessons 9 10 11 dictation listening sentences' },
    { name: 'Lessons 13-16 Cumulative', url: 'lesson-13-16-cumulative.html', type: 'page', keywords: 'milestone lessons 13 14 15 16 cumulative vocab review' },
    { name: 'Lessons 13-16 Dictation', url: 'lesson-13-16-dictation.html', type: 'page', keywords: 'milestone lessons 13 14 15 16 dictation listening sentences' },
    { name: 'Textbook Reference', url: 'textbook-reference.html', type: 'page', keywords: 'textbook reference scans lesson 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16' },
    { name: 'Textbook Pages 8–16', url: 'textbook-pages8-16.html', type: 'page', keywords: 'textbook scans pages 8 9 10 11 12 13 14 15 16 intro getting started' },
    { name: 'Textbook Lesson 1', url: 'textbook-lesson1.html', type: 'page', keywords: 'textbook scans lesson 1 pages14 15 16 17 两张地图' },
    { name: 'Textbook Lesson 2', url: 'textbook-lesson2.html', type: 'page', keywords: 'textbook scans lesson 2 pages18 19 20 21 我的家在哪儿' },
    { name: 'Textbook Lesson 3', url: 'textbook-lesson3.html', type: 'page', keywords: 'textbook scans lesson 3 pages32 33 34 35 我们都是美国人' },
    { name: 'Textbook Lesson 4', url: 'textbook-lesson4.html', type: 'page', keywords: 'textbook scans lesson 4 pages44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60 61 美国人学中文' },
    { name: 'Textbook Lesson 5', url: 'textbook-lesson5.html', type: 'page', keywords: 'textbook scans lesson 5 pages62 63 64 65 66 67 68 69 70 71 72 73 74 75 我是不是黑人' },
    { name: 'Textbook Lesson 6', url: 'textbook-lesson6.html', type: 'page', keywords: 'textbook scans lesson 6 pages76 77 78 79 80 81 82 83 84 85 86 87 别担心' },
    { name: 'Textbook Lesson 7', url: 'textbook-lesson7.html', type: 'page', keywords: 'textbook scans lesson 7 pages88 89 90 91 92 男女同住' },
    { name: 'Textbook Lesson 8', url: 'textbook-lesson8.html', type: 'page', keywords: 'textbook scans lesson 8 pages104 105 106 107 108 109 110 111 112 113 114 115 看电影' },
    { name: 'Textbook Lesson 9', url: 'textbook-lesson9.html', type: 'page', keywords: 'textbook scans lesson 9 pages116 117 118 119 120 121 122 123 我要去中国' },
    { name: 'Textbook Lesson 10', url: 'textbook-lesson10.html', type: 'page', keywords: 'textbook scans lesson 10 pages124 125 126 127 128 129 130 131 出国前的准备' },
    { name: 'Textbook Lesson 11', url: 'textbook-lesson11.html', type: 'page', keywords: 'textbook scans lesson 11 pages132 133 134 135 136 137 138 139 140 141 142 143 为什么学中文' },
    { name: 'Textbook Lesson 12', url: 'textbook-lesson12.html', type: 'page', keywords: 'textbook scans lesson 12 pages144 145 146 147 148 149 150 151 152 153 做孩子也不容易' },
    { name: 'Textbook Lesson 13', url: 'textbook-lesson13.html', type: 'page', keywords: 'textbook scans lesson 13 pages154 155 156 157 158 159 160 161 162 163 164 165 说标准的普通话' },
    { name: 'Textbook Lesson 14', url: 'textbook-lesson14.html', type: 'page', keywords: 'textbook scans lesson 14 pages166 167 168 169 170 171 172 173 174 175 176 177 繁体字和简体字' },
    { name: 'Textbook Lesson 15', url: 'textbook-lesson15.html', type: 'page', keywords: 'textbook scans lesson 15 pages178 179 180 181 182 183 184 185 186 187 188 189 190 191 都怪你妈妈' },
    { name: 'Textbook Lesson 16', url: 'textbook-lesson16.html', type: 'page', keywords: 'textbook scans lesson 16 pages192 193 194 195 196 197 198 199 200 201 我不要去中国城' },
    { name: 'Dialogue Practice', url: 'dialogue-practice.html', type: 'page', keywords: 'dialogue speaking practice jeremy lines summer vacation 暑假' },
    { name: 'Test 1 Practice', url: 'test1-practice.html', type: 'page', keywords: 'test 1 practice review' },
    { name: 'Test 1 Review', url: 'test1-review.html', type: 'page', keywords: 'test 1 review analysis' },
    { name: 'Modular Quiz Sandbox', url: 'test-modular-quiz.html', type: 'page', keywords: 'sandbox modular dev' },
    { name: 'Audio Prompt Tester', url: 'test-audio.html', type: 'page', keywords: 'audio sound test harness' },
    { name: 'Pinyin Input Tester', url: 'test-pinyin-input.html', type: 'page', keywords: 'pinyin input ime tester' },
    { name: 'Syllable Entry Harness', url: 'test-syllable-entry.html', type: 'page', keywords: 'syllable entry experiment' },
    { name: 'Char → Pinyin → Tones (MC)', url: 'char-to-pinyin-tones-mc.html', type: 'page', keywords: 'pinyin tones multiple choice two step' },
    { name: 'Experimental Layout', url: 'experimental-layout.html', type: 'page', keywords: 'experimental layout flat test sandbox' },
    { name: 'Oral Test 3', url: 'oral-test-3.html', type: 'page', keywords: 'oral test 3 dialogue sam daniel jeremy chin 111 cooking takeout' }
];

const PALETTE_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const COMMAND_PALETTE_TOAST_KEY = 'commandPaletteIntroShown';
const COMMAND_HINT_ATTR = 'data-command-hint-applied';
let commandPaletteUiLoadPromise = null;

function ensureCommandPaletteUiLibrary() {
    if (window.JcodeCommandPaletteUI?.render) {
        return Promise.resolve(window.JcodeCommandPaletteUI);
    }
    if (commandPaletteUiLoadPromise) {
        return commandPaletteUiLoadPromise;
    }
    commandPaletteUiLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'js/command-palette-ui.js';
        script.async = true;
        script.onload = () => {
            if (window.JcodeCommandPaletteUI?.render) {
                resolve(window.JcodeCommandPaletteUI);
            } else {
                reject(new Error('Command palette UI loaded but renderer is unavailable.'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load command palette UI bundle.'));
        (document.head || document.body || document.documentElement).appendChild(script);
    }).finally(() => {
        commandPaletteUiLoadPromise = null;
    });
    return commandPaletteUiLoadPromise;
}

function isMacLike() {
    if (typeof navigator === 'undefined') return false;
    return /mac|iphone|ipad|ipod/i.test(navigator.platform || '');
}

function getShortcutLabel() {
    return isMacLike() ? '⌘K' : 'Ctrl+K';
}

function whenDocumentReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        fn();
    }
}

function normalizeLinkTarget(href) {
    if (!href) return '';
    const cleaned = href.split('#')[0].split('?')[0];
    if (/^https?:\/\//i.test(cleaned)) {
        try {
            const url = new URL(cleaned);
            return url.pathname.replace(/^\/+/, '');
        } catch {
            return cleaned;
        }
    }
    return cleaned.replace(/^\.?\//, '');
}

function maybeShowCommandPaletteToast() {
    if (window.__commandPaletteToastScheduled) return;
    let shouldShow = true;
    try {
        if (localStorage.getItem(COMMAND_PALETTE_TOAST_KEY)) {
            shouldShow = false;
        }
    } catch {
        shouldShow = false;
    }

    if (!shouldShow) return;
    window.__commandPaletteToastScheduled = true;

    whenDocumentReady(() => {
        try {
            localStorage.setItem(COMMAND_PALETTE_TOAST_KEY, '1');
        } catch {
            // ignore storage issues
        }

        const toast = document.createElement('div');
        toast.className = 'command-palette-toast';
        toast.innerHTML = `
            <div>
                <strong>Tip:</strong>
                Press <span class="command-palette-shortcut">${getShortcutLabel()}</span>
                or <span class="command-palette-shortcut">:</span> to open the command palette.
            </div>
            <button type="button" aria-label="Dismiss command palette tip">Got it</button>
        `;

        const dismiss = () => {
            toast.classList.remove('command-palette-toast-show');
            setTimeout(() => toast.remove(), 350);
        };

        toast.querySelector('button')?.addEventListener('click', dismiss);
        setTimeout(dismiss, 6000);

        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('command-palette-toast-show'));
    });
}

function attachCommandableBadges(items) {
    whenDocumentReady(() => {
        // Don't show badges on home page - too cluttered
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage === 'home.html' || currentPage === 'index.html' || currentPage === '') {
            return;
        }

        const pageUrls = new Set(
            items
                .filter(item => item && item.type === 'page' && item.url)
                .map(item => normalizeLinkTarget(item.url))
        );

        const candidates = new Set();
        document.querySelectorAll('[data-commandable]').forEach(el => candidates.add(el));
        document.querySelectorAll('a[href]').forEach(link => {
            const normalized = normalizeLinkTarget(link.getAttribute('href'));
            if (pageUrls.has(normalized)) {
                candidates.add(link);
            }
        });

        candidates.forEach(el => {
            if (el.getAttribute(COMMAND_HINT_ATTR) === 'true') return;

            // Skip badges for home.html links
            const href = el.getAttribute('href');
            if (href && normalizeLinkTarget(href) === 'home.html') {
                return;
            }

            el.setAttribute(COMMAND_HINT_ATTR, 'true');
            el.classList.add('commandable-hinted');

            const badge = document.createElement('span');
            badge.className = 'commandable-badge';
            badge.textContent = `${getShortcutLabel()} · palette`;
            badge.setAttribute('aria-hidden', 'true');
            el.appendChild(badge);

            if (!el.hasAttribute('title')) {
                el.setAttribute('title', 'Also in the command palette');
            }
        });
    });
}

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
            // ignore unsupported select implementations
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

function initCommandPalette(config = []) {
    const normalizedConfig = normalizeConfig(config);

    if (window.__commandPaletteState) {
        window.__commandPaletteState.updateConfig(normalizedConfig);
        return;
    }

    let baseItems = normalizedConfig.items;
    let filteredItems = baseItems;
    let availableItems = [];
    let selectedIndex = 0;
    let query = '';
    let isVisible = false;
    let paletteRoot = document.getElementById('commandPaletteRoot');

    if (!paletteRoot) {
        paletteRoot = document.createElement('div');
        paletteRoot.id = 'commandPaletteRoot';
        document.body.appendChild(paletteRoot);
    }

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
                // ignore unsupported select implementations
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

    function filterItems(nextQuery, items) {
        const trimmed = nextQuery.trim().toLowerCase();
        if (!trimmed) return items.slice();

        const condensedQuery = trimmed.replace(/\s+/g, '');
        const matches = [];

        items.forEach(item => {
            const score = computeItemScore(trimmed, condensedQuery, item);
            if (score > Number.NEGATIVE_INFINITY) {
                matches.push({ item, score });
            }
        });

        matches.sort((a, b) => {
            if (b.score === a.score) {
                return a.item.name.localeCompare(b.item.name);
            }
            return b.score - a.score;
        });

        return matches.map(entry => entry.item);
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

    function getTypeMeta(item) {
        const badges = {
            mode: { text: 'Mode', className: 'bg-blue-100 text-blue-700 border-blue-200' },
            page: { text: 'Page', className: 'bg-green-100 text-green-700 border-green-200' },
            action: { text: 'Action', className: 'bg-purple-100 text-purple-700 border-purple-200' }
        };
        return badges[item.type] || { text: 'Command', className: 'bg-gray-100 text-gray-700 border-gray-200' };
    }

    function syncFilteredItems() {
        availableItems = computeAvailableItems();
        filteredItems = filterItems(query, availableItems);
        if (!filteredItems.length) {
            selectedIndex = -1;
        } else if (selectedIndex < 0 || selectedIndex >= filteredItems.length) {
            selectedIndex = 0;
        }
    }

    function syncPaletteUi() {
        ensureCommandPaletteUiLibrary()
            .then((ui) => {
                syncFilteredItems();
                ui.render(paletteRoot, {
                    visible: isVisible,
                    query,
                    searchPlaceholder: normalizedConfig.searchPlaceholder,
                    items: filteredItems,
                    selectedIndex,
                    onQueryChange(nextValue) {
                        query = nextValue;
                        selectedIndex = 0;
                        syncPaletteUi();
                    },
                    onKeyDown(event) {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            updateSelection(selectedIndex + 1);
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            updateSelection(selectedIndex - 1);
                        } else if (event.key === 'Tab') {
                            event.preventDefault();
                            if (!filteredItems.length) return;
                            if (event.shiftKey) {
                                updateSelection(selectedIndex <= 0 ? filteredItems.length - 1 : selectedIndex - 1);
                            } else {
                                updateSelection(selectedIndex >= filteredItems.length - 1 ? 0 : selectedIndex + 1);
                            }
                        } else if (event.key === 'Enter') {
                            event.preventDefault();
                            if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
                                selectItem(filteredItems[selectedIndex]);
                            }
                        } else if (event.key === 'Escape') {
                            event.preventDefault();
                            closePalette();
                        }
                    },
                    onSelect: selectItem,
                    onBackdrop: closePalette,
                    getTypeMeta,
                    getActionLabel,
                    getDefaultDescription
                });

                if (isVisible) {
                    requestAnimationFrame(() => {
                        const searchEl = document.getElementById('paletteSearch');
                        if (searchEl && document.activeElement !== searchEl) {
                            searchEl.focus();
                            const len = searchEl.value.length;
                            if (typeof searchEl.setSelectionRange === 'function') {
                                searchEl.setSelectionRange(len, len);
                            }
                        }
                        const selectedEl = paletteRoot.querySelector(`.palette-item[data-index="${selectedIndex}"]`);
                        if (selectedEl) {
                            selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                    });
                }
            })
            .catch((error) => {
                console.error('Failed to render command palette UI:', error);
            });
    }

    function updateSelection(newIndex) {
        if (!filteredItems.length) return;
        selectedIndex = Math.max(0, Math.min(newIndex, filteredItems.length - 1));
        syncPaletteUi();
    }

    function selectItem(item) {
        closePalette();

        if (item.type === 'mode') {
            const btn = document.querySelector(`[data-mode="${item.mode}"]`);
            if (btn) btn.click();
            return;
        }

        if (item.type === 'page') {
            let target = item.url;
            if (isExperimentalUIEnabled() && pageSupportsExperimental(item) && item.url !== 'experimental-layout.html') {
                const source = encodeURIComponent(item.url);
                target = `experimental-layout.html#from=${source}`;
            }
            window.location.href = target;
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
        isVisible = true;
        if (!keepQuery) {
            query = '';
            selectedIndex = 0;
        }
        syncPaletteUi();
    }

    function closePalette() {
        isVisible = false;
        query = '';
        selectedIndex = 0;
        syncPaletteUi();
    }

    function togglePalette(triggeredByShortcut) {
        if (isVisible) {
            closePalette();
        } else {
            openPalette({ keepQuery: triggeredByShortcut && query.length > 0 });
        }
    }

    function isTypingContext(target) {
        if (!target) return false;
        if (PALETTE_INPUT_TAGS.has(target.tagName)) return true;
        return Boolean(target.isContentEditable);
    }

    document.addEventListener('keydown', (e) => {
        const target = e.target;
        const inTypingContext = isTypingContext(target);

        const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
        if (isCtrlK) {
            if (window && window.__preferCtrlKForQuiz) return;
            e.preventDefault();
            togglePalette(true);
            return;
        }

        if (!isVisible && !inTypingContext && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === ':') {
            e.preventDefault();
            openPalette();
        }
    });

    window.__commandPaletteState = {
        updateConfig(newConfig) {
            baseItems = newConfig.items;
            normalizedConfig.searchPlaceholder = newConfig.searchPlaceholder;
            attachCommandableBadges(baseItems);
            syncPaletteUi();
        },
        open: openPalette,
        close: closePalette
    };

    attachCommandableBadges(baseItems);
    maybeShowCommandPaletteToast();
    syncPaletteUi();
}

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
        const experimentalActions = createExperimentalActions();
        const combinedItems = [
            ...base.actions,
            ...experimentalActions,
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
                },
                scope: 'This page only'
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
                },
                scope: 'This page only'
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
                available: () => typeof window.checkAnswer === 'function',
                scope: 'This page only'
            });
        }

        if (typeof window.generateQuestion === 'function') {
            actions.push({
                name: 'Skip Question',
                type: 'action',
                description: 'Move on to the next prompt immediately',
                keywords: 'skip next question new prompt',
                shortcut: 'Ctrl+J',
                action: () => window.generateQuestion(),
                scope: 'This page only'
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
            available: () => typeof window.currentAudioPlayFunc === 'function' || Boolean(document.getElementById('playAudioBtn')),
            scope: 'This page only'
        });

        if (typeof window.clearCanvas === 'function') {
            actions.push({
                name: 'Clear Drawing Canvas',
                type: 'action',
                description: 'Erase your strokes in draw mode',
                keywords: 'clear drawing canvas erase handwriting',
                action: () => window.clearCanvas(),
                available: () => typeof window.clearCanvas === 'function' && window.mode === 'draw-char',
                scope: 'Draw mode only'
            });
        }

        if (typeof window.submitDrawing === 'function') {
            actions.push({
                name: 'Submit Drawing',
                type: 'action',
                description: 'Send your handwriting to recognizer',
                keywords: 'submit drawing handwriting check ocr',
                action: () => window.submitDrawing(),
                available: () => typeof window.submitDrawing === 'function' && window.mode === 'draw-char',
                scope: 'Draw mode only'
            });
        }

        if (typeof window.revealDrawingAnswer === 'function') {
            actions.push({
                name: 'Reveal Draw Answer',
                type: 'action',
                description: 'Show the correct character for draw mode',
                keywords: 'reveal answer drawing handwriting show',
                action: () => window.revealDrawingAnswer(),
                available: () => typeof window.revealDrawingAnswer === 'function' && window.mode === 'draw-char',
                scope: 'Draw mode only'
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
                available: () => Boolean(document.getElementById('studyList')),
                scope: 'This page only'
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
                available: () => Boolean(document.getElementById('stats')),
                scope: 'This page only'
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
                available: () => element.isConnected && isElementVisible(element),
                scope: 'This page only'
            });
        });

        return actions;
    }

    function createExperimentalActions() {
        return [
            {
                name: 'Enable Experimental UI',
                type: 'action',
                description: 'Use the experimental layout for quiz / practice pages opened from the palette',
                keywords: 'experimental ui layout toggle enable',
                action: () => {
                    setExperimentalUIEnabled(true);
                    console.info('Experimental UI enabled');
                },
                available: () => !isExperimentalUIEnabled(),
                scope: 'Global'
            },
            {
                name: 'Disable Experimental UI',
                type: 'action',
                description: 'Return to the standard layout for all pages',
                keywords: 'experimental ui layout toggle disable off',
                action: () => {
                    setExperimentalUIEnabled(false);
                    console.info('Experimental UI disabled');
                },
                available: () => isExperimentalUIEnabled(),
                scope: 'Global'
            },
            {
                name: 'Show "Why This Card?" Panel',
                type: 'action',
                description: 'Show the decision panel that explains why each card was chosen in Feed mode',
                keywords: 'why this card decision panel show enable feed bandit score',
                action: () => {
                    if (window.eegDecision) window.eegDecision.show();
                },
                available: () => window.eegDecision && !window.eegDecision.isEnabled(),
                scope: 'Global'
            },
            {
                name: 'Hide "Why This Card?" Panel',
                type: 'action',
                description: 'Hide the decision panel that explains card selection',
                keywords: 'why this card decision panel hide disable feed bandit score',
                action: () => {
                    if (window.eegDecision) window.eegDecision.hide();
                },
                available: () => window.eegDecision && window.eegDecision.isEnabled(),
                scope: 'Global'
            },
            {
                name: 'Set Groq API Key',
                type: 'action',
                description: 'Configure your Groq API key for Whisper speech recognition',
                keywords: 'groq api key whisper speech recognition settings configure',
                action: () => {
                    const current = getGroqApiKey();
                    const masked = current ? `${current.slice(0, 8)}...${current.slice(-4)}` : '(not set)';
                    const newKey = prompt(`Enter your Groq API key:\n\nCurrent: ${masked}\n\nGet one at https://console.groq.com/keys`);
                    if (newKey !== null) {
                        if (newKey.trim()) {
                            setGroqApiKey(newKey.trim());
                            alert('API key saved!');
                        } else {
                            setGroqApiKey('');
                            alert('API key cleared.');
                        }
                    }
                },
                scope: 'Global'
            }
        ];
    }

    function getGroqApiKey() {
        try {
            return localStorage.getItem(GROQ_API_KEY_STORAGE) || '';
        } catch {
            return '';
        }
    }

    function setGroqApiKey(key) {
        try {
            if (key) {
                localStorage.setItem(GROQ_API_KEY_STORAGE, key);
            } else {
                localStorage.removeItem(GROQ_API_KEY_STORAGE);
            }
        } catch {
            // ignore storage errors
        }
    }

    // Expose for other scripts
    window.getGroqApiKey = getGroqApiKey;
    window.setGroqApiKey = setGroqApiKey;

    function isExperimentalUIEnabled() {
        try {
            return localStorage.getItem(EXPERIMENTAL_UI_KEY) === 'true';
        } catch {
            return false;
        }
    }

    function setExperimentalUIEnabled(enabled) {
        try {
            localStorage.setItem(EXPERIMENTAL_UI_KEY, enabled ? 'true' : 'false');
        } catch {
            // ignore storage errors
        }
    }

    function pageSupportsExperimental(item) {
        if (!item || item.type !== 'page' || !item.url) return false;
        const url = item.url.toLowerCase();
        const blocked = ['home.html', 'index.html', 'experimental-layout.html'];
        if (blocked.includes(url)) return false;
        // Broadly allow lesson/test/drill pages so the toggle is reliable.
        return /(quiz|dictation|practice|lesson|test|pinyin|tone|syllable|radical|context|listening|char|character)/i.test(url);
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
// Auto-initialize command palette when DOM is ready (only if not already initialized)
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.__commandPaletteState) {
                initCommandPalette();
            }
        }, { once: true });
    } else {
        if (!window.__commandPaletteState) {
            initCommandPalette();
        }
    }
}
