# Featured Image Implementation Report

## Overview

This report documents the changes introduced in the `feature/featured-image` branch. The feature adds support for extracting and migrating featured images from Tistory blog posts to WordPress.

## Changes Summary

### 1. Configuration Changes

#### `.env.example`

- **Added**: `TISTORY_SELECTOR_FEATURED_IMAGE` selector for featured image extraction
- **Updated**: Comment for `TISTORY_SELECTOR_CONTENT` for clarity

```diff
-# Only HTML under this selector will be cleaned and exported to WXR
+# Only HTML under this selector will be cleaned and used as a content
 TISTORY_SELECTOR_CONTENT=div.tt_article_useless_p_margin.contents_style
+TISTORY_SELECTOR_FEATURED_IMAGE="#main > div > div > div.article_header.type_article_header_cover > div"
```

#### `src/utils/config.ts`

- **Added**: `postFeaturedImageSelector` configuration loading
- **Added**: Validation for `TISTORY_SELECTOR_FEATURED_IMAGE` environment variable

#### `tests/unit/helpers/baseConfig.ts`

- **Added**: `postFeaturedImageSelector` to test configuration

### 2. Model Changes

#### `src/models/Config.ts`

```typescript
/**
 * CSS selector for featured image element
 * e.g. #main > div > div > div.article_header.type_article_header_cover > div
 */
postFeaturedImageSelector: string;
```

#### `src/models/Post.ts`

```typescript
/**
 * Featured image URL (optional)
 */
featured_image: Image | null;
```

### 3. Crawler Service Changes

#### `src/services/crawler.ts`

- **Added**: `extractFImgUrl` method to extract featured image URL from HTML
- **Added**: `featuredImage` selector to `metadataSelectors`
- **Updated**: Added TODO for Korean character handling and slugification

**New Method**:

```typescript
extractFImgUrl: (html: string) => string | null;
```

**Implementation Details**:

- Extracts background-image URL from CSS `style` attribute
- Supports URL pattern: `background-image: url("...")` or `background-image: url('...')` or `background-image: url(...)`
- Returns absolute URL after resolution
- Returns `null` if no featured image found

### 4. Image Processor Changes

#### `src/services/imageProcessor.ts`

- **Refactored**: Extracted image upload logic into separate `uploadImage` function
- **Renamed**: `processImagesForPost` → `processImgs`
- **Renamed**: `ImageProcessorContext` → `ImageUploaderOptions`
- **Added**: `processFImg` method for featured image processing

**New Method**:

```typescript
processFImg: (jobItemId: number, title: string, featuredImageUrl: string) => Promise<Image>;
```

**Refactored Helper**:

```typescript
uploadImage: async (uploaderOptions: ImageUploaderOptions): Promise<UploadMediaResult>
```

**Key Changes**:

- `makeFileName` now accepts `{ prefix, index?, mimeType }` object
- Image upload logic extracted to `uploadImage` for reusability
- Featured image processing uses `uploadImage` internally

### 5. Migrator Service Changes

#### `src/services/migrator.ts`

- **Added**: Featured image extraction using `crawler.extractFImgUrl(html)`
- **Added**: Featured image upload using `imageProcessor.processFImg()`
- **Updated**: Pass `featuredImageId` to `wpClient.createDraftPost()`
- **Added**: Rollback logic to delete uploaded featured image on failure

**Workflow**:

1. Extract featured image URL from HTML
2. Upload featured image to WordPress
3. Pass featured media ID when creating draft post
4. On rollback, delete featured image if upload succeeded

### 6. WordPress Client Changes

#### `src/services/wpClient.ts`

- **Renamed**: `featuredMediaId` → `featuredImageId` in interface and implementation
- **Renamed**: `featured_media` → `featured_image` in API payload

**Interface Change**:

```typescript
export interface CreateDraftPostOptions {
  featuredImageId: number | null; // was: featuredMediaId?: number;
}
```

### 7. Deleted Files

#### `src/models/WXRData.ts`

- **Removed**: WXR data model (no longer used in REST API approach)

#### `src/services/wxrGenerator.ts`

- **Removed**: WXR XML generation service (no longer used in REST API approach)

## Technical Details

### Featured Image Extraction Logic

The featured image is extracted from a Tistory post's HTML using:

1. CSS Selector: Configurable via `TISTORY_SELECTOR_FEATURED_IMAGE`
2. Extraction Method: Parse `style` attribute for `background-image` property
3. URL Pattern: Supports both quoted and unquoted URL formats
4. Resolution: Converts relative URLs to absolute URLs

### Image Upload Flow

1. **Featured Image**:
   - Download from Tistory URL
   - Upload to WordPress Media Library
   - Store `wp_media_id` in `post.featured_image`
   - Pass to WordPress post creation

2. **Content Images**:
   - Extract from post content
   - Download and upload to WordPress
   - Replace URLs in post content
   - Store metadata in `post.images`

### Rollback Mechanism

On migration failure:

- Delete all uploaded content images (existing behavior)
- Delete uploaded featured image if it exists (new behavior)
- Best-effort approach (logged if deletion fails)

## Testing Considerations

### Unit Tests

- `crawler.test.ts`: Add tests for `extractFImgUrl`
- `imageProcessor.test.ts`: Add tests for `processFImg`
- `migrator.test.ts`: Add tests for featured image integration
- `wpClient.test.ts`: Update tests for `featuredImageId` parameter

### Edge Cases

- Missing featured image element
- Invalid `background-image` URL format
- Failed featured image download
- Featured image upload failure
- Featured image deletion failure during rollback

## Configuration Requirements

To use the featured image feature, users must set:

```bash
TISTORY_SELECTOR_FEATURED_IMAGE="#main > div > div > div.article_header.type_article_header_cover > div"
```

This selector should point to the element containing the featured image via CSS `background-image`.

## Backward Compatibility

- **Breaking Change**: `TISTORY_SELECTOR_FEATURED_IMAGE` is now required
- **Breaking Change**: `WXRData` model and `wxrGenerator` service removed
- **Non-breaking**: Existing image processing logic preserved in refactored form

## Files Modified

1. `.env.example` - Added featured image selector
2. `src/models/Config.ts` - Added configuration field
3. `src/models/Post.ts` - Added featured_image field
4. `src/models/WXRData.ts` - **DELETED**
5. `src/services/crawler.ts` - Added extractFImgUrl method
6. `src/services/imageProcessor.ts` - Refactored and added featured image support
7. `src/services/migrator.ts` - Added featured image handling
8. `src/services/wpClient.ts` - Updated parameter names
9. `src/services/wxrGenerator.ts` - **DELETED**
10. `src/utils/config.ts` - Added configuration loading
11. `tests/unit/helpers/baseConfig.ts` - Added test configuration

## Migration Impact

This change enables full featured image support for Tistory to WordPress migration via REST API. The featured image from Tistory posts will be extracted, uploaded to WordPress, and attached to the corresponding WordPress post.
