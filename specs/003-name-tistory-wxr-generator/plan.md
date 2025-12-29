# Implementation Plan: Tistory WXR Generator

**Branch**: `003-name-tistory-wxr-generator` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-name-tistory-wxr-generator/spec.md`

## Summary

A CLI tool that migrates Tistory blog posts to WordPress by scraping blog content, cleaning HTML via Markdown conversion (turndown/marked), tracking internal links, downloading attachments, and generating WordPress-compatible WXR XML files. Supports parallel processing with worker pools and resumable migration via JSON state tracking.

## Technical Context

**Language/Version**: TypeScript 5.x with Node.js 18+  
**Primary Dependencies**: cheerio (HTML parsing), turndown (HTML→MD), marked (MD→HTML), @xmlbuilder2/builder (WXR generation), p-queue (worker pool), dotenv (env vars)  
**Storage**: File system (downloads/, JSON state file, WXR XML output)  
**Testing**: Jest with TypeScript support  
**Target Platform**: Node.js CLI (cross-platform: macOS, Linux, Windows)  
**Project Type**: single  
**Performance Goals**: Process 100 posts in <10 minutes with 4 workers, handle 500+ posts without memory issues  
**Constraints**: Rate limiting (1 req/sec per worker), graceful error handling, resumable progress  
**Scale/Scope**: Support blogs with 500+ posts, multiple categories/tags, diverse content types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

N/A - No constitution file present in repository

## Project Structure

### Documentation (this feature)

```text
specs/003-name-tistory-wxr-generator/
├── plan.md              # This file
├── sequence-diagram.md  # System interaction flows
├── data-model.md        # Data structures
├── quickstart.md        # Getting started guide
└── checklists/
    └── requirements.md  # Requirements tracking
```

### Source Code (repository root)

```text
src/
├── models/              # Data models (Post, Category, Tag, etc.)
├── services/            # Core business logic
│   ├── crawler.ts       # Tistory scraping
│   ├── cleaner.ts       # HTML→MD→HTML cleaning
│   ├── linkTracker.ts   # Internal link detection
│   ├── downloader.ts    # Attachment downloads
│   └── wxrGenerator.ts  # WXR XML generation
├── workers/             # Worker pool management
│   └── postProcessor.ts # Per-post pipeline orchestration
├── utils/               # Shared utilities
│   ├── config.ts        # Environment variable loading
│   ├── logger.ts        # Error/info logging
│   └── state.ts         # JSON state file management
└── cli.ts               # CLI entry point

tests/
├── unit/                # Unit tests for services/utils
├── integration/         # End-to-end pipeline tests
└── fixtures/            # Test data (sample HTML, expected outputs)

output/                  # Generated during runtime
├── downloads/           # Downloaded attachments
├── migration-state.json # Resume state tracking
├── link_mapping.json    # Internal link mapping
└── output.wxr.xml       # Final WXR output
```

**Structure Decision**: Single TypeScript CLI project with clear separation between models (data structures), services (business logic), workers (concurrency), and utilities (cross-cutting concerns). Output directory created at runtime for generated files.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A - No constitution violations detected
