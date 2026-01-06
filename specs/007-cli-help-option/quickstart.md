# Quick Start: CLI Help Option & Tistory Bookmark Handling

**Feature**: 007-cli-help-option
**Date**: 2026-01-06
**Spec**: [spec.md](./spec.md)

## Overview

This guide provides quick setup and usage instructions for the CLI help option and Tistory bookmark handling features.

## Prerequisites

- Node.js 18+ installed
- Tistory2Wordpress repository cloned
- Basic understanding of Tistory blog migration workflow

## Feature 1: CLI Help Option

### Usage

Display help message:

```bash
node dist/cli.js --help
# or
node dist/cli.js -h
# or
ts-node src/cli.ts --help
```

### Expected Output

```
Tistory2Wordpress - Migrate Tistory blog posts to WordPress

Usage:
  tistory2wp [--post <url> | --all] [--retry-failed] [--export-links]

Options:
  -h, --help           Show this help message
  --post <url>         Migrate a single post by URL
  --all                Migrate all posts from the blog
  --retry-failed       Retry failed migration items
  --export-links       Export internal link mapping to JSON

Environment Variables (in .env):
  TISTORY_BLOG_URL     Your Tistory blog URL (required)
  WORKER_COUNT         Number of concurrent workers (default: 4)
  RATE_LIMIT_PER_WORKER  Delay between requests per worker (default: 1000)
  OUTPUT_DIR           Directory for generated files (default: ./output)

  WordPress REST (optional):
  WP_BASE_URL          WordPress base URL
  WP_APP_USER          WordPress Application Password username
  WP_APP_PASSWORD      WordPress Application Password value

  Logging:
  LOG_LEVEL            Log level: debug, info, warn, error (default: info)
  LOG_FILE             Log file path (optional)

  Bookmark Configuration:
  TISTORY_BOOKMARK_SELECTOR  CSS selector to detect bookmarks (default: figure[data-ke-type="opengraph"])
```

### Behavior

- Help flag is checked **before** any configuration loading or database operations
- Exit code 0 when help is displayed successfully
- No migration is performed when help flag is present
- All other flags are ignored when `--help` is used

### Testing

```bash
# Test help option
node dist/cli.js --help
# Should display help and exit

# Test short form
node dist/cli.js -h
# Should display same help

# Test help with other flags (help takes precedence)
node dist/cli.js --help --all
# Should display help and exit, ignoring --all
```

---

## Feature 2: Tistory Bookmark Handling

### Configuration

Add bookmark configuration to your `.env` file:

```bash
# Bookmark Configuration
# CSS selector to detect bookmark elements in Tistory posts
# Default: figure[data-ke-type="opengraph"]
TISTORY_BOOKMARK_SELECTOR=figure[data-ke-type="opengraph"]
```

**Optional**: Customize bookmark HTML by updating the TypeScript template in `src/templates/bookmarkTemplate.ts`.

The helper function `renderBookmarkHTML` takes bookmark metadata and returns a styled `<figure>` element:

```ts
renderBookmarkHTML({
  title: 'Example Title',
  url: 'https://example.com',
  description: 'Short description',
  featuredImage: 'https://example.com/image.jpg',
});
```

This renders HTML similar to:

```html
<figure class="bookmark-card">
  <div class="bookmark-featured-image">
    <img src="https://example.com/image.jpg" alt="Example Title" />
  </div>
  <div class="bookmark-content">
    <h3 class="bookmark-title">
      <a href="https://example.com" target="_blank" rel="noopener noreferrer">Example Title</a>
    </h3>
    <p class="bookmark-description">Short description</p>
  </div>
</figure>
```

You can adjust styles inside `bookmarkTemplate.ts` (card layout, colors, spacing) to match your site.

### Usage

Bookmark handling is **automatic** - no additional flags needed:

```bash
# Migrate all posts (bookmarks are processed automatically)
npm start -- --all

# Migrate single post
npm start -- --post https://yourblog.tistory.com/123
```

### Behavior

1. **Detection**: Bookmarks are identified using the CSS selector configured in `.env`
2. **Metadata Fetch**: For each bookmark, metadata is fetched from URL (10s timeout)
3. **HTML Replacement**: Original bookmark HTML is replaced with custom card template
4. **Image Processing**: Bookmark featured images are ignored during image upload
5. **Error Handling**: If metadata fetch fails, original bookmark HTML is preserved

### What Gets Processed

**Tistory Bookmark Structure** (detected by selector):

```html
<figure data-og-type="website">
  <a href="https://example.com/article">
    <img src="https://example.com/thumbnail.jpg" />
    <!-- Note: URL is example, variable will be {{featuredImage}} -->
  </a>
</figure>
```

**After Processing** (custom card):

```html
<div
  class="bookmark-card"
  style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; margin: 16px 0;"
>
  <div class="bookmark-featured-image" style="height: 200px; overflow: hidden;">
    <img src="https://example.com/thumbnail.jpg" />
    alt="Article Title" style="width: 100%; height: 100%; object-fit: cover;" />
  </div>
  <div class="bookmark-content" style="padding: 16px;">
    <h3 class="bookmark-title" style="margin: 0 0 8px 0;">
      <a href="https://example.com/article" target="_blank" rel="noopener noreferrer"
        >Article Title</a
      >
    </h3>
    <p class="bookmark-description" style="margin: 0; color: #666; line-height: 1.5;">
      Article description goes here...
    </p>
  </div>
</div>
```

### Error Scenarios

**Scenario 1: Metadata Fetch Fails**

- Log: `Failed to fetch bookmark metadata from {url}: {error}`
- Action: Original bookmark HTML preserved, migration continues

**Scenario 2: Missing Metadata Fields**

- Log: `Warning: Missing og:description for {url}`
- Action: Bookmark card rendered with available fields (title, URL)

**Scenario 3: Invalid CSS Selector**

- Log: `Warning: Invalid bookmark selector "{selector}", using default`
- Action: Falls back to default selector `figure[data-ke-type="opengraph"]`

### Performance Impact

- **Additional Time**: ~2 seconds per bookmark (average fetch time)
- **Network Requests**: 1 request per bookmark (no caching)
- **Memory**: ~600 bytes per bookmark (transient, released after processing)

### Logging

Enable debug logging to see bookmark processing details:

```bash
# In .env
LOG_LEVEL=debug
```

**Example Debug Output**:

```
[DEBUG] BookmarkProcessor: Detected 3 bookmarks
[DEBUG] BookmarkProcessor: Fetching metadata from https://example.com/article1
[DEBUG] BookmarkProcessor: Metadata fetched successfully (title: "Example Title", hasFeaturedImage: true)
[DEBUG] BookmarkProcessor: Replaced bookmark #0 with custom HTML
[DEBUG] ImageProcessor: Skipping bookmark featured image (parent: figure[data-ke-type="opengraph"])
```

---

## Testing

### Test CLI Help

```bash
# Test help display
node dist/cli.js --help
# Verify: Help message displayed, exit code 0

# Test short form
node dist/cli.js -h
# Verify: Same output as --help
```

### Test Bookmark Processing

1. **Create Test Post** in Tistory with bookmark:

   ```html
   <figure data-og-type="website">
     <a href="https://github.com">
       <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" />
     </a>
   </figure>
   ```

2. **Run Migration**:

   ```bash
   npm start -- --post https://yourblog.tistory.com/test-post
   ```

3. **Verify Output**:
   - Check logs for bookmark detection and metadata fetch
   - Verify custom HTML in migrated post
   - Confirm bookmark featured image not uploaded to WordPress

### Test Bookmark Error Handling

1. **Create Post** with bookmark to non-existent URL:

   ```html
   <figure data-og-type="website">
     <a href="https://this-site-does-not-exist-12345.com">
       <img src="https://example.com/thumb.jpg" />
     </a>
   </figure>
   ```

2. **Run Migration**:

   ```bash
   node dist/cli.js --all
   ```

3. **Verify Behavior**:
   - Log shows warning about failed metadata fetch
   - Original bookmark HTML preserved
   - Migration continues to next bookmark/post

---

## Troubleshooting

### Help Option Not Working

**Problem**: `--help` flag not displaying help

**Solutions**:

1. Ensure help flag is before other options: `npm start -- --help --all`
2. Check for typos: `--help` (not `-help` or `--hel`)
3. Verify Node.js version: `node --version` (should be 18+)

### Bookmarks Not Detected

**Problem**: Bookmarks not being processed

**Solutions**:

1. Check CSS selector in `.env`: `TISTORY_BOOKMARK_SELECTOR=figure[data-ke-type="opengraph"]`
2. Verify bookmark HTML matches selector in your Tistory post
3. Enable debug logging: `LOG_LEVEL=debug`
4. Check logs for: `BookmarkProcessor: Detected X bookmarks`

### Metadata Fetch Timeout

**Problem**: Bookmark metadata fetches timing out

**Solutions**:

1. Check internet connectivity
2. Verify bookmark URLs are accessible (test in browser)
3. Check logs for specific error: `Failed to fetch bookmark metadata from {url}`
4. Some sites may block automated requests - original bookmark HTML will be preserved

### Bookmark Featured Images Being Uploaded

**Problem**: Bookmark featured images are being uploaded to WordPress

**Solutions**:

1. Verify CSS selector includes parent: `figure[data-ke-type="opengraph"]`
2. Check ImageProcessor logs for: `Skipping bookmark featured image`
3. Ensure bookmark HTML has correct `data-og-type` attribute

### Custom Template Not Working

**Problem**: Custom bookmark template not rendering

**Solutions**:

1. Verify template file exists: `src/templates/bookmark-template.html`
2. Check template syntax: `{{title}}`, `{{description}}`, etc.
3. Ensure file is valid HTML
4. Check logs for template loading errors

---

## Advanced Usage

### Custom CSS Selector

If your Tistory blog uses a different bookmark structure, customize the selector:

```bash
# For different bookmark structure
TISTORY_BOOKMARK_SELECTOR=div.bookmark-container a.link
```

### Disable Bookmark Processing

To disable bookmark processing without modifying code:

```bash
# Set selector to something that won't match
TISTORY_BOOKMARK_SELECTOR=.non-existent-class
```

### Conditional Template Logic

Use `{{#if}}` blocks in template for conditional rendering:

```html
{{#if featuredImage}}
<div class="featured-image">
  <img src="{{featuredImage}}" alt="{{title}}" />
</div>
{{/if}} {{#if description}}
<p class="description">{{description}}</p>
{{/if}}
```

---

## Reference Links

- [Feature Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Data Model](./data-model.md)
- [Sequence Diagram](./sequence-diagram.md)
- [Bookmark Metadata Contract](./contracts/bookmark-metadata.md)
- [Main README](../../README.md)
