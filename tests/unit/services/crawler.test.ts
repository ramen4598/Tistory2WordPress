/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadConfig } from '../../../src/utils/config';
import { createCrawler } from '../../../src/services/crawler';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('../../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('Crawler service', () => {
  const blogUrl = baseConfig.blogUrl;

  beforeEach(() => {
    mockedLoadConfig.mockReturnValue(baseConfig);
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
    });

    const urls = await crawler.discoverPostUrls();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(1, blogUrl);
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${blogUrl}?page=2`);
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${blogUrl}?page=3`);
    expect(urls).toEqual([`${blogUrl}/1`, `${blogUrl}/2`, `${blogUrl}/3`]);
  });

  it('should discover post URLs from real pagination fixture across pages', async () => {
    const page1Fixture = await import('fs/promises').then((fs) =>
      fs.readFile(`${__dirname}/../helpers/page1.html`, 'utf8')
    );

    const page2Html = `
      <html>
        <body>
          <a href="/999" class="link_category">Post 999</a>
        </body>
      </html>
    `;

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ text: async () => page1Fixture })
      .mockResolvedValueOnce({ text: async () => page2Html })
      .mockResolvedValueOnce({ text: async () => '' });

    const crawler = createCrawler({ fetchFn: fetchMock as any });

    const urls = await crawler.discoverPostUrls();

    expect(urls).toContain(`${blogUrl}/637`);
    expect(urls).toContain(`${blogUrl}/634`);
    expect(urls).toContain(`${blogUrl}/999`);
    expect(fetchMock).toHaveBeenCalledWith(`${blogUrl}?page=2`);
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
    });

    const urls = await crawler.discoverPostUrls();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls).toEqual([]);
  });

  it('should fetch individual post HTML from Tistory with path', async () => {
    const postHtml = `
      <html>
        <body>
          <h1>Post 1</h1>
        </body>
      </html>
    `;

    const fetchMock = jest.fn().mockResolvedValueOnce({ text: async () => postHtml });

    const crawler = createCrawler({
      fetchFn: fetchMock as any,
    });

    const html = await crawler.fetchPostHtml('/1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${blogUrl}/1`);
    expect(html).toBe(postHtml.trim());
  });

  it('should fetch individual post HTML from Tistory with full URL', async () => {
    const postHtml = `
      <html>
        <body>
          <h1>Post 1</h1>
        </body>
      </html>
    `;

    const fetchMock = jest.fn().mockResolvedValueOnce({ text: async () => postHtml });

    const crawler = createCrawler({
      fetchFn: fetchMock as any,
    });

    const html = await crawler.fetchPostHtml(`${blogUrl}/1`);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${blogUrl}/1`);
    expect(html).toBe(postHtml.trim());
  });

  it('should parse post metadata (title, dates, categories, tags) from HTML using configured selectors', () => {
    const postHtml = `
      <html>
        <head>
          <meta name="title" content="My Test Post" />
          <meta property="article:published_time" content="2025-01-01" />
          <meta property="article:modified_time" content="2025-01-02" />
        </head>
        <body>
          <div class="another_category">
            <h4><a href="/category/tech">Tech</a></h4>
            <h4><a href="/category/programming">Programming</a></h4>
          </div>

          <div class="area_tag">
            <a href="/tag/typescript" rel="tag">TypeScript</a>
            <a href="/tag/nodejs" rel="tag">Node.js</a>
          </div>
        </body>
      </html>
    `;

    const crawler = createCrawler({
      fetchFn: jest.fn() as any,
    });

    const url = `${blogUrl}/1`;
    const metadata = crawler.parsePostMetadata(postHtml, url);

    expect(metadata.url).toBe(url);
    expect(metadata.title).toBe('My Test Post');
    expect(metadata.publish_date).toEqual(new Date('2025-01-01'));
    expect(metadata.modified_date).toEqual(new Date('2025-01-02'));

    expect(metadata.categories).toHaveLength(2);
    expect(metadata.categories[0]?.name).toBe('Tech');
    expect(metadata.categories[0]?.slug).toBe('tech');
    expect(metadata.categories[0]?.parent).toBeNull();
    expect(metadata.categories[1]?.name).toBe('Programming');
    expect(metadata.categories[1]?.slug).toBe('programming');
    expect(metadata.categories[1]?.parent).toBe(metadata.categories[0]);

    expect(metadata.tags).toHaveLength(2);
    expect(metadata.tags[0]?.name).toBe('TypeScript');
    expect(metadata.tags[0]?.slug).toBe('typescript');
    expect(metadata.tags[1]?.name).toBe('Node.js');
    expect(metadata.tags[1]?.slug).toBe('nodejs');
  });

  it('should handle missing modified date gracefully using configured selectors', () => {
    const postHtml = `
      <html>
        <head>
          <meta name="title" content="My Test Post" />
          <meta property="article:published_time" content="2025-01-01" />
        </head>
        <body>
          <div class="another_category">
            <h4><a href="/category/tech">Tech</a></h4>
          </div>

          <div class="area_tag">
            <a href="/tag/typescripts" rel="tag">TypeScript</a>
          </div>
        </body>
      </html>
    `;

    const crawler = createCrawler({
      fetchFn: jest.fn() as any,
    });

    const url = `${blogUrl}/1`;
    const metadata = crawler.parsePostMetadata(postHtml, url);

    expect(metadata.modified_date).toBeNull();
    expect(metadata.categories).toHaveLength(1);
    expect(metadata.categories[0]?.parent).toBeNull();
    expect(metadata.tags).toHaveLength(1);
  });

  it('should generate slugs correctly for Korean category and tag names', () => {
    const postHtml = `
      <html>
        <head>
          <meta name="title" content="한글 포스트" />
          <meta property="article:published_time" content="2025-01-01" />
        </head>
        <body>
          <div class="another_category">
            <h4><a href="/category/dev">개발 일지</a></h4>
          </div>

          <div class="area_tag">
            <a href="/tag/js" rel="tag">자바스크립트</a></div>
        </body>
      </html>
    `;

    const crawler = createCrawler({
      fetchFn: jest.fn() as any,
    });

    const url = `${blogUrl}/korean`;
    const metadata = crawler.parsePostMetadata(postHtml, url);

    expect(metadata.categories[0]?.name).toBe('개발 일지');
    expect(metadata.categories[0]?.slug).toBe('개발-일지');
    expect(metadata.categories[0]?.parent).toBeNull();
    expect(metadata.tags[0]?.name).toBe('자바스크립트');
    expect(metadata.tags[0]?.slug).toBe('자바스크립트');
  });

  it('should treat second category as parent when categoryHierarchyOrder is last-is-parent', () => {
    const postHtml = `
      <html>
        <head>
          <meta name="title" content="My Test Post" />
          <meta property="article:published_time" content="2025-01-01" />
        </head>
        <body>
          <div class="another_category">
            <h4><a href="/category/cat1">Cat1</a></h4>
            <h4><a href="/category/cat2">Cat2</a></h4>
            <h4><a href="/category/cat3">Cat3</a></h4>
          </div>

          <div class="area_tag">
            <a href="/tag/tag1" rel="tag">Tag1</a>
          </div>
        </body>
      </html>
    `;

    mockedLoadConfig.mockReturnValue({
      blogUrl,
      workerCount: 4,
      rateLimitPerWorker: 1000,
      outputDir: './output',
      downloadsDir: './output/downloads',
      logLevel: 'info',
      postTitleSelector: 'meta[name="title"]',
      postPublishDateSelector: 'meta[property="article:published_time"]',
      postModifiedDateSelector: 'meta[property="article:modified_time"]',
      postCategorySelector: 'div.another_category h4 a',
      postTagSelector: 'div.area_tag a[rel="tag"]',
      postListLinkSelector: 'a.link_category',
      categoryHierarchyOrder: 'last-is-parent',
    } as any);

    const crawler = createCrawler({
      fetchFn: jest.fn() as any,
    });

    const url = `${blogUrl}/hierarchy`;
    const metadata = crawler.parsePostMetadata(postHtml, url);

    expect(metadata.categories).toHaveLength(2);

    const [cat1, cat2] = metadata.categories;

    expect(cat1.name).toBe('Cat1');
    expect(cat2.name).toBe('Cat2');

    expect(cat2.parent).toBeNull();
    expect(cat1.parent).toBe(cat2);
  });

  describe('extractFImgUrl', () => {
    it('extracts featured image URL from style attribute with double quotes', () => {
      const html = `
        <div id="main"><div><div><div class="article_header type_article_header_cover"><div style="background-image: url(&quot;https://img.tistory.com/featured.jpg&quot;);"></div></div></div></div></div>
      `;
      const crawler = createCrawler({ fetchFn: jest.fn() as any });
      const url = crawler.extractFImgUrl(html);
      expect(url).toBe('https://img.tistory.com/featured.jpg');
    });

    it('extracts featured image URL from style attribute with single quotes', () => {
      const html = `
        <div id="main"><div><div><div class="article_header type_article_header_cover"><div style="background-image: url('https://img.tistory.com/featured.jpg');"></div></div></div></div></div>
      `;
      const crawler = createCrawler({ fetchFn: jest.fn() as any });
      const url = crawler.extractFImgUrl(html);
      expect(url).toBe('https://img.tistory.com/featured.jpg');
    });

    it('extracts featured image URL from style attribute without quotes', () => {
      const html = `
        <div id="main"><div><div><div class="article_header type_article_header_cover"><div style="background-image: url(https://img.tistory.com/featured.jpg);"></div></div></div></div></div>
      `;
      const crawler = createCrawler({ fetchFn: jest.fn() as any });
      const url = crawler.extractFImgUrl(html);
      expect(url).toBe('https://img.tistory.com/featured.jpg');
    });

    it('returns null when no featured image element found', () => {
      const html = '<p>No featured image here</p>';
      const crawler = createCrawler({ fetchFn: jest.fn() as any });
      const url = crawler.extractFImgUrl(html);
      expect(url).toBeNull();
    });

    it('returns null when style attribute does not contain background-image', () => {
      const html =
        '<div id="main"><div><div><div class="article_header type_article_header_cover"><div style="color: red; margin: 10px;"></div></div></div></div></div>';
      const crawler = createCrawler({ fetchFn: jest.fn() as any });
      const url = crawler.extractFImgUrl(html);
      expect(url).toBeNull();
    });

    it('converts relative URLs to absolute URLs', () => {
      const html = `
        <div id="main"><div><div><div class="article_header type_article_header_cover"><div style="background-image: url(/images/featured.jpg);"></div></div></div></div></div>
      `;
      const crawler = createCrawler({ fetchFn: jest.fn() as any });
      const url = crawler.extractFImgUrl(html);
      expect(url).toBe('https://example.tistory.com/images/featured.jpg');
    });
  });
});
