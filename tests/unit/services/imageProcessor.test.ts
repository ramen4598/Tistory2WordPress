import axios, { type AxiosResponse } from 'axios';
import { Post } from '../../../src/models/Post';
import { createWpClient, type WpClient } from '../../../src/services/wpClient';
import { createImageProcessor } from '../../../src/services/imageProcessor';
import { createImageAsset, updateImageAsset } from '../../../src/db';
import { ImageAssetStatus } from '../../../src/enums/db.enum';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('axios');
jest.mock('../../../src/services/wpClient');
jest.mock('../../../src/db');
jest.mock('../../../src/utils/config');
jest.mock('../../../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedCreateWpClient = createWpClient as jest.MockedFunction<typeof createWpClient>;
const mockedCreateImageAsset = createImageAsset as jest.MockedFunction<typeof createImageAsset>;
const mockedUpdateImageAsset = updateImageAsset as jest.MockedFunction<typeof updateImageAsset>;
const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('imageProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadConfig.mockReturnValue(baseConfig);
  });

  const createPost = (): Post => ({
    id: 1,
    url: 'https://example.tistory.com/1',
    title: 'Test Post',
    content: '<p><img src="https://img.tistory.com/image1.jpg" alt="one" /></p>',
    publish_date: new Date('2024-01-01T00:00:00Z'),
    modified_date: null,
    categories: [],
    tags: [],
    images: [],
    attachments: [],
  });

  it('downloads images from HTML, uploads to WordPress, creates/updates ImageAsset DB records, rewrites URLs, and returns uploaded media IDs', async () => {
    const post = createPost();

    const axiosResponse = {
      status: 200,
      data: Buffer.from('binary-image'),
      headers: { 'content-type': 'image/jpeg' },
    };

    mockedAxios.get.mockResolvedValueOnce(axiosResponse as unknown as AxiosResponse);

    const uploadMediaMock = jest.fn().mockResolvedValue({
      id: 101,
      url: 'https://example.wordpress.com/wp-content/uploads/image1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
    });

    const wpClientMock: Partial<WpClient> = {
      uploadMedia: uploadMediaMock,
    };

    mockedCreateWpClient.mockReturnValue(wpClientMock as WpClient);

    const mockAsset = {
      id: 1,
      job_item_id: 1,
      tistory_image_url: 'https://img.tistory.com/image1.jpg',
      wp_media_id: null,
      wp_media_url: null,
      status: ImageAssetStatus.PENDING,
      error_message: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    mockedCreateImageAsset.mockReturnValue(mockAsset);

    const { processImagesForPost } = createImageProcessor();

    const result = await processImagesForPost(post, { jobItemId: 1 });

    expect(mockedCreateImageAsset).toHaveBeenCalledWith({
      job_item_id: 1,
      tistory_image_url: 'https://img.tistory.com/image1.jpg',
    });

    expect(axios.get).toHaveBeenCalledWith('https://img.tistory.com/image1.jpg', {
      responseType: 'arraybuffer',
    });

    expect(uploadMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'test-post-image-1',
        mimeType: 'image/jpeg',
        buffer: expect.any(Buffer),
        altText: 'one',
      })
    );

    expect(mockedUpdateImageAsset).toHaveBeenCalledWith(1, {
      status: ImageAssetStatus.UPLOADED,
      wp_media_id: 101,
      wp_media_url: 'https://example.wordpress.com/wp-content/uploads/image1.jpg',
    });

    expect(result.uploadedMediaIds).toEqual([101]);
    expect(result.updatedPost.content).toContain(
      'https://example.wordpress.com/wp-content/uploads/image1.jpg'
    );
  });

  it('processes multiple images in content, uploading each to WordPress and rewriting all URLs', async () => {
    const post = createPost();
    post.content = `
      <p>First image:</p>
      <img src="https://img.tistory.com/first.jpg" alt="first" />
      <p>Second image:</p>
      <img src="https://img.tistory.com/second.png" alt="second" />
      <p>Third image:</p>
      <img src="https://img.tistory.com/third.gif" alt="third" />
    `;

    const uploadMediaMock = jest
      .fn()
      .mockResolvedValueOnce({
        id: 101,
        url: 'https://example.wordpress.com/wp-content/uploads/first.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
      })
      .mockResolvedValueOnce({
        id: 102,
        url: 'https://example.wordpress.com/wp-content/uploads/second.png',
        mediaType: 'image',
        mimeType: 'image/png',
      })
      .mockResolvedValueOnce({
        id: 103,
        url: 'https://example.wordpress.com/wp-content/uploads/third.gif',
        mediaType: 'image',
        mimeType: 'image/gif',
      });

    const wpClientMock: Partial<WpClient> = {
      uploadMedia: uploadMediaMock,
    };

    mockedCreateWpClient.mockReturnValue(wpClientMock as WpClient);

    const mockAssets = [
      {
        id: 1,
        job_item_id: 1,
        tistory_image_url: 'https://img.tistory.com/first.jpg',
        wp_media_id: null,
        wp_media_url: null,
        status: ImageAssetStatus.PENDING,
        error_message: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        job_item_id: 1,
        tistory_image_url: 'https://img.tistory.com/second.png',
        wp_media_id: null,
        wp_media_url: null,
        status: ImageAssetStatus.PENDING,
        error_message: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 3,
        job_item_id: 1,
        tistory_image_url: 'https://img.tistory.com/third.gif',
        wp_media_id: null,
        wp_media_url: null,
        status: ImageAssetStatus.PENDING,
        error_message: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];
    mockedCreateImageAsset
      .mockReturnValueOnce(mockAssets[0])
      .mockReturnValueOnce(mockAssets[1])
      .mockReturnValueOnce(mockAssets[2]);

    const axiosResponses = [
      {
        status: 200,
        data: Buffer.from('first-image'),
        headers: { 'content-type': 'image/jpeg' },
      },
      {
        status: 200,
        data: Buffer.from('second-image'),
        headers: { 'content-type': 'image/png' },
      },
      {
        status: 200,
        data: Buffer.from('third-image'),
        headers: { 'content-type': 'image/gif' },
      },
    ];
    mockedAxios.get
      .mockResolvedValueOnce(axiosResponses[0] as unknown as AxiosResponse)
      .mockResolvedValueOnce(axiosResponses[1] as unknown as AxiosResponse)
      .mockResolvedValueOnce(axiosResponses[2] as unknown as AxiosResponse);

    const { processImagesForPost } = createImageProcessor();

    const result = await processImagesForPost(post, { jobItemId: 1 });

    expect(mockedCreateImageAsset).toHaveBeenCalledTimes(3);
    expect(uploadMediaMock).toHaveBeenCalledTimes(3);

    expect(uploadMediaMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        fileName: 'test-post-image-1',
        mimeType: 'image/jpeg',
        buffer: expect.any(Buffer),
        altText: 'first',
      })
    );
    expect(uploadMediaMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        fileName: 'test-post-image-2',
        mimeType: 'image/png',
        buffer: expect.any(Buffer),
        altText: 'second',
      })
    );
    expect(uploadMediaMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        fileName: 'test-post-image-3',
        mimeType: 'image/gif',
        buffer: expect.any(Buffer),
        altText: 'third',
      })
    );

    expect(mockedUpdateImageAsset).toHaveBeenNthCalledWith(1, 1, {
      status: ImageAssetStatus.UPLOADED,
      wp_media_id: 101,
      wp_media_url: 'https://example.wordpress.com/wp-content/uploads/first.jpg',
    });
    expect(mockedUpdateImageAsset).toHaveBeenNthCalledWith(2, 2, {
      status: ImageAssetStatus.UPLOADED,
      wp_media_id: 102,
      wp_media_url: 'https://example.wordpress.com/wp-content/uploads/second.png',
    });
    expect(mockedUpdateImageAsset).toHaveBeenNthCalledWith(3, 3, {
      status: ImageAssetStatus.UPLOADED,
      wp_media_id: 103,
      wp_media_url: 'https://example.wordpress.com/wp-content/uploads/third.gif',
    });

    expect(result.uploadedMediaIds).toEqual([101, 102, 103]);
    expect(result.updatedPost.content).toContain(
      'https://example.wordpress.com/wp-content/uploads/first.jpg'
    );
    expect(result.updatedPost.content).toContain(
      'https://example.wordpress.com/wp-content/uploads/second.png'
    );
    expect(result.updatedPost.content).toContain(
      'https://example.wordpress.com/wp-content/uploads/third.gif'
    );
  });

  it('returns early and updates no assets when post content has no images', async () => {
    const post = createPost();
    post.content = '<p>No images here</p>';

    const uploadMediaMock = jest.fn().mockResolvedValue({
      id: 101,
      url: 'https://example.wordpress.com/wp-content/uploads/image1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
    });

    const wpClientMock: Partial<WpClient> = {
      uploadMedia: uploadMediaMock,
    };

    mockedCreateWpClient.mockReturnValue(wpClientMock as WpClient);

    const { processImagesForPost } = createImageProcessor();

    const result = await processImagesForPost(post, { jobItemId: 1 });

    expect(mockedCreateImageAsset).not.toHaveBeenCalled();
    expect(uploadMediaMock).not.toHaveBeenCalled();
    expect(result.uploadedMediaIds).toEqual([]);
    expect(result.updatedPost.content).toBe(post.content);
  });

  it('updates ImageAsset to FAILED when download/upload fails', async () => {
    const post = createPost();

    const axiosError: any = new Error('Download failed');
    axiosError.isAxiosError = true;
    axiosError.response = { status: 404, statusText: 'Not Found' };
    mockedAxios.get.mockRejectedValue(axiosError);

    const uploadMediaMock = jest.fn().mockResolvedValue({
      id: 101,
      url: 'https://example.wordpress.com/wp-content/uploads/image1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
    });

    const wpClientMock: Partial<WpClient> = {
      uploadMedia: uploadMediaMock,
    };

    mockedCreateWpClient.mockReturnValue(wpClientMock as WpClient);

    const mockAsset = {
      id: 1,
      job_item_id: 1,
      tistory_image_url: 'https://img.tistory.com/image1.jpg',
      wp_media_id: null,
      wp_media_url: null,
      status: ImageAssetStatus.PENDING,
      error_message: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    mockedCreateImageAsset.mockReturnValue(mockAsset);

    const { processImagesForPost } = createImageProcessor();

    await expect(processImagesForPost(post, { jobItemId: 1 })).rejects.toThrow('Download failed');

    expect(mockedUpdateImageAsset).toHaveBeenCalledWith(1, {
      status: ImageAssetStatus.FAILED,
      error_message: 'Download failed',
    });
  });
});
