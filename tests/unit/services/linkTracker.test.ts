import { insertInternalLink, getInternalLinksByJobItemId } from '../../../src/db';
import { createLinkTracker } from '../../../src/services/linkTracker';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('../../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

jest.mock('../../../src/db/index', () => ({
  ...jest.requireActual('../../../src/db/index'),
  insertInternalLink: jest.fn(),
  getInternalLinksByJobItemId: jest.fn(),
}));

const mockedInsertInternalLink = insertInternalLink as jest.MockedFunction<
  typeof insertInternalLink
>;
const mockedGetInternalLinksByJobItemId = getInternalLinksByJobItemId as jest.MockedFunction<
  typeof getInternalLinksByJobItemId
>;

describe('linkTracker (with mocked DB)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadConfig.mockReturnValue(baseConfig);
  });

  it('extracts internal links from HTML and saves each to DB', () => {
    const html = '<p>Test with <a href="https://example.tistory.com/123">link</a></p>';
    const sourceUrl = 'https://example.tistory.com/1';

    const linkTracker = createLinkTracker();

    linkTracker.trackInternalLinks(sourceUrl, html, 1);

    expect(mockedInsertInternalLink).toHaveBeenCalledTimes(1);
    expect(mockedInsertInternalLink).toHaveBeenCalledWith({
      job_item_id: 1,
      source_url: sourceUrl,
      target_url: 'https://example.tistory.com/123',
      link_text: 'link',
      context: expect.stringContaining('Test with link'),
    });
  });

  it('handles multiple internal links and saves all to DB', () => {
    const html = `
      <p>First <a href="https://example.tistory.com/123">link1</a></p>
      <p>Second <a href="https://example.tistory.com/456">link2</a></p>
    `;
    const sourceUrl = 'https://example.tistory.com/1';

    const linkTracker = createLinkTracker();

    linkTracker.trackInternalLinks(sourceUrl, html, 1);

    expect(mockedInsertInternalLink).toHaveBeenCalledTimes(2);
    expect(mockedInsertInternalLink).toHaveBeenNthCalledWith(1, {
      job_item_id: 1,
      source_url: sourceUrl,
      target_url: 'https://example.tistory.com/123',
      link_text: 'link1',
      context: expect.stringContaining('First link1'),
    });
    expect(mockedInsertInternalLink).toHaveBeenNthCalledWith(2, {
      job_item_id: 1,
      source_url: sourceUrl,
      target_url: 'https://example.tistory.com/456',
      link_text: 'link2',
      context: expect.stringContaining('Second link2'),
    });
  });

  it('does not save to DB when no internal links found', () => {
    const html = '<p>External link: <a href="https://external.com/page">link</a></p>';
    const sourceUrl = 'https://example.tistory.com/1';

    const linkTracker = createLinkTracker();

    linkTracker.trackInternalLinks(sourceUrl, html, 1);

    expect(mockedInsertInternalLink).not.toHaveBeenCalled();
  });

  it('retrieves internal links by job item ID', () => {
    const jobItemId = 1;
    const internalLinks = [
      {
        id: 1,
        job_item_id: jobItemId,
        source_url: 'https://example.tistory.com/1',
        target_url: 'https://example.tistory.com/123',
        link_text: 'link',
        context: null,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    mockedGetInternalLinksByJobItemId.mockReturnValue(internalLinks);

    const linkTracker = createLinkTracker();

    const result = linkTracker.getInternalLinks(jobItemId);

    expect(mockedGetInternalLinksByJobItemId).toHaveBeenCalledWith(jobItemId);
    expect(result).toEqual(internalLinks);
  });

  it('filters out external links from different domains', () => {
    const html = `
      <p>Internal: <a href="https://example.tistory.com/123">internal</a></p>
      <p>External: <a href="https://other.com/456">external</a></p>
    `;
    const sourceUrl = 'https://example.tistory.com/1';

    const linkTracker = createLinkTracker();

    linkTracker.trackInternalLinks(sourceUrl, html, 1);

    expect(mockedInsertInternalLink).toHaveBeenCalledTimes(1);
    expect(mockedInsertInternalLink).toHaveBeenCalledWith({
      job_item_id: 1,
      source_url: sourceUrl,
      target_url: 'https://example.tistory.com/123',
      link_text: 'internal',
      context: expect.any(String),
    });
  });

  it('extracts context text around internal links', () => {
    const html =
      '<p>This is a longer paragraph with more text surrounding the <a href="https://example.tistory.com/123">link</a> element</p>';
    const sourceUrl = 'https://example.tistory.com/1';

    const linkTracker = createLinkTracker();

    linkTracker.trackInternalLinks(sourceUrl, html, 1);

    expect(mockedInsertInternalLink).toHaveBeenCalledTimes(1);
    expect(mockedInsertInternalLink).toHaveBeenCalledWith({
      job_item_id: 1,
      source_url: sourceUrl,
      target_url: 'https://example.tistory.com/123',
      link_text: 'link',
      context: expect.stringMatching(/.*surrounding the link element.*/),
    });
  });

  it('handles links with no link text', () => {
    const html = '<p>Test with <a href="https://example.tistory.com/123"></a> empty link</p>';
    const sourceUrl = 'https://example.tistory.com/1';

    const linkTracker = createLinkTracker();

    linkTracker.trackInternalLinks(sourceUrl, html, 1);

    expect(mockedInsertInternalLink).toHaveBeenCalledTimes(1);
    expect(mockedInsertInternalLink).toHaveBeenCalledWith({
      job_item_id: 1,
      source_url: sourceUrl,
      target_url: 'https://example.tistory.com/123',
      link_text: '',
      context: expect.any(String),
    });
  });

  it('handles links with invalid URL schemes gracefully', () => {
    const html =
      '<p>Valid: <a href="https://example.tistory.com/123">valid</a></p><p>Invalid scheme: <a href="javascript:alert(\'xss\')">invalid</a></p>';
    const sourceUrl = 'https://example.tistory.com/1';

    const linkTracker = createLinkTracker();

    linkTracker.trackInternalLinks(sourceUrl, html, 1);

    expect(mockedInsertInternalLink).toHaveBeenCalledTimes(1);
    expect(mockedInsertInternalLink).toHaveBeenCalledWith({
      job_item_id: 1,
      source_url: sourceUrl,
      target_url: 'https://example.tistory.com/123',
      link_text: 'valid',
      context: expect.any(String),
    });
  });

  it('returns empty array when no internal links exist for job item', () => {
    const jobItemId = 999;
    mockedGetInternalLinksByJobItemId.mockReturnValue([]);

    const linkTracker = createLinkTracker();

    const result = linkTracker.getInternalLinks(jobItemId);

    expect(mockedGetInternalLinksByJobItemId).toHaveBeenCalledWith(jobItemId);
    expect(result).toEqual([]);
  });

  it('extracts links with query parameters and fragments', () => {
    const html =
      '<p>Link with query: <a href="https://example.tistory.com/123?param=value#section">link</a></p>';
    const sourceUrl = 'https://example.tistory.com/1';

    const linkTracker = createLinkTracker();

    linkTracker.trackInternalLinks(sourceUrl, html, 1);

    expect(mockedInsertInternalLink).toHaveBeenCalledWith({
      job_item_id: 1,
      source_url: sourceUrl,
      target_url: 'https://example.tistory.com/123?param=value#section',
      link_text: 'link',
      context: expect.any(String),
    });
  });
});
