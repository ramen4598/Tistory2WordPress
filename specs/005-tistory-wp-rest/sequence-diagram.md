# Sequence Diagram: Tistory -> WordPress REST Migration

**Branch**: `005-tistory-wp-rest` | **Date**: 2026-01-01 | **Spec**: [spec.md](./spec.md)  
**Purpose**: Visual representation of migration pipeline, worker pool processing, SQLite state, rollback, and REST interactions

## Sequence Diagrams

### Complete Migration Flow (Overview)

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Config
    participant DB as SQLiteDB
    participant Crawler
    participant Tistory
    participant WorkerPool
    participant Migrator
    participant Cleaner
    participant LinkTracker
    participant ImageProcessor
    participant WPClient
    participant WordPress

    User->>CLI: Execute migration command (`--all` or `--post=<URL>`)
    CLI->>Config: Load environment variables
    Config-->>CLI: TISTORY_BLOG_URL, WP_BASE_URL, WP_APP_USER, WP_APP_PASSWORD, WORKER_COUNT, RATE_LIMIT, MIGRATION_DB_PATH

    CLI->>DB: Initialize connection and run migrations
    CLI->>DB: Create MigrationJob (status=Running)
    DB-->>CLI: jobId

    CLI->>Crawler: Start crawling blog
    loop Pagination
        Crawler->>Tistory: Fetch post list page
        Tistory-->>Crawler: HTML with post links
        Crawler->>Crawler: Extract post URLs
    end
    Crawler-->>CLI: All post URLs

    CLI->>DB: Query MigrationJobItems (Completed/Failed)
    DB-->>CLI: existing job items
    CLI->>CLI: Filter remaining post URLs (to process)

    CLI->>WorkerPool: Initialize workers (WORKER_COUNT, rate limiters)
    CLI->>WorkerPool: Enqueue remaining post URLs with jobId

    par Worker 1..N
        loop Each assigned post
            WorkerPool->>Migrator: migratePostByUrl(url, jobId)

            Migrator->>DB: Create MigrationJobItem (status=Running, tistory_url)
            DB-->>Migrator: jobItemId

            Migrator->>Tistory: Fetch post HTML (rate limited)
            Tistory-->>Migrator: Post HTML
            Migrator->>Migrator: Parse metadata (title, dates, categories, tags, images)

            Migrator->>Cleaner: Clean HTML content
            Cleaner->>Cleaner: HTML→Markdown→HTML conversion
            Cleaner-->>Migrator: Cleaned HTML

            Migrator->>LinkTracker: Extract links
            loop For each link
                alt Internal link
                    LinkTracker->>DB: Insert InternalLinkRecord (jobItemId, source_url, target_url, ...)
                else External link
                    LinkTracker->>LinkTracker: Ignore
                end
            end
            LinkTracker-->>Migrator: Done

            alt Post has images
                Migrator->>ImageProcessor: Process images(post, jobItemId)
                loop For each image
                    ImageProcessor->>DB: Create ImageAsset (status=pending)
                    ImageProcessor->>Tistory: Download image (rate limited)
                    Tistory-->>ImageProcessor: Image bytes
                    ImageProcessor->>WPClient: Upload media (buffer)
                    WPClient->>WordPress: POST /wp-json/wp/v2/media
                    WordPress-->>WPClient: Media ID + source_url
                    WPClient-->>ImageProcessor: Media info
                    ImageProcessor->>DB: Update ImageAsset (status=Uploaded, wp_media_id/url)
                end
                ImageProcessor-->>Migrator: Map original URLs→WP media URLs, uploadedMediaIds
                Migrator->>Migrator: Rewrite image URLs in content
            else No images
                Migrator->>Migrator: Continue without images
            end

            Migrator->>WPClient: Ensure categories/tags exist
            WPClient->>WordPress: GET/POST /categories,/tags
            WordPress-->>WPClient: Term IDs
            WPClient-->>Migrator: WP term ID lists

            Migrator->>WPClient: Create draft post
            WPClient->>WordPress: POST /wp-json/wp/v2/posts (status=draft, dates, tax, media)
            WordPress-->>WPClient: Post ID
            WPClient-->>Migrator: Post ID

            Migrator->>DB: Update MigrationJobItem (wp_post_id, status=completed)
            Migrator->>DB: Insert PostMap (tistory_url, wp_post_id)
        end
    end

    WorkerPool-->>CLI: All posts processed

    CLI->>DB: Update MigrationJob (status=Completed/Failed, metrics)
    CLI-->>User: Migration complete (summary: processed/failed, outputs)
```

---

### Single Post Migration with Rollback (P1 User Story)

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Config
    participant DB as SQLiteDB
    participant Migrator
    participant Tistory
    participant Cleaner
    participant LinkTracker
    participant ImageProcessor
    participant WPClient
    participant WordPress

    User->>CLI: Run CLI with --post=<URL>
    CLI->>Config: Load env (TISTORY_BLOG_URL, WP_*, MIGRATION_DB_PATH)
    Config-->>CLI: Config values

    CLI->>DB: Initialize DB and create/lookup MigrationJob
    DB-->>CLI: jobId

    CLI->>Migrator: migratePostByUrl(URL, jobId)

    Migrator->>DB: Create MigrationJobItem (Running)
    DB-->>Migrator: jobItemId

    Migrator->>Tistory: Fetch post HTML
    Tistory-->>Migrator: Post HTML
    Migrator->>Migrator: Parse title, dates, categories, tags, images

    Migrator->>Cleaner: Clean HTML
    Cleaner->>Cleaner: HTML→Markdown→HTML
    Cleaner-->>Migrator: Cleaned HTML

    Migrator->>LinkTracker: Extract links

    loop For each link
        alt Internal link
            LinkTracker->>DB: Insert InternalLinkRecord (jobItemId,...)
        else External link
            LinkTracker->>LinkTracker: Ignore
        end
    end

    LinkTracker-->>Migrator: Done

    alt Post has images
        Migrator->>ImageProcessor: Process images(post, jobItemId)
        loop For each image
            ImageProcessor->>DB: Create ImageAsset (pending)
            ImageProcessor->>Tistory: Download image
            Tistory-->>ImageProcessor: Image bytes
            ImageProcessor->>WPClient: Upload media
            WPClient->>WordPress: POST /media
            WordPress-->>WPClient: Media info
            WPClient-->>ImageProcessor: Media info
            ImageProcessor->>DB: Update ImageAsset (Uploaded)
        end
        ImageProcessor-->>Migrator: URL mapping + uploadedMediaIds
        Migrator->>Migrator: Rewrite image URLs in content
    end

    Migrator->>WPClient: Ensure categories/tags exist
    WPClient->>WordPress: GET/POST /categories, /tags
    WordPress-->>WPClient: Term IDs
    WPClient-->>Migrator: Term IDs

    Migrator->>WPClient: Create draft post
    WPClient->>WordPress: POST /posts (draft)
    WordPress-->>WPClient: Post ID
    WPClient-->>Migrator: Post ID

    Migrator->>DB: Update MigrationJobItem (wp_post_id, status=completed)
    Migrator->>DB: Insert PostMap (tistory_url, wp_post_id)
    Migrator-->>CLI: Post migrated successfully

    CLI-->>User: Single post migrated (WP post ID)
```

#### Failure with Rollback

```mermaid
sequenceDiagram
    participant Migrator
    participant DB as SQLiteDB
    participant WPClient
    participant WordPress

    note over Migrator: During migratePostByUrl

    Migrator->>Migrator: Error occurs after media/post creation
    Migrator->>DB: Read jobItem (wp_post_id, uploadedMediaIds via ImageAssets)

    alt Uploaded media exists
        loop For each mediaId
            Migrator->>WPClient: deleteMedia(mediaId)
            WPClient->>WordPress: DELETE /media/{id}?force=true
            WordPress-->>WPClient: 200 OK or 404
        end
    end

    alt Draft post created
        Migrator->>WPClient: deletePost(wp_post_id)
        WPClient->>WordPress: DELETE /posts/{id}?force=true
        WordPress-->>WPClient: 200 OK or 404
    end

    Migrator->>DB: Update MigrationJobItem (status=Failed, error_message)
    Migrator-->>Migrator: Rethrow error to worker/CLI
```

---

### Internal Link Tracking (P2 User Story)

```mermaid
sequenceDiagram
    participant Migrator
    participant LinkTracker
    participant DB as SQLiteDB

    Migrator->>LinkTracker: Provide cleaned HTML and base blog URL
    LinkTracker->>LinkTracker: Extract all <a href> links

    loop For each link
        alt href matches TISTORY_BLOG_URL (internal)
            LinkTracker->>LinkTracker: Build InternalLink { source_url, target_url, ... }
            LinkTracker->>DB: Insert InternalLinkRecord (jobItemId,...)
            DB-->>LinkTracker: Ack
        else external link
            LinkTracker->>LinkTracker: Ignore
        end
    end

    LinkTracker-->>Migrator: Finished tracking internal links
```

---

### Resume with SQLite Migration State (NF requirement)

```mermaid
sequenceDiagram
    participant CLI
    participant DB as SQLiteDB
    participant Crawler
    participant WorkerPool

    CLI->>DB: Open migration.db and query last MigrationJob (or create new)
    DB-->>CLI: jobId, existing jobItems

    CLI->>Crawler: Discover all post URLs
    Crawler-->>CLI: all_post_urls

    CLI->>CLI: remaining = all_post_urls - Completed items (and optionally Failed if not retrying)
    CLI->>WorkerPool: Enqueue remaining URLs with jobId

    loop For each URL in remaining
        WorkerPool->>DB: On success, set MigrationJobItem.status = completed
        WorkerPool->>DB: On failure, set status = Failed, error_message
    end

    WorkerPool-->>CLI: All remaining posts processed
    CLI->>DB: Update MigrationJob (status, pages_processed/succeeded/failed)
    CLI-->>CLI: Migration can be safely restarted later without duplicates
```

```

```
