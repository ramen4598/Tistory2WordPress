/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadConfig } from '../../src/utils/config';
import { createCrawler } from '../../src/services/crawler';

jest.mock('../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('Crawler service', () => {
  const blogUrl = 'https://myblog.tistory.com';

  beforeEach(() => {
    mockedLoadConfig.mockReturnValue({
      blogUrl,
      workerCount: 4,
      rateLimitPerWorker: 1000,
      outputDir: './output',
      downloadsDir: './output/downloads',
      logLevel: 'info',
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should discover post URLs across paginated list pages using ?page query', async () => {
    const page1Html = `
      <html>
        <body>
          <a href="/1" class="link_category">Post 1</a>
          <a href="/2" class="link_category">Post 2</a>
        </body>
      </html>
    `;

    const page2Html = `
      <html>
        <body>
          <a href="/3" class="link_category">Post 3</a>
        </body>
      </html>
    `;

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ text: async () => page1Html })
      .mockResolvedValueOnce({ text: async () => page2Html })
      .mockRejectedValueOnce(new Error('No more pages'));

    const crawler = createCrawler({
      fetchFn: fetchMock as any,
      postLinkSelector: 'a.link_category',
    });

    const urls = await crawler.discoverPostUrls();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(1, blogUrl);
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${blogUrl}?page=2`);
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${blogUrl}?page=3`);
    expect(urls).toEqual([`${blogUrl}/1`, `${blogUrl}/2`, `${blogUrl}/3`]);
  });

  it('should handle blogs without pagination by stopping when next page is missing', async () => {
    const pageHtml = `
      <html>
        <body>
          <a href="/1" class="link_category">Post 1</a>
        </body>
      </html>
    `;

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ text: async () => pageHtml })
      .mockRejectedValueOnce(new Error('No more pages'));

    const crawler = createCrawler({
      fetchFn: fetchMock as any,
      postLinkSelector: 'a.link_category',
    });

    const urls = await crawler.discoverPostUrls();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, blogUrl);
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${blogUrl}?page=2`);
    expect(urls).toEqual([`${blogUrl}/1`]);
  });

  it('should avoid duplicate post URLs across a single page', async () => {
    const pageHtml = `
      <html>
        <body>
          <a href="/1" class="link_category">Post 1</a>
          <a href="/1" class="link_category">Post 1 Duplicate</a>
        </body>
      </html>
    `;

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ text: async () => pageHtml })
      .mockRejectedValueOnce(new Error('No more pages'));

    const crawler = createCrawler({
      fetchFn: fetchMock as any,
      postLinkSelector: 'a.link_category',
    });

    const urls = await crawler.discoverPostUrls();

    expect(urls).toEqual([`${blogUrl}/1`]);
  });

  it('should handle pages with no post URLs by stopping', async () => {
    const pageHtml = `
      <html>
        <body>
          <p>No posts available.</p>
        </body>
      </html>
    `;

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ text: async () => pageHtml })
      .mockRejectedValueOnce(new Error('No more pages'));

    const crawler = createCrawler({
      fetchFn: fetchMock as any,
      postLinkSelector: 'a.link_category',
    });

    const urls = await crawler.discoverPostUrls();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls).toEqual([]);
  });
});
