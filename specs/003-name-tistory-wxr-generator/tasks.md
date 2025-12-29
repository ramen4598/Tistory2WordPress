# Tasks: Tistory WXR Generator

**Branch**: `003-name-tistory-wxr-generator` | **Date**: 2025-12-29  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This task list breaks down the Tistory to WordPress migration tool into implementable units organized by user story priority.

**Total Tasks**: 45  
**MVP Scope**: Phase 3 (User Story 1 - Basic Post Migration)  
**Parallel Opportunities**: 28 tasks marked [P]

---

## Phase 1: Setup

Project initialization and dependencies.

- [ ] T001 Create project structure per plan.md (src/, tests/, output/)
- [ ] T002 Initialize TypeScript project with package.json and tsconfig.json
- [ ] T003 [P] Install core dependencies (cheerio, turndown, marked, @xmlbuilder2/builder, p-queue, dotenv)
- [ ] T004 [P] Install dev dependencies (Jest, TypeScript types, ts-node, eslint, prettier)
- [ ] T005 [P] Configure Jest for TypeScript in jest.config.js
- [ ] T006 [P] Configure ESLint and Prettier in .eslintrc.js and .prettierrc
- [ ] T007 [P] Create .env.example with required environment variables
- [ ] T008 [P] Add npm scripts (start, build, test, lint, format) to package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

⚠️ CRITICAL: No user story work can begin until this phase is complete

Core infrastructure and shared utilities that all features depend on.

- [ ] T009 Create Config interface in src/models/Config.ts
- [ ] T010 Implement config loader in src/utils/config.ts (load from .env)
- [ ] T011 [P] Create logger utility in src/utils/logger.ts (console + file logging)
- [ ] T012 [P] Create Post model in src/models/Post.ts
- [ ] T013 [P] Create Category model in src/models/Category.ts
- [ ] T014 [P] Create Tag model in src/models/Tag.ts
- [ ] T015 [P] Create Image model in src/models/Image.ts
- [ ] T016 [P] Create Attachment model in src/models/Attachment.ts
- [ ] T017 [P] Create InternalLink model in src/models/InternalLink.ts
- [ ] T018 [P] Create MigrationState model in src/models/MigrationState.ts
- [ ] T019 [P] Create WXRData model in src/models/WXRData.ts

---

## Phase 3: User Story 1 - Basic Post Migration (Priority: P1) 🎯 MVP

**Goal**: Enable users to migrate Tistory blog posts to WordPress WXR format

**Independent Test**: Run CLI with a Tistory URL and verify WXR XML file contains all posts, categories, and tags

### Implementation for User Story 1

- [ ] T020 [P] [US1] Implement Crawler service in src/services/crawler.ts (discover post URLs with pagination)
- [ ] T021 [US1] Implement HTML post fetching in Crawler (fetch individual post HTML from Tistory)
- [ ] T022 [US1] Implement post metadata parsing in Crawler (extract title, dates, categories, tags from HTML)
- [ ] T023 [P] [US1] Implement Cleaner service in src/services/cleaner.ts (HTML→Markdown→HTML conversion)
- [ ] T024 [US1] Integrate turndown library in Cleaner (HTML to Markdown)
- [ ] T025 [US1] Integrate marked library in Cleaner (Markdown to HTML)
- [ ] T026 [P] [US1] Implement WXRGenerator service in src/services/wxrGenerator.ts (build WXR XML structure)
- [ ] T027 [US1] Implement addPost method in WXRGenerator (add post to WXR with categories/tags)
- [ ] T028 [US1] Implement finalize method in WXRGenerator (write WXR to file)
- [ ] T029 [P] [US1] Implement PostProcessor in src/workers/postProcessor.ts (per-post pipeline orchestration)
- [ ] T030 [US1] Integrate all services in PostProcessor (fetch → parse → clean → add to WXR)
- [ ] T031 [US1] Implement CLI entry point in src/cli.ts (load config, start crawler, manage processing)
- [ ] T032 [US1] Implement main migration flow in CLI (discover posts → process → finalize)

---

## Phase 4: User Story 2 - Data Cleaning and Internal Link Tracking (Priority: P2)

**Goal**: Clean Tistory-specific HTML/CSS and track internal links for manual WordPress updates

**Independent Test**: Migrate a post with Tistory styling and internal links, verify clean HTML in WXR and link_mapping.json output

### Implementation for User Story 2

- [ ] T033 [P] [US2] Implement LinkTracker service in src/services/linkTracker.ts (extract and identify internal links)
- [ ] T034 [US2] Implement internal link detection in LinkTracker (compare href to TISTORY_BLOG_URL)
- [ ] T035 [US2] Implement link_mapping.json writer in LinkTracker (append internal links incrementally)
- [ ] T036 [US2] Integrate LinkTracker into Cleaner service (extract links during HTML cleaning)
- [ ] T037 [US2] Enhance Cleaner to remove Tistory-specific CSS classes and attributes
- [ ] T038 [US2] Update PostProcessor to call LinkTracker after cleaning

---

## Phase 5: User Story 3 - Attachment Handling and Error Resilience (Priority: P3)

**Goal**: Download attachments locally and enable migration resume after interruptions

**Independent Test**: Trigger error mid-migration, restart, and verify migration resumes from checkpoint

### Implementation for User Story 3

- [ ] T039 [P] [US3] Implement Downloader service in src/services/downloader.ts (download attachments with error handling)
- [ ] T040 [US3] Implement file download with retry logic in Downloader
- [ ] T041 [US3] Implement local file save in Downloader (save to output/downloads/)
- [ ] T042 [P] [US3] Implement State manager in src/utils/state.ts (load/save migration-state.json)
- [ ] T043 [US3] Implement loadState method in State (read existing state file)
- [ ] T044 [US3] Implement markProcessed method in State (update state after each post)
- [ ] T045 [US3] Integrate State into CLI (load state at startup, filter processed posts)
- [ ] T046 [US3] Integrate Downloader into PostProcessor (download attachments per post)
- [ ] T047 [US3] Update PostProcessor to handle download failures gracefully (log and continue)

---

## Phase 6: User Story 4 - Parallel Processing and Performance (Priority: P4)

**Goal**: Process posts in parallel with worker pool and rate limiting for faster migration

**Independent Test**: Migrate 100 posts and measure completion time with/without parallel processing

### Implementation for User Story 4

- [ ] T048 [P] [US4] Implement WorkerPool in src/workers/workerPool.ts (manage concurrent workers)
- [ ] T049 [US4] Integrate p-queue library for worker pool management
- [ ] T050 [US4] Implement rate limiting per worker (1 req/sec per worker, configurable)
- [ ] T051 [US4] Replace sequential processing in CLI with WorkerPool
- [ ] T052 [US4] Configure worker count from environment variable (WORKER_COUNT)
- [ ] T053 [US4] Configure rate limit from environment variable (RATE_LIMIT_PER_WORKER)

---

## Phase 7: Polish & Cross-Cutting Concerns

Final improvements and validation.

- [ ] T054 [P] Add error handling and validation to all services
- [ ] T055 [P] Add input validation for environment variables in config.ts
- [ ] T056 [P] Create README.md with installation and usage instructions
- [ ] T057 [P] Add code comments and JSDoc documentation to public APIs
- [ ] T058 [P] Run full migration test using quickstart.md scenarios
- [ ] T059 [P] Performance testing with 500 post simulation
- [ ] T060 Code cleanup and refactoring for maintainability
- [ ] T061 Final validation against all acceptance criteria in spec.md

---

## Execution Strategy

### MVP (Minimum Viable Product)
Complete through **Phase 3 (User Story 1)** for basic migration functionality.
- Tasks: T001-T032 (32 tasks)
- Deliverable: Working CLI that migrates Tistory posts to WXR

### Full Feature Set
Complete all phases (1-7) for production-ready tool.
- Tasks: T001-T061 (61 tasks)
- Deliverable: Complete migration tool with all features

### Parallel Execution Opportunities
- **Phase 1 (Setup)**: T003-T008 can run in parallel
- **Phase 2 (Foundational)**: T011-T019 (models) can run in parallel
- **Phase 3**: T020, T023, T026, T029 can start in parallel
- **Phase 4**: T033 can start immediately after Phase 2
- **Phase 5**: T039, T042 can start in parallel
- **Phase 6**: T048 can start in parallel with Phase 5
- **Phase 7**: T054-T059 can run in parallel

---

## Dependencies

### Phase Dependencies
```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS all user stories
    ↓
Phase 3 (US1 - MVP) ─┐
Phase 4 (US2)        ├─ Can proceed in parallel or sequentially
Phase 5 (US3)        │
Phase 6 (US4)       ─┘
    ↓
Phase 7 (Polish)
```

### Critical Path (Sequential)
1. Setup (T001-T002)
2. Core models (T009-T019)
3. Basic services (T020-T032)
4. Feature enhancements (T033-T053)
5. Polish (T054-T061)

---

## Notes

- All file paths follow structure defined in plan.md
- Each task is atomic and independently testable
- Tests are not included (not requested in spec)
- User stories maintain independence for incremental delivery
- Worker pool design allows flexible parallelism without code changes
