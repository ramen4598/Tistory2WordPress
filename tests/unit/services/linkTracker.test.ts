import { insertInternalLink, getInternalLinksByJobItemId } from '../../../src/db';
import { createLinkTracker } from '../../../src/services/linkTracker';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('../../../src/db');
jest.mock('../../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

const mockedInsertInternalLink = insertInternalLink as jest.MockedFunction<
  typeof insertInternalLink
>;
const mockedGetInternalLinksByJobItemId = getInternalLinksByJobItemId as jest.MockedFunction<
  typeof getInternalLinksByJobItemId
>;

describe('linkTracker', () => {
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
});
