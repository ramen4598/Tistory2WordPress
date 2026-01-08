import {
  MigrationJobItemStatus,
  MigrationJobStatus,
  MigrationJobType,
} from '../../src/enums/db.enum';

describe('CLI --help', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 0 and prints formatted help when --help is provided', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const loadConfig = jest.fn().mockReturnValue({});
    jest.doMock('../../src/utils/config', () => ({
      loadConfig,
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--help']);

    expect(code).toBe(0);

    // Config should not be loaded when help flag is present
    expect(loadConfig).not.toHaveBeenCalled();

    // ensure help output contains key sections
    const logged = (logSpy.mock.calls as Array<[string]>).map(([msg]) => msg).join('\n');
    expect(logged).toContain('Tistory2Wordpress - Migrate Tistory blog posts to WordPress');
    expect(logged).toContain('Usage:');
    expect(logged).toContain(
      '[--post=<url> | --all] [--retry-failed] [--export-links] [--export-failed]'
    );
    expect(logged).toContain('Options:');
    expect(logged).toContain('-h, --help');
    expect(logged).toContain('Environment Variables (in .env):');

    logSpy.mockRestore();
  });

  it('returns 0 and prints usage when -h is provided', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const loadConfig = jest.fn().mockReturnValue({});
    jest.doMock('../../src/utils/config', () => ({
      loadConfig,
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '-h']);

    expect(code).toBe(0);
    expect(loadConfig).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('prefers help over other flags', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const loadConfig = jest.fn().mockReturnValue({});
    jest.doMock('../../src/utils/config', () => ({
      loadConfig,
    }));

    const getDb = jest.fn();
    const createMigrationJob = jest.fn();
    jest.doMock('../../src/db', () => ({
      getDb,
      createMigrationJob,
      getMigrationJobItemsByJobId: jest.fn().mockReturnValue([]),
      updateMigrationJob: jest.fn(),
    }));

    jest.doMock('../../src/services/migrator', () => ({
      createMigrator: jest.fn().mockReturnValue({ migratePostByUrl: jest.fn() }),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--help', '--all']);

    expect(code).toBe(0);
    expect(loadConfig).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
    expect(createMigrationJob).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
  });
});

describe('CLI --post', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('runs single post migration with job + db bootstrap', async () => {
    const migratePostByUrl = jest.fn().mockResolvedValue(undefined);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    jest.doMock('../../src/utils/config', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    const updateMigrationJob = jest.fn().mockResolvedValue(undefined);

    jest.doMock('../../src/db', () => ({
      getDb: jest.fn(),
      createMigrationJob: jest.fn().mockReturnValue({ id: 123 }),
      getMigrationJobItemsByJobId: jest
        .fn()
        .mockReturnValue([
          { id: 1, job_id: 123, tistory_url: 'https://example.com/post/1', status: 'completed' },
        ]),
      updateMigrationJob,
      closeDb: jest.fn(),
    }));

    jest.doMock('../../src/services/migrator', () => ({
      createMigrator: jest.fn().mockReturnValue({ migratePostByUrl }),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--post', 'https://example.com/post/1']);

    expect(code).toBe(0);

    const db = await import('../../src/db');
    expect(db.getDb).toHaveBeenCalledTimes(1);
    expect(db.createMigrationJob).toHaveBeenCalledWith(MigrationJobType.SINGLE);
    expect(db.getMigrationJobItemsByJobId).toHaveBeenCalledWith(123);

    expect(db.updateMigrationJob).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        status: MigrationJobStatus.COMPLETED,
        error_message: null,
      })
    );
    expect(migratePostByUrl).toHaveBeenCalledWith('https://example.com/post/1', { jobId: 123 });

    expect(logSpy).toHaveBeenCalledWith('----------------------------------------');
    expect(logSpy).toHaveBeenCalledWith('- Migration Job Summary (jobId=123)');
    expect(logSpy).toHaveBeenCalledWith('----------------------------------------');
    expect(logSpy).toHaveBeenCalledWith('- Completed: 1');
    expect(logSpy).toHaveBeenCalledWith('- Failed: 0');
    expect(logSpy).toHaveBeenCalledWith('----------------------------------------');

    logSpy.mockRestore();
  });

  it('returns non-zero when --post is missing', async () => {
    jest.doMock('../../src/utils/config', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli']);
    expect(code).toBe(1);
  });

  it('returns non-zero when migrator throws', async () => {
    const migratePostByUrl = jest.fn().mockRejectedValue(new Error('boom'));

    jest.doMock('../../src/utils/config', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    jest.doMock('../../src/db', () => ({
      getDb: jest.fn(),
      getLatestRunningJobByTypeAndUrl: jest.fn().mockReturnValue({ id: 999 }),
      createMigrationJob: jest.fn().mockReturnValue({ id: 999 }),
      getMigrationJobItemsByJobIdAndStatus: jest.fn().mockImplementation((id, status) => {
        if (status === MigrationJobItemStatus.COMPLETED) {
          return [
            { id: 1, job_id: 999, tistory_url: 'https://example.com/post/1', status: 'completed' },
          ];
        }
        if (status === MigrationJobItemStatus.FAILED) {
          return [
            { id: 2, job_id: 999, tistory_url: 'https://example.com/post/2', status: 'failed' },
          ];
        }
        return [];
      }),
      getMigrationJobItemsByJobId: jest.fn().mockReturnValue([]),
      updateMigrationJob: jest.fn(),
      closeDb: jest.fn(),
    }));

    jest.doMock('../../src/services/migrator', () => ({
      createMigrator: jest.fn().mockReturnValue({ migratePostByUrl }),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--post=https://example.com/post/2']);
    expect(code).toBe(1);
  });

  it('returns non-zero when job has failed items', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    jest.doMock('../../src/utils/config', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    jest.doMock('../../src/db', () => ({
      getDb: jest.fn(),
      getMigrationJobItemsByJobId: jest.fn().mockReturnValue([
        { id: 1, job_id: 123, tistory_url: 'https://example.com/post/1', status: 'completed' },
        { id: 2, job_id: 123, tistory_url: 'https://example.com/post/2', status: 'failed' },
      ]),
      updateMigrationJob: jest.fn(),
      closeDb: jest.fn(),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--post', 'https://example.com/post/1']);
    expect(code).toBe(1);

    logSpy.mockRestore();
  });
});

describe('CLI --all', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('runs full blog migration with --all bootstrap', async () => {
    const discoverPostUrls = jest
      .fn()
      .mockResolvedValue(['https://example.com/post/1', 'https://example.com/post/2']);
    const process = jest.fn();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    jest.doMock('../../src/utils/config', () => ({
      loadConfig: jest.fn().mockReturnValue({
        blogUrl: 'https://example.com',
        workerCount: 7,
        outputDir: './output',
      }),
    }));

    jest.doMock('../../src/db', () => ({
      getDb: jest.fn(),
      getLatestRunningJobByTypeAndUrl: jest.fn().mockReturnValue(null),
      createMigrationJob: jest.fn().mockReturnValue({ id: 999 }),
      getMigrationJobItemsByJobIdAndStatus: jest.fn().mockReturnValue([]),
      getMigrationJobItemsByJobId: jest.fn().mockReturnValue([
        { id: 1, job_id: 999, tistory_url: 'https://example.com/post/1', status: 'completed' },
        { id: 2, job_id: 999, tistory_url: 'https://example.com/post/2', status: 'completed' },
      ]),
      updateMigrationJob: jest.fn(),
      closeDb: jest.fn(),
    }));

    jest.doMock('../../src/services/crawler', () => ({
      createCrawler: jest.fn().mockReturnValue({ discoverPostUrls }),
    }));

    jest.doMock('../../src/services/migrator', () => ({
      createMigrator: jest.fn().mockReturnValue({}),
    }));

    jest.doMock('../../src/workers/postProcessor', () => ({
      createPostProcessor: jest.fn().mockReturnValue({ process }),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--all']);

    expect(code).toBe(0);

    const db = await import('../../src/db');
    const postProcessor = await import('../../src/workers/postProcessor');
    expect(db.getLatestRunningJobByTypeAndUrl).toHaveBeenCalledWith(
      MigrationJobType.FULL,
      'https://example.com'
    );
    expect(db.createMigrationJob).toHaveBeenCalledWith(MigrationJobType.FULL);
    expect(discoverPostUrls).toHaveBeenCalled();
    expect(db.getMigrationJobItemsByJobIdAndStatus).toHaveBeenCalledWith(
      999,
      MigrationJobItemStatus.COMPLETED
    );
    expect(postProcessor.createPostProcessor).toHaveBeenCalledWith();
    expect(process).toHaveBeenCalledWith(
      ['https://example.com/post/1', 'https://example.com/post/2'],
      999
    );
    expect(db.getMigrationJobItemsByJobId).toHaveBeenCalledWith(999);

    logSpy.mockRestore();
  });

  it('resumes migration when running job exists with completed items', async () => {
    const discoverPostUrls = jest
      .fn()
      .mockResolvedValue([
        'https://example.com/post/1',
        'https://example.com/post/2',
        'https://example.com/post/3',
      ]);
    const process = jest.fn();
    const loggerSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    jest.doMock('../../src/utils/config', () => ({
      loadConfig: jest.fn().mockReturnValue({
        blogUrl: 'https://example.com',
        workerCount: 7,
        outputDir: './output',
      }),
    }));

    jest.doMock('../../src/db', () => ({
      getDb: jest.fn(),
      getLatestRunningJobByTypeAndUrl: jest.fn().mockReturnValue({ id: 888 }),
      createMigrationJob: jest.fn().mockReturnValue({ id: 888 }),
      getMigrationJobItemsByJobIdAndStatus: jest.fn().mockReturnValue([
        { id: 1, job_id: 888, tistory_url: 'https://example.com/post/1', status: 'completed' },
        { id: 2, job_id: 888, tistory_url: 'https://example.com/post/2', status: 'completed' },
      ]),
      getMigrationJobItemsByJobId: jest.fn().mockReturnValue([]),
      updateMigrationJob: jest.fn(),
      closeDb: jest.fn(),
    }));

    jest.doMock('../../src/services/crawler', () => ({
      createCrawler: jest.fn().mockReturnValue({ discoverPostUrls }),
    }));

    jest.doMock('../../src/services/migrator', () => ({
      createMigrator: jest.fn().mockReturnValue({}),
    }));

    jest.doMock('../../src/workers/postProcessor', () => ({
      createPostProcessor: jest.fn().mockReturnValue({ process }),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--all']);

    expect(code).toBe(0);

    const db = await import('../../src/db');
    const postProcessor = await import('../../src/workers/postProcessor');
    expect(db.getLatestRunningJobByTypeAndUrl).toHaveBeenCalledWith(
      MigrationJobType.FULL,
      'https://example.com'
    );
    expect(db.createMigrationJob).not.toHaveBeenCalled();
    expect(discoverPostUrls).toHaveBeenCalled();
    expect(db.getMigrationJobItemsByJobIdAndStatus).toHaveBeenCalledWith(
      888,
      MigrationJobItemStatus.COMPLETED
    );
    expect(db.getMigrationJobItemsByJobIdAndStatus).toHaveBeenCalledWith(
      888,
      MigrationJobItemStatus.FAILED
    );
    expect(postProcessor.createPostProcessor).toHaveBeenCalledWith();
    expect(process).toHaveBeenCalledWith(['https://example.com/post/3'], 888);
    expect(db.getMigrationJobItemsByJobId).toHaveBeenCalledWith(888);

    loggerSpy.mockRestore();
  });

  it('retries failed items when --retry-failed flag is set', async () => {
    const discoverPostUrls = jest
      .fn()
      .mockResolvedValue([
        'https://example.com/post/1',
        'https://example.com/post/2',
        'https://example.com/post/3',
      ]);
    const process = jest.fn();
    const loggerSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    jest.doMock('../../src/utils/config', () => ({
      loadConfig: jest.fn().mockReturnValue({
        blogUrl: 'https://example.com',
        workerCount: 7,
        outputDir: './output',
      }),
    }));

    jest.doMock('../../src/db', () => ({
      getDb: jest.fn(),
      getLatestRunningJobByTypeAndUrl: jest.fn().mockReturnValue({ id: 999 }),
      createMigrationJob: jest.fn().mockReturnValue({ id: 999 }),
      getMigrationJobItemsByJobIdAndStatus: jest.fn().mockImplementation((id, status) => {
        if (status === MigrationJobItemStatus.COMPLETED) {
          return [
            { id: 1, job_id: 999, tistory_url: 'https://example.com/post/1', status: 'completed' },
          ];
        }
        if (status === MigrationJobItemStatus.FAILED) {
          return [
            { id: 2, job_id: 999, tistory_url: 'https://example.com/post/2', status: 'failed' },
          ];
        }
        return [];
      }),
      getMigrationJobItemsByJobId: jest.fn().mockReturnValue([]),
      getMigrationJobById: jest.fn().mockReturnValue({
        id: 999,
        job_type: 'full',
        status: 'running',
        created_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0,
      }),
      updateMigrationJob: jest.fn(),
      closeDb: jest.fn(),
    }));

    jest.doMock('../../src/services/crawler', () => ({
      createCrawler: jest.fn().mockReturnValue({ discoverPostUrls }),
    }));

    jest.doMock('../../src/services/migrator', () => ({
      createMigrator: jest.fn().mockReturnValue({}),
    }));

    jest.doMock('../../src/workers/postProcessor', () => ({
      createPostProcessor: jest.fn().mockReturnValue({ process }),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--all', '--retry-failed']);

    expect(code).toBe(0);

    const db = await import('../../src/db');
    const postProcessor = await import('../../src/workers/postProcessor');
    expect(db.getLatestRunningJobByTypeAndUrl).toHaveBeenCalledWith(
      MigrationJobType.FULL,
      'https://example.com'
    );
    expect(db.getMigrationJobItemsByJobIdAndStatus).toHaveBeenCalledWith(
      999,
      MigrationJobItemStatus.COMPLETED
    );
    expect(db.getMigrationJobItemsByJobIdAndStatus).toHaveBeenCalledWith(
      999,
      MigrationJobItemStatus.FAILED
    );
    expect(postProcessor.createPostProcessor).toHaveBeenCalledWith();
    expect(process).toHaveBeenCalledWith(
      ['https://example.com/post/2', 'https://example.com/post/3'],
      999
    );
    expect(db.getMigrationJobItemsByJobId).toHaveBeenCalledWith(999);

    loggerSpy.mockRestore();
  });
});

describe('CLI --export-failed', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('exports failed posts to outputDir/failed_posts.json', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { baseConfig } = await import('./helpers/baseConfig');

    jest.doMock('../../src/utils/config', () => ({
      loadConfig: jest.fn().mockReturnValue({
        ...baseConfig,
        blogUrl: 'https://example.com',
        outputDir: './output',
      }),
    }));

    const exportFailedPostsByBlogUrl = jest.fn();
    jest.doMock('../../src/services/failedPostExporter', () => ({
      exportFailedPostsByBlogUrl,
    }));

    jest.doMock('../../src/db', () => ({
      getDb: jest.fn(),
      closeDb: jest.fn(),
      createMigrationJob: jest.fn(),
      getMigrationJobItemsByJobId: jest.fn(),
      getLatestRunningJobByTypeAndUrl: jest.fn(),
      getMigrationJobItemsByJobIdAndStatus: jest.fn(),
      updateMigrationJob: jest.fn(),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--export-failed']);

    expect(code).toBe(0);
    expect(exportFailedPostsByBlogUrl).toHaveBeenCalledWith(
      expect.stringContaining('failed_posts.json'),
      'https://example.com'
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
