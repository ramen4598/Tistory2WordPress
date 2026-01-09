# Implementation Plan: CLI Help Option & Tistory Bookmark Handling

**Branch**: `007-cli-help-option` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-cli-help-option/spec.md`

## Summary

This plan implements two features for the Tistory2Wordpress migration tool:

1. **CLI Help Option**: Add `--help` and `-h` flags to display usage information and available options
2. **Tistory Bookmark Handling**: Detect Tistory bookmarks, fetch metadata from bookmark URLs, replace them with customizable HTML card components, and ignore bookmark featured images during image processing

Technical approach:

- CLI Help: Early flag detection in `cli.ts` before config loading, displaying formatted help text
- Bookmark Handling: New `bookmarkProcessor.ts` service with HTML parsing, metadata fetching (10s timeout, no caching), and template-based HTML generation using configurable CSS selector from `.env`. Bookmark processing occurs BEFORE Cleaner to ensure standard HTML structure survives turndown roundtrip

## Technical Context

**Language/Version**: TypeScript 5.x with Node.js 18+
**Primary Dependencies**: cheerio (HTML parsing), axios (HTTP), turndown (HTML→MD), marked (MD→HTML), @xmlbuilder2/builder (WXR generation), p-queue (worker pool), dotenv (env vars)
**Storage**: SQLite (better-sqlite3) for migration state, file system (downloads/, output/, bookmark templates)
**Testing**: Jest with ts-jest
**Target Platform**: CLI tool (Node.js on Linux/macOS/Windows)
**Project Type**: Single project (monorepo with src/ and tests/)
**Performance Goals**: Bookmark metadata fetch <10s per URL, <20% overall migration overhead, 95%+ bookmark detection accuracy, 95%+ featured image fetch success
**Constraints**: No metadata caching, per-post error handling (fail gracefully, don't stop entire migration), configurable CSS selector via `.env`
**Scale/Scope**: 2 new files (bookmarkProcessor.ts, bookmarkTemplate.ts), modifications to cli.ts, imageProcessor.ts, cleaner.ts, migrator.ts, and .env.example

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

✅ **Passes** - All requirements are within the existing architecture scope:

- No new dependencies beyond existing HTTP libraries
- No new storage mechanisms (uses file system and SQLite)
- Follows existing service pattern (bookmarkProcessor.ts similar to imageProcessor.ts)
- No breaking changes to existing APIs

## Project Structure

### Documentation (this feature)

```text
specs/007-cli-help-option/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── bookmark-metadata.md  # OpenGraph metadata contract
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── models/
│   ├── Bookmark.ts              # NEW: Bookmark entity
│   └── BookmarkMetadata.ts      # NEW: Metadata entity
├── services/
│   ├── bookmarkProcessor.ts      # NEW: Bookmark detection & replacement
│   ├── imageProcessor.ts        # MODIFIED: Ignore bookmark featured images
│   ├── cleaner.ts               # MODIFIED: Preserves bookmark-card structure
│   └── migrator.ts             # MODIFIED: Call BookmarkProcessor before Cleaner
├── utils/
│   └── config.ts                # MODIFIED: Add bookmark selector config
├── cli.ts                       # MODIFIED: Add --help flag
└── templates/
    └── bookmarkTemplate.ts      # NEW: Custom bookmark HTML template renderer

tests/
├── unit/
│   ├── services/
│   │   ├── bookmarkProcessor.test.ts  # NEW
│   │   ├── imageProcessor.test.ts      # MODIFIED
│   │   ├── cleaner.test.ts             # MODIFIED
│   │   └── migrator.test.ts           # MODIFIED
│   └── cli.test.ts                     # MODIFIED

.env.example                  # MODIFIED: Add bookmark configuration
```

**Structure Decision**: Single project structure maintained. Follows existing patterns:

- New `bookmarkProcessor.ts` service similar to existing `imageProcessor.ts`
- Bookmark processing executed BEFORE Cleaner to preserve HTML structure through turndown
- Models in `src/models/` for data entities
- Templates in `src/templates/` for easy customization (TypeScript renderer)
- Unit tests in `tests/unit/` following Jest patterns

## Complexity Tracking

> **No complexity violations detected** - Constitution check passed
