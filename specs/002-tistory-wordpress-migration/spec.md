# Feature Specification: Tistory to WordPress Migration

**Feature Branch**: `002-tistory-wordpress-migration`  
**Created**: 2025-12-28  
**Status**: Draft  
**Input**: Tistory 블로그 게시글을 WordPress import 가능한 WXR 파일로 변환

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crawl Tistory Blog Posts (Priority: P1)

User wants to migrate their Tistory blog to WordPress by extracting all blog posts including titles, content, publication dates, categories, and tags.

**Why this priority**: This is the core functionality - without crawling posts, no migration can occur. This represents the minimum viable product that delivers immediate value by enabling users to export their Tistory content.

**Independent Test**: Can be fully tested by providing a Tistory blog URL and verifying that all posts are extracted with correct metadata and stored in JSON format.

**Acceptance Scenarios**:

1. **Given** a valid Tistory blog URL, **When** the crawler runs, **Then** all posts from all pages are extracted with title, content, creation date, modification date, URL, categories, and tags
2. **Given** a blog with multiple pages, **When** the crawler encounters pagination, **Then** it automatically follows all pagination links until all posts are collected
3. **Given** a post with images and attachments, **When** parsed, **Then** image URLs and attachment URLs with filenames are extracted

---

### User Story 2 - Clean and Normalize Content (Priority: P1)

User wants to remove Tistory-specific HTML/CSS elements to produce clean, generic content suitable for WordPress import.

**Why this priority**: Tistory uses blog-specific CSS and HTML structure that WordPress cannot understand. Cleaning this data is essential for successful migration. This can be tested independently by processing raw HTML and verifying output contains only semantic content. And Tistory includes many unnecessary HTML tags, styles, and classes that need to be removed to leave only pure content.

**Independent Test**: Can be tested by taking raw Tistory post HTML, running the cleaner, and verifying Tistory-specific classes/styles are removed while preserving content.

**Acceptance Scenarios**:

1. **Given** raw Tistory HTML with blog-specific CSS classes, **When** the cleaner processes it, **Then** Tistory-specific classes and inline styles are removed
2. **Given** post content with embedded images, **When** cleaned, **Then** image elements are preserved with alt text
3. **Given** post with internal Tistory links, **When** cleaned, **Then** internal links are preserved and identified for later mapping

---

### User Story 3 - Generate WordPress WXR File (Priority: P1)

User wants to import their cleaned Tistory content into WordPress using the standard WordPress Importer plugin.

**Why this priority**: The WXR (WordPress eXtended RSS) file is the required input format for WordPress Importer. This is the final output that delivers value to users. Can be tested independently by importing generated WXR into WordPress and verifying posts appear correctly.

**Independent Test**: Can be tested by generating a WXR file from processed data and importing it into a test WordPress instance to verify all posts, categories, and tags are created correctly.

**Acceptance Scenarios**:

1. **Given** processed post data with metadata, **When** WXR generator runs, **Then** it creates a valid WXR XML file with all posts, categories, and tags
2. **Given** a post with publication date, **When** WXR is generated, **Then** the WordPress post_date field matches the Tistory publication date
3. **Given** categories and tags from Tistory, **When** WXR is generated, **Then** WordPress category and tag elements are created with correct hierarchy

---

### User Story 4 - Track Internal Links (Priority: P2)

User wants to identify which posts contain links to other Tistory posts so they can update links after migration.

**Why this priority**: Internal link mapping is important for maintaining SEO and user experience after migration, but it's not blocking for initial migration. Users can manually update links if needed. This can be tested independently by checking that link_mapping.json is created with correct mappings.

**Independent Test**: Can be tested by scanning posts for internal links and verifying link_mapping.json contains all identified mappings.

**Acceptance Scenarios**:

1. **Given** posts containing links to other Tistory posts, **When** the link tracker runs, **Then** all internal Tistory URLs are identified and recorded in link_mapping.json
2. **Given** a post with multiple internal links, **When** tracked, **Then** the mapping includes source post and target post for each link

---

### User Story 5 - Download Attachment Files (Priority: P2)

User wants to download attachments from Tistory to local storage for manual upload to WordPress later.
Wordpress importer plugin can handle image URLs in WXR file. So downloading images is not necessary for migration.
Not image. Just attachments.

**Why this priority**: Downloading attachments is important for complete migration. This can be tested independently by verifying files are downloaded to correct locations.

**Independent Test**: Can be tested by providing a list of attachment URLs and verifying files are downloaded to the downloads directory with correct filenames.

**Acceptance Scenarios**:

1. **Given** post with attachment URLs, **When** the downloader runs, **Then** all attachments are downloaded to the downloads directory
2. **Given** an attachment URL, **When** downloaded, **Then** the file is saved with the original filename from the URL

---

### User Story 6 - Error Handling and Logging (Priority: P2)

User wants the migration tool to handle errors gracefully and provide detailed logs for troubleshooting.

**Why this priority**: Robust error handling prevents migration from failing completely due to individual post errors. This can be tested independently by simulating various error conditions and verifying proper logging.

**Independent Test**: Can be tested by introducing network errors, malformed HTML, and missing files, then verifying logs capture errors and migration continues.

**Acceptance Scenarios**:

1. **Given** a post that fails to parse, **When** an error occurs, **Then** the error is logged and processing continues with the next post
2. **Given** network timeout during crawling, **When** an error occurs, **Then** the tool retries up to a configurable number of times before logging the failure

---

### User Story 7 - Parallel Processing (Priority: P3)

User wants to speed up migration by processing posts in parallel rather than sequentially.

**Why this priority**: Performance optimization that reduces migration time for blogs with many posts, but not required for basic functionality. This can be tested independently by comparing sequential vs parallel execution times.

**Independent Test**: Can be tested by running migration with different thread counts and measuring performance improvement.

**Acceptance Scenarios**:

1. **Given** a blog with 100 posts, **When** processing with 4 parallel workers, **Then** total processing time is significantly less than sequential processing
2. **Given** parallel processing enabled, **When** complete, **Then** all posts are processed correctly without data corruption

---

### User Story 8 - Rate Limiting (Priority: P3)

User wants to respect Tistory's server load by limiting the rate of HTTP requests.

**Why this priority**: Prevents IP blocking or rate limiting from Tistory servers, especially for large blogs. This can be tested independently by monitoring request timing.

**Independent Test**: Can be tested by verifying requests are spaced according to configured rate limit.

**Acceptance Scenarios**:

1. **Given** rate limiting configured to 1 request per second, **When** crawling multiple posts, **Then** requests are spaced at least 1 second apart
2. **Given** rate limiting is set, **When** tool runs, **Then** no Tistory rate limit errors occur

---

### Edge Cases

- What happens when Tistory blog URL is invalid or returns 404? System should log error and exit with clear message
- How does system handle blog with zero posts? Should complete gracefully with empty WXR file
- How does system handle posts with malformed HTML or missing metadata? System should use resilient parsing to extract whatever content is available; parsing failures should not occur by design
- What happens when attachment download fails (404, network error)? Log error, continue processing other attachments
- How does system handle very large blogs (1000+ posts)? Use memory-efficient processing with immediate WXR writes
- What happens when Tistory structure changes (site redesign)? System should extract maximum pure data regardless of theme/skin structure
- How does system handle Unicode or special characters in post content? Preserve all Unicode characters in WXR output
- What happens when WordPress import fails due to WXR validation errors? User must debug; system logs all processing steps
- How does system handle authentication requirements for private Tistory blogs? Out of scope - public blogs only
- What happens when disk space runs out during file downloads? Log error, gracefully exit, allow resume with --resume flag

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST crawl all posts from a Tistory blog URL by following pagination
- **FR-002**: System MUST extract post metadata including title, content, creation date, modification date, URL, categories, and tags
- **FR-003**: System MUST extract image URLs with alt text and attachment URLs with filenames from posts
- **FR-004**: System MUST process posts by adding each processed post to WXR document immediately (maintain in memory) rather than batch processing
- **FR-005**: System MUST support parallel processing using Python threading with 5 default workers (configurable via environment variable)
- **FR-006**: System MUST remove Tistory-specific HTML/CSS classes and inline styles from post content
- **FR-007**: System MUST preserve semantic content structure (headings, paragraphs, lists, links) during cleaning
- **FR-008**: System MUST identify internal Tistory links (links to same blog) in post content
- **FR-009**: System MUST record internal link mappings in link_mapping.json file
- **FR-010**: System MUST download attachments to local downloads directory
- **FR-011**: System MUST generate WordPress Importer-compatible WXR XML file
- **FR-012**: System MUST include posts, categories, and tags in WXR file with correct hierarchy
- **FR-013**: System MUST accept Tistory blog URL via .env file environment variable
- **FR-014**: System MUST log errors and provide detailed error messages
- **FR-015**: System MUST support single command execution with progress display, resuming from interruption by tracking processed posts, and skipping failed posts with detailed error logging
- **FR-016**: System MUST implement rate limiting for HTTP requests to Tistory with default 1 request per second (configurable via environment variable), applied per thread worker
- **FR-017**: System MUST handle large volumes of posts (1000+) without memory issues by extracting maximum pure data content regardless of Tistory theme/skin structure
- **FR-018**: System MUST be designed to prevent parsing failures by using resilient HTML parsing strategies that extract content from any valid HTML structure

### Out of Scope

- **FR-001-EXCLUDE**: Comment migration is NOT included
- **FR-002-EXCLUDE**: Automatic file upload to WordPress is NOT included (files are downloaded locally only)
- **FR-003-EXCLUDE**: Automatic internal link rewriting in WXR is NOT included (mapping file provided for manual updates)
- **FR-004-EXCLUDE**: Automatic WXR import into WordPress is NOT included (user manually imports via WordPress Importer plugin)
- **FR-005-EXCLUDE**: Category/tag hierarchy preservation beyond flat structure is NOT included (all categories/tags are flat, just text)

### Key Entities

- **TistoryPost**: Represents a single blog post with metadata (title, content, creation_date, modification_date, url, categories, tags, images, attachments)
- **InternalLink**: Represents a link from one Tistory post to another (source_post_url, target_post_url)
- **MediaFile**: Represents an attachment (url, filename, local_path)
- **WXRDocument**: WordPress eXtended RSS document containing posts, categories, and tags

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can successfully crawl all posts from a Tistory blog URL with 100% post extraction accuracy
- **SC-002**: Generated WXR file can be imported into WordPress Importer plugin without validation errors
- **SC-003**: All imported WordPress posts contain correct titles, content, and metadata matching Tistory source
- **SC-004**: Cleaning process removes all Tistory-specific HTML tags, CSS classes and unnecessary elements while preserving 100% of semantic content
- **SC-005**: link_mapping.json contains 100% of internal Tistory links identified in all posts
- **SC-006**: Downloaded attachment files have matching filenames and are accessible in downloads directory
- **SC-007**: Tool can process 100+ posts within 10 minutes with parallel processing enabled
- **SC-008**: Error logging captures 100% of failures with sufficient detail for troubleshooting
- **SC-009**: Rate limiting prevents all Tistory server rate limit errors during migration
- **SC-010**: User can complete full migration workflow (crawl → clean → generate WXR) in under 30 minutes for typical blog (50-100 posts)
