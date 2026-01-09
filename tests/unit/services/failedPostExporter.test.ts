import fs from 'fs';

jest.mock('../../../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { exportFailedPostsByBlogUrl } from '../../../src/services/failedPostExporter';

jest.mock('../../../src/db', () => ({
  getUnresolvedFailedMigrationJobItemsByBlogUrl: jest.fn(),
}));

jest.mock('fs');

describe('failedPostExporter', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    const mockedFs = fs as unknown as {
      existsSync: jest.Mock;
      mkdirSync: jest.Mock;
      writeFileSync: jest.Mock;
    };

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
    mockedFs.writeFileSync.mockImplementation(() => undefined);
  });

  it('excludes URLs that have any completed history', () => {
    const db = require('../../../src/db') as {
      getUnresolvedFailedMigrationJobItemsByBlogUrl: jest.Mock;
    };

    db.getUnresolvedFailedMigrationJobItemsByBlogUrl.mockReturnValue([
      { tistory_url: 'https://tistory.com/b', error_message: 'err3' },
    ]);

    const result = exportFailedPostsByBlogUrl('./output/failed.json', 'https://example.com');

    expect(db.getUnresolvedFailedMigrationJobItemsByBlogUrl).toHaveBeenCalledWith(
      'https://example.com'
    );

    expect(result.blog_url).toBe('https://example.com');
    expect(result.count).toBe(1);
    expect(result.items).toEqual([
      {
        tistory_url: 'https://tistory.com/b',
        error_messages: ['err3'],
      },
    ]);

    const mockedFs = fs as unknown as { writeFileSync: jest.Mock };
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
  });
});
