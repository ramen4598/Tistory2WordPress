import { MigrationJobStatus, MigrationJobType } from '../../src/enums/db.enum';

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
      createMigrationJob: jest.fn().mockReturnValue({ id: 555 }),
      updateMigrationJob: jest.fn(),
    }));

    jest.doMock('../../src/services/migrator', () => ({
      createMigrator: jest.fn().mockReturnValue({ migratePostByUrl }),
    }));

    const { runCli } = await import('../../src/cli');

    const code = await runCli(['node', 'cli', '--post=https://example.com/post/2']);
    expect(code).toBe(1);
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
      loadConfig: jest.fn().mockReturnValue({ blogUrl: 'https://example.com', workerCount: 7 }),
    }));

    jest.doMock('../../src/db', () => ({
      getDb: jest.fn(),
      createMigrationJob: jest.fn().mockReturnValue({ id: 999 }),
      getMigrationJobItemsByJobId: jest.fn().mockReturnValue([
        { id: 1, job_id: 999, tistory_url: 'https://example.com/post/1', status: 'completed' },
        { id: 2, job_id: 999, tistory_url: 'https://example.com/post/2', status: 'completed' },
      ]),
      updateMigrationJob: jest.fn(),
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
    expect(db.createMigrationJob).toHaveBeenCalledWith(MigrationJobType.FULL);
    expect(discoverPostUrls).toHaveBeenCalled();
    expect(postProcessor.createPostProcessor).toHaveBeenCalledWith(7);
    expect(process).toHaveBeenCalledWith(
      ['https://example.com/post/1', 'https://example.com/post/2'],
      999
    );
    expect(db.getMigrationJobItemsByJobId).toHaveBeenCalledWith(999);

    logSpy.mockRestore();
  });
});
