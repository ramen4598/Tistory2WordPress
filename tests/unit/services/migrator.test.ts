import { createMigrator } from '../../../src/services/migrator';
import { MigrationJobItemStatus } from '../../../src/enums/db.enum';
import { Crawler } from '../../../src/services/crawler';
import { Cleaner } from '../../../src/services/cleaner';
import { BookmarkProcessor } from '../../../src/services/bookmarkProcessor';
import { LinkTracker } from '../../../src/services/linkTracker';
import { ImageProcessor } from '../../../src/services/imageProcessor';
import { WpClient } from '../../../src/services/wpClient';
import { createMigrationJobItem, updateMigrationJobItem } from '../../../src/db';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';
import { createBookmarkProcessor } from '../../../src/services/bookmarkProcessor';

jest.mock('../../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

jest.mock('../../../src/services/crawler', () => ({
  createCrawler: jest.fn(),
}));

const mockedCreateBookmarkProcessor = createBookmarkProcessor as jest.MockedFunction<
  typeof createBookmarkProcessor
>;

jest.mock('../../../src/services/cleaner', () => ({
  createCleaner: jest.fn(),
}));

jest.mock('../../../src/services/bookmarkProcessor', () => ({
  createBookmarkProcessor: jest.fn(),
}));

jest.mock('../../../src/services/linkTracker', () => ({
  createLinkTracker: jest.fn(),
}));

jest.mock('../../../src/services/imageProcessor', () => ({
  createImageProcessor: jest.fn(),
}));

jest.mock('../../../src/services/wpClient', () => ({
  createWpClient: jest.fn(),
}));

jest.mock('../../../src/db', () => ({
  createMigrationJobItem: jest.fn(),
  updateMigrationJobItem: jest.fn(),
  createPostMap: jest.fn(),
}));

describe('migrator (T221/T223)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedLoadConfig.mockReturnValue(baseConfig);
  });

  it('processes bookmarks before cleaner', async () => {
    const url = 'https://example.tistory.com/1';
    const context = { jobId: 123 };
    const jobItemId = 456;

    (createMigrationJobItem as jest.Mock).mockReturnValue({ id: jobItemId });

    const legacyHtml = '<html><body>legacy</body></html>';
    const bookmarkProcessedHtml =
      '<html><body><figure class="bookmark-card"></figure></body></html>';

    const bookmarkProcessor = {
      replaceBookmarks: jest.fn().mockResolvedValue(bookmarkProcessedHtml),
    };
    mockedCreateBookmarkProcessor.mockReturnValue(
      bookmarkProcessor as unknown as BookmarkProcessor
    );

    const crawler = {
      fetchPostHtml: jest.fn().mockResolvedValue(legacyHtml),
      parsePostMetadata: jest.fn().mockReturnValue({
        url,
        title: 'Hello',
        publish_date: new Date('2020-01-01T00:00:00Z'),
        modified_date: null,
        categories: [],
        tags: [],
      }),
      extractFImgUrl: jest.fn().mockReturnValue(null),
    };

    const cleaner = {
      cleanHtml: jest.fn().mockImplementation((incomingHtml: string) => {
        if (incomingHtml === legacyHtml) {
          throw new Error('Cleaner must run after bookmark processing');
        }
        return '<p>cleaned</p>';
      }),
    };

    const linkTracker = {
      trackInternalLinks: jest.fn(),
    };

    const imageProcessor = {
      processImgs: jest.fn().mockResolvedValue({
        url,
        title: 'Hello',
        content: '<p>cleaned</p>',
        publish_date: new Date('2020-01-01T00:00:00Z'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [],
        featured_image: null,
      }),
      processFImg: jest.fn().mockResolvedValue(null),
    };

    const wpClient = {
      ensureCategory: jest.fn(),
      ensureTag: jest.fn(),
      createDraftPost: jest.fn().mockResolvedValue({ id: 999 }),
      deleteMedia: jest.fn(),
      deletePost: jest.fn(),
    };

    const migrator = createMigrator({
      crawler: crawler as unknown as Crawler,
      cleaner: cleaner as unknown as Cleaner,
      linkTracker: linkTracker as unknown as LinkTracker,
      imageProcessor: imageProcessor as unknown as ImageProcessor,
      wpClient: wpClient as unknown as WpClient,
    });

    await migrator.migratePostByUrl(url, context);

    expect(bookmarkProcessor.replaceBookmarks).toHaveBeenCalledWith(legacyHtml);
    expect(crawler.parsePostMetadata).toHaveBeenCalledWith(legacyHtml, url);
    expect(crawler.extractFImgUrl).toHaveBeenCalledWith(legacyHtml);
    expect(cleaner.cleanHtml).toHaveBeenCalledWith(bookmarkProcessedHtml);
  });

  it('rolls back uploaded media when post creation fails', async () => {
    const bookmarkProcessor = {
      replaceBookmarks: jest.fn().mockResolvedValue('<html></html>'),
    };
    mockedCreateBookmarkProcessor.mockReturnValue(
      bookmarkProcessor as unknown as BookmarkProcessor
    );

    const url = 'https://example.tistory.com/1';
    const context = { jobId: 123 };
    const jobItemId = 456;

    (createMigrationJobItem as jest.Mock).mockReturnValue({ id: jobItemId });

    const deleteMedia = jest.fn().mockResolvedValue(undefined);
    const deletePost = jest.fn().mockResolvedValue(undefined);

    const crawler = {
      fetchPostHtml: jest.fn().mockResolvedValue('<html></html>'),
      parsePostMetadata: jest.fn().mockReturnValue({
        url,
        title: 'Hello',
        publish_date: new Date('2020-01-01T00:00:00Z'),
        modified_date: null,
        categories: [],
        tags: [],
      }),
      extractFImgUrl: jest.fn().mockReturnValue(null),
    };

    const cleaner = {
      cleanHtml: jest.fn().mockReturnValue('<p>cleaned</p>'),
    };

    const linkTracker = {
      trackInternalLinks: jest.fn(),
    };

    const imageProcessor = {
      processImgs: jest.fn().mockResolvedValue({
        url,
        title: 'Hello',
        content: '<p>cleaned</p>',
        publish_date: new Date('2020-01-01T00:00:00Z'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [
          {
            url: 'https://img.tistory.com/image1.jpg',
            alt_text: 'one',
            wp_media_id: 1,
            wp_media_url: 'https://example.wordpress.com/wp-content/uploads/image1.jpg',
          },
          {
            url: 'https://img.tistory.com/image2.jpg',
            alt_text: 'two',
            wp_media_id: 2,
            wp_media_url: 'https://example.wordpress.com/wp-content/uploads/image2.jpg',
          },
        ],
      }),
    };

    const wpClient = {
      ensureCategory: jest.fn(),
      ensureTag: jest.fn(),
      createDraftPost: jest.fn().mockRejectedValue(new Error('post create failed')),
      deleteMedia,
      deletePost,
    };

    const migrator = createMigrator({
      crawler: crawler as unknown as Crawler,
      cleaner: cleaner as unknown as Cleaner,
      linkTracker: linkTracker as unknown as LinkTracker,
      imageProcessor: imageProcessor as unknown as ImageProcessor,
      wpClient: wpClient as unknown as WpClient,
    });

    await expect(migrator.migratePostByUrl(url, context)).rejects.toThrow('post create failed');

    expect(deleteMedia).toHaveBeenCalledTimes(2);
    expect(deleteMedia).toHaveBeenCalledWith(1);
    expect(deleteMedia).toHaveBeenCalledWith(2);
    expect(deletePost).not.toHaveBeenCalled();

    expect(updateMigrationJobItem).toHaveBeenCalledWith(
      jobItemId,
      expect.objectContaining({
        status: MigrationJobItemStatus.FAILED,
        error_message: expect.any(String),
        updated_at: expect.any(String),
      })
    );
  });
});
