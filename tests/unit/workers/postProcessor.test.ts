import { createMigrator, Migrator } from '../../../src/services/migrator';
import { createPostProcessor } from '../../../src/workers/postProcessor';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';
import { Config } from '../../../src/models/Config';

jest.mock('../../../src/utils/config');
jest.mock('../../../src/services/migrator');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('PostProcessor', () => {
  beforeEach(() => {
    mockedLoadConfig.mockReturnValue(baseConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  let mockMigrator: jest.Mocked<Migrator>;
  beforeEach(() => {
    mockMigrator = {
      migratePostByUrl: jest.fn().mockResolvedValue(undefined),
    };
    (createMigrator as jest.Mock).mockReturnValue(mockMigrator);
  });

  it('processes posts with specified concurrency', async () => {
    const urls = ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'];

    const processor = createPostProcessor();
    await processor.process(urls, 1);

    expect(mockMigrator.migratePostByUrl).toHaveBeenCalledTimes(3);
    expect(mockMigrator.migratePostByUrl).toHaveBeenCalledWith('https://example.com/1', {
      jobId: 1,
    });
    expect(mockMigrator.migratePostByUrl).toHaveBeenCalledWith('https://example.com/2', {
      jobId: 1,
    });
    expect(mockMigrator.migratePostByUrl).toHaveBeenCalledWith('https://example.com/3', {
      jobId: 1,
    });
  });

  it('continues processing even if some posts fail', async () => {
    const urls = ['https://example.com/fail', 'https://example.com/pass'];
    mockMigrator.migratePostByUrl
      .mockRejectedValueOnce(new Error('Migration failed'))
      .mockResolvedValueOnce(undefined);

    const processor = createPostProcessor();
    await processor.process(urls, 1);
    expect(mockMigrator.migratePostByUrl).toHaveBeenCalledTimes(2);
  });

  it('respects config rate limiting and concurrency settings', async () => {
    const testConfig: Config = {
      ...baseConfig,
      workerCount: 2,
      rateLimitPerWorker: 500, // 500ms = 2 requests per second
    };
    mockedLoadConfig.mockReturnValue(testConfig);

    const urls = ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'];
    const startTime = Date.now();

    const processor = createPostProcessor();
    await processor.process(urls, 1);

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(mockMigrator.migratePostByUrl).toHaveBeenCalledTimes(3);
    // With rate limiting of 500ms per request and 2 concurrent workers,
    // we should see some minimum duration for processing
    expect(duration).toBeGreaterThan(250); // Allow some tolerance for test execution time
  });
});
