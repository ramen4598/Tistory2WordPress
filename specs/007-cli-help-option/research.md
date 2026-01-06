# Research: CLI Help Option & Tistory Bookmark Handling

**Feature**: 007-cli-help-option
**Date**: 2026-01-06
**Status**: Complete

## Overview

This document documents research findings for implementing CLI help option and Tistory bookmark handling features.

## Phase 0 Research Topics

### Topic 1: OpenGraph Metadata Fetching

**Question**: How to reliably fetch OpenGraph metadata from bookmark URLs?

**Research Findings**:

- OpenGraph metadata is embedded in HTML `<head>` section as meta tags
- Common meta tags: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`
- Fallback mechanisms needed: use `<title>` if `og:title` missing, use first `<img>` if `og:image` (featuredImage) missing
- HTTP redirects must be followed (common on URL shorteners)
- Response time varies: 100ms - 5s typical, can be 10s+ for slow sites
- Some sites block automated requests (403 Forbidden, 429 Too Many Requests)

**Recommendations**:

- Use axios with `maxRedirects: 5` to handle redirects
- Set 10s timeout per spec requirement
- Use cheerio to parse HTML and extract meta tags
- Implement fallback logic for missing metadata
- Add User-Agent header to reduce blocking risk
- Graceful degradation: if fetch fails, preserve original bookmark HTML

**Example Implementation**:

```typescript
import axios from 'axios';
import * as cheerio from 'cheerio';

async function fetchMetadata(url: string) {
  const response = await axios.get(url, {
    maxRedirects: 5,
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Tistory2Wordpress/1.0)',
    },
  });

  const $ = cheerio.load(response.data);

  return {
    title: $('meta[property="og:title"]').attr('content') || $('title').text(),
    description: $('meta[property="og:description"]').attr('content') || '',
    image: $('meta[property="og:image"]').attr('content') || '', // Renamed to featuredImage in actual implementation
    url: $('meta[property="og:url"]').attr('content') || url,
  };
}
```

---

### Topic 2: HTML Template with Variables

**Question**: How to implement customizable bookmark HTML templates in TypeScript?

**Research Findings**:

- Template variables can use simple placeholders like `{{title}}`, `{{description}}`, `{{featuredImage}}`, `{{url}}`
- File-based templates allow easy modification without code changes
- Must sanitize user-provided metadata to prevent XSS
- Cheerio or simple string replacement can be used
- Template file should be in `src/templates/` for discoverability

**Recommendations**:

- Create `src/templates/bookmark-template.html` with placeholder variables
- Load template file at service initialization (not per-request)
- Use simple string replacement with regex
- Escape HTML in metadata fields to prevent XSS
- Support optional fields (hide entire element if empty)

**Example Template** (`bookmark-template.html`):

```html
{{#if featuredImage}}
   <div class="bookmark-featured-image" style="height: 200px; overflow: hidden;">
     <img
       src="{{featuredImage}}"
       alt="{{title}}"
       style="width: 100%; height: 100%; object-fit: cover;"
     />
   </div>
   {{/if}}
   <div class="bookmark-content" style="padding: 16px;">
     <h3 class="bookmark-title" style="margin: 0 0 8px 0;">
       <a href="{{url}}" target="_blank" rel="noopener noreferrer">{{title}}</a>
     </h3>
     {{#if description}}
     <p class="bookmark-description" style="margin: 0; color: #666; line-height: 1.5;">
       {{description}}
     </p>
     {{/if}}
   </div>
</div>
```

---

### Topic 3: CLI Help Message Formatting

**Question**: What's the best practice for CLI help messages in Node.js/TypeScript?

**Research Findings**:

- Most CLI tools use consistent formatting: command, options, descriptions
- Help should display before config loading and migration logic
- Exit code 0 for help, 1 for errors
- Console.log() is standard (no logging for help messages)
- Options should include both short (`-h`) and long (`--help`) forms
- Description should be concise but clear

**Recommendations**:

- Check for help flag first, before loading config or DB
- Display: tool name, description, usage, options with descriptions
- Format options as `  -h, --help     Show help message`
- Exit with code 0 immediately after displaying help
- Keep help text simple, avoid color/emoji (for terminal compatibility)

**Example Implementation**:

```typescript
function printHelp(): void {
  console.log('Tistory2Wordpress - Migrate Tistory blog posts to WordPress');
  console.log('');
  console.log('Usage:');
  console.log('  tistory2wp [--post <url> | --all] [--retry-failed] [--export-links]');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help           Show this help message');
  console.log('  --post <url>         Migrate a single post by URL');
  console.log('  --all                Migrate all posts from the blog');
  console.log('  --retry-failed       Retry failed migration items');
  console.log('  --export-links       Export internal link mapping to JSON');
  console.log('');
  console.log('Environment Variables (in .env):');
  console.log('  TISTORY_BLOG_URL     Your Tistory blog URL (required)');
  console.log('  WORKER_COUNT         Number of concurrent workers (default: 4)');
  // ... more env vars
}
```

---

### Topic 4: Image Filtering by Parent Element

**Question**: How to filter images based on parent element in cheerio?

**Research Findings**:

- Cheerio supports parent traversal: `img.parent()`, `img.closest('selector')`
- `closest()` is most efficient: finds first matching ancestor
- Can chain filters: `$('img').not('[data-skip]')`
- Should check parent before downloading image

**Recommendations**:

- Use `img.closest(BOOKMARK_SELECTOR)` to detect bookmark featured images
- Skip images that have bookmark figure as ancestor
- Add data attribute to bookmark figures for easier detection
- Filter images before processing loop

**Example Implementation**:

```typescript
const processImgs = async (post: Post, jobItemId: number): Promise<Post> => {
  const $ = cheerio.load(post.content);
  const imgElements = $('img');
  const bookmarkSelector = loadConfig().bookmarkSelector; // e.g., 'figure[data-og-type="website"]'

  const uploadedImages: Image[] = [];

  for (let i = 0; i < imgElements.length; i++) {
    const img = imgElements.eq(i);

    // Skip bookmark featured images
    if (img.closest(bookmarkSelector).length > 0) {
      continue;
    }

    const originalUrl = img.attr('src');
    const altText = img.attr('alt') ?? null;

    if (!originalUrl) {
      continue;
    }

    // ... process image
  }

  return { ...post, content: $.html(), images: uploadedImages };
};
```

---

### Topic 5: CSS Selector Configuration

**Question**: How to configure and validate CSS selectors in `.env`?

**Research Findings**:

- `.env` variables are strings, loaded via dotenv
- CSS selector syntax validation is complex
- Should provide default value if not configured
- Invalid selectors will fail at runtime (cheerio throws)

**Recommendations**:

- Add `TISTORY_BOOKMARK_SELECTOR` to `.env.example`
- Default value: `figure[data-og-type="website"] a` (extract URL)
- For bookmark detection, use parent: `figure[data-og-type="website"]`
- Add simple validation: check if selector is non-empty
- Log warning if selector looks suspicious (e.g., too short)

**Example Config** (`.env.example`):

```bash
# Bookmark configuration
# CSS selector to detect bookmark elements in Tistory posts
# Default: figure[data-og-type="website"]
TISTORY_BOOKMARK_SELECTOR=figure[data-og-type="website"]
```

---

## Summary of Research Decisions

1. **OpenGraph Metadata**: Use axios with 10s timeout, cheerio for parsing, fallbacks for missing fields
2. **HTML Templates**: File-based templates with `{{variable}}` placeholders, loaded at service init
3. **CLI Help**: Early flag detection, console.log output, exit code 0
4. **Image Filtering**: Use `img.closest(BOOKMARK_SELECTOR)` to detect and skip bookmark featured images
5. **CSS Selector**: Configurable via `.env`, default value provided, simple validation

## Open Questions (Resolved)

- ~~What timeout for metadata fetch?~~ **Resolved**: 10 seconds (from spec clarification)
- ~~Should metadata be cached?~~ **Resolved**: No caching (from spec clarification)
- ~~What HTML structure for bookmarks?~~ **Resolved**: Custom card component with separate template file

## References

- Axios documentation: https://axios-http.com/docs/config_defaults
- Cheerio API: https://cheerio.js.org/
- OpenGraph protocol: https://ogp.me/
