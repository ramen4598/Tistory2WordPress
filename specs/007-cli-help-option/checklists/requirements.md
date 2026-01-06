# Requirements Checklist

This checklist verifies that all requirements from `requirements.md` are captured in the specification.

## CLI Help Option Requirements

- [ ] **R-001**: Add new cli option `--help`, `-h` to show help message
  - Corresponds to FR-001, FR-002, FR-003, FR-004, FR-005

- [ ] **R-002**: Handle bookmark of tistory
  - Corresponds to FR-009 through FR-018

## CLI Help Option Detailed Requirements

- [ ] **R-003**: Add a new command line option `--help` or `-h`
  - Corresponds to FR-001, FR-002

- [ ] **R-004**: When this option is provided, display a help message
  - Corresponds to FR-003, FR-004, FR-005

- [ ] **R-005**: The help message should include:
  - [ ] Description of the tool
    - Corresponds to FR-003
  - [ ] List of available command line options
    - Corresponds to FR-004
  - [ ] Brief explanation of each option
    - Corresponds to FR-005

- [ ] **R-006**: After displaying the help message, exit the program without performing any further actions
  - Corresponds to FR-006, FR-007

## Handle Bookmark of Tistory Requirements

- [ ] **R-007**: While coverting raw HTML to Markdown, handle Tistory bookmarks
  - Corresponds to FR-018

- [ ] **R-008**: Extract bookmarks from Tistory posts
  - Corresponds to FR-009, FR-011

- [ ] **R-009**: Use the CSS Selector (ex. `figure[data-og-type="website"] a`) to identify bookmarks
  - Corresponds to FR-009, FR-010

- [ ] **R-010**: CSS Selector should be configurable via `.env` file
  - Corresponds to FR-009

- [ ] **R-011**: Extract url from the a tag
  - Corresponds to FR-011

- [ ] **R-012**: Fetch metadata from the URL (title, description, featured image ... )
  - Corresponds to FR-012

- [ ] **R-013**: Replace the original HTML with a custom HTML structure for bookmarks
  - Corresponds to FR-013

- [ ] **R-014**: The custom HTML structure should include the fetched metadata
  - Corresponds to FR-014

- [ ] **R-015**: ImageProcess should ignore bookmark featured images. (If the parent is figure, ignore it)
  - Corresponds to FR-015

## Additional Requirements from Spec Analysis

The following requirements were added during spec creation for completeness:

- [ ] **R-016**: Parse help option before processing other arguments
  - Corresponds to FR-008

- [ ] **R-017**: Handle metadata fetch failures gracefully with robust exception handling
  - Corresponds to FR-016

- [ ] **R-018**: Preserve bookmark functionality even when partial metadata is missing or metadata fetch fails completely
  - Corresponds to FR-017

- [ ] **R-019**: Custom HTML structure MUST be a card component with title, description, and featured image
  - Corresponds to FR-019

- [ ] **R-020**: Custom HTML template MUST be managed in a separate file for easy modification
  - Corresponds to FR-020

- [ ] **R-021**: System MUST support template variables for title, description, featured image URL, and original URL
  - Corresponds to FR-021

- [ ] **R-022**: System MUST NOT cache bookmark metadata (always fetch fresh metadata from URLs)
  - Corresponds to FR-022

- [ ] **R-023**: System MUST use 10 second timeout for metadata fetch operations
  - Corresponds to FR-023

- [ ] **R-024**: Bookmarks are correctly detected with 95%+ accuracy using configured CSS selector
  - Corresponds to SC-003

- [ ] **R-025**: Metadata is successfully fetched from 95%+ of bookmark URLs
  - Corresponds to SC-004

- [ ] **R-026**: Tool exits gracefully when bookmark metadata fetch fails (per-post exception handling, not entire migration)
  - Corresponds to SC-006

- [ ] **R-027**: Total migration time increases by less than 20% when bookmark handling is enabled
  - Corresponds to SC-007

## Clarification Status

The following clarification needs have been addressed:

- [x] **C-001**: What is the exact custom HTML structure for bookmarks?
  - Resolved: Custom card component with separate template file

- [x] **C-002**: Should bookmark metadata be cached?
  - Resolved: No caching

- [x] **C-003**: What is the timeout for metadata fetch operations?
  - Resolved: 10 seconds

- [x] **C-004**: What is the target accuracy for bookmark detection?
  - Resolved: 95%+

- [x] **C-005**: What is the target success rate for metadata fetches?
  - Resolved: 95%+ with robust exception handling

- [x] **C-006**: What is the acceptable performance overhead for bookmark handling?
  - Resolved: Less than 20%
