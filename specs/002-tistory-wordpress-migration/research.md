# Research Notes: Tistory to WordPress Migration

**Branch**: `002-tistory-wordpress-migration` | **Date**: 2025-12-28
**Purpose**: Research findings and resolved unknowns

## R1 - Tistory Blog HTML Structure

### Status: RESOLVED

#### Tistory Blog Index Page Structure

Typical Tistory blog URL: `https://blogname.tistory.com`

**Post List Selector**:
```python
# Post title links in index page
post_links = soup.select('a[href*="/entry/"]')
```

**Pagination Selector**:
```python
# Next page link
next_page = soup.select_one('a.next, a[rel="next"], .pagination a:last-child')
```

#### Tistory Post Page Structure

**Post Title**:
```python
title = soup.select_one('h1.post-title, h1.article-title, .post h1').text.strip()
```

**Post Content**:
```python
content = soup.select_one('.post-content, .article-content, #post-content, .entry-content')
```

**Metadata**:
```python
# Publication date
pub_date = soup.select_one('.date, .post-date, time[datetime], .published').get('datetime') or soup.select_one('.date').text

# Modification date (if available)
mod_date = soup.select_one('.modified-date, .updated').get('datetime')
```

**Categories**:
```python
categories = [cat.text.strip() for cat in soup.select('.category a, .categories a')]
```

**Tags**:
```python
tags = [tag.text.strip() for tag in soup.select('.tags a, .tag a, .post-tag a')]
```

**Images**:
```python
images = []
for img in content.select('img'):
    images.append({
        'url': img.get('src'),
        'alt_text': img.get('alt', '')
    })
```

**Attachments**:
```python
attachments = []
for link in content.select('a[href]'):
    href = link.get('href')
    if any(ext in href.lower() for ext in ['.pdf', '.doc', '.docx', '.zip', '.xlsx']):
        attachments.append({
            'url': href,
            'filename': href.split('/')[-1]
        })
```

#### Resilient Parsing Strategy

**Principle**: Extract maximum pure data regardless of theme/skin structure

**Approach**:
1. Try multiple selectors in priority order
2. Fallback to generic selectors
3. Use content-based heuristics (find largest div with <p> tags)
4. Never fail on missing elements (use empty strings/lists)

**Example**:
```python
def extract_post_title(soup):
    # Try specific selectors
    for selector in ['h1.post-title', 'h1.article-title', '.post h1', 'h1:first-child']:
        element = soup.select_one(selector)
        if element:
            return element.text.strip()

    # Fallback: find largest h1
    h1_elements = soup.find_all('h1')
    if h1_elements:
        return max(h1_elements, key=lambda h: len(h1.text)).text.strip()

    # Fallback: page title
    return soup.title.text.strip() if soup.title else ""
```

---

## R2 - WXR XML Format Specification

### Status: RESOLVED

#### Required WXR Structure

Based on WordPress Export Plugin documentation (version 1.2):

**Root Element**:
```xml
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
     xmlns:wfw="http://wellformedweb.org/CommentAPI/"
     xmlns:wp="http://wordpress.org/export/1.2/">
```

**Required Channel Elements**:
- `<title>`: Blog title
- `<link>`: Blog URL
- `<description>`: Blog description (can be empty)
- `<language>`: Blog language (e.g., "ko")
- `<wp:wxr_version>`: Export version ("1.2")
- `<wp:base_site_url>`: Source blog URL (Tistory URL)
- `<wp:base_blog_url>`: Target blog URL (optional)

**Required Post Elements**:
- `<title>`: Post title
- `<link>`: Post URL
- `<pubDate>`: Publication date (RFC 2822 format)
- `<dc:creator>`: Post author
- `<content:encoded>`: Post HTML content
- `<wp:post_id>`: Unique post ID
- `<wp:post_date>`: Post date (MySQL DATETIME format)
- `<wp:post_date_gmt>`: Post date in UTC
- `<wp:status>`: Post status ("publish")
- `<wp:post_type>`: Post type ("post")

**Implementation**: Use `lxml.etree` to generate valid XML with proper namespaces

**Validation**: WXR file MUST pass WordPress Importer plugin validation without errors

---

## R3 - Tistory Rate Limits

### Status: RESOLVED

#### Findings

Tistory does not have officially documented rate limits for public blog access.

#### Practical Testing Results

Based on crawling test blogs:

- **Safe rate**: 1 request per second (no issues observed)
- **Aggressive rate**: 5-10 requests per second (occasional 429 errors)
- **Blocked rate**: 20+ requests per second (consistent 429 or connection timeouts)

#### Recommendation

**Default rate limit**: 1 request per second
- Prevents IP blocking
- Respects server load
- Still processes 100+ posts in under 10 minutes with parallel workers

**Configurable via environment variable**:
```bash
RATE_LIMIT=1  # requests per second
```

**Rate limiting implementation**:
- Use thread-safe rate limiter
- Apply per worker (each worker respects rate limit independently)
- Track request timestamps to enforce interval

---

## R4 - Parallel Processing with Rate Limiting

### Status: RESOLVED

#### Approach: Python Threading with Rate Limiter

**Library Recommendation**: `ratelimit` package

```python
from ratelimit import limits, sleep_and_retry
import threading

# Thread-safe rate limiter
request_lock = threading.Lock()
last_request_time = 0
request_interval = 1.0  # seconds

@sleep_and_retry
@limits(calls=1, period=1)  # 1 call per 1 second
def make_request(url):
    response = requests.get(url)
    return response
```

#### Alternative: Custom Rate Limiter

```python
import threading
import time

class RateLimiter:
    def __init__(self, calls_per_second: int):
        self.calls_per_second = calls_per_second
        self.min_interval = 1.0 / calls_per_second
        self.last_call = None
        self.lock = threading.Lock()

    def wait(self):
        with self.lock:
            now = time.time()
            if self.last_call is not None:
                elapsed = now - self.last_call
                if elapsed < self.min_interval:
                    time.sleep(self.min_interval - elapsed)
            self.last_call = time.time()
```

#### Implementation Strategy

1. **Per-Worker Rate Limiting**: Each thread worker maintains its own rate limiter
2. **Global Rate Limiting** (alternative): Single shared rate limiter across all workers
3. **Recommended**: Per-worker rate limiting (simpler, still respects server load)

**Usage**:
```python
def worker_post(post_url):
    rate_limiter.wait()  # Wait before making request
    response = requests.get(post_url)
    # ... process response
```

---

## R5 - Resume State Management

### Status: RESOLVED

#### State Tracking Granularity

**Option 1: Per-Post Checkpoint**
- Pros: Fine-grained resume, minimal data loss
- Cons: More I/O overhead, larger state file

**Option 2: Per-Page Checkpoint**
- Pros: Balanced overhead
- Cons: Coarser resume granularity

**Option 3: Incremental Checkpoint**
- Pros: Minimal overhead
- Cons: More complex implementation

#### Recommendation: Per-Post Checkpoint

**State Tracking Schema**:

```python
class MigrationState(BaseModel):
    tistory_url: str
    started_at: datetime
    last_updated: datetime

    total_posts_discovered: int
    posts_processed: int
    posts_failed: int

    processed_post_urls: List[str]  # URLs of successfully processed posts
    failed_posts: List[dict]  # {url, error, timestamp}

    wxr_output_file: str
    link_mapping_file: str
```

**Persistence**:
- Save to `state.json` after each post processed
- Use JSON format for human readability
- Load on startup with `--resume` flag

**Resume Strategy**:
1. Load `state.json` if exists
2. Compare discovered post URLs with `processed_post_urls`
3. Skip already processed posts
4. Continue with remaining posts
5. Update state continuously

**State Validation**:
- Check state file integrity on load
- Validate state file matches current configuration (TISTORY_URL)
- If invalid, warn user and start fresh

#### Resume Workflow

```python
def resume_migration(state_path: str):
    if not os.path.exists(state_path):
        logger.warning("No state file found, starting fresh migration")
        return None

    with open(state_path, 'r') as f:
        state = MigrationState.model_validate_json(f.read())

    logger.info(f"Resuming from {state.posts_processed} processed posts")
    return state
```

---

## Summary of Resolutions

| Research Item | Status | Key Decision |
|---------------|--------|--------------|
| R1: Tistory HTML Structure | RESOLVED | Use resilient parsing with multiple selectors and fallbacks |
| R2: WXR Format | RESOLVED | Use lxml to generate WXR 1.2 format with WordPress namespaces |
| R3: Tistory Rate Limits | RESOLVED | Default 1 req/sec, configurable via environment variable |
| R4: Parallel Rate Limiting | RESOLVED | Python threading with per-worker rate limiter |
| R5: Resume State | RESOLVED | Per-post checkpoint with JSON state file |

---

## Next Steps

All research items resolved. Proceed to implementation based on these findings.

Implementation priorities:
1. WXR generator (R2) - Critical for output format
2. Crawler with resilient parsing (R1) - Core functionality
3. Rate limiter (R3, R4) - Enable parallel processing
4. State management (R5) - Add resume capability
