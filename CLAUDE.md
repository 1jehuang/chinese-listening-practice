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

## Structure

- `home.html` - Main landing page with links to all exercises
- `lesson-*.html` - Vocabulary quiz pages for textbook lessons
- `character-sheet-*.html` - Character sheet practice pages
- `*-dictation.html` - Dictation exercises
- `js/` - Shared JavaScript utilities (quiz engine, command palette, etc.)
- `css/` - Shared stylesheets
