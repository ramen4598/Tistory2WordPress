# Feature Specification: CLI Help Option & Tistory Bookmark Handling

**Feature Branch**: `007-cli-help-option`  
**Created**: 2026-01-06  
**Status**: Clarified  
**Input**: User description: "Add CLI help option and Tistory bookmark handling feature. Includes --help/-h CLI option to display tool usage and handle Tistory bookmarks during HTML to Markdown conversion with configurable CSS selectors and metadata fetching."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - CLI Help Option (Priority: P1)

Users want to quickly understand how to use the Tistory2Wordpress tool without reading documentation. They should be able to run the tool with a `--help` or `-h` flag to see usage instructions, available options, and brief explanations.

**Why this priority**: This is a fundamental usability feature. Users cannot effectively use the tool without understanding its options. It's independent of the bookmark handling logic and provides immediate value to all users.

**Independent Test**: Can be fully tested by running `tistory2wp --help` or `tistory2wp -h` and verifying that:

- The help message is displayed
- All command line options are listed
- The program exits without performing migration
- The message includes tool description and option explanations

**Acceptance Scenarios**:

1. **Given** user runs `tistory2wp --help`, **When** the command executes, **Then** the tool displays a help message containing tool description, list of options, and explanations, then exits without migration
2. **Given** user runs `tistory2wp -h`, **When** the command executes, **Then** the tool displays the same help message as `--help`, then exits without migration
3. **Given** user runs `tistory2wp --help --config config.json`, **When** the command executes, **Then** the help message is displayed and the tool exits without processing the config file
4. **Given** user runs `tistory2wp --help`, **When** the help message is displayed, **Then** the exit code is 0

---

### User Story 2 - Tistory Bookmark Handling (Priority: P2)

Users want Tistory bookmarks (website previews/og:type=website) to be properly converted when migrating from Tistory to WordPress. The tool should detect bookmarks, fetch metadata, and convert them to an appropriate HTML structure.

**Why this priority**: This is an important feature for preserving the richness of Tistory content. Without it, bookmarks lose their preview functionality. However, it's not blocking basic migration, so P2 is appropriate.

**Independent Test**: Can be fully tested by processing a Tistory post with bookmarks using the bookmark handling enabled and verifying that:

- Bookmarks are detected using the configured CSS selector
- Metadata (title, description, featured image) is fetched from URLs
- Original bookmark HTML is replaced with custom HTML structure
- Bookmark featured images are not processed by the image processor
- The converted post maintains bookmark functionality

**Acceptance Scenarios**:

1. **Given** a Tistory post contains a bookmark element with CSS selector `figure[data-ke-type="opengraph"] a`, **When** the post is processed, **Then** the URL is extracted, metadata is fetched, and the element is replaced with custom HTML structure containing the metadata
2. **Given** the CSS selector is configured in `.env` file, **When** processing begins, **Then** the tool uses the configured selector from `.env` to detect bookmarks
3. **Given** a bookmark URL returns metadata, **When** the metadata is fetched, **Then** the custom HTML includes title, description, and featured image URL
4. **Given** a bookmark element contains a featured image, **When** the image processor runs, **Then** the featured image is ignored (not downloaded/processed) because its parent is a figure element
5. **Given** a bookmark URL is unreachable or returns no metadata, **When** the metadata fetch fails, **Then** the bookmark is either preserved with original structure or replaced with a fallback (graceful degradation)
6. **Given** bookmark handling is disabled or no bookmarks are found, **When** the post is processed, **Then** the conversion proceeds normally without bookmark-related changes

---

### Edge Cases

- What happens when the bookmark CSS selector in `.env` is malformed or invalid?
  - System should use default selector `figure[data-ke-type="opengraph"] a`
- How does system handle bookmark URLs that are HTTP (not HTTPS)?
  - System should still attempt to fetch metadata, log warning about insecure HTTP
- How does system handle bookmark metadata fetch timeouts or network errors?
  - System should log error, skip metadata fetch, preserve original bookmark structure
- What happens when the bookmark URL redirects to a different URL?
  - System should follow redirects (up to 5 hops) to fetch metadata
- How does system handle bookmark URLs that return 4xx/5xx HTTP status codes?
  - System should log error, skip metadata fetch, preserve original bookmark structure
- What happens when metadata is missing some fields (e.g., no description)?
  - System should render bookmark card with available fields, omitting missing ones
- How does system handle duplicate bookmarks in the same post?
  - System should fetch metadata for each occurrence (no caching)
- What happens when the bookmark featured image URL is malformed?
  - System should omit featured image from bookmark card, log warning
- How does system handle encoding issues in fetched metadata?
  - System should sanitize and normalize metadata, replace invalid characters

## Requirements _(mandatory)_

### Functional Requirements

#### CLI Help Option Requirements

- **FR-001**: System MUST support `--help` command line option to display help message
- **FR-002**: System MUST support `-h` command line option as shorthand for `--help`
- **FR-003**: System MUST display tool description in help message
- **FR-004**: System MUST display list of all available command line options in help message
- **FR-005**: System MUST display brief explanation for each command line option in help message
- **FR-006**: System MUST exit with code 0 after displaying help message
- **FR-007**: System MUST NOT perform any migration operations when help option is provided
- **FR-008**: System MUST parse help option before processing other arguments

#### Tistory Bookmark Handling Requirements

- **FR-009**: System MUST detect bookmark elements using configurable CSS selector from `.env` file
- **FR-010**: System MUST use default CSS selector `figure[data-ke-type="opengraph"] a` if not configured in `.env`
- **FR-011**: System MUST extract URL from bookmark anchor tag
- **FR-012**: System MUST fetch metadata from bookmark URL (title, description, featured image URL)
- **FR-013**: System MUST replace original bookmark HTML with custom HTML structure
- **FR-014**: Custom HTML structure MUST include fetched metadata (title, description, featured image)
- **FR-015**: System MUST ignore images inside bookmark figure elements during image processing
- **FR-016**: System MUST handle metadata fetch failures gracefully with robust exception handling
- **FR-017**: System MUST preserve bookmark functionality even when partial metadata is missing or metadata fetch fails completely
- **FR-018**: System MUST apply bookmark handling during HTML to Markdown conversion phase
- **FR-019**: Custom HTML structure MUST be a card component with title, description, and featured image
- **FR-020**: Custom HTML template MUST be managed in a separate file for easy modification
- **FR-021**: System MUST support template variables for title, description, featured image URL, and original URL
- **FR-022**: System MUST NOT cache bookmark metadata (always fetch fresh metadata from URLs)
- **FR-023**: System MUST use 10 second timeout for metadata fetch operations

### Key Entities

- **Bookmark**: Represents a Tistory bookmark with URL, title, description, and featured image metadata
- **BookmarkMetadata**: Fetched metadata from bookmark URL including title, description, image URL, and other OpenGraph properties
- **BookmarkHTML**: Custom HTML structure for rendering bookmarks in WordPress
- **BookmarkTemplate**: HTML template file with placeholder variables for rendering bookmark cards

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can display help message using `--help` or `-h` in under 1 second
- **SC-002**: Help message includes all available CLI options with descriptions
- **SC-003**: Bookmarks are correctly detected with 95%+ accuracy using configured CSS selector
- **SC-004**: Metadata is successfully fetched from 95%+ of bookmark URLs
- **SC-005**: Bookmark featured images are ignored by image processor with 100% accuracy
- **SC-006**: Tool exits gracefully when bookmark metadata fetch fails (per-post exception handling, not entire migration)
- **SC-007**: Total migration time increases by less than 20% when bookmark handling is enabled
- **SC-008**: Custom bookmark HTML renders correctly in WordPress with all metadata fields
