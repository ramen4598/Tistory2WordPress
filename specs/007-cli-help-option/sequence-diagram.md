# Sequence Diagram: CLI Help Option & Tistory Bookmark Handling

**Branch**: `007-cli-help-option` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Purpose**: Visual representation of user journeys, API calls, and system interactions

## Sequence Diagrams

### Feature 1 - CLI Help Option (Priority: P1)

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Logger

    User->>CLI: tistory2wp --help (or -h)
    CLI->>CLI: Check for help flag
    CLI->>CLI: Print help message to console
    Note right of CLI: Tool description, usage, options
    CLI->>Logger: N/A (no logging for help)
    CLI-->>User: Exit with code 0
```

**Key Interactions**:

- Help flag is checked BEFORE config loading and DB initialization
- No database or config validation occurs when help is requested
- Help is displayed using `console.log()` (not logger)
- Exit code 0 indicates successful help display
- All other flags are ignored when help flag is present

---

### Feature 2 - Tistory Bookmark Handling (Priority: P2)

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Migrator
    participant BookmarkProcessor
    participant Cleaner
    participant ImageProcessor
    participant External URL

    User->>CLI: tistory2wp --all
    CLI->>Migrator: Start migration
    Migrator->>BookmarkProcessor: Process bookmarks first
    BookmarkProcessor->>BookmarkProcessor: Load template from file
    BookmarkProcessor->>BookmarkProcessor: Parse HTML with cheerio
    BookmarkProcessor->>BookmarkProcessor: Find bookmarks using CSS selector
    BookmarkProcessor->>External URL: Fetch metadata (GET /)
    External URL-->>BookmarkProcessor: HTML with OpenGraph meta tags
    BookmarkProcessor->>BookmarkProcessor: Extract og:title, og:description, og:image
    BookmarkProcessor->>BookmarkProcessor: Call renderBookmarkHTML()
    BookmarkProcessor->>BookmarkProcessor: Replace bookmark with standard HTML
    BookmarkProcessor-->>Migrator: HTML with bookmark-card figures
    Migrator->>Cleaner: Clean HTML content
    Note right of Cleaner: Turndown preserves bookmark-card structure
    Cleaner-->>Migrator: Cleaned content
    Migrator->>ImageProcessor: Process images
    ImageProcessor->>ImageProcessor: Find all img elements
    ImageProcessor->>ImageProcessor: Check parent for bookmark-card
    Note right of ImageProcessor: Skip if parent matches figure.bookmark-card
    ImageProcessor-->>Migrator: Updated post
    Migrator-->>CLI: Migration complete
    CLI-->>User: Success message
```

**Key Interactions**:

- Bookmark processing occurs BEFORE HTML cleaning phase
- Metadata fetch happens for each bookmark (no caching, 10s timeout per URL)
- BookmarkProcessor generates standard `<figure class="bookmark-card">` HTML structure
- If metadata fetch fails, bookmark is rendered using URL only (graceful degradation)
- Cleaner performs turndown roundtrip (HTML→MD→HTML) on pre-processed bookmark HTML
- Image processor checks for `figure.bookmark-card` ancestor and skips featured images inside it
- Each bookmark fetch is independent; one failure doesn't stop the entire post migration

---

### Feature 2 - Bookmark Metadata Fetch Error Flow

```mermaid
sequenceDiagram
    participant Migrator
    participant BookmarkProcessor
    participant External URL
    participant Logger

    Migrator->>BookmarkProcessor: Process bookmarks
    BookmarkProcessor->>External URL: Fetch metadata (GET /)
    External URL-->>BookmarkProcessor: Timeout or Error (4xx/5xx)
    BookmarkProcessor->>Logger: Log error with details
    Note right of Logger: "Failed to fetch metadata from {url}: {error}"
    BookmarkProcessor->>BookmarkProcessor: Render bookmark using URL only.
    BookmarkProcessor-->>Migrator: Return rendered bookmark HTML
```

**Key Interactions**:

- Error is logged but doesn't stop migration
- Bookmark is rendered using URL only when metadata fetch fails
- Multiple bookmarks can fail independently
- Migration continues to next bookmark or next processing step

---

## Component Definitions

### CLI (cli.ts)

- **Responsibility**: Parse command line arguments, coordinate migration flow
- **Key Operations**: Check for `--help` flag, display help message, invoke migrator

### Migrator (migrator.ts)

- **Responsibility**: Orchestrate post migration workflow
- **Key Operations**: Migrate single or all posts, coordinate crawler, cleaner, and image processor

### Cleaner (cleaner.ts)

- **Responsibility**: Transform bookmark-processed HTML to cleaned HTML via markdown roundtrip
- **Key Operations**: Extract content using selector, convert to markdown, convert back to HTML, preserve bookmark-card structure

### BookmarkProcessor (bookmarkProcessor.ts) - NEW

- **Responsibility**: Detect and transform Tistory bookmarks
- **Key Operations**: Load template, parse bookmarks using CSS selector, fetch metadata, replace with custom HTML (including featured image)

### ImageProcessor (imageProcessor.ts)

- **Responsibility**: Download and upload images to WordPress
- **Key Operations**: Find images, check parent elements, skip bookmark featured images, upload images

### Logger (logger.ts)

- **Responsibility**: Log application events and errors
- **Key Operations**: Log debug info, warnings, errors (not used for help messages)

---

## Cross-Feature Interactions

**CLI Help ↔ Bookmark Handling**:

- No direct interaction - features are independent
- Help option bypasses all migration logic including bookmark handling

**BookmarkProcessor ↔ Cleaner**:

- BookmarkProcessor generates standard bookmark HTML before cleaning
- Cleaner receives pre-processed bookmark HTML and preserves it through turndown
- Sequential execution: BookmarkProcessor → Cleaner

**BookmarkProcessor ↔ ImageProcessor**:

- BookmarkProcessor creates `<figure class="bookmark-card">` structure
- ImageProcessor checks for this class to skip featured images
- Interaction occurs via HTML content passed through Cleaner

**BookmarkProcessor ↔ Configuration**:

- BookmarkProcessor reads CSS selector from config (loaded from `.env`)
- Template file path from `@src/templates/bookmarkTemplate.ts`

---

## Notes

**Performance Considerations**:

- Each bookmark requires an HTTP request (10s timeout)
- No caching means duplicate URLs are fetched multiple times
- Parallel processing of bookmarks is NOT implemented (sequential per post)
- Overall migration overhead should be <20% (success criteria)

**Error Handling Strategy**:

- Per-post error handling: one bookmark failure doesn't stop the entire migration
- Errors are logged but migration continues
- Original content preserved on failure (graceful degradation)

**Threading/Concurrency**:

- Bookmark processing is synchronous within a single post's migration
- Multiple posts are processed in parallel via worker pool (existing architecture)
- Metadata fetch uses axios (non-blocking but awaited per bookmark)
- Processing order: BookmarkProcessor → Cleaner → ImageProcessor (per post)

**Security**:

- Metadata from external URLs is sanitized before use in templates
- XSS prevention: HTML escaping for metadata fields
- No code execution in template rendering (simple string replacement)
