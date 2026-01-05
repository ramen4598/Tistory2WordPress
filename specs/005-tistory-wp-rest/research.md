# Research Findings - 005-tistory-wp-rest

## WordPress REST + Application Passwords

**Decision**: Use standard WordPress REST API (`/wp-json/wp/v2/*`) with Application Passwords and Basic Auth headers.

**Rationale**:

- Matches how Notion2Wordpress integrates with WordPress.
- Officially supported and stable across recent WordPress versions.
- Works with self-hosted WordPress and WordPress.com (with appropriate settings).

**Key Details**:

- Auth header: `Authorization: Basic base64("WP_APP_USER:WP_APP_PASSWORD")`.
- Base URL: `${WP_BASE_URL}/wp-json/wp/v2`.
- Endpoints used:
  - `POST /media` for image uploads.
  - `GET/POST /categories` for taxonomy terms.
  - `GET/POST /tags` for tags.
  - `POST /posts` for creating draft posts.

**Alternatives considered**:

- OAuth plugins or JWT-based auth: more setup complexity; Application Passwords are simpler for a migration tool.

---

## Media Upload Strategy

**Decision**: Download images into memory (in‑memory buffer only, no `downloads/` directory) and upload them to WordPress via the REST media endpoint, then rewrite content URLs to use the returned `source_url`.

**Rationale**:

- Aligns with updated 005 spec: images must not be written to local disk.
- Still mirrors the logical pattern in Notion2Wordpress (download → upload → rewrite) while changing the storage medium to memory.
- Avoids relying on WordPress automatically fetching external images.
- Ensures media lives in the target WordPress media library and benefits from its CDN/cache.

**Notes**:

- Use `axios.get(url, { responseType: 'arraybuffer' })` or equivalent to obtain a binary buffer in memory.
- Use multipart/form-data with `file` field for uploads, constructed directly from the in‑memory buffer.
- Consider simple retry with backoff on 5xx or transient 4xx errors.

**Alternatives considered**:

- Rely on WordPress auto-fetched external images: less control and may fail silently.

---

## Worker Pool & Rate Limiting

**Decision**: Reuse the worker-pool + rate-limiting approach from 003 (p-queue or equivalent) for both Tistory crawling and WordPress REST calls.

**Rationale**:

- Already implemented and tested in 003 (Tistory side).
- Same pattern is suitable for WordPress REST (bounded concurrency + delay between requests).

**Parameters**:

- `WORKER_COUNT` (default 4).
- `RATE_LIMIT_PER_WORKER` (default ~1 req/sec, adjustable via env).

---

## Resume Strategy (Migration State)

**Decision**: Use a SQLite database (Notion2Wordpress‑style) as the single source of truth for migration state instead of a JSON state file (`migration-state.json`).

**Rationale**:

- Aligns with the updated 005 spec and data model (job / job_item / image_asset / mapping tables).
- Matches the proven approach in Notion2Wordpress for resumable, inspectable migrations.
- Makes it easier to track per‑post status, image assets, and internal links in a structured way.

**Schema overview** (see `data-model.md` for details):

- `migration_jobs`: overall migration runs (type, status, counts, timestamps).
- `migration_job_items`: per‑post state (Tistory URL, wp_post_id, status, error_message, timestamps).
- `migration_image_assets`: per‑image state (Tistory image URL, wp_media_id/url, status, error_message).
- `tistory_wp_post_map`: mapping between Tistory post URL and WordPress post ID.
- `internal_links`: internal Tistory link records (for optional `link_mapping.json` export).

---

## Scope Clarifications

- **Out-of-scope**:
  - Comments migration.
  - Non-image attachments.
  - Automatic conversion of internal Tistory links to WordPress permalinks.
- **Reason**: Each of these would require additional mapping logic and/or WordPress configuration beyond the current project's goals.
