# Data Model: Tistory -> WordPress REST Migration

**Branch**: `005-tistory-wp-rest` | **Date**: 2026-01-01

## Overview

This document defines the core data structures used throughout the REST-based migration pipeline, from parsing Tistory content to creating WordPress posts/media via the REST API, and tracking migration state in SQLite.

We reuse most of the data model from `003-name-tistory-wxr-generator`, remove WXR-only concepts (like `WXRData` aggregation and non-image attachments for this feature), and add fields relevant to:

- WordPress REST (term IDs, media IDs, rollback operations).
- SQLite-based job/item/image-asset/internal-link tracking (inspired by Notion2Wordpress `schema.sql` and `db` layer).

---

## Post

**Description**: Represents a single Tistory blog post with all associated metadata and content, ready to be mapped to a WordPress post.

### Attributes

- `url`: string - Original Tistory post URL (unique identifier)
- `title`: string - Post title
- `raw_html`: string - Original post HTML as fetched from Tistory
- `cleaned_html`: string - Cleaned HTML content (after HTML->Markdown->HTML and Tistory-specific cleanup)
- `publish_date`: Date - Original publication date
- `modified_date`: Date | null - Last modification date (optional)
- `categories`: Category[] - Associated categories (hierarchical)
- `tags`: Tag[] - Associated tags
- `images`: Image[] - Images referenced in post
- `internal_links`: InternalLink[] - Internal Tistory links found in content

### Relationships

- **One-to-Many**: Post -> Image (one post has many images)
- **Many-to-Many**: Post -> Category (post can have multiple categories)
- **Many-to-Many**: Post -> Tag (post can have multiple tags)

### Validation

- `url` must be valid URL format and start with configured `TISTORY_BLOG_URL`.
- `title` must not be empty (fallback: "Untitled" with logging).
- `publish_date` required, `modified_date` optional.
- `cleaned_html` should be non-null after cleaning step; if empty, log warning.

### State Transitions

- Raw HTML -> Parsed Post -> Cleaned Post (HTML->MD->HTML) -> Images processed (media uploaded, URLs rewritten) -> WordPress draft created.

---

## Category

**Description**: Represents a blog category with optional parent-child hierarchy and a mapping to a WordPress category term.

### Attributes

- `name`: string - Category display name
- `slug`: string - URL-safe category identifier
- `parent`: Category | null - Parent category (for hierarchy)
- `description`: string | null - Category description (optional)
- `wpId`: number | null - WordPress category term ID once created/resolved

### Relationships

- **Self-referential**: Category -> Category (parent-child hierarchy)
- **Many-to-Many**: Category <-> Post

### Validation

- `name` must not be empty.
- `slug` is generated and managed by WordPress based on `name` (via `sanitize_title()` and any site-level filters/plugins). The migration tool does not attempt to reproduce WordPress slug rules; it primarily relies on `name` and the resolved WordPress term ID (`wpId`).
- Circular parent references not allowed.
- Recommended maximum depth: 2 levels (for Tistory compatibility).

---

## Tag

**Description**: Represents a blog tag (flat, no hierarchy) and its mapping to a WordPress tag term.

### Attributes

- `name`: string - Tag display name
- `slug`: string - URL-safe tag identifier
- `wpId`: number | null - WordPress tag term ID once created/resolved

### Relationships

- **Many-to-Many**: Tag <-> Post

### Validation

- `name` must not be empty.
- `slug` is generated and managed by WordPress based on `name` (via `sanitize_title()` and any site-level filters/plugins). The migration tool does not attempt to reproduce WordPress slug rules; it primarily relies on `name` and the resolved WordPress term ID (`wpId`).
- Tags treated as case-insensitive (normalized to lowercase).

---

## Image

**Description**: Represents an image referenced in post content, along with its WordPress media mapping.

### Attributes

- `url`: string - Original image URL (Tistory CDN or external)
- `alt_text`: string | null - Image alt attribute
- `wp_media_id`: number | null - WordPress media ID after upload
- `wp_media_url`: string | null - WordPress media URL after upload

### Relationships

- **Many-to-One**: Image -> Post

### Validation

- `url` must be valid URL format.
- `alt_text` extracted from HTML `alt` attribute if available.

### Processing Notes

- Images are downloaded into memory (no local file persistence) before upload.
- After successful upload, `wp_media_id` and `wp_media_url` are populated.
- Post content is rewritten to use `wp_media_url` instead of original `url`.

---

## InternalLink

**Description**: Tracks links between posts within the same Tistory blog. Used to populate a DB table (and optionally generate `link_mapping.json`) for manual post-migration fixes.

### Attributes

- `source_url`: string - URL of post containing the link
- `target_url`: string - URL of referenced Tistory post
- `link_text`: string | null - Anchor text of the link
- `context`: string | null - Optional surrounding text snippet for context

### Relationships

- **Standalone**: Stored separately from Post entities (but logically tied to them via URLs).

### Validation

- `source_url` must correspond to a discovered post URL.
- `target_url` must start with configured `TISTORY_BLOG_URL`.
- Both URLs must be valid.

### Output Format (optional JSON `link_mapping.json`)

```json
{
  "source_url": "https://blog.tistory.com/123",
  "target_url": "https://blog.tistory.com/456",
  "link_text": "See this related post",
  "context": "For more details, see this related post about..."
}
```

---

## SQLite Entities (Migration State)

REST flow uses SQLite to track migration jobs, per-post items, image assets, and mappings, inspired by Notion2Wordpress.

### MigrationJob (`migration_jobs`)

**Description**: Represents a single migration run (e.g., `--all` full-blog run).

#### Attributes (columns)

- `id`: integer (PK) - Job ID
- `job_type`: string - e.g., `full`, `single` (make it as Enum)
- `status`: string - `running`, `completed`, `failed` (make it as Enum)
- `created_at`: datetime - Job start timestamp
- `completed_at`: datetime | null - Job completion timestamp
- `error_message`: string | null - Fatal error message (if any)

### MigrationJobItem (`migration_job_items`)

**Description**: Represents the migration state of a single Tistory post.

#### Attributes (columns)

- `id`: integer (PK)
- `job_id`: integer (FK → `migration_jobs.id`)
- `tistory_url`: string - Tistory post URL
- `wp_post_id`: integer | null - WordPress post ID created for this item
- `status`: string - `running`, `completed`, `failed` (make it as Enum)
- `error_message`: string | null - Last error encountered during migration
- `created_at`: datetime
- `updated_at`: datetime

#### Relationships

- **Many-to-One**: MigrationJobItem -> MigrationJob
- **One-to-Many**: MigrationJobItem -> ImageAsset

### ImageAsset (`migration_image_assets`)

**Description**: Tracks the state of each image processed for a specific job item, used for diagnostics and rollback.

#### Attributes (columns)

- `id`: integer (PK)
- `job_item_id`: integer (FK → `migration_job_items.id`)
- `tistory_image_url`: string - Original image URL
- `wp_media_id`: integer | null - WordPress media ID
- `wp_media_url`: string | null - WordPress media URL
- `status`: string - `pending`, `uploaded`, `failed` (make it as Enum)
- `error_message`: string | null
- `created_at`: datetime
- `updated_at`: datetime

### PostMap (`tistory_wp_post_map`)

**Description**: Maps Tistory post identifiers to WordPress posts.

#### Attributes (columns)

- `id`: integer (PK)
- `tistory_url`: string - Tistory post URL
- `wp_post_id`: integer - WordPress post ID
- `created_at`: datetime

### InternalLinkRecord (`internal_links`)

**Description**: DB representation of internal links, similar to `InternalLink` model, used to export `link_mapping.json`.

#### Attributes (columns)

- `id`: integer (PK)
- `job_item_id`: integer (FK → `migration_job_items.id`)
- `source_url`: string
- `target_url`: string
- `link_text`: string | null
- `context`: string | null
- `created_at`: datetime

---

## Config

**Description**: Environment configuration loaded at startup for both Tistory crawling and WordPress REST interactions, and for SQLite.

### Attributes

- `blogUrl`: string - `TISTORY_BLOG_URL` (required)
- `workerCount`: number - `WORKER_COUNT` (default: 4)
- `rateLimitPerWorker`: number - `RATE_LIMIT_PER_WORKER` in ms or req/sec (default aligned with 003)
- `outputDir`: string - `OUTPUT_DIR` (default: `./output`)
- `wpBaseUrl`: string - `WP_BASE_URL` (required)
- `wpAppUser`: string - `WP_APP_USER` (required)
- `wpAppPassword`: string - `WP_APP_PASSWORD` (required)
- `migrationDbPath`: string - `MIGRATION_DB_PATH` (default: `./data/migration.db`)
- Retry settings: `maxRetryAttempts`, `retryInitialDelayMs`, `retryMaxDelayMs`, `retryBackoffMultiplier`
- Logging level: `LOG_LEVEL` (default: `info`)
- CSS selectors for content extraction : `postTitleSelector`, `postPublishDateSelector`, `postModifiedDateSelector`, `postCategorySelector`, `postTagSelector`, `postContentSelector`, `postListLinkSelector`
- `categoryHierarchyOrder`: string - `CATEGORY_HIERARCHY_ORDER` (default: `first-is-parent`)(make it as Enum)

### Validation

- `blogUrl` and `wpBaseUrl` must be valid URLs.
- `workerCount` must be a positive integer (1–16 recommended).
- `rateLimitPerWorker` must be positive.
- WordPress credentials must be non-empty.
- `migrationDbPath` must be writable by the process.

---

## Entity Lifecycle (REST + SQLite Flow)

```text
Tistory HTML
    ↓
[Crawler] -> Post URLs
    ↓
[CLI] -> MigrationJob created in DB
    ↓
[Worker/Migrator] -> Raw Post (raw_html, metadata) + MigrationJobItem
    ↓
[Cleaner] -> Cleaned Post (cleaned_html)
    ↓
[LinkTracker] -> InternalLinkRecord rows (DB, later export to link_mapping.json)
    ↓
[ImageProcessor] -> Images downloaded in memory + uploaded (wp_media_id/url) and content rewritten + ImageAsset rows updated
    ↓
[WPClient] -> WordPress draft post created (wp_post_id)
    ↓
[DB] -> MigrationJobItem updated to Completed, PostMap row created
    ↓
[CLI] -> Job metrics summarized from DB
```

### Rollback Path

```text
Error during migratePostByUrl
    ↓
[Migrator] -> Collect wp_post_id + uploaded wp_media_ids for job item
    ↓
[WPClient] -> DELETE /media/{id} for each uploaded media
    ↓
[WPClient] -> DELETE /posts/{id} for created post (if any)
    ↓
[DB] -> MigrationJobItem.status = Failed, error_message set
```

---

## Out-of-Scope Entities

- **Attachment (non-image)**:
  - Defined in 003 for WXR but **not used** in this REST feature.
  - Such files are not migrated; no DB modeling required.
- **WXRData**:
  - Aggregation structure for WXR output in 003; not used in REST flow.
