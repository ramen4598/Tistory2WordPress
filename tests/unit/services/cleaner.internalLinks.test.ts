import { createCleaner, type Cleaner } from '../../../src/services/cleaner';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('../../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('cleaner - internal link extraction', () => {
  let cleaner: Cleaner;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadConfig.mockReturnValue(baseConfig);
    cleaner = createCleaner();
  });

  const createHtmlWithInternalLinks = (): string => `
    <div class="tt_article_useless_p_margin contents_style">
      <p>This is a test post with internal links.</p>
      <p>Check out <a href="https://example.tistory.com/123">this related post</a> for more details.</p>
      <p>See also <a href="https://example.tistory.com/category/tech">tech category</a>.</p>
      <p>External link: <a href="https://external.com/page">external page</a></p>
      <p>Another internal: <a href="https://example.tistory.com/456">another post</a></p>
    </div>
  `;

  it('extracts internal links that start with blog URL', () => {
    const html = createHtmlWithInternalLinks();
    const internalLinks = cleaner.extractInternalLinks?.('https://example.tistory.com/789', html);

    expect(internalLinks).toBeDefined();
    expect(internalLinks).toHaveLength(3);

    expect(internalLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_url: 'https://example.tistory.com/789',
          target_url: 'https://example.tistory.com/123',
          link_text: 'this related post',
        }),
        expect.objectContaining({
          source_url: 'https://example.tistory.com/789',
          target_url: 'https://example.tistory.com/category/tech',
          link_text: 'tech category',
        }),
        expect.objectContaining({
          source_url: 'https://example.tistory.com/789',
          target_url: 'https://example.tistory.com/456',
          link_text: 'another post',
        }),
      ])
    );
  });

  it('returns empty array when no internal links exist', () => {
    const html = `
      <div class="tt_article_useless_p_margin contents_style">
        <p>External only: <a href="https://external.com/page">external page</a></p>
      </div>
    `;
    const internalLinks = cleaner.extractInternalLinks?.('https://example.tistory.com/1', html);

    expect(internalLinks).toBeDefined();
    expect(internalLinks).toEqual([]);
  });

  it('includes context (surrounding text) for internal links', () => {
    const html = `
      <div class="tt_article_useless_p_margin contents_style">
        <p>For more information about the topic, please refer to our detailed article about <a href="https://example.tistory.com/123">this subject</a> which explains everything.</p>
      </div>
    `;
    const internalLinks = cleaner.extractInternalLinks?.('https://example.tistory.com/1', html);

    expect(internalLinks).toBeDefined();
    expect(internalLinks).toHaveLength(1);
    expect(internalLinks?.[0].context).toBeDefined();
    expect(internalLinks?.[0].context).toContain('article about');
    expect(internalLinks?.[0].context).toContain('this subject');
    expect(internalLinks?.[0].context).toContain('which explains everything');
  });

  it('handles links with no link_text (empty anchor)', () => {
    const html = `
      <div class="tt_article_useless_p_margin contents_style">
        <p>Link: <a href="https://example.tistory.com/123"></a> here.</p>
      </div>
    `;
    const internalLinks = cleaner.extractInternalLinks?.('https://example.tistory.com/1', html);

    expect(internalLinks).toBeDefined();
    expect(internalLinks).toHaveLength(1);
    expect(internalLinks?.[0].link_text).toBe('');
  });

  it('handles links with missing href attribute', () => {
    const html = `
      <div class="tt_article_useless_p_margin contents_style">
        <p>Invalid link: <a>no href</a></p>
      </div>
    `;
    const internalLinks = cleaner.extractInternalLinks?.('https://example.tistory.com/1', html);

    expect(internalLinks).toBeDefined();
    expect(internalLinks).toEqual([]);
  });
});
