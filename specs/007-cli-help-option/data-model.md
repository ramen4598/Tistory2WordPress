# Data Model: CLI Help Option & Tistory Bookmark Handling

**Feature**: 007-cli-help-option
**Date**: 2026-01-06
**Spec**: [spec.md](./spec.md)
**Status**: Final

## Overview

This document defines the data structures for the CLI help option and Tistory bookmark handling features.

## Data Entities

### Bookmark (NEW)

Represents a Tistory bookmark detected during HTML parsing.

```typescript
interface Bookmark {
  /** The original HTML element of the bookmark */
  originalElement: cheerio.Cheerio<HTMLElement>;

  /** Extracted URL from the bookmark anchor tag */
  url: string;

  /** The CSS selector used to detect this bookmark */
  selector: string;

  /** Position index of this bookmark in the post (0-based) */
  index: number;
}
```

**Notes**:

- Not persisted to database - transient entity during post processing
- Exists only in memory during HTML cleaning phase
- Used to coordinate metadata fetching and HTML replacement

---

### BookmarkMetadata (NEW)

Metadata fetched from a bookmark URL using OpenGraph protocol.

```typescript
interface BookmarkMetadata {
  /** Title from og:title meta tag or <title> fallback */
  title: string;

  /** Description from og:description meta tag (may be empty) */
  description: string;

  /** Featured image URL from og:image meta tag (may be empty) */
  featuredImage: string;

  /** The canonical URL from og:url meta tag (defaults to fetch URL) */
  url: string;

  /** Timestamp when metadata was fetched */
  fetchedAt: string;

  /** Whether metadata fetch was successful */
  success: boolean;

  /** Error message if fetch failed (optional) */
  error?: string;
}
```

**Notes**:

- Not persisted to database - no caching (per spec)
- Fetched fresh for each bookmark during migration
- Contains optional fields that may be empty if not available

---

### BookmarkTemplate (NEW)

HTML template for rendering bookmark cards.

```typescript
interface BookmarkTemplate {
  /** Raw template content with placeholder variables */
  content: string;

  /** Path to the template file */
  filePath: string;

  /** Template variables supported */
  variables: {
    title: string;
    description: string;
    featuredImage: string;
    url: string;
  };
}
```

**Template Variables**:

- `{{title}}` - Bookmark title
- `{{description}}` - Bookmark description (may be empty)
- `{{featuredImage}}` - Featured image URL (may be empty)
- `{{url}}` - Bookmark URL

**Conditional Logic** (optional, based on template design):

- `{{#if featuredImage}}...{{/if}}` - Render section only if featured image exists
- `{{#if description}}...{{/if}}` - Render section only if description exists

---

### Configuration Extensions (MODIFIED)

#### Config (config.ts)

Extended with bookmark-related configuration:

```typescript
interface Config {
  // ... existing config fields ...

  /** CSS selector to detect bookmark elements in Tistory posts */
  bookmarkSelector: string;

  /** Path to bookmark HTML template file */
  bookmarkTemplatePath: string;
}
```

**Default Values**:

- `bookmarkSelector`: `figure[data-ke-type="opengraph"]`
- `bookmarkTemplatePath`: `./src/templates/bookmark-template.html`

---

## Data Flow

### Bookmark Processing Flow

```
Raw HTML (from Tistory)
    ↓
[Cheerio Parse]
    ↓
[CSS Selector Match] → Bookmark[]
    ↓
[Fetch Metadata] → BookmarkMetadata[]
    ↓
[Load Template] → BookmarkTemplate
    ↓
[Replace HTML] → Template + Metadata = Custom HTML
    ↓
[Image Processing] → Skip bookmark featured images
    ↓
Final HTML (with bookmarks)
```

### Metadata Fetch Flow

```
Bookmark URL
    ↓
[HTTP GET] (10s timeout, 5 redirects)
    ↓
[HTML Response]
    ↓
[Parse OpenGraph Tags]
    ↓
[Extract Fields]
    - og:title (or <title>)
    - og:description (or empty)
    - og:image (or empty for featuredImage)
    - og:url (or original URL)
    ↓
BookmarkMetadata
```

### Error Handling Flow

```
Bookmark URL
    ↓
[HTTP GET]
    ↓
[Error?] (timeout, 4xx, 5xx, network)
    ↓ YES
[Log Error]
    ↓
[Preserve Original HTML]
    ↓
Continue to next bookmark
```

---

## Schema Changes

### No Database Schema Changes

This feature does not require database schema modifications:

- Bookmarks are transient, processed in-memory only
- No metadata caching (per spec requirement)
- No persistent storage needed

### File System Changes

**New Files**:

- `src/templates/bookmark-template.html` - Bookmark HTML template

**Modified Files**:

- `.env.example` - Add bookmark configuration variables
- `src/utils/config.ts` - Add bookmark config parsing

---

## Data Validation

### Bookmark Validation

```typescript
function validateBookmark(bookmark: Bookmark): boolean {
  return bookmark.url.length > 0 && bookmark.selector.length > 0 && bookmark.index >= 0;
}
```

### Metadata Validation

```typescript
function validateMetadata(metadata: BookmarkMetadata): boolean {
  return metadata.title.length > 0 && metadata.url.length > 0 && metadata.fetchedAt.length > 0;
}
```

### CSS Selector Validation

```typescript
function validateCssSelector(selector: string): boolean {
  // Basic validation - non-empty, reasonable length
  return selector.length > 0 && selector.length < 200;
}
```

---

## Data Integrity

### Sanitization

**Metadata Sanitization**:

- HTML-escape title, description to prevent XSS
- URL-encode URL and featured image before using in href/src attributes
- Remove null bytes and control characters

**Template Variable Replacement**:

- Use proper escaping for each context (HTML attribute, HTML content)
- Validate featured image URL before using in `<img>` src attribute

---

## Performance Considerations

### Memory Usage

- Bookmarks array: ~100 bytes per bookmark (transient)
- Metadata: ~500 bytes per bookmark (transient)
- No long-term memory impact (released after post processing)

### Network Usage

- Each bookmark: 1 HTTP request (10s timeout)
- No caching means duplicate URLs are re-fetched
- Estimated: 1-5 bookmarks per post = 1-5 additional requests per post

### Processing Time

- Metadata fetch: 100ms - 10s per bookmark (average ~2s)
- Template replacement: <10ms per bookmark
- Image filtering: <5ms per bookmark (skip detection)
- Total overhead per bookmark: ~2s (mostly network)

---

## Error Scenarios

### Metadata Fetch Failure

**Causes**:

- Network timeout (>10s)
- HTTP 4xx/5xx errors
- Invalid URL
- No internet connection
- DNS resolution failure

**Handling**:

- Log error with details
- Set `success: false` in BookmarkMetadata
- Preserve original bookmark HTML
- Continue migration (don't stop)

### Missing Metadata Fields

**Causes**:

- Target website doesn't implement OpenGraph
- OpenGraph tags not present
- Malformed HTML

**Handling**:

- Use fallbacks (e.g., `<title>` for title)
- Leave field empty if no fallback
- Template should handle empty fields gracefully

### Invalid CSS Selector

**Causes**:

- Malformed selector in `.env`
- User error in configuration

**Handling**:

- Validate selector at config load time
- Fall back to default selector if invalid
- Log warning about invalid selector

---

## Future Extensions (Not in Scope)

**Potential future enhancements** (for reference only):

- Metadata caching to reduce duplicate fetches
- Parallel bookmark processing for multiple posts
- Custom template directory for user-defined templates
- Metadata preview in CLI during migration
- Bookmark analytics (count, success rate)
