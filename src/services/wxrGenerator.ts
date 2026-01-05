import { create } from 'xmlbuilder2';
import { promises as fs } from 'fs';
import * as path from 'path';
import { WXRData } from '../models/WXRData';
import { Post } from '../models/Post';
import { Category } from '../models/Category';
import { Tag } from '../models/Tag';

export interface WxrGenerator {
  /**
   * Build full WXR XML string from aggregated data.
   */
  build: (data: WXRData) => string;

  /**
   * Add a post into aggregated WXRData while deduplicating
   * categories and tags by slug.
   */
  addPost: (current: WXRData, post: Post) => WXRData;

  /**
   * Build WXR XML from data and write it to the given file path.
   */
  finalize: (data: WXRData, filePath: string) => Promise<void>;
}

export interface WxrGeneratorOptions {
  /**
   * Factory for XML builder, primarily for testability.
   */
  createXmlBuilder?: typeof create;
}

const mergeCategories = (existing: Category[], incoming: Category[]): Category[] => {
  const bySlug = new Map<string, Category>();

  for (const category of existing) {
    bySlug.set(category.slug, category);
  }

  for (const category of incoming) {
    if (!bySlug.has(category.slug)) {
      bySlug.set(category.slug, category);
    }
  }

  return Array.from(bySlug.values());
};

const mergeTags = (existing: Tag[], incoming: Tag[]): Tag[] => {
  const bySlug = new Map<string, Tag>();

  for (const tag of existing) {
    bySlug.set(tag.slug, tag);
  }

  for (const tag of incoming) {
    if (!bySlug.has(tag.slug)) {
      bySlug.set(tag.slug, tag);
    }
  }

  return Array.from(bySlug.values());
};

/**
 * Format date to RFC 2822 format for WXR pubDate.
 * E.g., "Mon, 25 Dec 2023 15:30:00 +0000"
 * @param date The date to format.
 * @returns The formatted date string. Follow RFC 2822 format.
 */
export const formatPubDate = (date: Date): string => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const dayName = days[date.getUTCDay()];
  const monthName = months[date.getUTCMonth()];
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${dayName}, ${day} ${monthName} ${year} ${hours}:${minutes}:${seconds} +0000`;
};

export const formatWXRDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const formatWXRGMTDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Extract slug from a given URL.
 * E.g., "https://example.com/2024/06/slug-name" -> "slug-name"
 * E.g., "https://example.com/2024/06/slug-name/" -> "slug-name"
 * E.g., "https://example.com/2024/06/" -> "06"
 * E.g., "https://example.com/" -> "https://example.com/1696547200000"
 * @param url The URL to extract slug from.
 * @returns The extracted slug.
 */
export const extractSlug = (url: string): string => {
  const parts = url.split('/');
  const lastPart =
    parts[parts.length - 1] || parts[parts.length - 2] || url + new Date().getTime().toString();
  return lastPart;
};

/**
 * Sort categories so that parent categories come before their children.
 * @param categories The list of categories to sort.
 * @returns The sorted list of categories.
 */
const sortCategories = (categories: Category[]): Category[] => {
  const bySlug = new Map<string, Category>();
  for (const cat of categories) {
    bySlug.set(cat.slug, cat);
  }

  const sorted: Category[] = [];
  const added = new Set<string>();

  const addCategory = (cat: Category): void => {
    if (added.has(cat.slug)) {
      return;
    }

    if (cat.parent && !added.has(cat.parent.slug)) {
      const parent = bySlug.get(cat.parent.slug);
      if (parent) {
        addCategory(parent);
      }
    }

    added.add(cat.slug);
    sorted.push(cat);
  };

  for (const cat of categories) {
    addCategory(cat);
  }

  return sorted;
};

export const createWxrGenerator = (options: WxrGeneratorOptions = {}): WxrGenerator => {
  const createXmlBuilder = options.createXmlBuilder ?? create;

  const build = (data: WXRData): string => {
    const doc = createXmlBuilder({
      version: '1.0',
      encoding: 'UTF-8',
    });

    doc.ele('rss', {
      version: '2.0',
      'xmlns:excerpt': 'http://wordpress.org/export/1.2/excerpt/',
      'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
      'xmlns:wfw': 'http://wellformedweb.org/CommentAPI/',
      'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      'xmlns:wp': 'http://wordpress.org/export/1.2/',
    });

    doc.ele('channel');
    doc.ele('title').txt(data.site_info.title).up();
    doc.ele('link').txt(data.site_info.url).up();
    // doc.ele('description').txt(data.site_info.description).up(); // 기존 Wordpress 상세 설명을 유지하기 위해서 생략
    // eslint-disable-next-line prettier/prettier
    doc.ele('language').txt(data.site_info.language ?? 'ko-KR').up();
    doc.ele('pubDate').txt(formatPubDate(new Date())).up();
    doc.ele('wp:wxr_version').txt('1.2').up();
    doc.ele('wp:base_site_url').txt(data.site_info.url).up();
    doc.ele('wp:base_blog_url').txt(data.site_info.url).up();

    data.authors.forEach((author) => {
      doc
        .ele('wp:author')
        .ele('wp:author_id')
        .txt(author.id.toString())
        .up()
        .ele('wp:author_login')
        .dat(author.login)
        .up()
        .ele('wp:author_display_name')
        .dat(author.display_name)
        .up()
        .up();
    });

    const sortedCategories = sortCategories(data.categories);
    sortedCategories.forEach((cat, idx) => {
      const categoryEl = doc.ele('wp:category');
      // eslint-disable-next-line prettier/prettier
      categoryEl.ele('wp:term_id').txt((idx + 1).toString()).up();
      categoryEl.ele('wp:category_nicename').dat(cat.slug).up();
      // eslint-disable-next-line prettier/prettier
      categoryEl.ele('wp:category_parent').dat(cat.parent?.slug || ' ').up();
      categoryEl.ele('wp:cat_name').dat(cat.name).up();
      if (cat.description) {
        categoryEl.ele('wp:category_description').dat(cat.description).up();
      }
      categoryEl.up();
    });

    data.tags.forEach((tag, idx) => {
      const tagEl = doc.ele('wp:tag');
      // eslint-disable-next-line prettier/prettier
      tagEl.ele('wp:term_id').txt((idx + 1).toString()).up();
      tagEl.ele('wp:tag_slug').dat(tag.slug).up();
      tagEl.ele('wp:tag_name').dat(tag.name).up();
      tagEl.up();
    });

    data.posts.forEach((post, postIdx) => {
      const postId = post.id ?? postIdx + 1; // TODO: post.id와 postIdx 중복 방지 확인. post.id 필수화.
      const item = doc.ele('item');
      item.ele('title').txt(post.title).up();
      item.ele('link').txt(post.url).up();
      item.ele('pubDate').txt(formatPubDate(post.publish_date)).up();
      item.ele('dc:creator').txt('tistory').up();
      item.ele('guid', { isPermaLink: 'false' }).txt(post.url).up();
      item.ele('content:encoded').txt(post.content).up();
      // item.ele('content:encoded').dat(post.content).up(); // TODO: CDATA handling
      item.ele('wp:post_id').txt(postId.toString()).up();
      item.ele('wp:post_date').txt(formatWXRDate(post.publish_date)).up();
      item.ele('wp:post_date_gmt').txt(formatWXRGMTDate(post.publish_date)).up();

      const modifiedDate = post.modified_date ?? post.publish_date;
      item.ele('wp:post_modified').txt(formatWXRDate(modifiedDate)).up();
      item.ele('wp:post_modified_gmt').txt(formatWXRGMTDate(modifiedDate)).up();

      item.ele('wp:comment_status').txt('open').up();
      item.ele('wp:ping_status').txt('open').up();
      item.ele('wp:post_name').txt(extractSlug(post.url)).up();
      item.ele('wp:status').txt('publish').up();
      item.ele('wp:post_parent').txt('0').up();
      item.ele('wp:menu_order').txt('0').up();
      item.ele('wp:post_type').txt('post').up();
      item.ele('wp:post_password').txt('').up();
      item.ele('wp:is_sticky').txt('0').up();

      post.categories.forEach((cat) => {
        item
          .ele('category', {
            domain: 'category',
            nicename: cat.slug,
          })
          .dat(cat.name)
          .up();
      });

      post.tags.forEach((tag) => {
        item
          .ele('category', {
            domain: 'post_tag',
            nicename: tag.slug,
          })
          .dat(tag.name)
          .up();
      });

      item.up();
    });

    return doc.end({ prettyPrint: true });
  };

  const addPost = (current: WXRData, post: Post): WXRData => {
    const postId = current.posts.length + 1;
    const postWithId: Post = { ...post, id: postId };
    const posts = [...current.posts, postWithId];
    const categories = mergeCategories(current.categories, post.categories);
    const tags = mergeTags(current.tags, post.tags);

    return {
      ...current,
      posts,
      categories,
      tags,
    };
  };

  const finalize = async (data: WXRData, filePath: string): Promise<void> => {
    const xml = build(data);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, xml, 'utf-8');
  };

  return {
    build,
    addPost,
    finalize,
  };
};
