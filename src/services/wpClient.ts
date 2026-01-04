import axios, { type AxiosError, type AxiosInstance } from 'axios';
import FormData from 'form-data';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export interface CreateDraftPostOptions {
  title: string;
  content: string;
  date: string;
  categories: number[];
  tags: number[];
  featuredMediaId?: number; // Future use
}

export interface CreateDraftPostResult {
  id: number;
  status: string;
  link: string;
}

export interface UploadMediaOptions {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  altText?: string;
  title?: string;
}

export interface UploadMediaResult {
  id: number;
  url: string;
  mediaType: string;
  mimeType: string;
}

/**
 * Client for interacting with WordPress REST API.
 * Supports creating draft posts and uploading media.
 * Includes retry logic for transient failures.
 */
export interface WpClient {
  /**
   * Creates a draft post in WordPress.
   * @param options Options for creating the draft post.
   * @returns Result containing the ID, status, and link of the created post.
   */
  createDraftPost(options: CreateDraftPostOptions): Promise<CreateDraftPostResult>;
  /**
   * Uploads media to WordPress.
   * @param options Options for uploading the media.
   * @returns Result containing the ID, URL, media type, and MIME type of the uploaded media.
   */
  uploadMedia(options: UploadMediaOptions): Promise<UploadMediaResult>;
  /**
   * Deletes media from WordPress.
   * @param mediaId The ID of the media to delete.
   * @throws Error if deletion fails.
   */
  deleteMedia(mediaId: number): Promise<void>;
  /**
   * Deletes a post from WordPress.
   * @param postId The ID of the post to delete.
   * @throws Error if deletion fails.
   */
  deletePost(postId: number): Promise<void>;
}

function isRetryableStatus(status?: number): boolean {
  if (!status) return false;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

function getAxiosErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<any>;

  if (axiosError && axiosError.isAxiosError) {
    const status = axiosError.response?.status;
    const statusText = axiosError.response?.statusText;
    const message = axiosError.response?.data?.message;
    return `HTTP ${status ?? 'unknown'} ${statusText ?? ''} ${message ?? ''}`.trim();
  }

  return (error as Error)?.message ?? String(error);
}

export function createWpClient(): WpClient {
  const config = loadConfig();
  const logger = getLogger();

  // Remove trailing slash if any. e.g., https://example.com/ -> https://example.com
  const baseUrl = config.wpBaseUrl.replace(/\/$/, '');
  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  const auth = Buffer.from(`${config.wpAppUser}:${config.wpAppPassword}`).toString('base64');

  const client: AxiosInstance = axios.create({
    baseURL: apiBase,
    headers: {
      Authorization: `Basic ${auth}`,
    },
    timeout: 30000,
  });

  async function withRetry<T>(
    fn: () => Promise<T>,
    context: { operation: string; url: string }
  ): Promise<T> {
    const wrapped = async () => {
      try {
        return await fn();
      } catch (error) {
        const axiosError = error as AxiosError;
        if (!axiosError.isAxiosError || !isRetryableStatus(axiosError.response?.status)) {
          throw error;
        }
        throw error;
      }
    };

    return retryWithBackoff(wrapped as () => Promise<T>, config, {
      onRetry: (error, attempt, delayMs) => {
        logger.warn(
          'Retrying WordPress request',
          { operation: context.operation, url: context.url, attempt, delayMs },
          getAxiosErrorMessage(error)
        );
      },
    });
  }

  const createDraftPost = async (
    options: CreateDraftPostOptions
  ): Promise<CreateDraftPostResult> => {
    type WpPostPayload = {
      title: string;
      content: string;
      status: 'draft';
      date: string;
      categories: number[];
      tags: number[];
      featured_media?: number;
    };

    const { title, content, date, categories, tags, featuredMediaId } = options;
    const payload: WpPostPayload = {
      title,
      content,
      status: 'draft',
      date,
      categories,
      tags,
    };

    if (featuredMediaId) {
      payload.featured_media = featuredMediaId;
    }

    const exec = async () => {
      const response = await client.post('/posts', payload);
      return response.data as { id: number; status: string; link: string };
    };

    try {
      const data = await withRetry(exec, {
        operation: 'createDraftPost',
        url: `${apiBase}/posts`,
      });

      logger.info('Created WordPress draft post', {
        wpPostId: data.id,
        status: data.status,
      });

      return {
        id: data.id,
        status: data.status,
        link: data.link,
      };
    } catch (error) {
      const message = getAxiosErrorMessage(error);
      logger.error('Failed to create WordPress draft post', {
        error: message,
        title,
      });
      throw error;
    }
  };

  const uploadMedia = async (options: UploadMediaOptions): Promise<UploadMediaResult> => {
    const { fileName, mimeType, buffer, altText, title } = options;

    const form = new FormData();
    form.append('file', buffer, {
      filename: fileName,
      contentType: mimeType,
    });

    if (altText) {
      form.append('alt_text', altText);
    }
    if (title) {
      form.append('title', title);
    }

    type WpMediaResponse = {
      id: number;
      source_url: string;
      media_type: string;
      mime_type: string;
    };

    const exec = async () => {
      const response = await client.post<WpMediaResponse>('/media', form, {
        headers: form.getHeaders(),
      });
      return response.data;
    };

    try {
      const data = await withRetry(exec, {
        operation: 'uploadMedia',
        url: `${apiBase}/media`,
      });

      logger.info('Uploaded WordPress media', {
        wpMediaId: data.id,
        url: data.source_url,
      });

      return {
        id: data.id,
        url: data.source_url,
        mediaType: data.media_type,
        mimeType: data.mime_type,
      };
    } catch (error) {
      const message = getAxiosErrorMessage(error);
      logger.error('Failed to upload WordPress media', {
        error: message,
        fileName,
      });
      throw error;
    }
  };

  const deleteMedia = async (mediaId: number): Promise<void> => {
    try {
      await client.delete(`/media/${mediaId}?force=true`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (axiosError.isAxiosError && status === 404) {
        logger.warn('Media already absent during rollback', { wpMediaId: mediaId });
        return;
      }

      const message = getAxiosErrorMessage(error);
      logger.error('Failed to delete WordPress media during rollback', {
        error: message,
        wpMediaId: mediaId,
      });
      throw error;
    }
  };

  const deletePost = async (postId: number): Promise<void> => {
    try {
      await client.delete(`/posts/${postId}?force=true`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (axiosError.isAxiosError && status === 404) {
        logger.warn('Post already absent during rollback', { wpPostId: postId });
        return;
      }

      const message = getAxiosErrorMessage(error);
      logger.error('Failed to delete WordPress post during rollback', {
        error: message,
        wpPostId: postId,
      });
      throw error;
    }
  };

  return { createDraftPost, uploadMedia, deleteMedia, deletePost };
}
