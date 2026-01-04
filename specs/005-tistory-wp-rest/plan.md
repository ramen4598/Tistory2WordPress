# Implementation Plan: Tistory -> WordPress REST Migration

**Branch**: `005-tistory-wp-rest` | **Date**: 2026-01-01 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-tistory-wp-rest/spec.md`, reusing non-WXR decisions from `003-name-tistory-wxr-generator` and media/REST/SQLite patterns from Notion2Wordpress.

## Summary

A TypeScript CLI tool that migrates Tistory blog posts directly into a target WordPress instance via the WordPress REST API. The tool:

- Scrapes Tistory blog content (no official API) using the existing crawler from 003.
- Cleans HTML via Markdown round-trip (turndown/marked) to remove Tistory-specific markup.
- Tracks internal Tistory links and stores them in SQLite (and can export `link_mapping.json` for manual usage).
- Downloads post images into memory and uploads them to the WordPress media library (reusing Notion2Wordpress logic), then rewrites image URLs in post content.
- Creates WordPress draft posts (with categories/tags/dates/media) via REST, using Application Password authentication.
- Supports parallel per-post processing via worker pool and **resumable migration through a SQLite database**, not JSON state files.
- Supports **per-post rollback**: if any step fails after media/post creation, uploaded media and the post are deleted via WordPress REST `DELETE`.

Compared to the 003 WXR generator, the main changes are:

- Final output stage: instead of building a WXR XML file, we call WordPress REST endpoints to create content in-place.
- State management: we use a SQLite DB (Notion2Wordpress-style) to persist jobs, items, image assets, mappings, and internal links (no JSON `migration-state.json`).
- Error handling: introduce mandatory per-post rollback similar to Notion2Wordpress `syncOrchestrator.rollback`.

## Technical Context

**Language/Version**: TypeScript 5.x with Node.js 18+  
**Primary Dependencies**:

- `cheerio` (HTML parsing)
- `turndown` (HTML->Markdown)
- `marked` (Markdown->HTML)
- `p-queue` or equivalent (worker pool / concurrency control)
- `axios` (HTTP client for REST, reused from Notion2Wordpress semantics)
- `dotenv` (environment variable loading)
- `better-sqlite3`(preferred) or `sqlite3` + query wrapper (SQLite access, similar to Notion2Wordpress DB layer)

**Storage**:

- SQLite database (e.g. `migration.db`):
  - Migration jobs, job items (per post), image assets, post mapping, internal links.
- File system:
  - Optional `link_mapping.json` export (derived from DB).
- WordPress database (indirectly, via REST API).

**Testing**: Jest + ts-jest (same setup as 003)  
**Target Platform**: Node.js CLI (macOS, Linux, Windows)  
**Performance Goals**:

- 100 posts in <10 minutes with 4 workers under reasonable network conditions.
- Support 500+ posts without running out of memory or overwhelming Tistory/WordPress.

**Constraints**:

- Respect Tistory and WordPress rate limits (e.g., ~1 req/sec per worker by default, configurable).
- Graceful error handling with resumable state and per-post rollback.
- No write access to comments/non-image attachments.

---

## Project Structure (005 feature view)

We reuse the 003 project layout and extend/replace the WXR-specific parts with REST-specific services and a SQLite DB layer.

```text
specs/005-tistory-wp-rest/
├── spec.md               # Feature specification (requirements, stories, success criteria)
├── plan.md               # This implementation plan
├── sequence-diagram.md   # Updated sequence diagrams for REST + DB + rollback flow
├── data-model.md         # Data structures and WP/DB mapping
├── quickstart.md         # Getting started for REST migration
├── notion2wp-reuse-report.md # Reuse analysis from Notion2Wordpress
└── checklists/
    └── requirements.md   # Requirements tracking for this feature
```

### Source Code (shared repo)

```text
src/
├── models/                      # Shared domain models
│   ├── Post.ts
│   ├── Category.ts
│   ├── Tag.ts
│   ├── Image.ts
│   ├── InternalLink.ts
│   ├── MigrationState.ts        # May be adapted/aliased to DB-based state
│   └── WXRData.ts               # Kept for 003 (WXR), unused for REST
├── services/
│   ├── crawler.ts               # Tistory scraping (reused from 003)
│   ├── cleaner.ts               # HTML→MD→HTML cleaning (reused from 003)
│   ├── wxrGenerator.ts          # WXR generation (003 path, not used here)
│   ├── wpClient.ts              # NEW: WordPress REST API client (create/delete posts/media, terms)
│   ├── imageProcessor.ts        # NEW: image download (in-memory) + WP media upload + URL rewrite
│   └── migrator.ts              # NEW: per-post pipeline orchestration for REST + rollback
├── db/
│   └── index.ts                 # NEW: SQLite access layer (jobs, job_items, image_assets, mappings, links)
├── workers/
│   └── postProcessor.ts         # Worker pool orchestration (shared/extended)
├── utils/
│   ├── config.ts                # Env loading, extended with WP_* and DB path
│   ├── logger.ts                # Logging (reused)
│   ├── retry.ts                 # NEW: retryWithBackoff (from Notion2Wordpress)
│   └── state.ts                 # May wrap DB-based state or be phased out
└── cli.ts                       # REST-only CLI entrypoint for 005 (no WXR mode or entrypoint)

output/
└── link_mapping.json            # Optional internal link mapping export (derived from DB)
```

**Structure Decision**: Keep a single codebase that can support both WXR and REST flows, sharing crawler/cleaner/models. Introduce REST-specific services (`wpClient`, `imageProcessor`, `migrator`, `db` layer) that plug into the existing worker/logging infrastructure. JSON `migration-state.json` is replaced with a SQLite-based state model.

---

## Phase 0: Research & Reuse Alignment

Goals:

- Confirm how Notion2Wordpress handles WordPress REST + media upload + Application Passwords + SQLite DB + rollback.
- Ensure Tistory crawler/cleaner from 003 are adequate for REST flow without major changes.

Actions:

- Review Notion2Wordpress:
  - HTTP client choices, auth header construction (`Authorization: Basic base64(user:app_password)`), error handling and retry/backoff.
  - Media upload and post creation payloads for WordPress (`/wp-json/wp/v2/media`, `/wp-json/wp/v2/posts`).
  - DB schema (`config/schema.sql`) and how sync jobs, job items, image assets, and page-post mapping are modeled.
  - `syncOrchestrator.rollback` 구현 방식 (업로드된 media/post 삭제, item 상태 업데이트).
- Review 003 services:
  - `crawler.ts`: per-post URLs and metadata in a `Post` model suitable for REST.
  - `cleaner.ts`: HTML→MD→HTML and Tistory-specific DOM removal logic are generic and reusable.

Output of Phase 0 is captured in `notion2wp-reuse-report.md` and used to update this plan/spec. It identifies:

- Which modules are reused as-is.
- Which require adapter/wrapper code.
- Which are replaced (WXR generation → REST posting, JSON state → SQLite, no rollback → rollback).

---

## Phase 1: Sequence & Data Flow Design

We adapt the 003 sequence diagrams to REST + SQLite + rollback. See `sequence-diagram.md` for full Mermaid diagrams.

High-level flow:

1. CLI loads env/config (Tistory URL, WP base URL, WP app user/password, worker count, rate limits, SQLite DB path).
2. CLI initializes SQLite DB (migrations/DDL if needed) and loads current migration job state (or creates a new job).
3. Crawler discovers all post URLs via pagination.
4. CLI queries DB for already-processed/failed posts and computes remaining targets.
5. Worker pool (`p-queue`) processes remaining posts concurrently:
   - For each post:
     - Create a `migration_job_item` row in DB.
     - Fetch post HTML (rate-limited HTTP to Tistory).
     - Parse metadata (title, dates, categories, tags, images).
     - Clean HTML via cleaner (HTML→MD→HTML, Tistory markup removal).
     - Extract internal links and write internal_links rows to DB (handled by LinkTracker).
     - Download each image into memory and upload to WordPress media via `wpClient` (no `downloads/` dir).
     - Build mapping from original image URL → WordPress media URL and rewrite content.
     - Ensure categories/tags exist in WordPress (find-or-create via REST), cache IDs.
     - Create WordPress draft post with content, dates, taxonomy, and featured media.
     - Update DB job item row with `wp_post_id`, status `Success`.
   - If any step fails after media/post creation:
     - Trigger rollback: delete uploaded media/post via REST and mark job item `Failed` with error details.
6. At the end (or incrementally), export `link_mapping.json` from DB if desired and update overall job metrics.

Key REST/DB-specific decisions:

- No WXR file is written for this flow (003 path remains for WXR use cases).
- Errors during media upload or post creation:
  - Logged with post URL and error details.
  - Marked as `Failed` in SQLite job item and **rolled back** by deleting created WP resources.
- Job/job item tables provide resumability and detailed progress tracking.

---

## Phase 2: Data Model Adaptation

We reuse most of the 003 data model (see `data-model.md`) but drop WXR-specific parts and attachments for this feature, and add DB entities inspired by Notion2Wordpress.

- `Post`:
  - Keep: `url`, `title`, `cleaned_html`, `publish_date`, `modified_date`, `categories`, `tags`, `images`.
  - Ignore: `attachments` (attachments are out of scope).
- `Category` / `Tag`:
  - Same as 003, with optional fields for WordPress term IDs to cache mapping:
    - `wpId?: number`.
- `Image`:
  - No local path.
  - Fields:
    - `url`, `alt_text`, `wp_media_id?`, `wp_media_url?`.
- `InternalLink`:
  - Same logical structure as 003; stored in DB instead of only JSON.
- DB entities:
  - `MigrationJob` (e.g., `migration_jobs` table): overall run (mode, timestamps, counts, status).
  - `MigrationJobItem` (`migration_job_items`): per-post state.
  - `ImageAsset` (`migration_image_assets`): per-image state.
  - `PostMap` (`tistory_wp_post_map`): Tistory URL/ID ↔ WP Post ID mapping.
  - `InternalLinkRecord` (`internal_links`): internal link mapping; can be dumped to `link_mapping.json`.

WordPress REST request payloads (conceptual):

- Media upload (`POST /wp-json/wp/v2/media`): multipart/form-data with file (image) and fields (`alt_text`, `title` as needed).
- Post creation (`POST /wp-json/wp/v2/posts`):
  - `title`, `content` (HTML), `status: "draft"`, `date` (publish date), `categories` (array of term IDs), `tags` (array of term IDs), `featured_media`.
- Resource deletion (rollback):
  - `DELETE /wp-json/wp/v2/media/{id}?force=true`.
  - `DELETE /wp-json/wp/v2/posts/{id}?force=true`.

---

## Phase 3: Module-Level Design

### 3.1 `utils/config.ts`

Extend existing config loader to include:

- `TISTORY_BLOG_URL` (string, required)
- `WP_BASE_URL` (string, required)
- `WP_APP_USER` (string, required)
- `WP_APP_PASSWORD` (string, required)
- `WORKER_COUNT` (number, default 4)
- `RATE_LIMIT_PER_WORKER` (ms or req/sec, consistent with 003)
- `MIGRATION_DB_PATH` (string, SQLite file path, default `./migration.db`)
- Retry-related settings:
  - `MAX_RETRY_ATTEMPTS`, `RETRY_INITIAL_DELAY_MS`, `RETRY_MAX_DELAY_MS`, `RETRY_BACKOFF_MULTIPLIER`

### 3.2 `db/index.ts`

Responsibilities:

- Establish a SQLite connection (e.g., `better-sqlite3`) and run schema migrations on startup.
- Provide typed functions for interacting with tables:
  - `createMigrationJob(jobType)`, `updateMigrationJob(jobId, patch)`.
  - `getLastMigrationTimestamp()` (if needed. Maybe not needed now.).
  - `createMigrationJobItem({ job_id, tistory_url })`, `updateMigrationJobItem(id, patch)`.
  - `createImageAsset({ job_item_id, tistory_image_url, ... })`, `updateImageAsset(id, patch)`.
  - `createPostMap({ tistory_url, wp_post_id })`, `getPostMapByTistoryUrl(url)`.
  - `insertInternalLink(record)`, `getAllInternalLinks()`.
- Encapsulate SQL strings and keep a thin but clear API similar to Notion2Wordpress `db/index.ts`.

### 3.3 `services/wpClient.ts`

Responsibilities:

- Build authenticated HTTP client using Application Passwords (Basic auth header).
- Expose methods (based on Notion2Wordpress `wpService.ts`):
  - `createDraftPost(options): Promise<{ id; link; status; }>`.
    - Accepts title, content, status, dates, categories, tags, featured_media, etc.
  - `uploadMedia(options): Promise<{ id; url; mediaType; mimeType; }>`.
  - `deletePost(postId: number): Promise<void>` (rollback).
  - `deleteMedia(mediaId: number): Promise<void>` (rollback).
  - `ensureCategory(name, parentPath?): Promise<number>`.
  - `ensureTag(name): Promise<number>`.
  - (Helper) `replaceImageUrls(html, map)` if not moved to `imageProcessor`.
- Error & retry handling:
  - Use `retryWithBackoff` for network/transient errors.
  - Distinguish 4xx vs 429/5xx to decide retry vs fail-fast.
  - Log structured messages for each attempt and final failure.

### 3.4 `services/imageProcessor.ts`

Responsibilities:

- For a given `Post` and its `images`:
  - Download each image into memory (axios `responseType: 'arraybuffer'`).
  - Compute filename based on original filename + hash, infer extension from `content-type`.
  - Call `wpClient.uploadMedia` with the in-memory buffer.
  - Insert/update `ImageAsset` rows in DB with status (`Pending` → `Uploaded`/`Failed`).
  - Build a mapping from original image URL → WordPress media URL.
  - Apply URL replacements to `post.cleaned_html`.
- API:
  - `processImagesForPost(post, context): Promise<{ updatedPost; uploadedMediaIds: number[]; }>`.
    - `context` includes `jobItemId` for DB linkage.
- Error handling:
  - Use `retryWithBackoff` for downloads.
  - If any image fails, mark corresponding DB rows as `Failed` and propagate an error up so `migrator` can roll back the whole post.

### 3.5 `services/migrator.ts`

Responsibilities:

- Orchestrate the per-post migration pipeline with rollback:
  - `migratePostByUrl(url: string, jobId: number): Promise<void>`.
- Steps per post:
  1. Create `migration_job_item` in DB (status: `Pending`).
  2. Fetch HTML from Tistory with `crawler`.
  3. Parse metadata and construct `Post` model.
  4. Clean content with `cleaner`.
  5. Extract internal links and insert `internal_links` rows into DB.
  6. Call `imageProcessor.processImagesForPost` to handle images and rewrite HTML.
  7. Resolve categories/tags via `wpClient.ensureCategory/Tag` and map to term IDs.
  8. Call `wpClient.createDraftPost` to create the WordPress draft.
  9. Update DB:
     - Set JobItem `wp_post_id`, status `Success`, timestamps.
     - Create post map row (Tistory URL ↔ WP post ID).
- Rollback:
  - On any error after images or post creation:
    - Call `rollback(jobItem, { uploadedMediaIds, wpPostId })`:
      - Delete uploaded media via `wpClient.deleteMedia`.
      - Delete created post via `wpClient.deletePost`.
      - Update `migration_job_items` status to `Failed` and store error message.
    - Rethrow error so worker/CLI can log and increment failure counters.

### 3.6 Worker Pool (`workers/postProcessor.ts`)

Adaptation from 003:

- Keep `p-queue`-based worker design and rate limiting.
- Instead of pushing "add to WXR", workers call `migrator.migratePostByUrl(...)`.
- Respect DB state:
  - Before enqueuing URLs, query DB for items already `Success` or `Failed` and skip or re-enqueue according to CLI flags (e.g. `--retry-failed`).
- Ensure that errors in individual posts:
  - Do not crash the whole job.
  - Are reflected in job/job item counters in DB.

### 3.7 CLI Entrypoint

- CLI options:
  - `--all` (default): migrate entire blog.
  - `--post=<url>`: migrate a single post for testing.
  - Optional: `--retry-failed` to only reprocess failed posts.
- Responsibilities:
  - Validate configuration and required env vars.
  - Initialize logging, SQLite DB (run migrations), and create/update a `migration_job` record.
  - Kick off either single-post or bulk flow via worker pool + migrator.
  - Summarize results (processed, failed, outputs) at the end using DB metrics.

---

## Phase 4: Testing Strategy

We follow the same Jest-based approach as 003, with additional focus on DB integration and rollback.

- **Unit tests**:
  - `config`: env precedence and validation.
  - `db`: DB initialization and CRUD for jobs, job items, image assets, mappings.
  - `wpClient`: builds correct URLs, headers, and handles success/error responses (HTTP mocked), including delete endpoints.
  - `imageProcessor`: downloads images (HTTP mocked), inserts/updates DB records, and rewrites URLs correctly.
  - `migrator`: orchestrates per-post pipeline correctly given mocked crawler/cleaner/wpClient/imageProcessor/db, including rollback path.
- **Integration-style tests** (no real network):
  - Simulate a few sample Tistory HTML pages (fixtures already in 003 tests) and verify that running the pipeline yields expected number of WordPress REST calls and DB rows for jobs/items/image assets/internal links.
  - Force errors (e.g. media upload failure) and verify that rollback deletes simulated WP resources and marks items `Failed`.

Reusing 003 and Notion2Wordpress test fixtures/patterns:

- HTML fixtures for Tistory posts and index pages.
- Expected cleaned HTML snippets.
- Notion2Wordpress tests for `retry`, `wpService`, `syncOrchestrator` as reference for test style and coverage.

---

## Risks & Mitigations

- **Risk**: WordPress REST API differences across versions.
  - Mitigation: Use the standard `wp/v2` endpoints and avoid version-specific fields where possible. Make WP base URL configurable.
- **Risk**: Network instability or rate limiting.
  - Mitigation: Reuse rate-limiting + retry strategies with `retryWithBackoff`. Make them configurable via env.
- **Risk**: Divergence between WXR and REST paths causing maintenance overhead.
  - Mitigation: Keep shared logic (crawler, cleaner, models) in common modules. Restrict differences to `wxrGenerator` vs `wpClient`/`imageProcessor`/`migrator`/`db`.
- **Risk**: SQLite schema evolution and locking issues.
  - Mitigation: Start with a minimal stable schema; apply simple migrations when necessary. Use a single-process CLI (no multi-process writes) to avoid lock contention.
- **Risk**: Large image data and many concurrent downloads.
  - Mitigation: Constrain `maxConcurrentImageDownloads`; stream downloads into memory without persisting to disk; use backpressure via worker pool.

---

## Implementation Order (High-level)

1. Extend `config` and `.env.example` with WordPress-related and DB-related settings.
2. Introduce SQLite schema and `db/index.ts` (inspired by Notion2Wordpress `schema.sql` and `db/index.ts`).
3. Implement `retry.ts` utility and update HTTP-related code to use it.
4. Implement `wpClient` based on Notion2Wordpress patterns (create/delete posts, upload/delete media, ensureCategory/Tag).
5. Implement `imageProcessor` for in-memory image download + WP media upload + URL rewrite, with DB-backed image asset tracking.
6. Implement `migrator` to orchestrate per-post REST migration using existing crawler/cleaner and new db/wpClient/imageProcessor, including rollback.
7. Wire `postProcessor` (worker pool) to use DB state (jobs/items) and call the new migrator for REST mode.
8. Implement REST-only CLI supporting `--all`, `--post`, `--retry-failed` and integrate DB job lifecycle (no `--mode` switch).
9. Add/update unit & integration tests for new modules and ensure existing 003 tests still pass.
10. Verify end-to-end on a small Tistory blog (local test instance of WordPress recommended), including intentional failure cases to validate rollback.
