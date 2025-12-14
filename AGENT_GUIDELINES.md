# Agent Guidelines

- When adding a new page, utility, or tool, update `js/command-palette.js` so the feature is discoverable via the command palette.
- Exercise caution with heavy data files (large JSON, media). Avoid unnecessary rewrites; prefer targeted updates.
- Document any new runtime dependencies or build steps in `README.md` (or the relevant project docs) before finishing the task.

## UI Patterns

- **Three-column layout is the default** for new quiz modes. Show previous (completed), current (active), and upcoming (preview) questions simultaneously.
- **Use instant transitions** - no setTimeout delays between questions. When a user answers correctly, advance immediately.

## Lesson Data

- Prefer keeping lesson vocab + dictation data out of the HTML files.
- Store per-lesson data in `data/lessons/lesson-<N>.js` and load it via a `<script src="data/lessons/lesson-<N>.js"></script>` tag.
- Lesson files register into `window.__LESSON_DATASETS__['lesson-<N>']` with `{ vocab: { part1, part2 }, dictation }`.

## Textbook Pages

- Source PDF lives in `~/Downloads/vdoc.pub_oh-china-an-elementary-reader-of-modern-chinese-for-advanced-beginners.pdf`.
- In this PDF, **PDF page = textbook page + 43** (e.g., textbook page 192 is PDF page 235).

### Lesson Page Ranges (Textbook)

- Lesson 9: 116–123
- Lesson 10: 124–131
- Lesson 11: 132–143
- Lesson 12: 144–153
- Lesson 13: 154–165
- Lesson 14: 166–177
- Lesson 15: 178–191
- Lesson 16: 192–201

- To add new scanned page ranges:
  - Extract at ~150 DPI to match existing `images/lesson*/page*.jpg` sizing (1275×1650): `pdftoppm -f <start> -l <end> -r 150 -jpeg -jpegopt quality=85 "<pdf>" images/<dir>/page`
    - `<start>`/`<end>` are **PDF page numbers** (use the `+43` offset above for textbook page numbers).
  - Rename outputs to `page<NUMBER>.jpg` and store under `images/` (e.g. `images/textbook/page8.jpg`).
  - Create a `textbook-*.html` viewer page and link it from `textbook-reference.html`.
  - Add the new page to `js/command-palette.js` for discoverability.
  - Prefer linking to existing page images (e.g. Lesson archives) instead of duplicating overlaps.
