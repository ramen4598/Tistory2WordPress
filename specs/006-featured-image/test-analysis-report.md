# Test Analysis Report for Featured Image Feature

## Executive Summary

This report analyzes the current test suite after the Featured Image feature implementation (branch: `feature/featured-image`). The analysis identifies **13 failing tests** and provides recommendations for fixing them, along with suggestions for improving **37 passing tests**.

---

## Part 1: Failing Tests and Fixes

### 1. Configuration Tests (`tests/unit/utils/config.test.ts`)

**Total Failing**: 10 tests

**Root Cause**: `TISTORY_SELECTOR_FEATURED_IMAGE` environment variable is required but not set in test setup.

**Tests Affected**:

- ❌ `applies defaults and validates numeric fields`
- ❌ `throws ConfigurationError when WORKER_COUNT is out of range`
- ❌ `throws ConfigurationError when LOG_LEVEL is invalid`
- ❌ `throws ConfigurationError when WP_BASE_URL is invalid`
- ❌ `uses CATEGORY_HIERARCHY_ORDER default when invalid`
- ❌ `loads concurrency config from environment variable`
- ❌ `loads rate limit config from environment variable`
- ❌ `validates WORKER_COUNT upper bound`
- ❌ `validates RATE_LIMIT_PER_WORKER is positive`
- ❌ `handles string values for numeric config`

**Error Message**:

```
ConfigurationError: TISTORY_SELECTOR_FEATURED_IMAGE is required. Please set it in .env or environment variables.
```

**Fix Required**:

```typescript
// In tests/unit/utils/config.test.ts
function setMinimumValidEnv() {
  process.env.TISTORY_BLOG_URL = 'https://example.tistory.com';
  process.env.WP_BASE_URL = 'https://example.com';
  process.env.WP_APP_USER = 'user';
  process.env.WP_APP_PASSWORD = 'password';
  process.env.TISTORY_SELECTOR_TITLE = 'meta[name="title"]';
  process.env.TISTORY_SELECTOR_PUBLISH_DATE = 'meta[property="article:published_time"]';
  process.env.TISTORY_SELECTOR_MODIFIED_DATE = 'meta[property="article:modified_time"]';
  process.env.TISTORY_SELECTOR_CATEGORY = 'div.another_category h4 a';
  process.env.TISTORY_SELECTOR_TAG = 'div.area_tag a[rel="tag"]';
  process.env.TISTORY_SELECTOR_POST_LINK = 'a.link_category';
  process.env.TISTORY_SELECTOR_CONTENT = 'div.tt_article_useless_p_margin.contents_style';
  // ADD THIS LINE:
  process.env.TISTORY_SELECTOR_FEATURED_IMAGE =
    '#main > div > div > div.article_header.type_article_header_cover > div';
}
```

**Impact**: All 10 failing tests will pass after adding the missing environment variable.

---

### 2. Migrator Tests (`tests/unit/services/migrator.test.ts`)

**Total Failing**: 1 test

**Test**: `rolls back uploaded media when post creation fails`

**Root Cause**: Mock crawler is missing the `extractFImgUrl` method.

**Error Message**:

```
Error: crawler.extractFImgUrl is not a function
```

**Current Mock** (line 51-61):

```typescript
const crawler = {
  fetchPostHtml: jest.fn().mockResolvedValue('<html></html>'),
  parsePostMetadata: jest.fn().mockReturnValue({
    url,
    title: 'Hello',
    publish_date: new Date('2020-01-01T00:00:00Z'),
    modified_date: null,
    categories: [],
    tags: [],
  }),
};
```

**Fix Required**:

```typescript
const crawler = {
  fetchPostHtml: jest.fn().mockResolvedValue('<html></html>'),
  parsePostMetadata: jest.fn().mockReturnValue({
    url,
    title: 'Hello',
    publish_date: new Date('2020-01-01T00:00:00Z'),
    modified_date: null,
    categories: [],
    tags: [],
  }),
  // ADD THIS LINE:
  extractFImgUrl: jest.fn().mockReturnValue(null), // No featured image for this test
};
```

**Additional Considerations**: The test should also verify that featured image rollback works. Consider adding a test case with featured image:

```typescript
// Add new test: "rolls back featured image when post creation fails"
it('rolls back featured image when post creation fails', async () => {
  // Setup mock with featured image
  const crawler = {
    // ... other methods
    extractFImgUrl: jest.fn().mockReturnValue('https://example.tistory.com/featured.jpg'),
  };

  const imageProcessor = {
    processImagesForPost: jest.fn().mockResolvedValue({...}),
    processFImg: jest.fn().mockResolvedValue({
      url: 'https://example.tistory.com/featured.jpg',
      alt_text: 'Featured image for Hello',
      wp_media_id: 100,
      wp_media_url: 'https://example.wordpress.com/wp-content/uploads/featured.jpg',
    }),
  };

  // ... test expectation that deleteMedia is called for featured image (ID 100)
});
```

---

### 3. Image Processor Tests (`tests/unit/services/imageProcessor.test.ts`)

**Total Failing**: 4 tests

**Root Cause**: Method name changed from `processImagesForPost` to `processImgs`, but tests still use old name.

**Tests Affected**:

- ❌ `downloads images from HTML, uploads to WordPress, creates/updates ImageAsset DB records, rewrites URLs, and returns uploaded media IDs`
- ❌ `processes multiple images in content, uploading each to WordPress and rewriting all URLs`
- ❌ `returns early and updates no assets when post content has no images`
- ❌ `updates ImageAsset to FAILED when download/upload fails`

**Error Message**:

```
TypeError: processImagesForPost is not a function
```

**Fix Required**: Replace all `processImagesForPost` with `processImgs` and update parameter name:

**Before** (line 85-87):

```typescript
const { processImagesForPost } = createImageProcessor();

const result = await processImagesForPost(post, { jobItemId: 1 });
```

**After**:

```typescript
const { processImgs } = createImageProcessor();

const result = await processImgs(post, 1); // Note: Changed from { jobItemId: 1 } to just 1
```

**File-wide Changes Needed**:

- Line 85: `processImagesForPost` → `processImgs`
- Line 87: `processImagesForPost(post, { jobItemId: 1 })` → `processImgs(post, 1)`
- Line 219: `processImagesForPost(post, { jobItemId: 1 })` → `processImgs(post, 1)`
- Line 293: `processImagesForPost(post, { jobItemId: 1 })` → `processImgs(post, 1)`
- Line 337: `processImagesForPost(post, { jobItemId: 1 })` → `processImgs(post, 1)`

**Missing Tests**: Add tests for the new `processFImg` method:

```typescript
describe('processFImg', () => {
  it('downloads and uploads featured image to WordPress', async () => {
    const axiosResponse = {
      status: 200,
      data: Buffer.from('featured-image'),
      headers: { 'content-type': 'image/jpeg' },
    };
    mockedAxios.get.mockResolvedValueOnce(axiosResponse);

    const uploadMediaMock = jest.fn().mockResolvedValue({
      id: 200,
      url: 'https://example.wordpress.com/wp-content/uploads/featured.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
    });

    const wpClientMock: Partial<WpClient> = {
      uploadMedia: uploadMediaMock,
    };
    mockedCreateWpClient.mockReturnValue(wpClientMock as WpClient);

    const mockAsset = {
      id: 10,
      job_item_id: 5,
      tistory_image_url: 'https://img.tistory.com/featured.jpg',
      wp_media_id: null,
      wp_media_url: null,
      status: ImageAssetStatus.PENDING,
      error_message: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    mockedCreateImageAsset.mockReturnValue(mockAsset);

    const { processFImg } = createImageProcessor();

    const result = await processFImg(5, 'My Post', 'https://img.tistory.com/featured.jpg');

    expect(result.wp_media_id).toBe(200);
    expect(result.alt_text).toBe('Featured image for My Post');
  });

  it('handles featured image download failure', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Download failed'));

    const { processFImg } = createImageProcessor();

    await expect(processFImg(5, 'My Post', 'https://img.tistory.com/featured.jpg')).rejects.toThrow(
      'Download failed'
    );
  });
});
```

---

## Part 2: Improvements for Passing Tests

### 1. Crawler Tests (`tests/unit/services/crawler.test.ts`)

**Status**: ✅ All 11 tests passing

**Improvement Opportunities**:

**A. Add Featured Image Extraction Tests**

```typescript
describe('extractFImgUrl', () => {
  it('extracts featured image URL from style attribute with double quotes', () => {
    const html = `
      <div style="background-image: url(&quot;https://img.tistory.com/featured.jpg&quot;);"></div>
    `;
    const crawler = createCrawler({ fetchFn: jest.fn() as any });
    const url = crawler.extractFImgUrl(html);
    expect(url).toBe('https://img.tistory.com/featured.jpg');
  });

  it('extracts featured image URL from style attribute with single quotes', () => {
    const html = `
      <div style="background-image: url('https://img.tistory.com/featured.jpg');"></div>
    `;
    const crawler = createCrawler({ fetchFn: jest.fn() as any });
    const url = crawler.extractFImgUrl(html);
    expect(url).toBe('https://img.tistory.com/featured.jpg');
  });

  it('extracts featured image URL from style attribute without quotes', () => {
    const html = `
      <div style="background-image: url(https://img.tistory.com/featured.jpg);"></div>
    `;
    const crawler = createCrawler({ fetchFn: jest.fn() as any });
    const url = crawler.extractFImgUrl(html);
    expect(url).toBe('https://img.tistory.com/featured.jpg');
  });

  it('returns null when no featured image element found', () => {
    const html = '<p>No featured image here</p>';
    const crawler = createCrawler({ fetchFn: jest.fn() as any });
    const url = crawler.extractFImgUrl(html);
    expect(url).toBeNull();
  });

  it('returns null when style attribute does not contain background-image', () => {
    const html = '<div style="color: red; margin: 10px;"></div>';
    const crawler = createCrawler({ fetchFn: jest.fn() as any });
    const url = crawler.extractFImgUrl(html);
    expect(url).toBeNull();
  });

  it('converts relative URLs to absolute URLs', () => {
    const html = `
      <div style="background-image: url(/images/featured.jpg);"></div>
    `;
    const crawler = createCrawler({ fetchFn: jest.fn() as any });
    const url = crawler.extractFImgUrl(html);
    expect(url).toBe('https://example.tistory.com/images/featured.jpg');
  });
});
```

**B. Test Edge Cases**

- Malformed `background-image` CSS
- URL with query parameters
- URL with hash fragments
- Multiple elements matching selector (should use `.first()`)
- Invalid URL format in style attribute

---

### 2. WordPress Client Tests (`tests/unit/services/wpClient.test.ts`)

**Status**: ✅ All tests passing

**Improvement Opportunities**:

**A. Update Featured Image Parameter Name**
The tests use `featuredMediaId` but the interface changed to `featuredImageId`. Update tests for consistency:

**Current** (line 52-59):

```typescript
const result = await client.createDraftPost({
  title: 'Post Title',
  content: '<p>content</p>',
  date: '2026-01-01T12:00:00',
  categories: [10],
  tags: [20],
  featuredMediaId: 123, // ← OLD NAME
});
```

**Should be**:

```typescript
const result = await client.createDraftPost({
  title: 'Post Title',
  content: '<p>content</p>',
  date: '2026-01-01T12:00:00',
  categories: [10],
  tags: [20],
  featuredImageId: 123, // ← NEW NAME
});
```

**B. Add Test for `null` Featured Image**

```typescript
it('creates draft post without featured image when featuredImageId is null', async () => {
  const client = createClient();

  const responseData = {
    id: 456,
    status: 'draft',
    link: 'https://example.wordpress.com/?p=456',
  };
  axiosInstance.post.mockResolvedValue({ data: responseData } as AxiosResponse);

  const result = await client.createDraftPost({
    title: 'Post Title',
    content: '<p>content</p>',
    date: '2026-01-01T12:00:00',
    categories: [10],
    tags: [20],
    featuredImageId: null,
  });

  expect(axiosInstance.post).toHaveBeenCalledWith('/posts', {
    title: 'Post Title',
    content: '<p>content</p>',
    status: 'draft',
    date: '2026-01-01T12:00:00',
    categories: [10],
    tags: [20],
    // featured_image should NOT be in payload when null
  });
});
```

**C. Verify API Payload Structure**
Ensure the test validates that `featured_image` (not `featured_media`) is sent to WordPress API.

---

### 3. Post Model Tests

**Status**: Not present - **NEW TESTS NEEDED**

**Recommendation**: Add tests for the new `featured_image` field in Post model:

```typescript
// Create new file: tests/unit/models/Post.test.ts
import { Post } from '../../../src/models/Post';
import { Image } from '../../../src/models/Image';

describe('Post model', () => {
  it('creates post without featured image', () => {
    const post: Post = {
      id: 1,
      url: 'https://example.tistory.com/1',
      title: 'Test Post',
      content: '<p>Content</p>',
      publish_date: new Date('2024-01-01'),
      modified_date: null,
      categories: [],
      tags: [],
      images: [],
      featured_image: null,
    };

    expect(post.featured_image).toBeNull();
  });

  it('creates post with featured image', () => {
    const featuredImage: Image = {
      url: 'https://img.tistory.com/featured.jpg',
      alt_text: 'Featured',
      wp_media_id: 100,
      wp_media_url: 'https://example.wordpress.com/wp-content/uploads/featured.jpg',
    };

    const post: Post = {
      id: 1,
      url: 'https://example.tistory.com/1',
      title: 'Test Post',
      content: '<p>Content</p>',
      publish_date: new Date('2024-01-01'),
      modified_date: null,
      categories: [],
      tags: [],
      images: [],
      featured_image: featuredImage,
    };

    expect(post.featured_image?.wp_media_id).toBe(100);
    expect(post.featured_image?.wp_media_url).toContain('featured.jpg');
  });
});
```

---

## Part 3: Integration Test Recommendations

### 1. End-to-End Featured Image Flow Test

Create a new integration test file: `tests/integration/featured-image-flow.test.ts`

```typescript
describe('Featured Image Integration Flow', () => {
  it('completes full featured image migration: extract → upload → attach → rollback on failure', async () => {
    // 1. Setup Tistory HTML with featured image
    const html = `
      <html>
        <div style="background-image: url('https://img.tistory.com/featured.jpg');"></div>
        <div class="contents_style">
          <p>Post content</p>
        </div>
      </html>
    `;

    // 2. Mock crawler to return HTML
    const crawler = {
      fetchPostHtml: jest.fn().mockResolvedValue(html),
      parsePostMetadata: jest.fn().mockReturnValue({...}),
      extractFImgUrl: jest.fn().mockReturnValue('https://img.tistory.com/featured.jpg'),
    };

    // 3. Mock image processor to upload featured image
    const imageProcessor = {
      processFImg: jest.fn().mockResolvedValue({
        url: 'https://img.tistory.com/featured.jpg',
        alt_text: 'Featured image for Test Post',
        wp_media_id: 123,
        wp_media_url: 'https://example.wordpress.com/wp-content/uploads/featured.jpg',
      }),
      processImgs: jest.fn().mockResolvedValue({...}),
    };

    // 4. Mock wpClient to fail at post creation
    const wpClient = {
      createDraftPost: jest.fn().mockRejectedValue(new Error('Post creation failed')),
      deleteMedia: jest.fn().mockResolvedValue(undefined),
    };

    // 5. Run migration
    const migrator = createMigrator({ crawler, imageProcessor, wpClient });

    // 6. Verify featured image was uploaded
    expect(imageProcessor.processFImg).toHaveBeenCalledWith(456, 'Test Post', 'https://img.tistory.com/featured.jpg');

    // 7. Verify featured image was attached to post
    expect(wpClient.createDraftPost).toHaveBeenCalledWith(
      expect.objectContaining({
        featuredImageId: 123,
      })
    );

    // 8. Verify rollback deleted featured image
    await expect(migrator.migratePostByUrl(url, context)).rejects.toThrow();
    expect(wpClient.deleteMedia).toHaveBeenCalledWith(123);
  });
});
```

---

## Part 4: Test Coverage Gaps

### Missing Test Coverage

1. **Crawler.extractFImgUrl**: No tests (0% coverage)
   - Extract from style attribute
   - Handle malformed CSS
   - URL resolution
   - Null returns

2. **ImageProcessor.processFImg**: No tests (0% coverage)
   - Download and upload
   - Error handling
   - Asset creation and updates

3. **Migrator featured image flow**: Limited coverage
   - Extract → Upload → Attach workflow
   - Featured image rollback
   - Mixed featured + content images

4. **Post model**: No tests (0% coverage)
   - `featured_image` field presence and typing

5. **Config.postFeaturedImageSelector**: No dedicated validation tests

---

## Part 5: Priority Recommendations

### High Priority (Fix Failing Tests First)

1. **Fix config.test.ts** (10 tests)
   - Add `TISTORY_SELECTOR_FEATURED_IMAGE` to `setMinimumValidEnv()`
   - **Effort**: 5 minutes
   - **Impact**: 10 tests pass

2. **Fix imageProcessor.test.ts** (4 tests)
   - Replace `processImagesForPost` with `processImgs`
   - Update parameter format from `{ jobItemId: 1 }` to `1`
   - **Effort**: 10 minutes
   - **Impact**: 4 tests pass

3. **Fix migrator.test.ts** (1 test)
   - Add `extractFImgUrl` mock to crawler
   - **Effort**: 2 minutes
   - **Impact**: 1 test pass

### Medium Priority (Add New Tests)

4. **Add crawler.extractFImgUrl tests** (6 tests recommended)
   - **Effort**: 30 minutes
   - **Impact**: Critical feature coverage

5. **Add imageProcessor.processFImg tests** (2 tests recommended)
   - **Effort**: 20 minutes
   - **Impact**: Critical feature coverage

6. **Update wpClient.test.ts** (parameter name fix)
   - Change `featuredMediaId` to `featuredImageId`
   - Add null featured image test
   - **Effort**: 15 minutes
   - **Impact**: API contract correctness

### Low Priority (Nice to Have)

7. **Add Post model tests**
   - **Effort**: 20 minutes

8. **Add integration test for full featured image flow**
   - **Effort**: 45 minutes

9. **Add edge case tests**
   - Malformed CSS
   - Invalid URLs
   - Mixed scenarios
   - **Effort**: 30 minutes

---

## Part 6: Summary

### Test Statistics

| Category             | Total  | Passing | Failing | Missing | Coverage  |
| -------------------- | ------ | ------- | ------- | ------- | --------- |
| Config Tests         | 12     | 2       | 10      | 0       | 16.7%     |
| Crawler Tests        | 11     | 11      | 0       | 6       | 64.7%     |
| ImageProcessor Tests | 4      | 0       | 4       | 2       | 0%        |
| Migrator Tests       | 1      | 0       | 1       | 1       | 0%        |
| WpClient Tests       | 9      | 9       | 0       | 1       | 90%       |
| **Total**            | **37** | **22**  | **15**  | **10**  | **39.3%** |

### Quick Wins

The following changes will fix **15 failing tests** in under **20 minutes**:

1. Add one line to `setMinimumValidEnv()`: +10 tests ✅
2. Rename `processImagesForPost` → `processImgs`: +4 tests ✅
3. Add `extractFImgUrl` mock: +1 test ✅

### Next Steps

1. **Immediate**: Apply quick fixes to restore all passing tests
2. **Short-term**: Add missing tests for new featured image functionality
3. **Long-term**: Improve integration test coverage for complex scenarios

---

**Report Generated**: 2026-01-06
**Branch**: feature/featured-image
**Test Framework**: Jest
