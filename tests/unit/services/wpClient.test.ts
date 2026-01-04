import axios, { type AxiosInstance } from 'axios';
import { loadConfig } from '../../../src/utils/config';
import { getLogger } from '../../../src/utils/logger';
import { createWpClient, type WpClient } from '../../../src/services/wpClient';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('axios');
jest.mock('../../../src/utils/config');
jest.mock('../../../src/utils/logger');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('wpClient', () => {
  let axiosInstance: { post: jest.Mock; delete: jest.Mock };
  let loggerMock: { info: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    axiosInstance = {
      post: jest.fn(),
      delete: jest.fn(),
    } as unknown as { post: jest.Mock; delete: jest.Mock };

    mockedAxios.create.mockReturnValue(axiosInstance as unknown as AxiosInstance);

    mockedLoadConfig.mockReturnValue(baseConfig);
    loggerMock = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    (getLogger as jest.Mock).mockReturnValue(loggerMock);

    jest.clearAllMocks();
  });

  const createClient = (): WpClient => createWpClient();

  describe('happy paths', () => {
    it('creates a draft post via /posts', async () => {
      const client = createClient();

      const responseData = {
        id: 456,
        status: 'draft',
        link: 'https://example.wordpress.com/?p=456',
      };
      axiosInstance.post.mockResolvedValue({ data: responseData } as unknown);

      const result = await client.createDraftPost({
        title: 'Post Title',
        content: '<p>content</p>',
        date: '2026-01-01T12:00:00',
        categories: [10],
        tags: [20],
        featuredMediaId: 123,
      });

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://example.wordpress.com/wp-json/wp/v2',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
          timeout: 30000,
        })
      );

      expect(axiosInstance.post).toHaveBeenCalledWith('/posts', {
        title: 'Post Title',
        content: '<p>content</p>',
        status: 'draft',
        date: '2026-01-01T12:00:00',
        categories: [10],
        tags: [20],
        featured_media: 123,
      });

      expect(result).toEqual(responseData);
    });

    it('uploads media via /media', async () => {
      const client = createClient();

      const mediaResponse = {
        id: 123,
        source_url: 'https://example.wordpress.com/wp-content/uploads/image.jpg',
        media_type: 'image',
        mime_type: 'image/jpeg',
      };

      axiosInstance.post.mockResolvedValue({ data: mediaResponse } as unknown);

      const buffer = Buffer.from('fake-image');

      const result = await client.uploadMedia({
        fileName: 'image.jpg',
        mimeType: 'image/jpeg',
        buffer,
        altText: 'alt',
        title: 'title',
      });

      expect(axiosInstance.post).toHaveBeenCalledWith(
        '/media',
        expect.anything(),
        expect.objectContaining({ headers: expect.any(Object) })
      );

      expect(result).toEqual({
        id: 123,
        url: 'https://example.wordpress.com/wp-content/uploads/image.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
      });
    });

    it('deletes media via /media/{id}?force=true for rollback', async () => {
      const client = createClient();

      axiosInstance.delete.mockResolvedValue({ data: { deleted: true } } as unknown);

      await client.deleteMedia(123);

      expect(axiosInstance.delete).toHaveBeenCalledWith('/media/123?force=true');
    });

    it('deletes post via /posts/{id}?force=true for rollback', async () => {
      const client = createClient();

      axiosInstance.delete.mockResolvedValue({ data: { deleted: true } } as unknown);

      await client.deletePost(456);

      expect(axiosInstance.delete).toHaveBeenCalledWith('/posts/456?force=true');
    });
  });

  describe('rollback 404 handling', () => {
    it('treats 404 on media deletion as non-fatal, logs warning', async () => {
      const client = createClient();

      const error = {
        isAxiosError: true,
        response: { status: 404, statusText: 'Not Found', data: { message: 'Not found' } },
      } as unknown as Error;

      axiosInstance.delete.mockRejectedValue(error);

      await expect(client.deleteMedia(999)).resolves.toBeUndefined();

      expect(loggerMock.warn).toHaveBeenCalledWith('Media already absent during rollback', {
        wpMediaId: 999,
      });
    });

    it('treats 404 on post deletion as non-fatal, logs warning', async () => {
      const client = createClient();

      const error = {
        isAxiosError: true,
        response: { status: 404, statusText: 'Not Found', data: { message: 'Not found' } },
      } as unknown as Error;

      axiosInstance.delete.mockRejectedValue(error);

      await expect(client.deletePost(999)).resolves.toBeUndefined();

      expect(loggerMock.warn).toHaveBeenCalledWith('Post already absent during rollback', {
        wpPostId: 999,
      });
    });
  });

  describe('error paths', () => {
    it('wraps 4xx error without extra retries (retryWithBackoff 한번만 호출)', async () => {
      const client = createClient();

      const error = {
        isAxiosError: true,
        response: { status: 400, data: { message: 'Bad request' } },
      } as unknown;

      axiosInstance.post.mockRejectedValue(error);

      const result = client.createDraftPost({
        title: 'Bad',
        content: '<p>bad</p>',
        date: '2026-01-01T12:00:00',
        categories: [],
        tags: [],
      });

      expect(result).rejects.toMatchObject({
        isAxiosError: true,
        response: { status: 400, data: { message: 'Bad request' } },
      });
      expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('retries on 5xx using retryWithBackoff', async () => {
      const client = createClient();

      const transientError = {
        isAxiosError: true,
        response: { status: 500, data: { message: 'Server error' } },
      } as unknown;

      const successResponse = {
        id: 789,
        status: 'draft',
        link: 'https://example.wordpress.com/?p=789',
      };

      axiosInstance.post
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({ data: successResponse } as unknown);

      const result = await client.createDraftPost({
        title: 'Retry',
        content: '<p>retry</p>',
        date: '2026-01-01T12:00:00',
        categories: [],
        tags: [],
      });

      expect(axiosInstance.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        id: 789,
        status: 'draft',
        link: 'https://example.wordpress.com/?p=789',
      });
    });
  });
});
