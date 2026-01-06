# Implementation Tasks

**Feature**: 007-cli-help-option - CLI Help Option & Tistory Bookmark Handling
**Branch**: `007-cli-help-option`
**Date**: 2026-01-06
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document contains actionable, dependency-ordered tasks for implementing CLI help option and Tistory bookmark handling features. Tasks are organized by user story and include acceptance criteria and test requirements.

## Task Legend

- **[PARALLEL]**: Can be executed in parallel with other tasks in same section
- **[DEPENDS: X]**: Depends on task X (X must be completed first)
- **[TEST]**: Requires test implementation
- **[REVIEW]**: Requires code review before proceeding

---

## User Story 1: CLI Help Option (Priority: P1)

### Task 1.1: Update CLI to Check for Help Flag Early

**Description**: Modify `cli.ts` to check for `--help` or `-h` flag before loading config or initializing database. Display help message and exit with code 0.

**Files**:

- `src/cli.ts`

**Implementation Steps**:

1. Add `hasHelpFlag()` function to check for `--help` or `-h` in argv
2. Call `hasHelpFlag()` at the start of `runCli()` before `loadConfig()`
3. If help flag detected, call `printHelp()` and return exit code 0
4. Update `printUsage()` function to `printHelp()` with comprehensive help message
5. Include tool description, usage, options, and environment variables in help message

**Acceptance Criteria**:

- [x] Help flag checked before config loading
- [x] Help message displayed when `--help` or `-h` present
- [x] Exit code 0 when help displayed
- [x] No migration performed when help displayed
- [x] Help message includes tool description, usage, and options
- [x] All existing CLI options listed in help message

**Tests**:

- [x] Unit test: `hasHelpFlag()` returns true for `--help` and `-h`
- [x] Unit test: `hasHelpFlag()` returns false for other flags
- [x] Integration test: CLI exits with code 0 when `--help` provided
- [x] Integration test: Help message contains expected content
- [x] Integration test: Config not loaded when help flag present

**Dependencies**: None

**Estimated Time**: 1 hour

---

### Task 1.2: Format Help Message Content

**Description**: Enhance help message with tool description, all CLI options, and key environment variables. Ensure formatting is consistent and readable.

**Files**:

- `src/cli.ts`

**Implementation Steps**:

1. Add tool description: "Tistory2Wordpress - Migrate Tistory blog posts to WordPress"
2. Format usage line: "tistory2wp [--post <url> | --all] [--retry-failed] [--export-links]"
3. List all options with both short and long forms
4. Add environment variables section with required variables
5. Group related options for better readability

**Acceptance Criteria**:

- [x] Tool description clear and concise
- [x] Usage syntax shows required vs optional arguments
- [x] Each option has short and long form (e.g., `-h, --help`)
- [x] Options grouped logically (basic, advanced, WordPress, etc.)
- [x] Environment variables include required fields and defaults
- [x] Help message <50 lines (concise)

**Tests**:

- [x] Manual test: Verify help message displays correctly
- [x] Integration test: Help output matches expected format

**Dependencies**: [Task 1.1]

**Estimated Time**: 30 minutes

---

### Task 1.3: Update CLI Tests for Help Option

**Description**: Add unit and integration tests for help option functionality to ensure help flag detection and message display work correctly.

**Files**:

- `tests/unit/cli.test.ts`

**Implementation Steps**:

1. Add test suite for help flag detection
2. Add test for `--help` flag
3. Add test for `-h` short flag
4. Add test that config is not loaded when help present
5. Add test that exit code is 0 for help
6. Add test that help takes precedence over other flags

**Acceptance Criteria**:

- [x] Test coverage >90% for help functionality
- [x] All tests pass
- [x] Edge cases covered (help with other flags)

**Dependencies**: [Task 1.1]

**Estimated Time**: 45 minutes

---

### Task 1.4: Documentation Update

**Description**: Update README or documentation to mention new `--help` option and update example commands to include help usage.

**Files**:

- `README.md` (or create if not exists)

**Implementation Steps**:

1. Add help option to CLI options section
2. Update usage examples to show `--help`
3. Update quick start guide if applicable

**Acceptance Criteria**:

- [x] Help option documented
- [x] Examples include help usage

**Dependencies**: [Task 1.1]

**Estimated Time**: 15 minutes

---

## User Story 2: Tistory Bookmark Handling (Priority: P2)

### Task 2.1: Add Bookmark Configuration

**Description**: Extend configuration system to support bookmark-related settings including CSS selector and template path.

**Files**:

- `src/utils/config.ts`
- `.env.example`

**Implementation Steps**:

1. Add `bookmarkSelector` field to Config interface (default: `figure[data-ke-type="opengraph"]`)
2. Add `bookmarkTemplatePath` field to Config interface (default: `./src/templates/bookmark-template.html`)
3. Update `loadConfig()` to read `TISTORY_BOOKMARK_SELECTOR` from `.env`
4. Add validation for bookmark selector (non-empty, reasonable length)
5. Update `.env.example` with bookmark configuration section
6. Add comment explaining bookmark selector purpose

**Acceptance Criteria**:

- [x] Config includes bookmark selector with default value
- [x] Config includes template path with default value
- [x] Environment variable `TISTORY_BOOKMARK_SELECTOR` loaded from `.env`
- [x] Selector validation prevents empty or malformed values
- [x] `.env.example` documents bookmark configuration
- [x] Default selector: `figure[data-ke-type=\"opengraph\"]`

**Tests**:

- [x] Unit test: Config loads bookmark selector from `.env`
- [x] Unit test: Config uses default selector when not in `.env`
- [x] Unit test: Config validation rejects empty selector
- [x] Unit test: Config validation rejects overly long selector

**Dependencies**: None (can be done in parallel with 2.2)

**Estimated Time**: 1 hour

---

### Task 2.2: Create Bookmark HTML Template

**Description**: Create customizable bookmark card template (implemented as a TypeScript renderer) for title, description, featured image, and URL.

**Files**:

- `src/templates/bookmarkTemplate.ts`
- `tests/unit/templates/bookmarkTemplate.test.ts`

**Implementation Steps**:

1. Implement `renderBookmarkHTML(data: BookmarkTemplateData): string` that returns a `<figure class="bookmark-card">` bookmark card
2. Ensure the entire card is clickable by wrapping image and content inside a single `<a>` with `target="_blank"` and `rel="noopener noreferrer"`
3. Use grid layout on the anchor (`grid-template-columns: 30% 70%`) to position image/content
4. Include optional featured image and description blocks that render only when data is provided
5. Escape user-provided values (title, description, url, featuredImage) for XSS safety
6. Keep all styles inline within `bookmarkTemplate.ts` for easy customization

**Acceptance Criteria**:

- [x] Bookmark template implemented in `bookmarkTemplate.ts` with `renderBookmarkHTML`
- [x] Top-level element is `<figure class="bookmark-card">`
- [x] Entire card is clickable via a single outer `<a>`
- [x] Layout uses grid to place image and content side-by-side
- [x] Optional description and featured image handled gracefully when missing
- [x] User-provided content is HTML-escaped

**Tests**:

- [x] Unit test: Renders figure with title and link
- [x] Unit test: Includes image section when `featuredImage` is provided
- [x] Unit test: Includes description paragraph when `description` is provided

**Dependencies**: None (can be done in parallel with 2.1)

**Estimated Time**: 30 minutes

---

### Task 2.3: Implement Bookmark Metadata Fetcher

**Description**: Create service to fetch OpenGraph metadata from bookmark URLs with 10s timeout, redirect following, and fallback logic.
Use retryWithBackoff.

**Files**:

- `src/models/BookmarkMetadata.ts` (NEW)
- `src/services/bookmarkProcessor.ts` (NEW)

**Implementation Steps**:

1. Create `BookmarkMetadata` interface with fields: title, description, featuredImage, url, fetchedAt, success, error
2. Create `bookmarkProcessor.ts` service with `fetchMetadata()` function
3. Implement HTTP GET with axios, 10s timeout, 5 max redirects with retryWithBackoff
4. Parse HTML response with cheerio to extract OpenGraph meta tags
5. Implement fallbacks: og:title → <title>, og:description → empty, og:image → empty
6. Handle errors gracefully: timeout, 4xx/5xx, network errors -> 북마크와 관련된 에러 전파하지 말것. 실패해도 해당 post migration 계속 진행해야 함. 실패 시 URL만 사용하여 렌더링
7. Log success and failure cases appropriately

**Acceptance Criteria**:

- [ ] BookmarkMetadata interface defined
- [ ] fetchMetadata() function extracts og:title, og:description, og:image, og:url
- [ ] Timeout set to 10 seconds
- [ ] Max redirects set to 5
- [ ] Fallbacks implemented (title from <title>, empty for missing fields)
- [ ] Errors handled with success=false and error message
- [ ] Logging for success and failure cases
- [ ] User-Agent header set to reduce blocking

**Tests**:

- [ ] Unit test: Successfully fetch metadata from URL with all OpenGraph tags
- [ ] Unit test: Use fallbacks when og:title, og:description, og:image missing
- [ ] Unit test: Handle timeout after 10s
- [ ] Unit test: Handle 404, 403, 500 HTTP errors
- [ ] Unit test: Handle network errors (connection refused)
- [ ] Unit test: Follow redirects (1-5 hops)
- [ ] Unit test: Parse HTML with UTF-8 encoding

**Dependencies**: None (can be done in parallel with 2.1, 2.2)

**Estimated Time**: 2 hours

---

### Task 2.4: Implement Bookmark Detection

**Description**: Add logic to detect bookmark elements in HTML using configurable CSS selector and extract bookmark URLs.

**Files**:

- `src/models/Bookmark.ts` (NEW)
- `src/services/bookmarkProcessor.ts`

**Implementation Steps**:

1. Create `Bookmark` interface with fields: originalElement, url, selector, index
2. Add `detectBookmarks(html, selector)` function
3. Use cheerio to parse HTML and find elements matching selector
4. Extract URL from anchor tag within bookmark element
5. Assign index to each bookmark based on position
6. Return array of Bookmark objects
7. Log number of bookmarks detected

**Acceptance Criteria**:

- [ ] Bookmark interface defined
- [ ] detectBookmarks() uses configured CSS selector
- [ ] URLs extracted from anchor tags within matched elements
- [ ] Each bookmark assigned correct index (0-based)
- [ ] Returns empty array if no bookmarks found
- [ ] Logs number of bookmarks detected

**Tests**:

- [ ] Unit test: Detect bookmarks with correct CSS selector
- [ ] Unit test: Extract URL from anchor tag
- [ ] Unit test: Assign correct index to each bookmark
- [ ] Unit test: Return empty array for HTML without bookmarks
- [ ] Unit test: Handle multiple bookmarks in same HTML

**Dependencies**: [Task 2.1] (needs config)

**Estimated Time**: 1 hour

---

### Task 2.5: Implement Bookmark HTML Replacement

**Description**: Add logic to load HTML template, replace placeholder variables with metadata, and replace original bookmark HTML in content.

**Files**:

- `src/services/bookmarkProcessor.ts`

**Implementation Steps**:

1. Add `loadTemplate()` function to read template file from disk
2. Cache template content (load once at service initialization)
3. Add `renderBookmark(metadata, template)` function
4. Replace `{{title}}`, `{{description}}`, `{{featuredImage}}`, `{{url}}` with metadata
5. Handle conditional `{{#if}}` blocks (remove section if field empty)
6. Escape HTML in metadata fields (title, description) for XSS prevention
7. Update HTML content by replacing each bookmark element with rendered HTML

**Acceptance Criteria**:

- [ ] Template file loaded once at service initialization
- [ ] Placeholder variables replaced with metadata values
- [ ] Conditional blocks removed when field is empty
- [ ] HTML escaped in title and description fields
- [ ] Original bookmark elements replaced with rendered HTML
- [ ] Returns updated HTML content

**Tests**:

- [ ] Unit test: Template loads successfully from file
- [ ] Unit test: Placeholder variables replaced correctly
- [ ] Unit test: Conditional blocks handled for empty fields
- [ ] Unit test: HTML escaping prevents XSS
- [ ] Unit test: Original HTML replaced with rendered bookmark
- [ ] Unit test: Multiple bookmarks replaced correctly

**Dependencies**: [Task 2.2], [Task 2.3], [Task 2.4]

**Estimated Time**: 1.5 hours

---

### Task 2.6: Integrate Bookmark Processor into Cleaner

**Description**: Modify Cleaner service to call BookmarkProcessor during HTML cleaning phase, detecting and replacing bookmarks before markdown conversion.

**Files**:

- `src/services/cleaner.ts`

**Implementation Steps**:

1. Import createBookmarkProcessor from bookmarkProcessor
2. Create bookmarkProcessor instance in createCleaner()
3. In cleanHtml(), after extracting content root HTML
4. Call bookmarkProcessor.detectBookmarks() on content
5. For each bookmark, call fetchMetadata()
6. Call bookmarkProcessor.renderBookmark() for each successful fetch
7. Replace original bookmark HTML with rendered bookmark
8. Continue with existing markdown conversion logic

**Acceptance Criteria**:

- [ ] Bookmark processor integrated into cleaner workflow
- [ ] Bookmarks detected and processed before markdown conversion
- [ ] Metadata fetched for each bookmark
- [ ] Bookmarks replaced with custom HTML
- [ ] Original workflow (HTML → MD → HTML) maintained
- [ ] Failure handling: bookmark rendered using URL only if metadata fetch fails

**Tests**:

- [ ] Integration test: Cleaner processes bookmarks correctly
- [ ] Integration test: Cleaner handles bookmark metadata fetch failures
- [ ] Integration test: Cleaner continues after bookmark processing

**Dependencies**: [Task 2.5]

**Estimated Time**: 1 hour

---

### Task 2.7: Modify Image Processor to Skip Bookmark Featured Images

**Description**: Update ImageProcessor to check parent elements and skip images that are inside bookmark figure elements.

**Files**:

- `src/services/imageProcessor.ts`

**Implementation Steps**:

1. Import config to get bookmark selector
2. In processImgs(), before processing each image
3. Use cheerio's `img.closest(bookmarkSelector)` to check if parent is bookmark
4. Skip image if parent matches bookmark selector
5. Log skip: "Skipping bookmark featured image (parent: {selector})"
6. Continue processing non-bookmark images

**Acceptance Criteria**:

- [ ] Image processor checks parent element for each image
- [ ] Bookmark featured images detected using configured selector
- [ ] Bookmark featured images skipped (not downloaded/uploaded)
- [ ] Non-bookmark images processed normally
- [ ] Skip logged with appropriate message

**Tests**:

- [ ] Unit test: Skip image when parent matches bookmark selector
- [ ] Unit test: Process image when parent doesn't match
- [ ] Unit test: Handle multiple images (mix of bookmark and non-bookmark)
- [ ] Integration test: Bookmark featured images not uploaded to WordPress

**Dependencies**: [Task 2.1] (needs bookmark selector in config)

**Estimated Time**: 45 minutes

---

### Task 2.8: Add Bookmark Processor Unit Tests

**Description**: Create comprehensive unit tests for BookmarkProcessor including detection, metadata fetching, template rendering, and error handling.

**Files**:

- `tests/unit/services/bookmarkProcessor.test.ts` (NEW)

**Implementation Steps**:

1. Create test file for bookmarkProcessor
2. Add tests for detectBookmarks() with various HTML inputs
3. Add tests for fetchMetadata() with mock HTTP responses
4. Add tests for template loading and rendering
5. Add tests for HTML escaping and XSS prevention
6. Add tests for error scenarios (timeout, HTTP errors, invalid HTML)
7. Add tests for conditional blocks in template

**Acceptance Criteria**:

- [ ] Test coverage >90% for BookmarkProcessor
- [ ] All tests pass
- [ ] Happy path and error cases covered
- [ ] Mock HTTP responses for metadata fetch tests
- [ ] XSS prevention tested with malicious input

**Dependencies**: [Task 2.5]

**Estimated Time**: 2 hours

---

### Task 2.9: Update Cleaner Tests for Bookmark Integration

**Description**: Add integration tests to Cleaner to ensure bookmarks are processed correctly during the HTML cleaning workflow.

**Files**:

- `tests/unit/services/cleaner.test.ts`

**Implementation Steps**:

1. Add test case for HTML with bookmark elements
2. Mock bookmark processor to return known metadata
3. Verify bookmarks are replaced with custom HTML
4. Add test case for HTML without bookmarks (no changes)
5. Add test case for bookmark metadata fetch failure
6. Verify bookmark rendered using URL only on failure

**Acceptance Criteria**:

- [ ] Cleaner correctly integrates bookmark processor
- [ ] Bookmarks replaced with expected HTML
- [ ] Cleaner handles bookmark processing failures gracefully
- [ ] Existing cleaner tests still pass

**Dependencies**: [Task 2.6]

**Estimated Time**: 1 hour

---

### Task 2.10: Update Image Processor Tests for Bookmark Filtering

**Description**: Add tests to ImageProcessor to ensure bookmark featured images are correctly skipped while other images are processed.

**Files**:

- `tests/unit/services/imageProcessor.test.ts`

**Implementation Steps**:

1. Add test case for HTML with bookmark featured images
2. Verify bookmark featured images are skipped (not uploaded)
3. Add test case for HTML with mix of bookmark and regular images
4. Verify regular images uploaded, bookmark featured images skipped
5. Add test case for HTML without bookmarks
6. Verify all images processed normally

**Acceptance Criteria**:

- [ ] Bookmark featured images skipped correctly
- [ ] Non-bookmark images processed normally
- [ ] Mix of bookmark and regular images handled correctly
- [ ] Existing image processor tests still pass

**Dependencies**: [Task 2.7]

**Estimated Time**: 45 minutes

---

## Cross-Feature Tasks

### Task 3.1: Full Integration Test

**Description**: Create end-to-end integration test that simulates complete migration workflow with help option and bookmark handling.

**Files**:

- `tests/integration/cli-integration.test.ts` (NEW)

**Implementation Steps**:

1. Create integration test file
2. Test help option: run CLI with --help, verify output and exit code
3. Test migration with bookmarks: run CLI with post containing bookmarks
4. Verify bookmarks detected, metadata fetched, and HTML replaced
5. Verify bookmark featured images not uploaded
6. Test migration without bookmarks: verify normal processing
7. Test help with other flags: verify help takes precedence

**Acceptance Criteria**:

- [ ] Help option integration test passes
- [ ] Bookmark handling integration test passes
- [ ] Combined workflow test passes
- [ ] All edge cases covered

**Dependencies**: [Task 1.1], [Task 2.6], [Task 2.7]

**Estimated Time**: 2 hours

---

### Task 3.2: Performance Testing

**Description**: Run performance tests to ensure bookmark processing doesn't exceed 20% migration overhead and metadata fetches complete within expected timeframes.

**Files**:

- `tests/performance/bookmark-performance.test.ts` (NEW)

**Implementation Steps**:

1. Create performance test file
2. Measure time to migrate post with 5 bookmarks
3. Measure time to migrate post without bookmarks
4. Calculate overhead percentage
5. Verify overhead <20%
6. Measure individual metadata fetch times
7. Verify 95% of fetches <5s, all <10s

**Acceptance Criteria**:

- [ ] Migration overhead <20%
- [ ] Metadata fetch times meet targets
- [ ] Performance tests automated and repeatable

**Dependencies**: [Task 2.6]

**Estimated Time**: 1.5 hours

---

### Task 3.3: Code Review and Refinement

**Description**: Conduct comprehensive code review of all changes, refactor for consistency, and ensure code follows project conventions.

**Files**: All modified and new files

**Implementation Steps**:

1. Review all new code for consistency with existing patterns
2. Check naming conventions (camelCase, PascalCase)
3. Ensure proper error handling and logging
4. Verify TypeScript types are correct
5. Add missing comments where needed
6. Refactor for better code organization
7. Run linter and fix issues
8. Run type checker and fix issues

**Acceptance Criteria**:

- [ ] Code review completed
- [ ] Linting passes (npm run lint)
- [ ] Type checking passes (npm run typecheck)
- [ ] Code follows project conventions
- [ ] No obvious bugs or issues

**Dependencies**: All implementation tasks

**Estimated Time**: 2 hours

---

### Task 3.4: Documentation Updates

**Description**: Update project documentation including README, API docs (if applicable), and inline code comments to reflect new features.

**Files**: Documentation files

**Implementation Steps**:

1. Update README with help option and bookmark handling sections
2. Update CHANGELOG or release notes
3. Add inline comments to complex code sections
4. Update any architecture or design docs
5. Verify all documentation is accurate

**Acceptance Criteria**:

- [ ] README updated with new features
- [ ] Documentation is clear and accurate
- [ ] Inline comments explain complex logic
- [ ] No outdated information in docs

**Dependencies**: [Task 3.3]

**Estimated Time**: 1 hour

---

## Task Summary

### by User Story

**User Story 1: CLI Help Option**

- Tasks 1.1-1.4 (4 tasks)
- Estimated: 2.5 hours

**User Story 2: Tistory Bookmark Handling**

- Tasks 2.1-2.10 (10 tasks)
- Estimated: 12 hours

**Cross-Feature Tasks**

- Tasks 3.1-3.4 (4 tasks)
- Estimated: 6.5 hours

**Total**: 18 tasks, ~21 hours

### Parallel Execution Opportunities

**Phase 1: Foundation**

- [PARALLEL] Task 1.1 (Help flag detection)
- [PARALLEL] Task 2.1 (Bookmark config)
- [PARALLEL] Task 2.2 (Bookmark template)
- [PARALLEL] Task 2.3 (Metadata fetcher)
- [PARALLEL] Task 2.4 (Bookmark detection)

**Phase 2: Integration**

- [DEPENDS: 1.1] Task 1.2 (Help message format)
- [DEPENDS: 1.1] Task 1.3 (Help tests)
- [DEPENDS: 2.1, 2.2, 2.3, 2.4] Task 2.5 (Bookmark replacement)
- [DEPENDS: 2.1] Task 2.7 (Image processor filter)

**Phase 3: Testing**

- [DEPENDS: 2.5] Task 2.6 (Cleaner integration)
- [DEPENDS: 2.5] Task 2.8 (Bookmark tests)
- [DEPENDS: 2.6] Task 2.9 (Cleaner tests)
- [DEPENDS: 2.7] Task 2.10 (Image processor tests)

**Phase 4: Finalization**

- [DEPENDS: 1.1, 2.6, 2.7] Task 3.1 (Integration tests)
- [DEPENDS: 2.6] Task 3.2 (Performance tests)
- [DEPENDS: All] Task 3.3 (Code review)
- [DEPENDS: 3.3] Task 3.4 (Documentation)

---

## Success Criteria Verification

Before marking implementation complete, verify:

- [ ] SC-001: Users can display help message in under 1 second
- [ ] SC-002: Help message includes all available CLI options
- [ ] SC-003: Bookmarks detected with 95%+ accuracy
- [ ] SC-004: Metadata fetched from 95%+ of bookmark URLs
- [ ] SC-005: Bookmark featured images ignored by image processor (100% accuracy)
- [ ] SC-006: Tool exits gracefully when bookmark metadata fetch fails
- [ ] SC-007: Migration time increases by <20%
- [ ] SC-008: Custom bookmark HTML renders correctly in WordPress

---

## Notes

- Always run `npm run lint` and `npm run typecheck` after each task
- Run `npm test` to verify tests pass
- Commit frequently with descriptive commit messages
- Use feature branch: `007-cli-help-option`
- Tag commits for easier tracking: `[HELP]` or `[BOOKMARK]`
