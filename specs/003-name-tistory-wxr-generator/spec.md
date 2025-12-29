# Feature Specification: Tistory WXR Generator

**Feature Branch**: `003-name-tistory-wxr-generator`  
**Created**: 2025-12-29  
**Status**: Draft  
**Input**: User requirements from requirements.md

## Clarifications

### Session 2025-12-29

- Q: How should Tistory blog content be retrieved given no official API? → A: Scraping (HTML parsing with fetch requests)
- Q: What parallel processing approach should be used? → A: Worker pool (fixed concurrent workers)
- Q: For rate limiting, what should be the target? → A: 1 req/sec per worker, configurable via env vars
- Q: What Markdown libraries should be used? → A: turndown (HTML to Markdown), marked (Markdown to HTML)
- Q: How should progress be tracked for resume? → A: JSON state file with processed URLs and timestamp

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Post Migration (Priority: P1)

As a user, I want to migrate my Tistory blog posts to WordPress by providing only my Tistory blog URL so that I can quickly switch blogging platforms without manual data entry.

**Why this priority**: This is the core value proposition - enabling users to move their content from Tistory to WordPress with minimal effort. Without this, the entire system has no purpose.

**Independent Test**: Can be fully tested by running the CLI with a Tistory URL and verifying that a valid WXR XML file is generated containing the expected posts, categories, and tags.

**Acceptance Scenarios**:

1. **Given** a valid Tistory blog URL is provided via environment variable, **When** the migration tool is executed, **Then** a WXR XML file is generated containing all published posts with titles, content, publish dates, categories, and tags
2. **Given** a Tistory blog with 50 posts across 10 categories, **When** migration completes, **Then** the WXR file contains exactly 50 posts and 10 categories with correct hierarchy
3. **Given** a Tistory blog with pagination, **When** migration completes, **Then** all posts across all pages are included in the WXR file

---

### User Story 2 - Data Cleaning and Internal Link Tracking (Priority: P2)

As a user, I want my migrated content to be clean (without Tistory-specific HTML/CSS) and be informed about internal links so that I can manually update broken links after import.

**Why this priority**: While not required for basic migration, this ensures content quality and provides awareness of link dependencies, reducing post-import cleanup work.

**Independent Test**: Can be fully tested by migrating a post with Tistory-specific styling and internal links, then verifying the WXR contains clean HTML and link_mapping.json lists all internal links.

**Acceptance Scenarios**:

1. **Given** a post contains Tistory-specific HTML/CSS classes, **When** migration processes the post, **Then** the WXR content has clean HTML without Tistory-specific elements
2. **Given** a post contains links to other posts within the same Tistory blog, **When** migration completes, **Then** link_mapping.json contains entries for each internal link with source and target URLs
3. **Given** a post with complex nested HTML, **When** HTML cleaning process runs, **Then** the content structure is preserved while removing unnecessary styling

---

### User Story 3 - Attachment Handling and Error Resilience (Priority: P3)

As a user, I want attachments downloaded locally and the system to handle errors gracefully so that I can resume migration if interrupted and have all assets available.

**Why this priority**: Enhances robustness and provides a better user experience by preventing total failure and ensuring assets are preserved.

**Independent Test**: Can be fully tested by triggering an error mid-migration (e.g., network failure), then restarting and verifying the migration resumes and completes successfully.

**Acceptance Scenarios**:

1. **Given** a post contains attachments, **When** migration processes the post, **Then** attachments are downloaded to the downloads directory and referenced in the WXR
2. **Given** migration is interrupted after processing 20 of 50 posts, **When** the migration tool is run again, **Then** it resumes from post 21 and completes successfully
3. **Given** a network error occurs while downloading an attachment, **When** the error occurs, **Then** the error is logged and the migration continues without stopping

---

### User Story 4 - Parallel Processing and Performance (Priority: P4)

As a user with a large blog (500+ posts), I want the migration to complete faster by processing posts in parallel so that I don't have to wait excessively long.

**Why this priority**: Improves user experience for power users with large content libraries, making the tool more practical at scale.

**Independent Test**: Can be fully tested by migrating a blog with 100 posts and measuring completion time with and without parallel processing enabled.

**Acceptance Scenarios**:

1. **Given** a blog with 100 posts, **When** migration runs with parallel processing enabled, **Then** completion time is significantly faster than sequential processing
2. **Given** parallel processing is active, **When** multiple posts are processed, **Then** each post's data is independent and does not interfere with others
3. **Given** rate limiting is configured, **When** parallel processing runs, **Then** the crawler respects rate limits regardless of parallelism

---

### Edge Cases

- What happens when the Tistory blog URL is invalid or inaccessible?
- How does system handle posts with no content or empty titles?
- What happens when a post has malformed HTML that cannot be cleaned?
- How does system handle duplicate posts with the same URL?
- What happens when Tistory rate limits or blocks the crawler?
- How does system handle posts with special characters in titles or content?
- What happens when downloads directory doesn't exist or has permission issues?
- How does system handle extremely long blog posts (e.g., 50,000+ characters)?
- What happens when Tistory blog structure changes (e.g., new DOM layout)?
- How does system handle posts with non-standard date formats?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept Tistory blog URL via environment variable (TISTORY_BLOG_URL)
- **FR-002**: System MUST support configurable worker count via environment variable (WORKER_COUNT, default: 4)
- **FR-003**: System MUST support configurable rate limit per worker via environment variable (RATE_LIMIT_PER_WORKER, default: 1 req/sec)
- **FR-004**: System MUST crawl all published posts from the Tistory blog
- **FR-005**: System MUST handle pagination to collect all posts across all pages
- **FR-006**: System MUST parse each post's details including title, content, publish date, modified date, URL, categories (with hierarchy), tags, images (URL, alt text), and attachments (URL, filename)
- **FR-007**: System MUST implement a per-post processing pipeline (crawl → clean → transform) instead of batch processing
- **FR-008**: System MUST support parallel processing of multiple posts using a worker pool with configurable concurrent workers via environment variable (default: 4 workers)
- **FR-009**: System MUST convert HTML content to Markdown (using turndown) and back to HTML (using marked) to remove unnecessary HTML/CSS structure
- **FR-010**: System MUST remove Tistory-specific HTML/CSS structures while preserving content
- **FR-011**: System MUST identify internal links (links referencing the same Tistory blog URL)
- **FR-012**: System MUST generate link_mapping.json file listing all internal links with source and target URLs
- **FR-013**: System MUST download attachments locally to the downloads directory
- **FR-014**: System MUST preserve image URLs in the WXR (WordPress Importer will fetch images automatically)
- **FR-015**: System MUST generate WordPress Importer plugin compatible WXR XML file
- **FR-016**: System MUST include posts, categories, and tags in the WXR file
- **FR-017**: System MUST implement rate limiting for crawling operations at 1 request per second per worker, configurable via environment variable
- **FR-018**: System MUST log all errors with sufficient detail for debugging
- **FR-019**: System MUST support resuming migration from the last successful post by tracking progress in a JSON state file (processed post URLs, last checkpoint timestamp)
- **FR-020**: System MUST be implemented in TypeScript
- **FR-003**: System MUST handle pagination to collect all posts across all pages
- **FR-004**: System MUST parse each post's details including title, content, publish date, modified date, URL, categories (with hierarchy), tags, images (URL, alt text), and attachments (URL, filename)
- **FR-005**: System MUST implement a per-post processing pipeline (crawl → clean → transform) instead of batch processing
- **FR-006**: System MUST support parallel processing of multiple posts using a worker pool with configurable concurrent workers via environment variable (default: 4 workers)
- **FR-007**: System MUST convert HTML content to Markdown and back to HTML to remove unnecessary HTML/CSS structure
- **FR-008**: System MUST remove Tistory-specific HTML/CSS structures while preserving content
- **FR-009**: System MUST identify internal links (links referencing the same Tistory blog URL)
- **FR-010**: System MUST generate link_mapping.json file listing all internal links with source and target URLs
- **FR-011**: System MUST download attachments locally to the downloads directory
- **FR-012**: System MUST preserve image URLs in the WXR (WordPress Importer will fetch images automatically)
- **FR-013**: System MUST generate WordPress Importer plugin compatible WXR XML file
- **FR-014**: System MUST include posts, categories, and tags in the WXR file
- **FR-015**: System MUST implement rate limiting for crawling operations at 1 request per second per worker, configurable via environment variable
- **FR-016**: System MUST log all errors with sufficient detail for debugging
- **FR-017**: System MUST support resuming migration from the last successful post
- **FR-018**: System MUST be implemented in TypeScript

### Key Entities

- **Post**: Represents a single blog post with attributes: title, content, publish_date, modified_date, url, categories, tags, images, attachments
- **Category**: Represents a blog category with attributes: name, parent (for hierarchy), posts
- **Tag**: Represents a blog tag with attributes: name, posts
- **Attachment**: Represents a file attachment with attributes: url, filename, local_path
- **InternalLink**: Represents a link to another post within the same blog with attributes: source_url, target_url

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully migrate a complete Tistory blog (all posts, categories, tags) by providing only the blog URL
- **SC-002**: Generated WXR files are valid XML and can be imported by WordPress Importer plugin without errors
- **SC-003**: All post data (title, content, dates, categories, tags) is accurately preserved in the WXR file with 100% data integrity
- **SC-004**: Internal link mapping in link_mapping.json accurately identifies 95%+ of internal links within posts
- **SC-005**: HTML cleaning removes Tistory-specific elements while preserving 99%+ of visible content
- **SC-006**: System can handle blogs with 500+ posts without memory issues or crashes
- **SC-007**: Migration can be resumed from interruption with correct progress tracking
- **SC-008**: Error logs provide sufficient information to identify and resolve 90%+ of failure cases
- **SC-009**: Parallel processing reduces migration time by 40%+ for blogs with 100+ posts (when feasible)
