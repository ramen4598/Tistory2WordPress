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

export const createWxrGenerator = (options: WxrGeneratorOptions = {}): WxrGenerator => {
  const createXmlBuilder = options.createXmlBuilder ?? create;

  const build = (data: WXRData): string => {
    const doc = createXmlBuilder({
      version: '1.0',
      encoding: 'UTF-8',
    })
      .ele('rss', {
        version: '2.0',
        'xmlns:excerpt': 'http://wordpress.org/export/1.2/excerpt/',
        'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
        'xmlns:wfw': 'http://wellformedweb.org/CommentAPI/',
        'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
        'xmlns:wp': 'http://wordpress.org/export/1.2/',
      })
      .ele('channel');

    // Basic site metadata
    doc.ele('title').txt(data.site_info.title).up();
    doc.ele('link').txt(data.site_info.url).up();
    doc.ele('description').txt(data.site_info.description).up();

    return doc.end({ prettyPrint: true });
  };

  const addPost = (current: WXRData, post: Post): WXRData => {
    const posts = [...current.posts, post];
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
