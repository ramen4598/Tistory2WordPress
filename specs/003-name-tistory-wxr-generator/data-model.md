# Data Model: Tistory WXR Generator

**Branch**: `003-name-tistory-wxr-generator` | **Date**: 2025-12-29

## Overview

This document defines the core data structures used throughout the migration pipeline, from parsing Tistory content to generating WXR output.

---

## Post

**Description**: Represents a single blog post with all associated metadata and content

### Attributes
- `url`: string - Original Tistory post URL (unique identifier)
- `title`: string - Post title
- `content`: string - Post HTML content (cleaned)
- `publish_date`: Date - Original publication date
- `modified_date`: Date | null - Last modification date (optional)
- `categories`: Category[] - Associated categories (hierarchical)
- `tags`: Tag[] - Associated tags
- `images`: Image[] - Images referenced in post
- `attachments`: Attachment[] - File attachments

### Relationships
- **One-to-Many**: Post → Image (one post has many images)
- **One-to-Many**: Post → Attachment (one post has many attachments)
- **Many-to-Many**: Post ↔ Category (post can have multiple categories)
- **Many-to-Many**: Post ↔ Tag (post can have multiple tags)

### Validation
- `url` must be valid URL format and start with TISTORY_BLOG_URL
- `title` must not be empty (fallback: "Untitled")
- `publish_date` required, `modified_date` optional
- `content` can be empty but should be logged

### State Transitions
- Raw HTML → Parsed → Cleaned → Added to WXR

---

## Category

**Description**: Represents a blog category with optional parent-child hierarchy

### Attributes
- `name`: string - Category display name
- `slug`: string - URL-safe category identifier
- `parent`: Category | null - Parent category for hierarchy (optional)
- `description`: string | null - Category description (optional)

### Relationships
- **Self-referential**: Category → Category (parent-child hierarchy)
- **Many-to-Many**: Category ↔ Post (categories can have multiple posts)

### Validation
- `name` must not be empty
- `slug` auto-generated from name (lowercase, hyphenated)
- Circular parent references not allowed
- Maximum depth: 3 levels recommended for WordPress compatibility

### Hierarchy Rules
- Top-level categories have `parent = null`
- Child categories reference parent via `parent` field
- Full category path: `parent.name / child.name`

---

## Tag

**Description**: Represents a blog tag (flat, no hierarchy)

### Attributes
- `name`: string - Tag display name
- `slug`: string - URL-safe tag identifier

### Relationships
- **Many-to-Many**: Tag ↔ Post (tags can have multiple posts)

### Validation
- `name` must not be empty
- `slug` auto-generated from name (lowercase, hyphenated)
- Tags are case-insensitive (normalize to lowercase)

---

## Image

**Description**: Represents an image referenced in post content

### Attributes
- `url`: string - Original image URL (Tistory CDN or external)
- `alt_text`: string | null - Image alt attribute (optional)

### Relationships
- **Many-to-One**: Image → Post (image belongs to one post)

### Validation
- `url` must be valid URL format
- `alt_text` extracted from HTML `alt` attribute if available

### Processing Notes
- Images are NOT downloaded locally (per FR-014)
- URLs preserved as-is in WXR output
- WordPress Importer will fetch images during import

---

## Attachment

**Description**: Represents a file attachment (non-image) associated with a post

### Attributes
- `url`: string - Original Tistory attachment URL
- `filename`: string - Original filename
- `local_path`: string | null - Local download path (downloads/ directory)
- `size`: number | null - File size in bytes (optional)
- `mime_type`: string | null - MIME type (optional)

### Relationships
- **Many-to-One**: Attachment → Post (attachment belongs to one post)

### Validation
- `url` must be valid URL format
- `filename` extracted from URL or Content-Disposition header
- `local_path` set after successful download, null if download failed

### Processing Notes
- Attachments downloaded to `downloads/{filename}` (per FR-013)
- Download failures logged but don't stop migration
- Local path stored for reference, but WXR may reference original URL

---

## InternalLink

**Description**: Tracks links between posts within the same Tistory blog

### Attributes
- `source_url`: string - URL of post containing the link
- `target_url`: string - URL of referenced post
- `link_text`: string | null - Anchor text of the link (optional)
- `context`: string | null - Surrounding text for context (optional)

### Relationships
- **Standalone**: Not directly related to Post entities (stored separately)

### Validation
- `source_url` must match a processed post URL
- `target_url` must start with TISTORY_BLOG_URL
- Both URLs must be valid format

### Output Format
```json
{
  "source_url": "https://blog.tistory.com/123",
  "target_url": "https://blog.tistory.com/456",
  "link_text": "See this related post",
  "context": "For more details, see this related post about..."
}
```

---

## MigrationState

**Description**: Tracks migration progress for resume capability

### Attributes
- `processed_posts`: string[] - Array of processed post URLs
- `total_posts`: number - Total number of posts discovered
- `last_checkpoint`: Date - Timestamp of last state update
- `version`: string - State file format version

### Validation
- `processed_posts` contains unique URLs only
- `last_checkpoint` updated after each post completion
- `version` = "1.0" (current format)

### File Format (migration-state.json)
```json
{
  "version": "1.0",
  "total_posts": 100,
  "processed_posts": [
    "https://blog.tistory.com/1",
    "https://blog.tistory.com/2"
  ],
  "last_checkpoint": "2025-12-29T10:30:00Z"
}
```

---

## Config

**Description**: Environment configuration loaded at startup

### Attributes
- `blogUrl`: string - TISTORY_BLOG_URL (required)
- `workerCount`: number - WORKER_COUNT (default: 4)
- `rateLimitPerWorker`: number - RATE_LIMIT_PER_WORKER in ms (default: 1000)
- `outputDir`: string - Output directory path (default: "./output")
- `downloadsDir`: string - Downloads directory path (default: "./output/downloads")

### Validation
- `blogUrl` must be valid URL and accessible
- `workerCount` must be positive integer (1-16 recommended)
- `rateLimitPerWorker` must be positive integer in milliseconds

### Source
Loaded from `.env` file or environment variables

---

## WXRData

**Description**: Aggregated data structure for WXR generation

### Attributes
- `posts`: Post[] - All processed posts
- `categories`: Category[] - Unique categories across all posts
- `tags`: Tag[] - Unique tags across all posts
- `authors`: Author[] - Blog authors (default: single author)
- `site_info`: SiteInfo - Blog metadata (title, description, URL)

### Relationships
- Aggregates all domain entities for WXR output

### Processing
- Categories deduplicated by slug
- Tags deduplicated by slug
- Hierarchical categories flattened with parent references
- Posts sorted by publish_date (ascending)

---

## Entity Lifecycle

```
Tistory HTML
    ↓
[Crawler] → Post URLs
    ↓
[PostProcessor] → Raw Post data
    ↓
[Cleaner] → Cleaned Post (HTML→MD→HTML)
    ↓
[LinkTracker] → InternalLink records
    ↓
[Downloader] → Attachment (local_path populated)
    ↓
[WXRGenerator] → WXRData aggregate
    ↓
output.wxr.xml (WordPress import ready)
```

---

## Database / Storage

**Storage Type**: File system (no database)

**Output Files**:
- `output/output.wxr.xml` - WordPress WXR file
- `output/link_mapping.json` - Internal link mappings
- `output/migration-state.json` - Resume state tracking
- `output/downloads/` - Downloaded attachments

**In-Memory**:
- All data structures held in memory during processing
- WXR built incrementally but held in memory before final write
- For 500 posts: ~50-100MB estimated memory usage

---

## Type Definitions (TypeScript)

```typescript
interface Post {
  url: string;
  title: string;
  content: string;
  publish_date: Date;
  modified_date: Date | null;
  categories: Category[];
  tags: Tag[];
  images: Image[];
  attachments: Attachment[];
}

interface Category {
  name: string;
  slug: string;
  parent: Category | null;
  description?: string;
}

interface Tag {
  name: string;
  slug: string;
}

interface Image {
  url: string;
  alt_text: string | null;
}

interface Attachment {
  url: string;
  filename: string;
  local_path: string | null;
  size?: number;
  mime_type?: string;
}

interface InternalLink {
  source_url: string;
  target_url: string;
  link_text?: string;
  context?: string;
}

interface MigrationState {
  version: string;
  total_posts: number;
  processed_posts: string[];
  last_checkpoint: Date;
}

interface Config {
  blogUrl: string;
  workerCount: number;
  rateLimitPerWorker: number;
  outputDir: string;
  downloadsDir: string;
}

interface WXRData {
  posts: Post[];
  categories: Category[];
  tags: Tag[];
  authors: Author[];
  site_info: SiteInfo;
}
```
