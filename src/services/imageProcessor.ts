import axios from 'axios';
import * as cheerio from 'cheerio';
import { Post } from '../models/Post';
import { createWpClient } from './wpClient';
import { createImageAsset, updateImageAsset } from '../db';
import { ImageAssetStatus } from '../enums/db.enum';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export interface ImageProcessorContext {
  jobItemId: number;
}

export interface ProcessImagesResult {
  updatedPost: Post;
  uploadedMediaIds: number[];
}

export function createImageProcessor() {
  const config = loadConfig();
  const logger = getLogger();
  const wpClient = createWpClient();

  const processImagesForPost = async (
    post: Post,
    context: ImageProcessorContext
  ): Promise<ProcessImagesResult> => {
    const $ = cheerio.load(post.content);
    const imgElements = $('img');
    if (imgElements.length === 0) {
      return { updatedPost: post, uploadedMediaIds: [] };
    }

    const uploadedMediaIds: number[] = [];

    for (let i = 0; i < imgElements.length; i++) {
      const img = imgElements.eq(i);
      const originalUrl = img.attr('src');
      const altText = img.attr('alt') ?? null;

      if (!originalUrl) {
        continue;
      }

      const asset = createImageAsset({
        job_item_id: context.jobItemId,
        tistory_image_url: originalUrl,
      });

      try {
        const downloadExec = async () => {
          const response = await axios.get<ArrayBuffer>(originalUrl, {
            responseType: 'arraybuffer',
          });
          return response;
        };

        const response = await retryWithBackoff(downloadExec, config, {
          onRetry: (error, attempt, delayMs) => {
            logger.warn(
              'Retrying image download',
              { imageUrl: originalUrl, attempt, delayMs },
              String(error)
            );
          },
        });

        const buffer = Buffer.from(response.data as ArrayBuffer);
        const mimeType = response.headers['content-type'] || 'application/octet-stream';

        // const fileName = post.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').append(`-image-${i + 1}`);
        const fileName = post.title
          .toLowerCase()
          .replace(/\s+/g, '-') // replace multiple spaces with single hyphen
          .replace(/[^a-z0-9\-]/g, '') // keep a-z, 0-9, hyphen and remove others
          .substring(0, 20) // limit length
          .concat(`-image-${i + 1}`); // append image index

        const uploadResult = await wpClient.uploadMedia({
          fileName,
          mimeType,
          buffer,
          altText: altText ?? undefined,
        });

        updateImageAsset(asset.id, {
          status: ImageAssetStatus.UPLOADED,
          wp_media_id: uploadResult.id,
          wp_media_url: uploadResult.url,
        });

        uploadedMediaIds.push(uploadResult.id);
        img.attr('src', uploadResult.url);
      } catch (error) {
        const message = (error as Error).message ?? String(error);
        updateImageAsset(asset.id, {
          status: ImageAssetStatus.FAILED,
          error_message: message,
        });
        throw error;
      }
    }

    return {
      updatedPost: { ...post, content: $.html() },
      uploadedMediaIds,
    };
  };

  return { processImagesForPost };
}
