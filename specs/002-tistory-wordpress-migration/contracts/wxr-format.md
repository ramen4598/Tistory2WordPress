# WXR Format Contract

**Purpose**: Define WordPress eXtended RSS (WXR) XML format for WordPress Importer plugin compatibility

## WXR XML Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
     xmlns:wfw="http://wellformedweb.org/CommentAPI/"
     xmlns:wp="http://wordpress.org/export/1.2/">
  <channel>
    <!-- Channel Metadata -->
    <title>Blog Title</title>
    <link>https://blog.example.com</link>
    <description>Blog Description</description>
    <language>ko</language>
    <wp:wxr_version>1.2</wp:wxr_version>
    <wp:base_site_url>https://example.tistory.com</wp:base_site_url>
    <wp:base_blog_url>https://blog.example.com</wp:base_blog_url>

    <!-- Authors (if any) -->
    <wp:author>
      <wp:author_login>author_username</wp:author_login>
      <wp:author_email>author@example.com</wp:author_email>
      <wp:author_display_name>Author Name</wp:author_display_name>
      <wp:author_first_name>First</wp:author_first_name>
      <wp:author_last_name>Last</wp:author_last_name>
    </wp:author>

    <!-- Categories (flat structure, no hierarchy) -->
    <wp:category>
      <wp:cat_name><![CDATA[Category Name]]></wp:cat_name>
      <wp:category_parent><![CDATA[]]></wp:category_parent>
      <wp:category_nicename>category-slug</wp:category_nicename>
    </wp:category>

    <!-- Tags -->
    <wp:tag>
      <wp:tag_slug>tag-slug</wp:tag_slug>
      <wp:tag_name><![CDATA[Tag Name]]></wp:tag_name>
    </wp:tag>

    <!-- Posts -->
    <item>
      <!-- Post Metadata -->
      <title><![CDATA[Post Title]]></title>
      <link>https://example.tistory.com/123</link>
      <pubDate>Mon, 01 Jan 2024 12:00:00 +0000</pubDate>
      <dc:creator><![CDATA[Author Name]]></dc:creator>
      <description><![CDATA[]]></description>
      <content:encoded><![CDATA[
        <!-- Post HTML content with preserved image URLs -->
        <img src="https://example.tistory.com/attachment/image.jpg" alt="Image description" />
        <p>Post content here...</p>
      ]]></content:encoded>
      <excerpt:encoded><![CDATA[]]></excerpt:encoded>

      <!-- WordPress-specific metadata -->
      <wp:post_id>123</wp:post_id>
      <wp:post_date>2024-01-01 12:00:00</wp:post_date>
      <wp:post_date_gmt>2024-01-01 03:00:00</wp:post_date_gmt>
      <wp:comment_status>open</wp:comment_status>
      <wp:ping_status>open</wp:ping_status>
      <wp:post_name>post-slug</wp:post_name>
      <wp:status>publish</wp:status>
      <wp:post_parent>0</wp:post_parent>
      <wp:menu_order>0</wp:menu_order>
      <wp:post_type>post</wp:post_type>
      <wp:post_password><![CDATA[]]></wp:post_password>
      <wp:is_sticky>0</wp:is_sticky>

      <!-- Post Categories -->
      <category domain="category" nicename="category-slug"><![CDATA[Category Name]]></category>

      <!-- Post Tags -->
      <category domain="post_tag" nicename="tag-slug"><![CDATA[Tag Name]]></category>
    </item>

  </channel>
</rss>
```

## Contract Requirements

### MUST (Required)

- **RSS Version**: `<rss version="2.0">` with required WordPress namespaces
- **Channel Metadata**: Title, link, description, language, wxr_version
- **Post ID**: Each post MUST have unique `<wp:post_id>` (use Tistory post number from URL)
- **Post Date**: `<pubDate>` in RFC 2822 format, `<wp:post_date>` in MySQL DATETIME format
- **Content**: Post HTML in `<content:encoded>` with CDATA sections
- **Status**: `<wp:status>` must be `publish` for published posts
- **Post Type**: `<wp:post_type>` must be `post`

### SHOULD (Recommended)

- **CDATA Wrappers**: All text content in CDATA sections to escape special characters
- **Image URLs**: Preserve original Tistory image URLs in `<img>` src attributes
- **Categories**: Add as `<category domain="category">` elements
- **Tags**: Add as `<category domain="post_tag">` elements
- **GMT Dates**: Include `<wp:post_date_gmt>` for timezone awareness

### MAY (Optional)

- **Authors**: Include `<wp:author>` elements if author information available
- **Excerpt**: Include `<excerpt:encoded>` if post summary available
- **Comments**: Out of scope per spec (not included)
- **Attachments**: Out of scope (attachments downloaded locally, not in WXR)

## Namespace Definitions

- `xmlns:content`: http://purl.org/rss/1.0/modules/content/
- `xmlns:dc`: http://purl.org/dc/elements/1.1/
- `xmlns:excerpt`: http://wordpress.org/export/1.2/excerpt/
- `xmlns:wfw`: http://wellformedweb.org/CommentAPI/
- `xmlns:wp`: http://wordpress.org/export/1.2/

## Date Formats

### pubDate (RFC 2822)
Format: `Day, DD Mon YYYY HH:MM:SS +TZ`
Example: `Mon, 01 Jan 2024 12:00:00 +0000`

### wp:post_date (MySQL DATETIME)
Format: `YYYY-MM-DD HH:MM:SS`
Example: `2024-01-01 12:00:00`

### wp:post_date_gmt (MySQL DATETIME)
Format: `YYYY-MM-DD HH:MM:SS` (UTC timezone)
Example: `2024-01-01 03:00:00`

## Content Encoding

All text content (titles, descriptions, post content, categories, tags) MUST be wrapped in CDATA sections to escape special characters:

```xml
<content:encoded><![CDATA[
  <h1>Title</h1>
  <p>Content with <strong>HTML</strong> tags...</p>
]]></content:encoded>
```

## Post ID Extraction

Extract post ID from Tistory URL: `https://example.tistory.com/123` → ID: `123`

## Image Handling

- Images NOT downloaded to local files
- Original Tistory URLs preserved in `<img>` src attributes
- Example:
  ```xml
  <img src="https://example.tistory.com/attachment/image.jpg" alt="Description" />
  ```

## Category and Tag Structure

**Categories** (flat, no hierarchy):
```xml
<category domain="category" nicename="category-slug"><![CDATA[Category Name]]></category>
```

**Tags**:
```xml
<category domain="post_tag" nicename="tag-slug"><![CDATA[Tag Name]]></category>
```

**Note**: Per spec, categories and tags are flat (no hierarchy). `wp:category_parent` should be empty.

## Validation

Generated WXR file MUST:

1. Be valid XML (well-formed, proper encoding UTF-8)
2. Include all required WordPress namespaces
3. Be importable by WordPress Importer plugin without errors
4. Preserve all semantic HTML content
5. Include correct post metadata (dates, titles, URLs)

## Example Complete WXR File

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
     xmlns:wfw="http://wellformedweb.org/CommentAPI/"
     xmlns:wp="http://wordpress.org/export/1.2/">
  <channel>
    <title>My Tistory Blog</title>
    <link>https://myblog.example.com</link>
    <description>Blog Description</description>
    <language>ko</language>
    <wp:wxr_version>1.2</wp:wxr_version>
    <wp:base_site_url>https://myblog.tistory.com</wp:base_site_url>
    <wp:base_blog_url>https://myblog.example.com</wp:base_blog_url>

    <wp:category>
      <wp:cat_name><![CDATA[Technology]]></wp:cat_name>
      <wp:category_parent><![CDATA[]]></wp:category_parent>
      <wp:category_nicename>technology</wp:category_nicename>
    </wp:category>

    <wp:tag>
      <wp:tag_slug>python</wp:tag_slug>
      <wp:tag_name><![CDATA[Python]]></wp:tag_name>
    </wp:tag>

    <item>
      <title><![CDATA[Hello World]]></title>
      <link>https://myblog.tistory.com/123</link>
      <pubDate>Mon, 01 Jan 2024 12:00:00 +0000</pubDate>
      <dc:creator><![CDATA[Author]]></dc:creator>
      <description><![CDATA[]]></description>
      <content:encoded><![CDATA[
        <h1>Hello World</h1>
        <p>This is my first post.</p>
        <img src="https://myblog.tistory.com/attachment/image.jpg" alt="Image" />
      ]]></content:encoded>
      <excerpt:encoded><![CDATA[]]></excerpt:encoded>
      <wp:post_id>123</wp:post_id>
      <wp:post_date>2024-01-01 12:00:00</wp:post_date>
      <wp:post_date_gmt>2024-01-01 03:00:00</wp:post_date_gmt>
      <wp:comment_status>open</wp:comment_status>
      <wp:ping_status>open</wp:ping_status>
      <wp:post_name>hello-world</wp:post_name>
      <wp:status>publish</wp:status>
      <wp:post_parent>0</wp:post_parent>
      <wp:menu_order>0</wp:menu_order>
      <wp:post_type>post</wp:post_type>
      <wp:post_password><![CDATA[]]></wp:post_password>
      <wp:is_sticky>0</wp:is_sticky>
      <category domain="category" nicename="technology"><![CDATA[Technology]]></category>
      <category domain="post_tag" nicename="python"><![CDATA[Python]]></category>
    </item>

  </channel>
</rss>
```
