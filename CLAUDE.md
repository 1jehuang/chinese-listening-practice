# Chinese Learning Practice App

## Adding New Pages

**IMPORTANT**: Whenever you create a new lesson, quiz, or practice page in this repo, you MUST add a corresponding entry to `home.html`.

### Steps to add a new page:
1. Create the new HTML file (e.g., `lesson-X-quiz.html`)
2. Open `home.html`
3. Add a new card entry in the grid with:
   - A link to the new page
   - An emoji icon (📖 for lessons, 📝 for dictation, etc.)
   - A descriptive title
   - A brief description of what the page contains
   - An appropriate border color class (e.g., `border-teal-500`, `border-cyan-500`)

### Example entry:
```html
<!-- Lesson 2 Part 1 -->
<a href="lesson-2-part-1.html" class="block bg-white rounded-lg shadow hover:shadow-md transition p-5 border-l-4 border-cyan-500">
    <div class="text-4xl mb-3">📖</div>
    <h2 class="text-lg font-semibold mb-2 text-gray-800">Lesson 2 Part 1: Where is My Home?</h2>
    <p class="text-sm text-gray-600">
        Learn 16 vocabulary words from Lesson 2 (我的家在哪儿?) - Page 18
    </p>
</a>
```

## Default UI Patterns

### Page Layout (Sidebar + Main Content)
When creating new practice/quiz pages, use the **sidebar layout** pattern from `lesson-7-part-1.html` as the default. This layout includes:
- **Left sidebar** (16rem width): Mode buttons, settings, speed controls
- **Main content area**: Header, quiz display, input section
- Full viewport height (`100vh`), no scroll on body
- Responsive: sidebar hides on mobile

Key CSS structure:
```css
.app-container { display: flex; height: 100vh; }
.sidebar { width: 16rem; flex-shrink: 0; }
.main-content { flex: 1; display: flex; flex-direction: column; }
.quiz-display { flex: 1; overflow-y: auto; }
```

Reference: `lesson-7-part-1.html` for complete implementation.

### Three-Column Layout (Default)
When implementing new quiz modes, use the **three-column layout** as the default pattern. This layout shows:
- **Left column (Previous)**: The last completed question with result indicator (✓/✗)
- **Center column (Current)**: The active question being answered
- **Right column (Upcoming)**: Preview of the next question (grayed out)

This pattern is used in:
- `char-to-meaning-type` mode
- `char-building` mode (Character Building)
- `audio-to-meaning` mode

Key state variables for three-column layout:
- `previousQuestion` / `charBuildingPreviousQuestion`
- `previousQuestionResult` / `charBuildingPreviousResult`
- `upcomingQuestion` / `charBuildingUpcomingQuestion`
- `threeColumnInlineFeedback` / `charBuildingInlineFeedback`

### Instant Transitions
Quiz modes should use **instant transitions** (no setTimeout delays) for smoother UX. When a user answers correctly, immediately advance to the next question without artificial delays.

## Structure

- `home.html` - Main landing page with links to all exercises
- `lesson-*.html` - Vocabulary quiz pages for textbook lessons
- `character-sheet-*.html` - Character sheet practice pages
- `*-dictation.html` - Dictation exercises
- `js/` - Shared JavaScript utilities (quiz engine, command palette, etc.)
- `css/` - Shared stylesheets

## Testing

### Running Tests

The project includes test files to verify pinyin conversion and answer validation:

**Run all vocabulary tests:**
```bash
node test-all-vocab.js
```

This tests pinyin conversion for all vocabulary words in the app to ensure:
- Tone marks are correctly converted to tone numbers
- Multi-syllable words are properly split
- Diphthongs (ai, ei, ao, ou, etc.) are handled correctly
- Edge cases like 西南 (xīnán) and 虽然 (suīrán) work without dots

**Run specific pinyin tests:**
```bash
node test-pinyin.js
```

This runs targeted tests for specific words/patterns.

### Writing Tests

When adding new vocabulary, you can add test cases to `test-all-vocab.js`:

```javascript
{ char: '新词', pinyin: 'xīncí', expected: 'xin1ci2' },
```

The test will verify that the pinyin conversion produces the expected tone number format.

### What to Test

Always run tests after:
- Modifying `js/pinyin-utils.js` or `js/quiz-engine.js` (especially `splitPinyinSyllables`, `convertPinyinToToneNumbers`, or `checkPinyinMatch`)
- Adding new vocabulary with unusual pinyin patterns
- Fixing bugs in answer validation
