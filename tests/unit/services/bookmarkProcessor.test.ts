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

  describe('replaceBookmarks', () => {
    it('Replace bookmark elements with bookmark-card HTML', async () => {
      const html = `
        <div class="content">
          <p>Intro</p>
          <figure data-ke-type="opengraph">
            <a href="https://example.com/article1">Article 1</a>
          </figure>
          <p>Outro</p>
        </div>
      `;

      mockedAxios.get.mockResolvedValue({
        data: `
          <html>
            <head>
              <meta property="og:title" content="Example Title" />
              <meta property="og:description" content="Example Description" />
              <meta property="og:image" content="https://example.com/image.jpg" />
              <meta property="og:url" content="https://example.com/article1" />
            </head>
            <body></body>
          </html>
        `,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const processor = createBookmarkProcessor();
      const replaced = await processor.replaceBookmarks(html);

      expect(replaced).toContain('class="bookmark-card"');
      expect(replaced).toContain('href="https://example.com/article1"');
      expect(replaced).toContain('Example Title');
      expect(replaced).toContain('Example Description');
      expect(replaced).toContain('src="https://example.com/image.jpg"');

      // Original Tistory opengraph figure should be gone
      expect(replaced).not.toContain('data-ke-type="opengraph"');
    });

    it('Fall back to URL-only card when metadata fetch fails', async () => {
      const html = `
        <div class="content">
          <figure data-ke-type="opengraph">
            <a href="https://example.com/article1">Article 1</a>
          </figure>
        </div>
      `;

      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const processor = createBookmarkProcessor();
      const replaced = await processor.replaceBookmarks(html);

      expect(replaced).toContain('class="bookmark-card"');
      expect(replaced).toContain('href="https://example.com/article1"');
      // title falls back to URL in the template
      expect(replaced).toContain('https://example.com/article1');
      expect(replaced).not.toContain('src="');
    });

    it('Replace multiple bookmarks in the same HTML', async () => {
      const html = `
        <div class="content">
          <figure data-ke-type="opengraph"><a href="https://example.com/a">A</a></figure>
          <p>between</p>
          <figure data-ke-type="opengraph"><a href="https://example.com/b">B</a></figure>
        </div>
      `;

      mockedAxios.get.mockImplementation(async (url: string) => {
        return {
          data: `
            <html>
              <head>
                <meta property="og:title" content="Title for ${url}" />
                <meta property="og:url" content="${url}" />
              </head>
              <body></body>
            </html>
          `,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as any;
      });

      const processor = createBookmarkProcessor();
      const replaced = await processor.replaceBookmarks(html);

      expect(replaced.match(/class="bookmark-card"/g)?.length).toBe(2);
      expect(replaced).toContain('href="https://example.com/a"');
      expect(replaced).toContain('href="https://example.com/b"');
      expect(replaced).toContain('Title for https://example.com/a');
      expect(replaced).toContain('Title for https://example.com/b');
      expect(replaced).toContain('<p>between</p>');
    });

    it('Return original HTML when no bookmarks exist', async () => {
      const html = `<div class="content"><p>No bookmarks here</p></div>`;

      const processor = createBookmarkProcessor();
      const replaced = await processor.replaceBookmarks(html);

      expect(replaced).toBe(html);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('detectBookmarks', () => {
    it('Detect bookmarks with correct CSS selector', () => {
      const html = `
        <div class="content">
          <figure data-ke-type="opengraph">
            <a href="https://example.com/article1">Article 1</a>
          </figure>
          <p>Some text</p>
          <figure data-ke-type="opengraph">
            <a href="https://example.com/article2">Article 2</a>
          </figure>
        </div>
      `;

      const processor = createBookmarkProcessor();
      const bookmarks = processor.detectBookmarks(html);

      expect(bookmarks.length).toBe(2);
      expect(bookmarks[0].url).toBe('https://example.com/article1');
      expect(bookmarks[1].url).toBe('https://example.com/article2');
    });

    it('Extract URL from anchor tag', () => {
      const html = `
        <figure data-ke-type="opengraph">
          <a href="https://example.com/article">
            <img src="https://example.com/image.jpg" />
          </a>
        </figure>
      `;

      const processor = createBookmarkProcessor();
      const bookmarks = processor.detectBookmarks(html);

      expect(bookmarks.length).toBe(1);
      expect(bookmarks[0].url).toBe('https://example.com/article');
    });

    it('Assign correct index to each bookmark', () => {
      const html = `
        <figure data-ke-type="opengraph"><a href="https://example.com/1">1</a></figure>
        <figure data-ke-type="opengraph"><a href="https://example.com/2">2</a></figure>
        <figure data-ke-type="opengraph"><a href="https://example.com/3">3</a></figure>
      `;

      const processor = createBookmarkProcessor();
      const bookmarks = processor.detectBookmarks(html);

      expect(bookmarks[0].index).toBe(0);
      expect(bookmarks[1].index).toBe(1);
      expect(bookmarks[2].index).toBe(2);
    });

    it('Return empty array for HTML without bookmarks', () => {
      const html = `
        <div class="content">
          <p>Just regular content</p>
          <img src="https://example.com/image.jpg" />
          <a href="https://example.com/link">Regular link</a>
        </div>
      `;

      const processor = createBookmarkProcessor();
      const bookmarks = processor.detectBookmarks(html);

      expect(bookmarks.length).toBe(0);
      expect(bookmarks).toEqual([]);
    });

    it('Handle multiple bookmarks in same HTML', () => {
      const html = `
        <article>
          <p>Introduction</p>
          <figure data-ke-type="opengraph"><a href="https://example.com/a">A</a></figure>
          <p>More content</p>
          <figure data-ke-type="opengraph"><a href="https://example.com/b">B</a></figure>
          <figure data-ke-type="opengraph"><a href="https://example.com/c">C</a></figure>
          <p>Conclusion</p>
          <figure data-ke-type="opengraph"><a href="https://example.com/d">D</a></figure>
        </article>
      `;

      const processor = createBookmarkProcessor();
      const bookmarks = processor.detectBookmarks(html);

      expect(bookmarks.length).toBe(4);
      expect(bookmarks[0].url).toBe('https://example.com/a');
      expect(bookmarks[1].url).toBe('https://example.com/b');
      expect(bookmarks[2].url).toBe('https://example.com/c');
      expect(bookmarks[3].url).toBe('https://example.com/d');
    });
  });
});
