# Chinese Listening Practice – System Design

## Goals
- Keep user-facing behavior stable while making the codebase easier to reason about.
- Reduce cross-cutting state, duplicated logic, and implicit coupling.
- Make each quiz mode self-contained with clear responsibilities.
- Centralize external service calls (LLM, TTS, storage) and error handling.

## High-Level Components

### 1) Data Layer
- **Lesson datasets**: `data/lessons/lesson-<N>.js` register into `window.__LESSON_DATASETS__`.
- **Aux data**: component decompositions, radicals, tone maps.

### 2) Core Quiz Engine
- **State**: current question, mode, stats, scheduler state, UI flags.
- **State transitions**: select question → render mode → handle answer → update stats → schedule next.
- **Event loop**: keyboard shortcuts, input handlers, audio playback.

### 3) Scheduler / Mastery
- **Scheduler modes**: Random, Weighted, Adaptive-5, Feed, Batch-5, Ordered.
- **Confidence model**: BKT or heuristic (shared interface).
- **Graduation logic**: based on served, streak, confidence.

### 4) Mode System
- Each mode should declare:
  - **Selection strategy**: standard vs custom (e.g., missing-component).
  - **UI layout**: three-column, chat, study, etc.
  - **Inputs**: text, fuzzy, choice, handwriting, draw.
  - **Answer grading**: local vs LLM.

### 5) UI Components
- **Layout manager**: toggles layout classes and avoids overlaps.
- **Panels**: confidence panel, chat panel, dictation chat (`js/engine/chat.js`).
- **Shared widgets**: audio controls, preview queue, stats bar.

### 6) Services
- **LLM service**: `js/engine/ai-service.js` (Groq client + markdown rendering) used for grading + chat prompts.
- **Audio service**: TTS playback, pinyin audio routing.
- **Storage**: localStorage for mode, stats, UI prefs.

## Refactor Strategy (Incremental)
1) **Stabilize mode selection & serving logic** to prevent incorrect stats.
2) **Centralize LLM calls** to one helper with uniform error handling.
3) **Introduce mode metadata** (layout + serving behavior) to remove ad-hoc branches.
4) **Progressively modularize** large subsystems into logical blocks (Scheduler, UI, Modes).
5) **Add diagnostic hooks** for debugging (e.g., readiness checks, data loaded).

## Non-Goals
- No build tooling or framework migration.
- Keep static HTML pages and their script includes unchanged.
