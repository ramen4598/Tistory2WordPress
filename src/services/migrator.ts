import { createCrawler, type Crawler } from './crawler';
import { createCleaner, type Cleaner } from './cleaner';
import { createBookmarkProcessor, type BookmarkProcessor } from './bookmarkProcessor';
import { type ImageProcessor, createImageProcessor } from './imageProcessor';
import { createLinkTracker, type LinkTracker } from './linkTracker';
import { createWpClient, type WpClient } from './wpClient';
import { getLogger } from '../utils/logger';
import { createMigrationJobItem, createPostMap, updateMigrationJobItem } from '../db';
import { MigrationJobItemStatus } from '../enums/db.enum';
import type { Post } from '../models/Post';

export interface MigratorContext {
  jobId: number;
}

export interface Migrator {
  /**
   * Migrate a post from the given URL to WordPress.
   * @param url The URL of the post to migrate.
   * @param context The migration context containing job information.
   */
  migratePostByUrl(url: string, context: MigratorContext): Promise<void>;
}

export interface CreateMigratorOptions {
  crawler?: Crawler;
  cleaner?: Cleaner;
  bookmarkProcessor?: BookmarkProcessor;
  linkTracker?: LinkTracker;
  imageProcessor?: ImageProcessor;
  wpClient?: WpClient;
}

export function createMigrator(options: CreateMigratorOptions = {}): Migrator {
  const logger = getLogger();

  const crawler = options.crawler ?? createCrawler({ fetchFn: fetch });
  const cleaner = options.cleaner ?? createCleaner();
  const bookmarkProcessor = options.bookmarkProcessor ?? createBookmarkProcessor();
  const linkTracker = options.linkTracker ?? createLinkTracker();
  const wpClient = options.wpClient ?? createWpClient();
  const imageProcessor = options.imageProcessor ?? createImageProcessor(wpClient);

  // TODO: 예외 처리 강화 (전반적인 예외 처리 강화가 필요)
  const migratePostByUrl = async (url: string, context: MigratorContext): Promise<void> => {
    const jobItem = createMigrationJobItem({ job_id: context.jobId, tistory_url: url });

    let wpPostId: number | null = null;
    let post: Post | null = null;

    try {
      const html = await crawler.fetchPostHtml(url);
      const metadata = crawler.parsePostMetadata(html, url);
      const featuredImageUrl: string | null = crawler.extractFImgUrl(html);
      const bookmarkProcessedHtml = await bookmarkProcessor.replaceBookmarks(html);
      const cleanedHtml = cleaner.cleanHtml(bookmarkProcessedHtml);

      post = {
        url,
        title: metadata.title,
        content: cleanedHtml,
        publish_date: metadata.publish_date,
        modified_date: metadata.modified_date,
        categories: metadata.categories,
        tags: metadata.tags,
        images: [],
        featured_image: null,
        // attachments: [], // needed?
      };

      linkTracker.trackInternalLinks(url, post.content, jobItem.id);

      post.featured_image = featuredImageUrl
        ? await imageProcessor.processFImg(jobItem.id, post.title, featuredImageUrl)
        : null;
      post = await imageProcessor.processImgs(post, jobItem.id);

      const categoryIds = await Promise.all(
        post.categories.map(async (category) => {
          const parentId = category.parent
            ? await wpClient.ensureCategory(category.parent.name)
            : 0;
          return wpClient.ensureCategory(category.name, parentId);
        })
      );

      const tagIds = await Promise.all(post.tags.map(async (tag) => wpClient.ensureTag(tag.name)));

      const wpPost = await wpClient.createDraftPost({
        title: post.title,
        content: post.content,
        date: post.publish_date.toISOString(),
        categories: categoryIds,
        tags: tagIds,
        featuredImageId: post.featured_image?.wp_media_id ?? null,
      });

      wpPostId = wpPost.id;

      createPostMap({ tistory_url: url, wp_post_id: wpPostId });
      updateMigrationJobItem(jobItem.id, {
        status: MigrationJobItemStatus.COMPLETED,
        wp_post_id: wpPostId,
        error_message: null,
        updated_at: new Date().toISOString(),
      });

      logger.info('Migrator.migratePostByUrl - migrated post successfully', {
        url,
        jobId: context.jobId,
        jobItemId: jobItem.id,
        wpPostId,
      });
    } catch (error) {
      const message = (error as Error)?.message ?? String(error);
      logger.error('Migrator.migratePostByUrl - migrate post failed; starting rollback', {
        url,
        jobId: context.jobId,
        jobItemId: jobItem.id,
        wpPostId,
        uploadedImageCount: post?.images.length ?? 0,
        error: message,
      });

      // --- rollback (best effort) ---
      if (post?.featured_image?.wp_media_id != null) {
        try {
          await wpClient.deleteMedia(post.featured_image.wp_media_id);
        } catch (rollbackError) {
          logger.error('Migrator.migratePostByUrl - rollback delete featured image failed', {
            url,
            wpMediaId: post.featured_image.wp_media_id,
            error: (rollbackError as Error)?.message ?? String(rollbackError),
          });
        }
      }

      for (const image of post?.images ?? []) {
        if (image.wp_media_id == null) continue;
        try {
          await wpClient.deleteMedia(image.wp_media_id);
        } catch (rollbackError) {
          logger.error('Migrator.migratePostByUrl - rollback delete media failed', {
            url,
            wpMediaId: image.wp_media_id,
            error: (rollbackError as Error)?.message ?? String(rollbackError),
          });
        }
      }

      if (wpPostId != null) {
        try {
          await wpClient.deletePost(wpPostId);
        } catch (rollbackError) {
          logger.error('Migrator.migratePostByUrl - rollback delete post failed', {
            url,
            wpPostId,
            error: (rollbackError as Error)?.message ?? String(rollbackError),
          });
        }
      }

      updateMigrationJobItem(jobItem.id, {
        status: MigrationJobItemStatus.FAILED,
        error_message: message,
        updated_at: new Date().toISOString(),
      });

      logger.info('Migrator.migratePostByUrl - rollback completed', {
        url,
        jobId: context.jobId,
        jobItemId: jobItem.id,
        wpPostId,
      });
      throw error;
    }
  };

  return { migratePostByUrl };
}
