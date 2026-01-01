# Requirements Checklist - 005-tistory-wp-rest

## Functional Requirements

- [ ] FR-001: Accept Tistory blog URL via env (`TISTORY_BLOG_URL`)
- [ ] FR-002: Implemented in TypeScript; reuse 003 crawler/cleaner/models where possible
- [ ] FR-003: Crawl blog listing pages and handle pagination to collect all post URLs
- [ ] FR-004: Parse per-post details (title, raw HTML, created/modified dates, URL, hierarchical categories, tags, images URL+alt)
- [ ] FR-005: Per-post pipeline (crawl → clean → image download/upload → internal link tracking → WordPress upload) instead of batch
- [ ] FR-006: HTML→Markdown→HTML cleaning using turndown/marked; remove Tistory-specific HTML/CSS while preserving structure
- [ ] FR-007: Identify internal Tistory links and record source/target to DB (and/or `link_mapping.json` export)
- [ ] FR-008: Download images into memory (no local files) and upload to WordPress media library (logic reused from Notion2Wordpress where possible)
- [ ] FR-009: Replace in-post image URLs with uploaded WordPress media URLs
- [ ] FR-010: Use WordPress REST API to create posts including categories, tags, and media (featured/gallery)
- [ ] FR-011: Preserve Tistory publish date (and modified date if available) on WordPress post
- [ ] FR-012: Upload all migrated posts as `draft` status
- [ ] FR-013: Use Application Passwords for WordPress REST auth; config via env (`WP_BASE_URL`, `WP_APP_USER`, `WP_APP_PASSWORD`)
- [ ] FR-014: Support configurable worker count and per-worker/request rate limit via env (reusing 003 worker-pool pattern)
- [ ] FR-015: Track per-post processing state in **SQLite DB** (jobs/job_items) to support resume without duplicating completed posts
- [ ] FR-016: Log errors with sufficient detail (post URL/id, resource) and store error info in DB for debugging
- [ ] FR-017: Support parallel per-post processing with worker pool while respecting rate limits (SHOULD)
- [ ] FR-018: Must NOT implement out-of-scope features (comments, non-image attachments, automatic internal link rewriting)
- [ ] FR-019: Implement mandatory per-post rollback: on failure after media/post creation, delete created WordPress media/posts and mark the job item as Failed in DB

## Cross-Project Reuse

- [ ] Reuse Tistory crawling and pagination logic from 003 WXR generator
- [ ] Reuse HTML cleaning (turndown + marked) and Tistory-specific DOM stripping from 003
- [ ] Reuse InternalLink detection logic and mapping shape from 003 (but store primarily in SQLite)
- [ ] Reuse Notion2Wordpress approach for state management and rollback: SQLite DB with jobs/job_items/image_assets/internal_links
- [ ] Reuse WordPress REST + media upload patterns from Notion2Wordpress (Application Password auth, retry/backoff, axios usage)

## Non-functional

- [ ] NF-001: Handle large blogs (500+ posts) without crashes using worker pool + rate limiting
- [ ] NF-002: Provide error logging and resumability via SQLite so interrupted runs can be safely retried
- [ ] NF-003: Respect crawl/API rate limits to avoid being blocked by Tistory/WordPress

## Scope Exclusions

- [ ] EX-001: Comments migration
- [ ] EX-002: Non-image attachment uploads
- [ ] EX-003: Automatic internal link rewriting to WordPress URLs
