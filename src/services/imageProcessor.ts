import axios from 'axios';
import * as cheerio from 'cheerio';
import { Post } from '../models/Post';
import { createWpClient, WpClient, UploadMediaResult } from './wpClient';
import { createImageAsset, updateImageAsset } from '../db';
import { ImageAssetStatus } from '../enums/db.enum';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { Image } from '../models/Image';

export interface ImageUploaderOptions {
  jobItemId: number;
  title: string;
  source_url: string;
  alt_text: string | null;
}

export interface ImageProcessor {
  /**
   * Processs a featured image to WordPress.
   * @param jobItemId - The migration job item ID for tracking.
   * @param title - The title of the post (used for naming).
   * @param featuredImageUrl - The URL of the featured image to process.
   * @returns A promise that resolves to the uploaded Image.
   */
  processFImg: (jobItemId: number, title: string, featuredImageUrl: string) => Promise<Image>;
  /**
   * Processes images in the given post by downloading them from their original URLs,
   * uploading them to WordPress, and rewriting the image URLs in the post content.
   *
   * @param post - The post containing images to be processed.
   * @param jobItemId - The migration job item ID for tracking.
   * @returns A promise that resolves to the updated post with processed images.
   */
  processImgs: (post: Post, jobItemId: number) => Promise<Post>;
}

export function createImageProcessor(wpc?: WpClient): ImageProcessor {
  const config = loadConfig();
  const logger = getLogger();
  const wpClient = wpc ?? createWpClient();

  const getExtensionFromMimeType = (mimeType: string): string => {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff',
    };
    return mimeToExt[mimeType] || 'bin';
  };

  // const makeFileName = ({ prefix: string, index?: number, mimeType: string }): string => {
  const makeFileName = ({
    prefix,
    index,
    mimeType,
  }: {
    prefix: string;
    index?: number;
    mimeType: string;
  }): string => {
    // Make a safe file name based on post title and index
    const safePrefix = prefix
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric characters with hyphens
      .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with a single hyphen
      .substring(0, 15); // Limit length to 15 characters
    const indexPart = index !== undefined ? `-${index + 1}` : '';
    const extension = getExtensionFromMimeType(mimeType);
    return `${safePrefix}-image${indexPart}.${extension}`;
  };

  /**
   * Uploads a single image to WordPress.
   * @param uploaderOptions - Options for uploading the image.
   * @returns A promise that resolves to the upload media result.
   */
  const uploadImage = async (uploaderOptions: ImageUploaderOptions): Promise<UploadMediaResult> => {
    const { jobItemId, title, source_url, alt_text } = uploaderOptions;

    const asset = createImageAsset({
      job_item_id: jobItemId,
      tistory_image_url: source_url,
    });

    try {
      const downloadExec = async () => {
        const response = await axios.get<ArrayBuffer>(source_url, {
          responseType: 'arraybuffer',
        });
        return response;
      };

      const response = await retryWithBackoff(downloadExec, config, {
        onRetry: (error, attempt, delayMs) => {
          logger.warn(
            'Retrying image download',
            { imageUrl: uploaderOptions.source_url, attempt, delayMs },
            String(error)
          );
        },
      });

      const buffer = Buffer.from(response.data as ArrayBuffer);
      const mimeType = response.headers['content-type'] || 'application/octet-stream';
      const fileName = makeFileName({ prefix: title, mimeType: mimeType });

      const uploadResult = await wpClient.uploadMedia({
        fileName,
        mimeType,
        buffer,
        altText: alt_text ?? undefined,
      });

      updateImageAsset(asset.id, {
        status: ImageAssetStatus.UPLOADED,
        wp_media_id: uploadResult.id,
        wp_media_url: uploadResult.url,
      });

      return uploadResult;
    } catch (error) {
      const message = (error as Error).message ?? String(error);
      updateImageAsset(asset.id, {
        status: ImageAssetStatus.FAILED,
        error_message: message,
      });
      throw error;
    }
  };

  const processFImg = async (
    jobItemId: number,
    title: string,
    featuredImageUrl: string
  ): Promise<Image> => {
    const uploadResult = await uploadImage({
      jobItemId,
      title,
      source_url: featuredImageUrl,
      alt_text: `Featured image for ${title}`,
    });

    return {
      url: featuredImageUrl,
      alt_text: `Featured image for ${title}`,
      wp_media_id: uploadResult.id,
      wp_media_url: uploadResult.url,
    };
  };

  const processImgs = async (post: Post, jobItemId: number): Promise<Post> => {
    const $ = cheerio.load(post.content);
    // const imgElements = $('img');
    const imgElements = $('img');

    const filtered = imgElements.filter((_, el) => {
      // Filter out images that are inside figure.bookmark-card
      return $(el).closest('figure.bookmark-card').length === 0;
    });

    if (filtered.length === 0) {
      return post;
    }

    const uploadedImages: Image[] = [];

    for (let i = 0; i < filtered.length; i++) {
      const img = filtered.eq(i);
      const originalUrl = img.attr('src');
      const altText = img.attr('alt') ?? null;

      if (!originalUrl) {
        continue;
      }

      const uploadResult = await uploadImage({
        jobItemId,
        title: post.title,
        source_url: originalUrl,
        alt_text: altText,
      });

      img.attr('src', uploadResult.url);
      uploadedImages.push({
        url: originalUrl,
        alt_text: altText,
        wp_media_id: uploadResult.id,
        wp_media_url: uploadResult.url,
      });
    }

    return { ...post, content: $.html(), images: uploadedImages };
  };

  return { processFImg, processImgs };
}
