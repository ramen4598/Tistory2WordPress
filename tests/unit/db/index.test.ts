import fs from 'fs';
import path from 'path';
import { getDb, closeDb } from '../../../src/db/index';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('../../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

const TEST_DB_PATH = path.join(__dirname, 'test-migration.db');

describe('db initialization and migrations', () => {
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
