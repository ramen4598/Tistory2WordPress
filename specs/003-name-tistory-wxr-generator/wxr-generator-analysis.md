# WXR Generator Analysis (Based on WordPress `export.php`)

**Source**: `wp-admin/includes/export.php` in the official WordPress repository  
**Goal**: Understand the canonical WXR format that WordPress itself generates, and derive concrete requirements for our Tistory→WXR generator.

---

## 1. High-Level Structure

The export file is a specialized RSS 2.0 document with multiple WordPress-specific namespaces.

Top-level skeleton (simplified from `export.php`):

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/WXR_VERSION/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/WXR_VERSION/"
>
  <channel>
    <!-- Site-level metadata -->
    <!-- Authors -->
    <!-- Terms: categories, tags, custom taxonomies, nav_menu -->
    <!-- Posts as <item> elements -->
  </channel>
</rss>
```

Key points:

- The root element is standard RSS `<rss version="2.0">`.
- WordPress-specific semantics are expressed via the `wp:` namespace.
- The `excerpt:` and `content:` namespaces are used for rich post content and excerpts.
- WXR version is currently `1.2` (constant `WXR_VERSION`).

For our generator, this means:

- We must match the same namespaces and WXR version to ensure plugin compatibility.
- The structure of `<channel>` + `<item>` elements should mirror WordPress as closely as reasonable.

---

## 2. Channel-Level Metadata

Within `<channel>`, WordPress outputs the following core elements:

```php
<title><?php bloginfo_rss( 'name' ); ?></title>
<link><?php bloginfo_rss( 'url' ); ?></link>
<description><?php bloginfo_rss( 'description' ); ?></description>
<pubDate><?php echo gmdate( 'D, d M Y H:i:s +0000' ); ?></pubDate>
<language><?php bloginfo_rss( 'language' ); ?></language>
<wp:wxr_version><?php echo WXR_VERSION; ?></wp:wxr_version>
<wp:base_site_url><?php echo wxr_site_url(); ?></wp:base_site_url>
<wp:base_blog_url><?php bloginfo_rss( 'url' ); ?></wp:base_blog_url>
```

**Implications for our `WXRData.site_info` mapping:**

- Required fields for interoperability:
  - `<title>` ← blog title
  - `<link>` / `<wp:base_blog_url>` ← canonical site URL
  - `<description>` ← blog description
- Good to include:
  - `<language>`: we can derive from config or allow a default (e.g. `ko-KR` / `en-US`).
  - `<pubDate>`: generation time (UTC, RFC 2822 format).
  - `<wp:wxr_version>`: fixed `1.2` to match WordPress.
  - `<wp:base_site_url>` vs `<wp:base_blog_url>`: for us, these can both map to the Tistory blog URL (or a derived WordPress base URL if we support that later).

**Action items for our generator:**

- Extend `WXRData.site_info` mapping to include:
  - Language (optional but recommended).
  - Generated `pubDate` at export time.
  - Both `wp:wxr_version`, `wp:base_site_url`, `wp:base_blog_url`.

---

## 3. Authors Representation

WordPress outputs authors as repeated `<wp:author>` elements inside `<channel>`.

From `wxr_authors_list()`:

```xml
<wp:author>
  <wp:author_id>1</wp:author_id>
  <wp:author_login><![CDATA[admin]]></wp:author_login>
  <wp:author_email><![CDATA[email@example.com]]></wp:author_email>
  <wp:author_display_name><![CDATA[Admin User]]></wp:author_display_name>
  <wp:author_first_name><![CDATA[First]]></wp:author_first_name>
  <wp:author_last_name><![CDATA[Last]]></wp:author_last_name>
</wp:author>
```

- Authors are derived from posts in the export, not from the full user table.
- Content is wrapped in `<![CDATA[ ... ]]>` via `wxr_cdata()` to handle special characters.

**Our current model:**

- `WXRData.authors` has `{ id, login, display_name }` only.

**Gap / decisions:**

- Minimal compatibility: `author_id`, `author_login`, `author_display_name` are likely sufficient.
- Optional fields `author_email`, `author_first_name`, `author_last_name` could be omitted or set to placeholders.
- Since Tistory does not expose rich author data easily, we can:
  - Use a single synthetic author (`id=1`, `login="tistory"`, `display_name="Tistory Author"`).

**Action items:**

- In WXR generation, emit `<wp:author>` elements matching `WXRData.authors`.
- Wrap all text via a CDATA-equivalent in xmlbuilder2 (or rely on XML escaping; CDATA is closer to upstream).

---

## 4. Taxonomies: Categories / Tags / Custom Terms

WordPress separates three groups of terms in `<channel>`:

1. **Categories** (`wp:category`)
2. **Tags** (`wp:tag`)
3. **Custom taxonomies** (`wp:term`)

### 4.1 Categories

Shape (simplified):

```xml
<wp:category>
  <wp:term_id>123</wp:term_id>
  <wp:category_nicename><![CDATA[slug]]></wp:category_nicename>
  <wp:category_parent><![CDATA[parent-slug-or-empty]]></wp:category_parent>
  <wp:cat_name><![CDATA[Human Readable Name]]></wp:cat_name>
  <wp:category_description><![CDATA[Description]]></wp:category_description>
  <!-- optional term meta -->
</wp:category>
```

Key behaviors:

- Categories are ordered so that no child is emitted before its parent.
- `category_parent` refers to the parent **slug**.
- Meta is exported via `<wp:termmeta>` children.

**Our `Category` model:**

- `name`, `slug`, `parent: Category | null`, `description?: string | null`.

**Mapping proposal:**

- `term_id`: we can synthesize sequential IDs (e.g., order in `WXRData.categories`).
- `category_nicename` ← `slug`.
- `category_parent` ← parent category's `slug` or empty string.
- `cat_name` ← `name`.
- `category_description` ← `description` if present.
- We can skip `termmeta` for now.

### 4.2 Tags

Shape:

```xml
<wp:tag>
  <wp:term_id>456</wp:term_id>
  <wp:tag_slug><![CDATA[tag-slug]]></wp:tag_slug>
  <wp:tag_name><![CDATA[Tag Name]]></wp:tag_name>
  <wp:tag_description><![CDATA[...]]></wp:tag_description>
  <!-- optional termmeta -->
</wp:tag>
```

Our `Tag` model:

- `name`, `slug`.

Mapping:

- `term_id`: synthetic sequential ID.
- `tag_slug` ← `slug`.
- `tag_name` ← `name`.
- We can leave `tag_description` empty.

### 4.3 Custom Terms (nav_menu, custom taxonomies)

For our Tistory migration MVP, we can ignore custom taxonomies and nav menus:

- `wp:term` with `taxonomy`, `slug`, `parent`, name, description, termmeta.
- `wxr_nav_menu_terms()` outputs `nav_menu` taxonomy terms.

**Decision:**

- Skip `<wp:term>` and nav menus for now (not relevant to Tistory).
- Ensure categories/tags cover required FR-016 (include posts, categories, tags).

---

## 5. Posts as `<item>` Elements

Each post/page/attachment/comment is represented as an `<item>` inside `<channel>`.

Core structure (simplified):

```xml
<item>
  <title><![CDATA[Post Title]]></title>
  <link>https://example.com/post-slug/</link>
  <pubDate>Mon, 01 Jan 2024 10:00:00 +0000</pubDate>
  <dc:creator><![CDATA[author_login]]></dc:creator>
  <guid isPermaLink="false">https://example.com/?p=123</guid>
  <description></description>
  <content:encoded><![CDATA[HTML Content]]></content:encoded>
  <excerpt:encoded><![CDATA[Excerpt]]></excerpt:encoded>

  <wp:post_id>123</wp:post_id>
  <wp:post_date><![CDATA[2024-01-01 10:00:00]]></wp:post_date>
  <wp:post_date_gmt><![CDATA[2024-01-01 10:00:00]]></wp:post_date_gmt>
  <wp:post_modified><![CDATA[...]]></wp:post_modified>
  <wp:post_modified_gmt><![CDATA[...]]></wp:post_modified_gmt>
  <wp:comment_status><![CDATA[open|closed]]></wp:comment_status>
  <wp:ping_status><![CDATA[open|closed]]></wp:ping_status>
  <wp:post_name><![CDATA[post-slug]]></wp:post_name>
  <wp:status><![CDATA[publish|draft|...]]></wp:status>
  <wp:post_parent>0</wp:post_parent>
  <wp:menu_order>0</wp:menu_order>
  <wp:post_type><![CDATA[post|page|attachment|...]]></wp:post_type>
  <wp:post_password><![CDATA[]]></wp:post_password>
  <wp:is_sticky>0|1</wp:is_sticky>

  <!-- If attachment -->
  <wp:attachment_url><![CDATA[https://example.com/wp-content/uploads/file.png]]></wp:attachment_url>

  <!-- Taxonomy terms for this post -->
  <category domain="category" nicename="cat-slug"><![CDATA[Cat Name]]></category>
  <category domain="post_tag" nicename="tag-slug"><![CDATA[Tag Name]]></category>
  <!-- plus any custom taxonomies -->

  <!-- Post meta -->
  <wp:postmeta>
    <wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key>
    <wp:meta_value><![CDATA[789]]></wp:meta_value>
  </wp:postmeta>

  <!-- Comments -->
  <wp:comment> ... </wp:comment>
</item>
```

Important details:

- Content and excerpt are filtered via `the_content_export` / `the_excerpt_export` and wrapped in CDATA.
- `guid` is usually a persistent identifier; not necessarily the same as permalink.
- `post_date` / `post_modified` and GMT variants are both exported (FR-006 + spec requirement for dates).
- Taxonomy links per post are written via `wxr_post_taxonomy()`:
  - For each term assigned to the post, a `<category>` element with attributes `domain` and `nicename` is output.
  - For default categories, `domain="category"`.
  - For tags, `domain="post_tag"`.

**Mapping from our `Post` model:**

Our `Post` interface:

- `url: string;` (Tistory URL)
- `title: string;`
- `content: string;` (cleaned HTML)
- `publish_date: Date;`
- `modified_date: Date | null;`
- `categories: Category[];`
- `tags: Tag[];`
- `images: Image[];`
- `attachments: Attachment[];`

**Proposed WXR mapping:**

- `<title>` ← `Post.title`.
- `<link>` ← derived WordPress target URL, or we can use original Tistory URL for now.
- `<guid isPermaLink="false">` ← original Tistory URL as a stable identifier.
- `<content:encoded>` ← cleaned HTML (`Post.content`).
- `<excerpt:encoded>` ← we can initially leave empty.
- `<wp:post_type>` ← `post` (we treat all Tistory entries as standard posts for v1).
- `<wp:status>` ← `publish`.
- `<wp:post_date>` / `_gmt`: format `Y-m-d H:i:s` from `publish_date`.
- `<wp:post_modified>` / `_gmt`: from `modified_date` if present, otherwise same as `publish_date`.
- `<dc:creator>`: default author login (e.g. `tistory`).
- `<wp:post_password>`: empty.
- `<wp:is_sticky>`: `0`.
- `<category>` elements per post:
  - For each `Post.categories[]`: `domain="category"`, `nicename=slug`, body=name.
  - For each `Post.tags[]`: `domain="post_tag"`, `nicename=slug`, body=name.

**Attachments vs. our model:**

- The core WXR for attachments uses a separate `<item>` with `post_type="attachment"` and `wp:attachment_url`.
- Our spec currently represents attachments inside `Post.attachments[]` and downloads to a local directory, but **FR-014 explicitly says image URLs are preserved** and attachments are downloaded separately.

For MVP we can:

- Keep images as-is in `content:encoded` (image URLs preserved).
- Optionally, represent non-image attachments via postmeta or additional `<item>`s later.

**Comments:**

- WordPress exports comments (`wp:comment`) and commentmeta.
- Tistory comment migration is not currently in our scope/spec, so we can safely omit comments in v1.

---

## 6. Encoding, CDATA, and Special Characters

Helper `wxr_cdata()` shows how WordPress protects content:

```php
$str = (string) $str;
if ( ! wp_is_valid_utf8( $str ) ) {
  $str = utf8_encode( $str );
}
$str = '<![CDATA[' . str_replace( ']]>', ']]]]><![CDATA[>', $str ) . ']]>';
```

Takeaways:

- All human-readable text fields (titles, content, excerpts, author names, term names) are wrapped in CDATA.
- The edge case `]]>` inside content is handled by splitting into multiple CDATA sections.
- Non-UTF-8 strings are coerced into UTF-8.

**For our generator:**

- xmlbuilder2 can handle escaping by default, but if we want high fidelity to WordPress:
  - Either:
    - Use normal text nodes and rely on escaping (simpler, usually works), or
    - Implement a small helper to wrap strings in CDATA and do the `]]>` replacement.
- Given FR-015/SC-002 (valid WXR importable by WordPress), ensuring well-formed XML is critical; CDATA is helpful but not strictly required if correct escaping is used.

---

## 7. What WordPress Skips / Filters

There are several filter hooks that affect what is exported:

- `wxr_export_skip_postmeta`: allows plugins to skip specific post meta entries.
- `wxr_export_skip_commentmeta`: same for comment meta.
- `wxr_export_skip_termmeta`: same for term meta.
- Internal `wxr_filter_postmeta` skips `_edit_lock` by default.

For our tool:

- We are not yet exporting postmeta/termmeta/comments, so we can ignore these filters for now.
- Later, if we add custom meta (e.g. original Tistory URL, migration markers), we will need a consistent strategy.

---

## 8. Gaps Between Our Current Implementation and Canonical WXR

Our current `WXRGenerator` (as of T026–T028) provides:

- Basic `<rss>` + `<channel>` skeleton with namespaces (but currently hard-coded to `wp: 1.2` namespace root without the trailing `/excerpt/` pattern).
- Channel metadata: `title`, `link`, `description` from `WXRData.site_info`.
- Aggregation helpers:
  - `addPost` merges posts, categories, tags.
  - `finalize` writes XML to file.

**Missing or incomplete vs WordPress export:**

1. **Channel-level elements**
   - Missing: `pubDate`, `language`, `wp:wxr_version`, `wp:base_site_url`, `wp:base_blog_url`.
2. **Authors**
   - Not yet emitted as `<wp:author>` elements.
3. **Taxonomy definitions**
   - `WXRData.categories` / `tags` are not yet written as `<wp:category>` / `<wp:tag>` under `<channel>`.
4. **Post items**
   - We currently do **not** emit any `<item>` elements at all; integration with `Post` will come with `PostProcessor` + further WXRGenerator enhancements.
5. **Per-post taxonomies**
   - `category` elements under `<item>` are not yet generated.
6. **Encoding / CDATA**
   - We rely on xmlbuilder2 defaults; no explicit CDATA handling.
7. **Attachments/comments/meta**
   - Entirely omitted in MVP, which is acceptable for initial Tistory migration, but different from full WordPress export.

---

## 9. Recommended Enhancements for Our WXR Generator

Based on this analysis, here are concrete enhancements we should plan for next phases:

1. **Channel metadata parity**
   - Add to `build()`:
     - `<pubDate>` with `gmdate`-like timestamp at export time.
     - `<language>`: configurable (env or default).
     - `<wp:wxr_version>` hard-coded to `1.2`.
     - `<wp:base_site_url>` / `<wp:base_blog_url>` from `Config.blogUrl` (or separate config if needed).

2. **Authors emission**
   - Iterate over `WXRData.authors` and emit `<wp:author>` elements, mapping:
     - `author_id` ← `id`
     - `author_login` ← `login`
     - `author_display_name` ← `display_name`
   - Optionally allow additional fields later.

3. **Global taxonomy sections**
   - Emit `<wp:category>` and `<wp:tag>` elements from deduplicated `WXRData.categories` / `tags` using the mapping described in §4.

4. **Post `<item>` generation API**
   - Extend `WxrGenerator` with a method like `buildItem(post: Post, index: number): XmlNode` or similar, or provide `addPostToXml(doc, post)`.
   - Map `Post` fields into the canonical structure described in §5, at least:
     - title, guid, link, content:encoded, post dates, post_type/post_status, basic taxonomies.

5. **Taxonomies per post**
   - For each post, in addition to global categories/tags, emit:
     - `<category domain="category" nicename="cat-slug">Cat Name</category>`
     - `<category domain="post_tag" nicename="tag-slug">Tag Name</category>`

6. **CDATA helper**
   - Optionally, add a small helper to emulate `wxr_cdata()` using xmlbuilder2 CDATA nodes to:
     - Reduce risk of invalid XML when content includes HTML entities or `]]>`.

7. **Future (out of MVP scope, but aligned with export.php)**
   - Optional attachment items (`post_type="attachment"`) for `Post.attachments`.
   - Optional comment export if Tistory comments are ever ingested.
   - Optional meta export for tracing original Tistory URL (e.g. `_tistory_original_url`).

---

## 10. How This Guides Our Next Implementation Steps

For the next iterations of the spec (`T029+` and WXRGenerator enhancements), we should:

- Treat `export.php` as the canonical contract for WXR compatibility.
- Ensure that any WXR we generate can be structurally diffed against a real WordPress export with similar content.
- Prioritize the following in near-term tasks:
  1. Add missing channel-level fields and `<wp:author>` emission.
  2. Implement global taxonomy sections `<wp:category>` / `<wp:tag>`.
  3. Define and implement the `<item>` generation contract so that `PostProcessor` can call it with our `Post` instances.

This will move our generator from a minimal skeleton toward a fully WordPress-aligned WXR output, increasing confidence that the WordPress Importer plugin will accept and faithfully reconstruct Tistory content.
