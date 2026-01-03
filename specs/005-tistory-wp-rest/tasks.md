# Tasks: Tistory -> WordPress REST Migration

**Branch**: `005-tistory-wp-rest` | **Date**: 2026-01-02  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Sequence**: [sequence-diagram.md](./sequence-diagram.md)

**Total Tasks**: 52  
**MVP Scope**: Complete User Stories 1 & 2 (single-post + full-blog migration)  
**Parallel Opportunities**: 28 tasks marked `[P]`

---

## Phase 0: Foundational (Blocking Prerequisites)

⚠️ **Critical**: All user stories depend on these tasks.

- [x] T201 [FOUND] Update `src/utils/config.ts` to load WP REST + SQLite settings and extend `src/models/Config.ts`.
- [x] T202 [P] [FOUND] Refresh `.env.example` and docs to document new REST environment variables.
- [x] T203 [FOUND] Add `utils/validation.ts` helpers for config/env guards reused across services. -> Not needed. We already validate config at config.ts. So skipped.
- [x] T204 [FOUND] Introduce `utils/retry.ts` with exponential backoff (inspired by Notion2Wordpress).
- [x] T205 [P] [FOUND] Scaffold `src/db/index.ts` and wire up `better-sqlite3` dependency.
- [x] T206 [FOUND] Create SQLite schema migrations (tables: migration_jobs, migration_job_items, migration_image_assets, post_map, internal_links) under `db/schema.sql`.
- [x] T207 [P] [FOUND] Implement DB initialization + migration runner called during CLI bootstrap.
- [x] T208 [FOUND] Add DB entity types (Job, JobItem, ImageAsset, PostMap, InternalLink) in `src/models/`.
- [x] T209 [FOUND] Provide structured logging helpers for DB + REST operations in `src/utils/logger.ts`. -> Not needed. We already have logger.ts with structured logging.

---

## User Story 1 - Single Post Draft Migration with Rollback (Priority: P1) 🎯 MVP

**Goal**: Migrate an individual Tistory post end-to-end via REST with guaranteed rollback.

### Tests (write first)

- [x] T210 [P] [US1] Add unit tests for config validation edge cases in `tests/unit/utils/config.test.ts`.
- [ ] T211 [P] [US1] Create DB layer tests covering CRUD + status transitions in `tests/unit/db/index.test.ts`.
- [ ] T212 [P] [US1] Mocked REST client tests for happy/error paths in `tests/unit/services/wpClient.test.ts`.
- [ ] T213 [P] [US1] Add rollback scenario test in `tests/unit/services/migrator.test.ts`.

### Implementation

- [ ] T214 [US1] Implement DB repository methods (jobs, job items, image assets, internal links, post map) in `src/db/index.ts`.
- [ ] T215 [P] [US1] Build `src/services/wpClient.ts` for media/posts/categories/tags CRUD with retries + auth.
- [ ] T216 [P] [US1] Implement rollback helpers in `wpClient` for `DELETE /media` and `DELETE /posts`.
- [ ] T217 [US1] Add category/tag caching + ensure\* helpers in `wpClient` following contracts.
- [ ] T218 [US1] Create `src/services/imageProcessor.ts` to download images (memory), upload to WordPress, and update DB state.
- [ ] T219 [US1] Extend `src/services/cleaner.ts` integration to capture internal links for DB recording.
- [ ] T220 [P] [US1] Implement `src/services/linkTracker.ts` to persist internal links via DB layer.
- [ ] T221 [US1] Build `src/services/migrator.ts` orchestrating per-post pipeline + rollback support.
- [ ] T222 [US1] Wire migrator with crawler/cleaner/imageProcessor/wpClient interactions per sequence diagram.
- [ ] T223 [US1] Persist job item lifecycle + failure reasons in SQLite during migration/rollback.
- [ ] T224 [P] [US1] Add CLI option `--post` for single URL and connect to migrator + DB bootstrap.
- [ ] T225 [US1] Export rollback-safe summary from CLI (success/failure metrics, job IDs).
- [ ] T226 [US1] Update `tests/unit/WXRGenerator-utils.test.ts` (or new suites) to stub crawler output for REST mode.
- [ ] T227 [US1] Document single-post smoke test flow in `quickstart.md` & plan checklist updates.

---

## User Story 2 - Full Blog Migration with Resume & Rate Limits (Priority: P1) 🎯 MVP

**Goal**: Migrate entire blogs with resumable worker pool respecting rate limits.

### Tests (write first)

- [ ] T230 [P] [US2] Add pagination crawler fixture tests ensuring URL discovery across pages.
- [ ] T231 [P] [US2] Add worker pool integration test simulating partial failures + resume in `tests/unit/workers/postProcessor.test.ts`.
- [ ] T232 [US2] Add CLI e2e-style test (mock REST + SQLite) covering resume + `--retry-failed`.

### Implementation

- [ ] T233 [US2] Extend crawler to expose bulk listing API compatible with resume logic.
- [ ] T234 [US2] Implement job bootstrap in CLI for `--all` (create migration_job rows, filter completed job items).
- [ ] T235 [P] [US2] Adapt `src/workers/postProcessor.ts` to enqueue per-post tasks via migrator with concurrency controls.
- [ ] T236 [US2] Integrate rate limit + concurrency settings from config into worker pool.
- [ ] T237 [US2] Implement resume logic (skip success, optional retry failed) backed by SQLite job items.
- [ ] T238 [US2] Aggregate job metrics (processed, skipped, failed, duration) and persist to job table.
- [ ] T239 [US2] Add CLI summary output for bulk runs including DB paths + link dump hints.
- [ ] T240 [US2] Implement optional `--retry-failed` flag controlling job item selection.
- [ ] T241 [US2] Ensure CLI exits with non-zero status when failures remain for visibility.

---

## User Story 3 - Internal Link Tracking & Export (Priority: P2)

**Goal**: Capture internal links for manual post-migration fixes.

### Tests (write first)

- [ ] T245 [P] [US3] Add unit tests for linkTracker DB writes + filtering.
- [ ] T246 [US3] Add integration test verifying `link_mapping.json` export content.

### Implementation

- [ ] T247 [US3] Finalize DB schema & repository methods for `internal_links` table (source/target/link_text/context).
- [ ] T248 [US3] Update cleaner/linkTracker pipeline to persist links per job item.
- [ ] T249 [US3] Implement exporter generating `output/link_mapping.json` from SQLite snapshot.
- [ ] T250 [P] [US3] Add CLI flag to trigger/export link mapping after runs.
- [ ] T251 [US3] Document link review workflow in `quickstart.md` and README section.

---

## User Story 4 - Configuration & Observability (Priority: P3)

**Goal**: Operational controls for concurrency, rate limits, logging, and troubleshooting.

### Tests (write first)

- [ ] T255 [P] [US4] Add config parsing tests for concurrency/rate-limit defaults.
- [ ] T256 [US4] Add logger tests asserting structured fields for job items + WP requests.

### Implementation

- [ ] T257 [US4] Implement structured logging fields (jobId, jobItemId, wpPostId) in `logger.ts` + CLI usage.
- [ ] T258 [US4] Add verbose logging / `--quiet` CLI switches to control output.
- [ ] T259 [US4] Surface config summary + sanity checks at CLI startup (missing env, DB path permissions).
- [ ] T260 [US4] Emit metrics dashboards (counts, durations) via log summaries suitable for ingestion.
- [ ] T261 [US4] Update `.env.example` + docs with tuning guidance for rate limits & workers.

---

## Phase N: Cross-Cutting Polish & Validation

- [ ] T270 [P] Update `specs/005-tistory-wp-rest/checklists/requirements.md` to trace task coverage.
- [ ] T271 [P] Ensure quickstart + README instructions match final CLI flags.
- [ ] T272 [P] Run end-to-end dry run against fixtures (no live WordPress) verifying success metrics.
- [ ] T273 [P] Conduct performance test (100-post fixture) to validate concurrency benefits.
- [ ] T274 [P] Final review for non-scope items (comments, attachments) to confirm excluded paths remain disabled.
- [ ] T275 Close feature by updating `progress.json` and preparing for implementation handoff.
