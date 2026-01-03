import fs from 'fs';
import path from 'path';
import {
  getDb,
  closeDb,
  createMigrationJob,
  updateMigrationJob,
  getMigrationJobById,
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

    const updatedJob = getMigrationJobById(job.id);
    expect(updatedJob).toBeDefined();
    expect(updatedJob?.status).toBe(MigrationJobStatus.COMPLETED);
    expect(updatedJob?.completed_at).toBe(completedAt);

    const errorMessage = 'something went wrong';
    updateMigrationJob(job.id, {
      status: MigrationJobStatus.FAILED,
      error_message: errorMessage,
    });

    const failedJob = getMigrationJobById(job.id);
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
    expect(item.status).toBe(MigrationJobItemStatus.PENDING);
    expect(item.tistory_url).toBe('https://example.tistory.com/1');
    expect(item.wp_post_id).toBeNull();

    const updatedAt1 = new Date().toISOString();

    updateMigrationJobItem(item.id, {
      status: MigrationJobItemStatus.SUCCESS,
      wp_post_id: 123,
      updated_at: updatedAt1,
    });

    const successItem = getMigrationJobItemById(item.id);
    expect(successItem).toBeDefined();
    expect(successItem?.status).toBe(MigrationJobItemStatus.SUCCESS);
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
});
