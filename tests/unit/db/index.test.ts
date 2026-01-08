import fs from 'fs';
import path from 'path';
import {
  getDb,
  closeDb,
  createMigrationJob,
  updateMigrationJob,
  createMigrationJobItem,
  updateMigrationJobItem,
  getMigrationJobItemById,
  getMigrationJobItemsByJobId,
  createImageAsset,
  updateImageAsset,
  getImageAssetsByJobItemId,
  createPostMap,
  getPostMapByTistoryUrl,
  insertInternalLink,
  getInternalLinksByJobItemId,
  getUnresolvedFailedMigrationJobItemsByBlogUrl,
} from '../../../src/db/index';
import {
  MigrationJobType,
  MigrationJobStatus,
  MigrationJobItemStatus,
  ImageAssetStatus,
} from '../../../src/enums/db.enum';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('../../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

const TEST_DB_PATH = path.join(__dirname, 'test-migration.db');

describe('db initialization and migrations', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH); // Remove existing test DB file
    }
    mockedLoadConfig.mockReturnValue({
      ...baseConfig,
      migrationDbPath: TEST_DB_PATH,
    });
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH); // Remove existing test DB file
    }
    jest.resetAllMocks();
  });

  it('runs schema migrations so tables exist', () => {
    const db = getDb();

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('migration_jobs', 'migration_job_items', 'migration_image_assets', 'post_map', 'internal_links') ORDER BY name"
      )
      .all() as { name: string }[];

    const tableNames = tables.map((row) => row.name);

    expect(tableNames).toEqual([
      'internal_links',
      'migration_image_assets',
      'migration_job_items',
      'migration_jobs',
      'post_map',
    ]);
  });
});

describe('db repository methods', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    mockedLoadConfig.mockReturnValue({
      ...baseConfig,
      migrationDbPath: TEST_DB_PATH,
    });
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    jest.resetAllMocks();
  });

  it('creates and updates a migration job lifecycle', () => {
    const job = createMigrationJob(MigrationJobType.SINGLE);

    expect(job.id).toBeGreaterThan(0);
    expect(job.blog_url).toBe(baseConfig.blogUrl);
    expect(job.job_type).toBe(MigrationJobType.SINGLE);
    expect(job.status).toBe(MigrationJobStatus.RUNNING);
    expect(job.created_at).toBeTruthy();
    expect(job.completed_at).toBeNull();
    expect(job.error_message).toBeNull();

    const completedAt = new Date().toISOString();

    updateMigrationJob(job.id, {
      status: MigrationJobStatus.COMPLETED,
      completed_at: completedAt,
    });

    const errorMessage = 'something went wrong';
    updateMigrationJob(job.id, {
      status: MigrationJobStatus.FAILED,
      error_message: errorMessage,
    });

    const db = getDb();
    const failedJob = db.prepare('SELECT * FROM migration_jobs WHERE id = ?').get(job.id) as
      | { status: string; error_message: string }
      | undefined;
    expect(failedJob).toBeDefined();
    expect(failedJob?.status).toBe(MigrationJobStatus.FAILED);
    expect(failedJob?.error_message).toBe(errorMessage);
  });

  it('creates and updates migration job items with status transitions', () => {
    const job = createMigrationJob(MigrationJobType.SINGLE);

    const item = createMigrationJobItem({
      job_id: job.id,
      tistory_url: 'https://example.tistory.com/1',
    });

    expect(item.id).toBeGreaterThan(0);
    expect(item.job_id).toBe(job.id);
    expect(item.status).toBe(MigrationJobItemStatus.RUNNING);
    expect(item.tistory_url).toBe('https://example.tistory.com/1');
    expect(item.wp_post_id).toBeNull();

    const updatedAt1 = new Date().toISOString();

    updateMigrationJobItem(item.id, {
      status: MigrationJobItemStatus.COMPLETED,
      wp_post_id: 123,
      updated_at: updatedAt1,
    });

    const successItem = getMigrationJobItemById(item.id);
    expect(successItem).toBeDefined();
    expect(successItem?.status).toBe(MigrationJobItemStatus.COMPLETED);
    expect(successItem?.wp_post_id).toBe(123);
    expect(successItem?.updated_at).toBe(updatedAt1);

    const updatedAt2 = new Date().toISOString();
    const errorMessage = 'failed to migrate';

    updateMigrationJobItem(item.id, {
      status: MigrationJobItemStatus.FAILED,
      error_message: errorMessage,
      updated_at: updatedAt2,
    });

    const failedItem = getMigrationJobItemById(item.id);
    expect(failedItem).toBeDefined();
    expect(failedItem?.status).toBe(MigrationJobItemStatus.FAILED);
    expect(failedItem?.error_message).toBe(errorMessage);
    expect(failedItem?.updated_at).toBe(updatedAt2);

    const itemsByJob = getMigrationJobItemsByJobId(job.id);
    expect(itemsByJob.map((i) => i.id)).toContain(item.id);
  });

  it('fetches unresolved failed migration job items by blog URL', () => {
    mockedLoadConfig.mockReturnValue({
      ...baseConfig,
      blogUrl: 'https://blog-a.example',
      migrationDbPath: TEST_DB_PATH,
    });

    const jobA1 = createMigrationJob(MigrationJobType.SINGLE);
    const jobA2 = createMigrationJob(MigrationJobType.SINGLE);

    mockedLoadConfig.mockReturnValue({
      ...baseConfig,
      blogUrl: 'https://blog-b.example',
      migrationDbPath: TEST_DB_PATH,
    });

    const jobB1 = createMigrationJob(MigrationJobType.SINGLE);

    const itemA1 = createMigrationJobItem({
      job_id: jobA1.id,
      tistory_url: 'https://blog-a/post/1',
    });
    const itemA2 = createMigrationJobItem({
      job_id: jobA2.id,
      tistory_url: 'https://blog-a/post/2',
    });
    const itemB1 = createMigrationJobItem({
      job_id: jobB1.id,
      tistory_url: 'https://blog-b/post/1',
    });

    updateMigrationJobItem(itemA1.id, {
      status: MigrationJobItemStatus.FAILED,
      error_message: 'A1 failed',
      updated_at: new Date().toISOString(),
    });
    updateMigrationJobItem(itemA2.id, {
      status: MigrationJobItemStatus.COMPLETED,
      error_message: null,
      updated_at: new Date().toISOString(),
    });

    // If a URL ever succeeds, it should be excluded from unresolved failures.
    updateMigrationJobItem(itemA1.id, {
      status: MigrationJobItemStatus.COMPLETED,
      error_message: null,
      updated_at: new Date().toISOString(),
    });
    updateMigrationJobItem(itemB1.id, {
      status: MigrationJobItemStatus.FAILED,
      error_message: 'B1 failed',
      updated_at: new Date().toISOString(),
    });

    const unresolvedFailedForA =
      getUnresolvedFailedMigrationJobItemsByBlogUrl('https://blog-a.example');
    expect(unresolvedFailedForA.map((i) => i.tistory_url)).toEqual([]);

    const unresolvedFailedForB =
      getUnresolvedFailedMigrationJobItemsByBlogUrl('https://blog-b.example');
    expect(unresolvedFailedForB.map((i) => i.tistory_url)).toEqual(['https://blog-b/post/1']);
  });

  it('creates and updates image assets', () => {
    const job = createMigrationJob(MigrationJobType.SINGLE);
    const item = createMigrationJobItem({
      job_id: job.id,
      tistory_url: 'https://example.tistory.com/2',
    });

    const asset = createImageAsset({
      job_item_id: item.id,
      tistory_image_url: 'https://example.tistory.com/image.png',
    });

    expect(asset.id).toBeGreaterThan(0);
    expect(asset.job_item_id).toBe(item.id);
    expect(asset.status).toBe(ImageAssetStatus.PENDING);
    expect(asset.tistory_image_url).toBe('https://example.tistory.com/image.png');

    const updatedAt1 = new Date().toISOString();

    updateImageAsset(asset.id, {
      status: ImageAssetStatus.UPLOADED,
      wp_media_id: 456,
      wp_media_url: 'https://wp.example.com/wp-content/uploads/image.png',
      updated_at: updatedAt1,
    });

    const uploadedAssetList = getImageAssetsByJobItemId(item.id);
    const uploadedAsset = uploadedAssetList.find((a) => a.id === asset.id);
    expect(uploadedAsset?.status).toBe(ImageAssetStatus.UPLOADED);
    expect(uploadedAsset?.wp_media_id).toBe(456);
    expect(uploadedAsset?.wp_media_url).toBe('https://wp.example.com/wp-content/uploads/image.png');
    expect(uploadedAsset?.updated_at).toBe(updatedAt1);

    const updatedAt2 = new Date().toISOString();
    const errorMessage = 'upload failure';

    updateImageAsset(asset.id, {
      status: ImageAssetStatus.FAILED,
      error_message: errorMessage,
      updated_at: updatedAt2,
    });

    const failedAssetList = getImageAssetsByJobItemId(item.id);
    const failedAsset = failedAssetList.find((a) => a.id === asset.id);
    expect(failedAsset?.status).toBe(ImageAssetStatus.FAILED);
    expect(failedAsset?.error_message).toBe(errorMessage);
    expect(failedAsset?.updated_at).toBe(updatedAt2);
  });

  it('creates and retrieves post map entries', () => {
    const mapping = createPostMap({
      tistory_url: 'https://example.tistory.com/3',
      wp_post_id: 789,
    });

    expect(mapping.id).toBeGreaterThan(0);
    expect(mapping.tistory_url).toBe('https://example.tistory.com/3');
    expect(mapping.wp_post_id).toBe(789);

    const fetched = getPostMapByTistoryUrl('https://example.tistory.com/3');
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(mapping.id);
    expect(fetched?.wp_post_id).toBe(789);
  });

  it('inserts and fetches internal link records', () => {
    const job = createMigrationJob(MigrationJobType.SINGLE);
    const item = createMigrationJobItem({
      job_id: job.id,
      tistory_url: 'https://example.tistory.com/4',
    });

    const link1 = insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/4',
      target_url: 'https://example.tistory.com/5',
      link_text: 'next post',
      context: 'See the next post',
    });

    const link2 = insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/4',
      target_url: 'https://example.tistory.com/6',
      link_text: null,
      context: null,
    });

    expect(link1.id).toBeGreaterThan(0);
    expect(link2.id).toBeGreaterThan(link1.id);

    const links = getInternalLinksByJobItemId(item.id);
    expect(links.length).toBe(2);
    const targets = links.map((l) => l.target_url).sort();
    expect(targets).toEqual(['https://example.tistory.com/5', 'https://example.tistory.com/6']);
  });

  it('filters internal links by job item ID when mixed data exists', () => {
    const job1 = createMigrationJob(MigrationJobType.SINGLE);
    const item1 = createMigrationJobItem({
      job_id: job1.id,
      tistory_url: 'https://example.tistory.com/job1/1',
    });

    const job2 = createMigrationJob(MigrationJobType.SINGLE);
    const item2 = createMigrationJobItem({
      job_id: job2.id,
      tistory_url: 'https://example.tistory.com/job2/1',
    });

    insertInternalLink({
      job_item_id: item1.id,
      source_url: 'https://example.tistory.com/job1/1',
      target_url: 'https://example.tistory.com/target1',
      link_text: 'link1',
      context: 'context1',
    });

    insertInternalLink({
      job_item_id: item1.id,
      source_url: 'https://example.tistory.com/job1/1',
      target_url: 'https://example.tistory.com/target2',
      link_text: 'link2',
      context: 'context2',
    });

    insertInternalLink({
      job_item_id: item2.id,
      source_url: 'https://example.tistory.com/job2/1',
      target_url: 'https://example.tistory.com/target3',
      link_text: 'link3',
      context: 'context3',
    });

    const item1Links = getInternalLinksByJobItemId(item1.id);
    const item2Links = getInternalLinksByJobItemId(item2.id);

    expect(item1Links).toHaveLength(2);
    expect(item2Links).toHaveLength(1);

    item1Links.forEach((link) => {
      expect(link.job_item_id).toBe(item1.id);
    });

    item2Links.forEach((link) => {
      expect(link.job_item_id).toBe(item2.id);
    });
  });

  it('returns empty array for non-existent job item ID', () => {
    const links = getInternalLinksByJobItemId(999999);
    expect(links).toEqual([]);
  });

  it('handles null link_text and context', () => {
    const job = createMigrationJob(MigrationJobType.SINGLE);
    const item = createMigrationJobItem({
      job_id: job.id,
      tistory_url: 'https://example.tistory.com/5',
    });

    const link = insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/5',
      target_url: 'https://example.tistory.com/6',
      link_text: null,
      context: null,
    });

    expect(link.link_text).toBeNull();
    expect(link.context).toBeNull();

    const links = getInternalLinksByJobItemId(item.id);
    expect(links).toHaveLength(1);
    expect(links[0].link_text).toBeNull();
    expect(links[0].context).toBeNull();
  });

  it('persists internal links with special characters in link text and context', () => {
    const job = createMigrationJob(MigrationJobType.SINGLE);
    const item = createMigrationJobItem({
      job_id: job.id,
      tistory_url: 'https://example.tistory.com/6',
    });

    const specialText = 'Link with <special> & "characters" and \'quotes\' and émojis 🎉';
    const specialContext = 'Context with <tag> & "quotes" and special chars: <>&"\' émojis ✨';

    const link = insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/6',
      target_url: 'https://example.tistory.com/7',
      link_text: specialText,
      context: specialContext,
    });

    expect(link.link_text).toBe(specialText);
    expect(link.context).toBe(specialContext);

    const links = getInternalLinksByJobItemId(item.id);
    expect(links).toHaveLength(1);
    expect(links[0].link_text).toBe(specialText);
    expect(links[0].context).toBe(specialContext);
  });

  it('handles multiple internal links with same source and target', () => {
    const job = createMigrationJob(MigrationJobType.SINGLE);
    const item = createMigrationJobItem({
      job_id: job.id,
      tistory_url: 'https://example.tistory.com/7',
    });

    insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/7',
      target_url: 'https://example.tistory.com/8',
      link_text: 'link1',
      context: 'context1',
    });

    insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/7',
      target_url: 'https://example.tistory.com/8',
      link_text: 'link2',
      context: 'context2',
    });

    const links = getInternalLinksByJobItemId(item.id);
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it('orders internal links by ID when retrieving', () => {
    const job = createMigrationJob(MigrationJobType.SINGLE);
    const item = createMigrationJobItem({
      job_id: job.id,
      tistory_url: 'https://example.tistory.com/8',
    });

    const link1 = insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/8',
      target_url: 'https://example.tistory.com/target1',
      link_text: 'first',
      context: 'first',
    });

    const link2 = insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/8',
      target_url: 'https://example.tistory.com/target2',
      link_text: 'second',
      context: 'second',
    });

    const link3 = insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/8',
      target_url: 'https://example.tistory.com/target3',
      link_text: 'third',
      context: 'third',
    });

    const links = getInternalLinksByJobItemId(item.id);
    expect(links).toHaveLength(3);
    expect(links[0].id).toBe(link1.id);
    expect(links[1].id).toBe(link2.id);
    expect(links[2].id).toBe(link3.id);
  });

  it('handles empty string for link_text and context', () => {
    const job = createMigrationJob(MigrationJobType.SINGLE);
    const item = createMigrationJobItem({
      job_id: job.id,
      tistory_url: 'https://example.tistory.com/9',
    });

    const link = insertInternalLink({
      job_item_id: item.id,
      source_url: 'https://example.tistory.com/9',
      target_url: 'https://example.tistory.com/10',
      link_text: '',
      context: '',
    });

    expect(link.link_text).toBe('');
    expect(link.context).toBe('');

    const links = getInternalLinksByJobItemId(item.id);
    expect(links).toHaveLength(1);
    expect(links[0].link_text).toBe('');
    expect(links[0].context).toBe('');
  });
});
