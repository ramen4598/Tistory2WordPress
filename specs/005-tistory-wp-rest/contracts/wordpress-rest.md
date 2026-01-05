# API Contracts - WordPress REST Integration (005-tistory-wp-rest)

This document describes the subset of WordPress REST API used by the migration tool. It is not a full OpenAPI spec, but a focused contract for implementation, rollback, and tests.

## Authentication

- **Scheme**: Basic Auth via Application Passwords
- **Header**:

```http
Authorization: Basic base64("WP_APP_USER:WP_APP_PASSWORD")
```

- **Config**:
  - `WP_BASE_URL` (e.g., `https://example.com`)
  - Base REST URL: `${WP_BASE_URL}/wp-json/wp/v2`

---

## Media Upload

### POST /media

Uploads an image file to the WordPress media library.

**Request**:

- Method: `POST`
- URL: `${WP_BASE_URL}/wp-json/wp/v2/media`
- Headers:
  - `Authorization: Basic ...`
  - `Content-Type: multipart/form-data; boundary=...`
- Body (multipart/form-data):
  - `file`: binary image content (JPEG/PNG/etc.), provided from an in-memory buffer.
  - Optional: `alt_text`, `title`, `caption` via additional fields.

**Response 201** (simplified):

```json
{
  "id": 123,
  "source_url": "https://example.com/wp-content/uploads/2026/01/image.jpg",
  "alt_text": "Sample image",
  "media_type": "image",
  "mime_type": "image/jpeg"
}
```

**Error Responses**:

- 400/415: invalid file or media type.
- 401/403: auth/permission issues.
- 429/5xx: rate limit or server errors (should trigger retry with backoff).

---

## Media Deletion (Rollback)

### DELETE /media/{id}

Deletes a media item. Used for per-post rollback.

**Request**:

- Method: `DELETE`
- URL: `${WP_BASE_URL}/wp-json/wp/v2/media/{id}?force=true`
- Headers:
  - `Authorization: Basic ...`

**Response 200** (simplified):

```json
{
  "deleted": true,
  "previous": {
    "id": 123,
    "source_url": "https://example.com/wp-content/uploads/2026/01/image.jpg"
  }
}
```

**Notes**:

- If the media item was already removed, WordPress may return 404; the client should treat this as non-fatal during rollback and log a warning.

---

## Categories

### GET /categories

Fetch existing categories (for lookup by name/slug).

**Request**:

- Method: `GET`
- URL: `${WP_BASE_URL}/wp-json/wp/v2/categories?per_page=100&page=1&search={name}`

**Response 200** (array of categories):

```json
[
  {
    "id": 10,
    "name": "Tech",
    "slug": "tech",
    "parent": 0
  }
]
```

### POST /categories

Create a new category if it does not exist.

**Request**:

- Method: `POST`
- URL: `${WP_BASE_URL}/wp-json/wp/v2/categories`
- Body (JSON):

```json
{
  "name": "Tech",
  "slug": "tech",
  "parent": 0
}
```

**Response 201**: Category object including `id`.

---

## Tags

### GET /tags

Lookup tags by name/slug.

**Request**:

- Method: `GET`
- URL: `${WP_BASE_URL}/wp-json/wp/v2/tags?per_page=100&page=1&search={name}`

### POST /tags

Create new tag.

**Request**:

- Method: `POST`
- URL: `${WP_BASE_URL}/wp-json/wp/v2/tags`
- Body (JSON):

```json
{
  "name": "JavaScript",
  "slug": "javascript"
}
```

**Response 201**: Tag object including `id`.

---

## Posts

### POST /posts

Create a new WordPress post as a draft.

**Request**:

- Method: `POST`
- URL: `${WP_BASE_URL}/wp-json/wp/v2/posts`
- Body (JSON):

```json
{
  "title": "Post Title",
  "content": "<p>Cleaned HTML content...</p>",
  "status": "draft",
  "date": "2026-01-01T12:00:00",
  "categories": [10, 11],
  "tags": [20, 21],
  "featured_media": 123
}
```

**Notes**:

- `date` should reflect Tistory `publish_date`.
- If `modified_date` needs to be preserved, `date_gmt`/`modified` fields may also be set, depending on WP behavior.
- `featured_media` is the ID of the uploaded media item that can be used as the post's thumbnail image. It should reference the uploaded media ID.

**Response 201**:

```json
{
  "id": 456,
  "status": "draft",
  "link": "https://example.com/?p=456"
}
```

**Error Responses**:

- 400: invalid payload.
- 401/403: authentication/authorization issues.
- 429/5xx: rate limit/server errors (should be retried with backoff where safe).

---

## Post Deletion (Rollback)

### DELETE /posts/{id}

Deletes a post. Used for per-post rollback.

**Request**:

- Method: `DELETE`
- URL: `${WP_BASE_URL}/wp-json/wp/v2/posts/{id}?force=true`
- Headers:
  - `Authorization: Basic ...`

**Response 200** (simplified):

```json
{
  "deleted": true,
  "previous": {
    "id": 456,
    "status": "draft"
  }
}
```

**Notes**:

- As with media deletion, 404 responses during rollback should be treated as non-fatal and logged.

---

## Error Handling & Retries (Logical Contract)

The migration tool should:

- Distinguish between client errors (4xx except 429) and server/transient errors (429, 5xx).
- For client errors:
  - Log the error with URL and payload summary.
  - Mark the corresponding job item as Failed in SQLite with the error message.
  - Trigger rollback if a partial resource (media/post) was already created.
- For transient errors (429/5xx):
  - Retry a limited number of times with exponential backoff (`retryWithBackoff`).
  - If still failing, log and mark as Failed + rollback.

---

## Mapping from Domain Models

- `Category.name` / `Category.slug` → `/categories` `name`/`slug`.
- `Tag.name` / `Tag.slug` → `/tags` `name`/`slug`.
- Image binary data (downloaded in memory) → `/media` `file`.
- `Image.wp_media_id` / `Image.wp_media_url` → `/posts` `featured_media` (and in-body URLs after rewrite).
- `Post.cleaned_html` → `/posts` `content`.
- `Post.publish_date` → `/posts` `date`.
- `Post.categories` / `Post.tags` → arrays of term IDs in `/posts` payload.
