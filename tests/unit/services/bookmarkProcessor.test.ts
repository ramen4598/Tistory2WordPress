/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { loadConfig } from '../../../src/utils/config';
import { createBookmarkProcessor } from '../../../src/services/bookmarkProcessor';

jest.mock('axios');
jest.mock('../../../src/utils/config');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('BookmarkProcessor service', () => {
  const config = {
    blogUrl: 'https://test.tistory.com',
    workerCount: 4,
    rateLimitPerWorker: 1000,
    outputDir: './output',
    downloadsDir: './output/downloads',
    logLevel: 'info',
    maxRetryAttempts: 3,
    retryInitialDelayMs: 1000,
    retryMaxDelayMs: 10000,
    retryBackoffMultiplier: 2,
    bookmarkSelector: 'figure[data-ke-type="opengraph"]',
    bookmarkTemplatePath: './src/templates/bookmarkTemplate.ts',
  };

  beforeEach(() => {
    mockedLoadConfig.mockReturnValue(config as any);
    jest.clearAllMocks();
  });

  describe('fetchMetadata', () => {
    it('Successfully fetch metadata from URL with all OpenGraph tags', async () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Example Title" />
            <meta property="og:description" content="Example Description" />
            <meta property="og:image" content="https://example.com/image.jpg" />
            <meta property="og:url" content="https://example.com/article" />
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const processor = createBookmarkProcessor();
      const result = await processor.fetchMetadata('https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.title).toBe('Example Title');
      expect(result.description).toBe('Example Description');
      expect(result.featuredImage).toBe('https://example.com/image.jpg');
      expect(result.url).toBe('https://example.com/article');
      expect(result.fetchedAt).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('Use fallbacks when og:title, og:description, og:image missing', async () => {
      const html = `
        <html>
          <head></head>
          <body>
            <title>Fallback Title</title>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const processor = createBookmarkProcessor();
      const result = await processor.fetchMetadata('https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.title).toBe('Fallback Title');
      expect(result.description).toBe('');
      expect(result.featuredImage).toBe('');
      expect(result.url).toBe('https://example.com/article');
    });

    it('Handle timeout after 10s', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Request timeout after 10000ms'));

      const processor = createBookmarkProcessor();
      const result = await processor.fetchMetadata('https://slow-server.com/article');

      expect(result.success).toBe(false);
      expect(result.title).toBe('https://slow-server.com/article');
      expect(result.description).toBe('');
      expect(result.featuredImage).toBe('');
      expect(result.url).toBe('https://slow-server.com/article');
      expect(result.error).toBe('Request timeout after 10000ms');
    });

    it('Handle 404 HTTP error', async () => {
      const error = new Error('Request failed with status code 404');
      (error as any).response = { status: 404, statusText: 'Not Found' };

      mockedAxios.get.mockRejectedValue(error);

      const processor = createBookmarkProcessor();
      const result = await processor.fetchMetadata('https://example.com/not-found');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.title).toBe('https://example.com/not-found');
    });

    it('Handle 403 HTTP error', async () => {
      const error = new Error('Request failed with status code 403');
      (error as any).response = { status: 403, statusText: 'Forbidden' };

      mockedAxios.get.mockRejectedValue(error);

      const processor = createBookmarkProcessor();
      const result = await processor.fetchMetadata('https://example.com/forbidden');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.title).toBe('https://example.com/forbidden');
    });

    it('Handle 500 HTTP error', async () => {
      const error = new Error('Request failed with status code 500');
      (error as any).response = { status: 500, statusText: 'Internal Server Error' };

      mockedAxios.get.mockRejectedValue(error);

      const processor = createBookmarkProcessor();
      const result = await processor.fetchMetadata('https://example.com/server-error');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.title).toBe('https://example.com/server-error');
    });

    it('Handle network errors (connection refused)', async () => {
      mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED: Connection refused'));

      const processor = createBookmarkProcessor();
      const result = await processor.fetchMetadata('https://unreachable.com/article');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED: Connection refused');
      expect(result.title).toBe('https://unreachable.com/article');
    });

    it('Follow redirects (1-5 hops)', async () => {
      const finalHtml = `
        <html>
          <head>
            <meta property="og:title" content="Redirected Article" />
            <meta property="og:url" content="https://final.com/article" />
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: finalHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const processor = createBookmarkProcessor();
      const result = await processor.fetchMetadata('https://short.link/abc');

      expect(result.success).toBe(true);
      expect(result.title).toBe('Redirected Article');
      expect(result.url).toBe('https://final.com/article');
    });

    it('Parse HTML with UTF-8 encoding', async () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="안녕하세요 你好" />
            <meta property="og:description" content="こんにちは مرحبا" />
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const processor = createBookmarkProcessor();
      const result = await processor.fetchMetadata('https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.title).toBe('안녕하세요 你好');
      expect(result.description).toBe('こんにちは مرحبا');
    });
  });
});
