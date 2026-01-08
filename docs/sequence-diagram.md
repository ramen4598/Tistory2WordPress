# Sequence Diagram: Tistory2Wordpress Migration

**Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Purpose**: Visual representation of migration pipeline, worker pool processing, SQLite state, rollback, and WordPress REST interactions

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
    participant BookmarkProcessor
    participant Cleaner
    participant LinkTracker
    participant ImageProcessor
    participant WPClient
    participant WordPress

    User->>CLI: Execute command (--all, --post=<URL>, --help)

    alt --help or -h
        CLI->>CLI: Check help flag
        CLI->>CLI: Print usage to console
        CLI-->>User: Exit with code 0
    else Normal migration
        CLI->>Config: Load environment variables
        Config-->>CLI: TISTORY_BLOG_URL, WP_BASE_URL, WP_APP_USER, WP_APP_PASSWORD, WORKER_COUNT, RATE_LIMIT_INTERVAL, RATE_LIMIT_CAP, MIGRATION_DB_PATH

        CLI->>DB: Initialize connection and run migrations

        alt --post=<URL>
            CLI->>DB: Create MigrationJob (type=SINGLE, status=Running)
            DB-->>CLI: jobId
            CLI->>Migrator: migratePostByUrl(url, {jobId})
            Note right of Migrator: Single post migration (see detailed diagram)
            Migrator-->>CLI: Done
        else --all
            CLI->>DB: Get latest FULL job or create new
            DB-->>CLI: jobId

            CLI->>Crawler: discoverPostUrls()
            loop Pagination
                Crawler->>Tistory: Fetch list page (page=1,2,3...)
                Tistory-->>Crawler: HTML with post links
                Crawler->>Crawler: Extract post URLs
            end
            Crawler-->>CLI: All post URLs

            CLI->>DB: Query MigrationJobItems (Completed/Failed)
            DB-->>CLI: existing job items
            CLI->>CLI: Filter remaining URLs (skip completed, optionally retry failed)

            CLI->>WorkerPool: Initialize workers (WORKER_COUNT, rate limiters)
            CLI->>WorkerPool: process(pendingUrls, jobId)

            par Worker 1..N
                loop Each assigned post
                    WorkerPool->>Migrator: migratePostByUrl(url, {jobId})
                    Note right of Migrator: See Single Post Migration diagram
                    Migrator-->>WorkerPool: Done or Error
                end
            end

            WorkerPool-->>CLI: All posts processed
        end

        CLI->>DB: Update MigrationJob (status=Completed/Failed, completed_at, metrics)
        CLI-->>User: Migration complete (summary: detected, skipped, completed, failed)
    end
```

---

### Single Post Migration

```mermaid
sequenceDiagram
    participant Migrator
    participant DB as SQLiteDB
    participant Crawler
    participant BookmarkProcessor
    participant Cleaner
    participant LinkTracker
    participant ImageProcessor
    participant WPClient
    participant WordPress

    Migrator->>DB: Create MigrationJobItem (status=Running, tistory_url)
    DB-->>Migrator: jobItemId

    Migrator->>Crawler: fetchPostHtml(url)
    Crawler->>Tistory: GET post URL
    Tistory-->>Crawler: HTML content
    Crawler-->>Migrator: HTML

    Migrator->>Crawler: parsePostMetadata(html, url)
    Crawler-->>Migrator: ParsedPostMetadata (title, dates, categories, tags)

    Migrator->>Crawler: extractFImgUrl(html)
    Crawler-->>Migrator: featuredImageUrl or null

    Migrator->>BookmarkProcessor: replaceBookmarks(html)
    BookmarkProcessor->>BookmarkProcessor: Detect bookmarks using CSS selector
    loop Each bookmark
        BookmarkProcessor->>External: Fetch metadata (GET /)
        External-->>BookmarkProcessor: HTML with OpenGraph meta
        BookmarkProcessor->>BookmarkProcessor: Extract og:title, og:description, og:image
    end
    BookmarkProcessor->>BookmarkProcessor: Replace with bookmark-card HTML
    BookmarkProcessor-->>Migrator: HTML with bookmark-card figures

    Migrator->>Cleaner: cleanHtml(bookmarkProcessedHtml)
    Cleaner->>Cleaner: Extract content using postContentSelector
    Cleaner->>Cleaner: HTML→Markdown (Turndown) with GFM support
    Note right of Cleaner: Preserves tables, iframes, bookmark-cards
    Cleaner->>Cleaner: Markdown→HTML (Marked)
    Cleaner-->>Migrator: Cleaned HTML

    Migrator->>LinkTracker: trackInternalLinks(url, cleanedHtml, jobItemId)
    LinkTracker->>LinkTracker: Extract all <a href> links
    loop Each link
        alt Internal link (hostname matches blogUrl)
            LinkTracker->>DB: Insert InternalLinkRecord
        else External link
            LinkTracker->>LinkTracker: Ignore
        end
    end
    LinkTracker-->>Migrator: Done

    alt Featured image exists
        Migrator->>ImageProcessor: processFImg(jobItemId, title, featuredImageUrl)
        ImageProcessor->>DB: Create ImageAsset (status=UPLOADING)
        ImageProcessor->>Tistory: Download image (rate limited, with retry)
        Tistory-->>ImageProcessor: Image bytes
        ImageProcessor->>WPClient: uploadMedia(buffer, mimeType, altText)
        WPClient->>WordPress: POST /wp-json/wp/v2/media
        WordPress-->>WPClient: Media ID + URL
        WPClient-->>ImageProcessor: UploadMediaResult
        ImageProcessor->>DB: Update ImageAsset (status=UPLOADED, wp_media_id, wp_media_url)
        ImageProcessor-->>Migrator: Image object
    end

    Migrator->>ImageProcessor: processImgs(post, jobItemId)
    ImageProcessor->>ImageProcessor: Find all <img> elements
    ImageProcessor->>ImageProcessor: Filter out bookmark-card images
    loop Each image
        ImageProcessor->>DB: Create ImageAsset (status=UPLOADING)
        ImageProcessor->>Tistory: Download image (rate limited, with retry)
        Tistory-->>ImageProcessor: Image bytes
        ImageProcessor->>WPClient: uploadMedia(buffer, mimeType, altText)
        WPClient->>WordPress: POST /wp-json/wp/v2/media
        WordPress-->>WPClient: Media ID + URL
        WPClient-->>ImageProcessor: UploadMediaResult
        ImageProcessor->>DB: Update ImageAsset (status=UPLOADED, wp_media_id, wp_media_url)
    end
    ImageProcessor->>ImageProcessor: Rewrite image URLs in content
    ImageProcessor-->>Migrator: Updated post with wp_media_url mapping

    Migrator->>WPClient: Ensure categories exist
    loop Each category
        alt Category has parent
            WPClient->>WPClient: ensureCategory(parent.name) → parentId
        end
        WPClient->>WordPress: GET /categories (check exists)
        WordPress-->>WPClient: Category list
        alt Category exists
            WPClient-->>Migrator: Existing category ID
        else Category doesn't exist
            WPClient->>WordPress: POST /categories (name, parent)
            WordPress-->>WPClient: New category ID
            WPClient-->>Migrator: New category ID
        end
    end

    Migrator->>WPClient: Ensure tags exist
    loop Each tag
        WPClient->>WordPress: GET /tags (check exists)
        WordPress-->>WPClient: Tag list
        alt Tag exists
            WPClient-->>Migrator: Existing tag ID
        else Tag doesn't exist
            WPClient->>WordPress: POST /tags (name)
            WordPress-->>WPClient: New tag ID
            WPClient-->>Migrator: New tag ID
        end
    end

    Migrator->>WPClient: createDraftPost(title, content, date, categoryIds, tagIds, featuredImageId)
    WPClient->>WordPress: POST /wp-json/wp/v2/posts (status=draft)
    WordPress-->>WPClient: Post ID
    WPClient-->>Migrator: Post ID

    Migrator->>DB: Insert PostMap (tistory_url, wp_post_id)
    Migrator->>DB: Update MigrationJobItem (status=COMPLETED, wp_post_id, error_message=null)

    Migrator-->>Migrator: Success
```

---

### Error Handling & Rollback

```mermaid
sequenceDiagram
    participant Migrator
    participant DB as SQLiteDB
    participant WPClient
    participant WordPress

    Note over Migrator: Error occurs during migratePostByUrl

    Migrator->>Migrator: Catch error

    Migrator->>DB: Read jobItem (wp_post_id, ImageAssets by jobItemId)
    DB-->>Migrator: Uploaded data

    alt Featured image uploaded
        Migrator->>WPClient: deleteMedia(post.featured_image.wp_media_id)
        WPClient->>WordPress: DELETE /wp-json/wp/v2/media/{id}?force=true
        WordPress-->>WPClient: 200 OK or 404
        WPClient-->>Migrator: Done
    end

    loop Each uploaded content image
        Migrator->>WPClient: deleteMedia(image.wp_media_id)
        WPClient->>WordPress: DELETE /wp-json/wp/v2/media/{id}?force=true
        WordPress-->>WPClient: 200 OK or 404
        WPClient-->>Migrator: Done
    end

    alt Post created
        Migrator->>WPClient: deletePost(wpPostId)
        WPClient->>WordPress: DELETE /wp-json/wp/v2/posts/{id}?force=true
        WordPress-->>WPClient: 200 OK or 404
        WPClient-->>Migrator: Done
    end

    Migrator->>DB: Update MigrationJobItem (status=FAILED, error_message)

    Migrator->>Migrator: Throw error (rethrow)
```

**Key Points**:

- Rollback is best-effort: failures are logged but don't stop the rollback process
- Delete order: featured image → content images → post (reverse of creation order)
- WordPress REST API uses `?force=true` to bypass trash
- MigrationJobItem status remains FAILED even if rollback succeeds

---

### WorkerPool Parallel Processing

```mermaid
sequenceDiagram
    participant CLI
    participant WorkerPool
    participant Config
    participant Migrator
    participant Logger

    CLI->>Config: Load config
    Config-->>CLI: WORKER_COUNT, RATE_LIMIT_INTERVAL, RATE_LIMIT_CAP

    CLI->>WorkerPool: Initialize with concurrency=WORKER_COUNT

    Note right of WorkerPool: p-queue configuration:<br/>concurrency: WORKER_COUNT<br/>intervalCap: RATE_LIMIT_CAP<br/>interval: RATE_LIMIT_INTERVAL

    CLI->>WorkerPool: process(urls, jobId)

    par Worker 1
        loop Assigned posts
            WorkerPool->>Migrator: migratePostByUrl(url, {jobId})
            Note right of Migrator: Rate limited by p-queue
            alt Success
                Migrator-->>WorkerPool: Done
            else Error
                Migrator->>Logger: Log error
                WorkerPool->>WorkerPool: Continue to next post
            end
        end
    and Worker 2
        loop Assigned posts
            WorkerPool->>Migrator: migratePostByUrl(url, {jobId})
            Note right of Migrator: Rate limited by p-queue
            alt Success
                Migrator-->>WorkerPool: Done
            else Error
                Migrator->>Logger: Log error
                WorkerPool->>WorkerPool: Continue to next post
            end
        end
    and Worker 3..N
        Note over WorkerPool,Migrator: Same pattern for all workers
    end

    WorkerPool->>WorkerPool: Wait for all tasks to complete (onIdle)
    WorkerPool-->>CLI: All posts processed
```

**Rate Limiting**:

사용자 관점:

- `RATE_LIMIT_INTERVAL` 동안 `RATE_LIMIT_CAP`번까지만 요청하도록 제한합니다.
- `WORKER_COUNT`는 동시 처리(병렬 처리) 작업 수입니다.
- `WORKER_COUNT`를 늘리면 병렬 처리가 가능하지만, 그럼에도 전체 요청 속도는 `RATE_LIMIT_CAP`에 의해 제한됩니다.

구현 관점:

- p-queue 설정: `concurrency=WORKER_COUNT`, `interval=RATE_LIMIT_INTERVAL`, `intervalCap=RATE_LIMIT_CAP`

예시:

- `WORKER_COUNT=1`, `RATE_LIMIT_INTERVAL=60000ms`, `RATE_LIMIT_CAP=1` → 분당 최대 1회 요청, 단일 작업자
- `WORKER_COUNT=4`, `RATE_LIMIT_INTERVAL=60000ms`, `RATE_LIMIT_CAP=1` → 분당 최대 1회 요청, 4개의 작업자가 병렬 처리

---

### Bookmark Processing

```mermaid
sequenceDiagram
    participant Migrator
    participant BookmarkProcessor
    participant External URL
    participant Logger

    Migrator->>BookmarkProcessor: replaceBookmarks(html)

    BookmarkProcessor->>BookmarkProcessor: Detect bookmarks using CSS selector
    BookmarkProcessor->>BookmarkProcessor: Parse HTML with cheerio
    BookmarkProcessor-->>BookmarkProcessor: Bookmark list

    loop Each bookmark element
        BookmarkProcessor->>BookmarkProcessor: Extract URL from anchor tag
        BookmarkProcessor->>External URL: Fetch metadata (GET /)

        alt Success (HTTP 200, timeout=60s, maxRedirects=5)
            External URL-->>BookmarkProcessor: HTML with OpenGraph meta
            BookmarkProcessor->>BookmarkProcessor: Extract og:title, og:description, og:image, og:url
            BookmarkProcessor->>BookmarkProcessor: renderBookmarkHTML() with metadata
            BookmarkProcessor-->>Migrator: Bookmark-card HTML (with title, description, image)
        else Failure (timeout, 4xx, 5xx)
            BookmarkProcessor->>Logger: Log error with details
            BookmarkProcessor->>BookmarkProcessor: renderBookmarkHTML() with URL only
            BookmarkProcessor-->>Migrator: Bookmark-card HTML (URL only, graceful degradation)
        end
    end

    BookmarkProcessor-->>Migrator: Full HTML with replaced bookmark-cards
```

**Key Points**:

- Metadata fetch happens BEFORE HTML cleaning
- No caching: duplicate URLs are fetched multiple times
- Graceful degradation: failed fetches fall back to URL-only rendering
- Retry mechanism: exponential backoff for HTTP failures
- Security: all user input is HTML-escaped

---

### Link Tracking

```mermaid
sequenceDiagram
    participant Migrator
    participant LinkTracker
    participant Config
    participant DB as SQLiteDB

    Migrator->>LinkTracker: trackInternalLinks(sourceUrl, cleanedHtml, jobItemId)

    LinkTracker->>Config: Load blogUrl
    Config-->>LinkTracker: TISTORY_BLOG_URL

    LinkTracker->>LinkTracker: Parse HTML with cheerio
    LinkTracker->>LinkTracker: Extract all <a href> links

    loop Each link
        LinkTracker->>LinkTracker: Parse href as URL

        alt href hostname matches blogUrl.hostname
            LinkTracker->>LinkTracker: Extract link text
            LinkTracker->>LinkTracker: Extract context (±50 chars around link)

            LinkTracker->>DB: Insert InternalLinkRecord<br/>(job_item_id, source_url, target_url, link_text, context)
            DB-->>LinkTracker: Ack

        else External link
            LinkTracker->>LinkTracker: Ignore
        end
    end

    LinkTracker-->>Migrator: Done
```

**Internal Link Record**:

- `job_item_id`: Migration job item ID
- `source_url`: Source post URL
- `target_url`: Target post URL (internal)
- `link_text`: Anchor text
- `context`: Surrounding text for context

---

### Resume Migration (--all with --retry-failed)

```mermaid
sequenceDiagram
    participant CLI
    participant DB as SQLiteDB
    participant Crawler
    participant WorkerPool

    CLI->>DB: Get latest FULL MigrationJob (status=Running)

    alt Running job exists
        DB-->>CLI: Existing job (jobId)
    else No running job
        CLI->>DB: Create new MigrationJob (type=FULL, status=Running)
        DB-->>CLI: New jobId
    end

    CLI->>Crawler: discoverPostUrls()
    Crawler-->>CLI: all_post_urls (N total)

    CLI->>DB: Get MigrationJobItems for jobId
    DB-->>CLI: Completed items (C), Failed items (F)

    alt --retry-failed NOT specified
        CLI->>CLI: pending = all_post_urls - C - F<br/>(skip both completed and failed)
    else --retry-failed specified
        CLI->>CLI: pending = all_post_urls - C<br/>(only skip completed, retry failed)
    end

    CLI->>WorkerPool: process(pending, jobId)

    loop Each pending URL
        WorkerPool->>WorkerPool: Process with Migrator
        Note over WorkerPool: Migration logic in Single Post Migration diagram
    end

    WorkerPool-->>CLI: All pending posts processed

    CLI->>DB: Update MigrationJob (status=Completed/Failed, completed_at)

    CLI->>CLI: Print summary (detected, skipped, completed, failed)
```

**Resume Logic**:

- Existing `status=Running` job is reused
- Completed items are always skipped
- Failed items are skipped unless `--retry-failed` is specified
- Database tracks progress at individual post level
- Can safely restart after interruption

---

## Component Definitions

### CLI (cli.ts)

- **Responsibility**: Entry point, command parsing, orchestration
- **Key Operations**: Check flags, load config, initialize DB, invoke crawler/migrator, print summary

### Config (utils/config.ts)

- **Responsibility**: Load and validate environment variables
- **Key Configuration**: Blog URL, WordPress credentials, worker count, rate limit, selectors

### DB (db/index.ts)

- **Responsibility**: SQLite database for state tracking
- **Key Operations**: Initialize schema, create/update MigrationJob, MigrationJobItem, ImageAsset, PostMap, InternalLink

### Crawler (services/crawler.ts)

- **Responsibility**: Discover and fetch Tistory blog content
- **Key Operations**: discoverPostUrls() with pagination, fetchPostHtml(), parsePostMetadata(), extractFImgUrl()

### WorkerPool (workers/postProcessor.ts)

- **Responsibility**: Manage concurrent post processing with rate limiting
- **Key Operations**: Initialize p-queue, distribute work, enforce rate limits per worker

### Migrator (services/migrator.ts)

- **Responsibility**: Orchestrate single post migration workflow
- **Key Operations**: Coordinate crawler, bookmark processor, cleaner, link tracker, image processor, WP client; handle rollback

### BookmarkProcessor (services/bookmarkProcessor.ts)

- **Responsibility**: Detect and transform Tistory bookmarks
- **Key Operations**: detectBookmarks(), fetchMetadata() (with retry), replaceBookmarks()

### Cleaner (services/cleaner.ts)

- **Responsibility**: Clean HTML via Markdown roundtrip
- **Key Operations**: Extract content, HTML→Markdown→HTML conversion, preserve tables/iframes/bookmark-cards

### LinkTracker (services/linkTracker.ts)

- **Responsibility**: Track internal links between posts
- **Key Operations**: Extract links, identify internal links, insert to DB

### ImageProcessor (services/imageProcessor.ts)

- **Responsibility**: Download and upload images to WordPress
- **Key Operations**: Download with retry, upload to WordPress media library, skip bookmark-card images, rewrite URLs

### WPClient (services/wpClient.ts)

- **Responsibility**: WordPress REST API communication
- **Key Operations**: ensureCategory(), ensureTag(), createDraftPost(), uploadMedia(), deletePost(), deleteMedia()

---

## Cross-Feature Interactions

**CLI → Crawler → WorkerPool → Migrator Pipeline**:

- CLI discovers all URLs via Crawler
- WorkerPool distributes URLs to workers
- Each worker invokes Migrator for each post

**Migrator Coordination**:

- Sequential execution: fetch → parse → bookmarks → clean → links → images → WordPress API
- All operations within a single post are sequential (no parallelism within post)
- Parallelism happens at post level via WorkerPool

**BookmarkProcessor ↔ Cleaner**:

- BookmarkProcessor generates `<figure class="bookmark-card">` HTML
- Cleaner preserves this structure through Turndown roundtrip
- Order: BookmarkProcessor BEFORE Cleaner

**ImageProcessor ↔ BookmarkProcessor**:

- ImageProcessor skips images inside `figure.bookmark-card`
- Prevents duplicate upload of bookmark featured images

**LinkTracker ↔ ImageProcessor**:

- Both operate on cleaned HTML
- LinkTracker tracks before image URL rewriting
- Internal links contain original Tistory URLs

**Rollback ↔ All Services**:

- Rollback happens on any error in Migrator
- Only resources created during migration are rolled back
- WordPress API calls are idempotent (DELETE with force=true)

---

## Notes

**Error Handling Strategy**:

- Per-post error handling: individual failures don't stop entire migration
- Retry mechanism: exponential backoff for network operations
- Rollback: best-effort cleanup on failure
- Logging: all errors logged with context

**Rate Limiting**:

- Applied at WorkerPool level (p-queue)
- 제한 모델: `RATE_LIMIT_INTERVAL` 동안 `RATE_LIMIT_CAP`번 요청 허용
- Ensures we don't overwhelm Tistory or WordPress

**State Persistence**:

- SQLite database tracks all migration state
- Can resume from any point of interruption
- Completed posts are never reprocessed

**Security**:

- WordPress authentication via Application Password (Basic Auth)
- All user input HTML-escaped in bookmark templates
- External links use `target="_blank" rel="noopener noreferrer"`

**Performance Considerations**:

- Worker pool enables parallel post processing
- Rate limiting prevents server overload
- No caching for bookmark metadata (by design)
- Image download/upload is the slowest part of migration

**Database Schema Summary**:

- `migration_jobs`: Track migration jobs (SINGLE/FULL)
- `migration_job_items`: Track individual post migration status
- `image_assets`: Track image upload status
- `post_maps`: Map Tistory URLs to WordPress post IDs
- `internal_links`: Track internal links for later URL updates
