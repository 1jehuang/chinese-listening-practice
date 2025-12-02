# Agent Guidelines

- When adding a new page, utility, or tool, update `js/command-palette.js` so the feature is discoverable via the command palette.
- Exercise caution with heavy data files (large JSON, media). Avoid unnecessary rewrites; prefer targeted updates.
- Document any new runtime dependencies or build steps in `README.md` (or the relevant project docs) before finishing the task.

## UI Patterns

- **Three-column layout is the default** for new quiz modes. Show previous (completed), current (active), and upcoming (preview) questions simultaneously.
- **Use instant transitions** - no setTimeout delays between questions. When a user answers correctly, advance immediately.
