/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../src/utils/config';
import { createCleaner } from '../../src/services/cleaner';

jest.mock('../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

const dummyPost637Html = fs.readFileSync(
  path.join(__dirname, '..', 'dummy', 'post637.html'),
  'utf8'
);

const dummyPost634Html = fs.readFileSync(
  path.join(__dirname, '..', 'dummy', 'post634.html'),
  'utf8'
);

describe('Cleaner service', () => {
  const blogUrl = 'https://ramen4598.tistory.com';
  const metaTags = `
    <meta name="title" content="Test Post Title">
    <meta property="article:published_time" content="2024-01-15T10:00:00+09:00">
    <meta property="article:modified_time" content="2024-01-16T15:30:00+09:00">
  `;
  const categoryTags = `
    <div class="another_category">
      <h4><a href="/category/tech">Tech</a></h4>
    </div>
  `;
  const tagTags = `
    <div class="area_tag">
      <a href="/tag/javascript" rel="tag">JavaScript</a>
      <a href="/tag/typescript" rel="tag">TypeScript</a>
    </div>
  `;
  const contentWrapperStart = '<div class="tt_article_useless_p_margin contents_style">';
  const contentWrapperEnd = '</div>';

  beforeEach(() => {
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
      postContentSelector: 'div.tt_article_useless_p_margin.contents_style',
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Just print out the cleaned HTML of post 637 for manual verification', async () => {
    const cleaner = createCleaner();
    const cleanedHtml = await cleaner.cleanHtml(dummyPost637Html);
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'tmp', 'post637.cleaned.html'),
      cleanedHtml,
      'utf8'
    );
    console.log('Cleaned HTML of post 637 written to post637.cleaned.html');
  });
  it('Just print out the cleaned HTML of post 634 for manual verification', async () => {
    const cleaner = createCleaner();
    const cleanedHtml = await cleaner.cleanHtml(dummyPost634Html);
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'tmp', 'post634.cleaned.html'),
      cleanedHtml,
      'utf8'
    );
    console.log('Cleaned HTML of post 634 written to post634.cleaned.html');
  });
  // TODO: Preserve table structure in HTML to Markdown and back conversions
  it('should preserve table structure during HTML to Markdown and back conversions', () => {
    const cleaner = createCleaner();
    const content = `
      <table class="table" style="width:100%; border-collapse: collapse;" border="1" data-ke-align="alignLeft">
        <tr>
          <th style="width: 50%;">Header 1</th>
          <th style="width: 50%;">Header 2</th>
        </tr>
        <tr>
          <td style="width: 50%;">Data 1</td>
          <td style="width: 50%;">Data 2</td>
        </tr>
      </table>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);
    expect(cleanedHtml).toContain('<table>');
    expect(cleanedHtml).toContain('<thead>');
    expect(cleanedHtml).toContain('<tbody>');
    expect(cleanedHtml).toContain('<th>');
    expect(cleanedHtml).toContain('<tr>');
    expect(cleanedHtml).toContain('<th>Header 1</th>');
    expect(cleanedHtml).toContain('<th>Header 2</th>');
    expect(cleanedHtml).toContain('<td>Data 1</td>');
    expect(cleanedHtml).toContain('<td>Data 2</td>');
  });

  it('should preserve bold, strong, and italic formatting during cleaning', () => {
    const cleaner = createCleaner();
    const content = `
      <p>This is <strong>strong text</strong>, this is <b>bold text</b>, and this is <em>italic text</em>.</p>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    expect(cleanedHtml).toContain('<strong>strong text</strong>');
    expect(cleanedHtml).toContain('<strong>bold text</strong>');
    expect(cleanedHtml).toContain('<em>italic text</em>');
  });

  it('should preserve superscript and subscript formatting during cleaning', () => {
    const cleaner = createCleaner();
    const content = `
      <p>This is <sup>superscript</sup> and this is <sub>subscript</sub>.</p>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    expect(cleanedHtml).toContain('<sup>superscript</sup>');
    expect(cleanedHtml).toContain('<sub>subscript</sub>');
  });

  it('should preserve blockquotes during cleaning', () => {
    const cleaner = createCleaner();
    const content = `
      <blockquote>
        <p>This is a blockquote.</p>
      </blockquote>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    expect(cleanedHtml).toContain('<blockquote>');
    expect(cleanedHtml).toContain('<p>This is a blockquote.</p>');
  });
  });

  // TODO: 코드 블록 유지. hljs 유지 (보류)
  // TODO: 표 안에 이미지 유지 (보류)

  // TODO: Add more tests to cover different scenarios
});
