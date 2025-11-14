# Command Palette Documentation

The command palette (opened with `/` or `Cmd/Ctrl+K`) provides quick access to quiz modes, actions, and page navigation.

## Opening the Command Palette

- Press `/` (forward slash) anywhere on the page
- Or press `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux)

## Available Items

### Quiz Modes

Available on all quiz pages:

- **Char → Pinyin** - Type pinyin for displayed characters
- **Char → Pinyin (MC)** - Multiple choice pinyin selection
- **Char → Tones** - Type tone numbers for characters
- **Audio → Pinyin** - Listen to audio and type pinyin
- **Audio → Meaning** - Listen to audio and select meaning
- **Pinyin → Char** - See pinyin and select the character
- **Char → Meaning** - See character and select meaning
- **Char → Meaning (Fuzzy)** - Type meaning with fuzzy matching
- **Meaning → Char** - See meaning and select character
- **Stroke Order** - Practice stroke order animation
- **Handwriting** - Practice writing (characters appear when you show answer)
- **Draw Character** - Draw characters with handwriting recognition
- **Study Mode** - Browse all vocabulary with audio

### Actions

Available actions depend on the current page context:

#### Always Available
- **Next Quiz Mode** - Cycle forward through quiz modes
- **Previous Quiz Mode** - Cycle backward through quiz modes
- **Toggle Tab Tone Cycling** - Enable/disable Tab key tone selection for pinyin input
- **Toggle Spaced Repetition** - Enable/disable spaced repetition filtering
- **View SR Stats** - See spaced repetition statistics (if SR enabled)
- **Reset SR Data** - Clear spaced repetition progress (if SR enabled)

#### Context-Dependent
- **Show/Hide Upcoming Characters** - Toggle preview queue (if enabled on page)
- **Toggle Component Hints** - Show/hide radical/phonetic breakdowns (if available)
- **Focus Answer Input** - Focus the main answer input field (if available)

### Pages

Navigation to other pages in the app:

- **Home** - Main dashboard
- **Pinyin Practice** - Pinyin typing drills
- **Pinyin Chart** - Reference table
- **Context Listening Comprehension** - Listening exercises
- **Context Listening · Easy** - Beginner listening exercises
- **Sentence Meaning Drill** - Sentence comprehension
- **Phrase Meaning Drill** - Phrase comprehension
- **Toneless Minimal Pairs** - Tone listening practice
- **Radical Practice** - Radical component drills
- **Radical Practice 2** - Advanced radical practice
- **Character Sheet 1-4** - Character sheet quizzes
- **Most Common 2500 Characters** - Frequency-based quiz
- **Lesson 1-5 Quizzes** - Lesson-specific vocabulary quizzes
- **Lesson 1-5 Dictation** - Lesson-specific dictation exercises
- **Dialogue Practice** - Dialogue speaking practice
- **Test Pages** - Various test and development pages

### Contextual Actions

The palette automatically detects and includes:
- Focusable input fields on the page
- Editable content areas
- Other interactive elements with command labels

## Search Tips

- Search by name, keywords, or description
- Partial matches work (e.g., "pinyin" finds all pinyin-related items)
- Use keywords like "toggle", "mode", "page", "action" to filter
- Search is case-insensitive

## Keyboard Shortcuts

- `/` or `Cmd/Ctrl+K` - Open command palette
- `Esc` - Close command palette
- `↑/↓` - Navigate results
- `Enter` - Execute selected item
- `Tab` - Cycle through results (when palette is closed, cycles quiz modes)
