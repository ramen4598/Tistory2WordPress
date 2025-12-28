# Data Model: Tistory to WordPress Migration

**Branch**: `002-tistory-wordpress-migration` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Purpose**: Data structures for Tistory posts, links, media, and WXR documents

## Entity Models

### TistoryPost

Represents a single Tistory blog post with all extracted metadata.

```python
from pydantic import BaseModel, HttpUrl, Field
from datetime import datetime
from typing import List, Optional

class ImageUrl(BaseModel):
    """Image URL with alt text"""
    url: HttpUrl
    alt_text: str = ""

class AttachmentUrl(BaseModel):
    """Attachment URL with filename"""
    url: HttpUrl
    filename: str

class TistoryPost(BaseModel):
    """Tistory blog post with complete metadata"""

    # Core content
    title: str
    content: str  # Raw HTML content (before cleaning)
    url: HttpUrl

    # Metadata
    creation_date: datetime
    modification_date: Optional[datetime] = None

    # Organization
    categories: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)

    # Media
    images: List[ImageUrl] = Field(default_factory=list)
    attachments: List[AttachmentUrl] = Field(default_factory=list)

    # Processing state
    cleaned_content: Optional[str] = None  # After Tistory-specific cleaning
    internal_links: List[HttpUrl] = Field(default_factory=list)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            HttpUrl: lambda v: str(v),
        }
```

**Notes**:
- `categories` and `tags` stored as flat text lists (no hierarchy per spec)
- `cleaned_content` populated after Cleaner Service processing
- `internal_links` populated after Link Tracker processing
- Images preserve original URLs (not downloaded)
- Attachments downloaded locally, filename extracted from URL

---

### InternalLink

Represents a link from one Tistory post to another post in the same blog.

```python
class InternalLink(BaseModel):
    """Link from source post to target post within same Tistory blog"""

    source_post_url: HttpUrl
    source_post_title: str

    target_post_url: HttpUrl
    target_post_title: Optional[str] = None  # May not be known yet

    link_text: Optional[str] = None  # Text inside <a> tag
    link_position: Optional[int] = None  # Position in content (for debugging)

    class Config:
        json_encoders = {
            HttpUrl: lambda v: str(v),
        }
```

**Notes**:
- Recorded in link_mapping.json
- Enables manual link updates after WordPress import
- Target post title may be unknown if target post not yet processed

---

### MediaFile

Represents an attachment downloaded from Tistory.

```python
class MediaFile(BaseModel):
    """Attachment file downloaded from Tistory"""

    url: HttpUrl
    filename: str
    local_path: str  # Relative path from downloads/ directory
    file_size: Optional[int] = None  # In bytes

    download_status: str = "pending"  # pending, downloading, completed, failed
    download_error: Optional[str] = None

    class Config:
        json_encoders = {
            HttpUrl: lambda v: str(v),
        }
```

**Notes**:
- Images NOT included in MediaFile (images handled via preserved URLs)
- Only non-image attachments downloaded
- `local_path` is relative path (e.g., "document.pdf")
- Files stored in `downloads/` directory

---

### WXRDocument

Represents WordPress eXtended RSS document for WordPress Importer.

```python
class WXRDocument(BaseModel):
    """WordPress eXtended RSS document for WordPress Importer plugin"""

    # Metadata
    generator: str = "Tistory2Wordpress Migration Tool"
    site_url: HttpUrl
    blog_title: str
    language: str = "ko"

    # Content
    authors: List[str] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    posts: List[TistoryPost] = Field(default_factory=list)

    # WordPress-specific metadata
    wp_version: str = "2.3"  # WordPress export version

    class Config:
        json_encoders = {
            HttpUrl: lambda v: str(v),
        }
```

**Notes**:
- WXR format compatible with WordPress Importer plugin
- Contains all posts, categories, and tags
- XML structure defined in contracts/wxr-format.md

---

### MigrationState

Tracks migration progress for resume capability.

```python
class MigrationState(BaseModel):
    """State tracking for migration resume capability"""

    # Configuration
    tistory_url: HttpUrl
    started_at: datetime
    last_updated: datetime

    # Progress
    total_posts_discovered: int = 0
    posts_processed: int = 0
    posts_failed: int = 0

    # Trackers
    processed_post_urls: List[HttpUrl] = Field(default_factory=list)
    failed_posts: List[dict] = Field(default_factory=list)  # {url, error, timestamp}

    # Output files
    wxr_output_file: str
    link_mapping_file: str

    class Config:
        json_encoders = {
            HttpUrl: lambda v: str(v),
            datetime: lambda v: v.isoformat(),
        }
```

**Notes**:
- Saved to `state.json` for resume capability
- Tracks which posts have been processed
- Records failed posts with error details
- Enables resuming from interruption point

---

### ProgressUpdate

Real-time progress update for CLI display.

```python
class ProgressUpdate(BaseModel):
    """Progress update for CLI progress display"""

    current_step: str  # "crawling", "cleaning", "downloading", "generating"
    current_post: int
    total_posts: int
    percentage: float  # 0.0 to 100.0

    posts_per_second: float  # Processing speed
    elapsed_seconds: int
    estimated_remaining_seconds: Optional[int] = None

    errors: int = 0

    def __str__(self) -> str:
        return (
            f"[{self.current_step.upper()}] "
            f"{self.current_post}/{self.total_posts} "
            f"({self.percentage:.1f}%) "
            f"│ {self.posts_per_second:.1f} posts/sec "
            f"│ Errors: {self.errors}"
        )
```

**Notes**:
- Real-time display to user during migration
- Shows processing speed and ETA
- Indicates current processing step

---

## Data Flow

```
1. Crawler Discovery
   Tistory HTML → TistoryPost (raw)

2. Parser Extraction
   Tistory HTML → TistoryPost (with metadata, images, attachments)

3. Cleaner Processing
   TistoryPost (raw content) → TistoryPost (cleaned content)

4. Link Tracking
   TistoryPost (cleaned) → InternalLink[]

5. Attachment Download
   AttachmentUrl[] → MediaFile[]

6. WXR Generation
   TistoryPost[] → WXRDocument → XML file
```

---

## File Storage Models

### link_mapping.json

```json
{
  "blog_url": "https://example.tistory.com",
  "generated_at": "2025-12-28T12:00:00Z",
  "total_internal_links": 42,
  "links": [
    {
      "source_post_url": "https://example.tistory.com/123",
      "source_post_title": "Post A",
      "target_post_url": "https://example.tistory.com/456",
      "target_post_title": "Post B",
      "link_text": "read more",
      "link_position": 5
    }
  ]
}
```

### state.json

```json
{
  "tistory_url": "https://example.tistory.com",
  "started_at": "2025-12-28T12:00:00Z",
  "last_updated": "2025-12-28T12:30:00Z",
  "total_posts_discovered": 100,
  "posts_processed": 75,
  "posts_failed": 2,
  "processed_post_urls": [
    "https://example.tistory.com/1",
    "https://example.tistory.com/2"
  ],
  "failed_posts": [
    {
      "url": "https://example.tistory.com/404",
      "error": "HTTP 404 Not Found",
      "timestamp": "2025-12-28T12:15:00Z"
    }
  ],
  "wxr_output_file": ".output.xml",
  "link_mapping_file": "link_mapping.json"
}
```

---

## Relationships

```
TistoryPost (1) ────> (N) ImageUrl
TistoryPost (1) ────> (N) AttachmentUrl
TistoryPost (1) ────> (N) InternalLink
AttachmentUrl (1) ────> (1) MediaFile
WXRDocument (1) ────> (N) TistoryPost
MigrationState (1) ────> (N) TistoryPost (via processed_post_urls)
```

---

## Notes

- **Flat Categories**: Categories and tags stored as flat text lists (no hierarchy)
- **Image URLs Preserved**: Images NOT downloaded, URLs preserved in cleaned content
- **Attachments Downloaded**: Only non-image attachments downloaded to `downloads/`
- **Thread Safety**: All models designed for thread-safe read operations during parallel processing
- **Pydantic Validation**: All models use Pydantic for runtime type validation and serialization
- **JSON Serialization**: Custom encoders for datetime and HttpUrl types
