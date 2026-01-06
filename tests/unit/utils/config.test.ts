function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith('TISTORY_') ||
      key.startsWith('WP_') ||
      key === 'WORKER_COUNT' ||
      key === 'RATE_LIMIT_PER_WORKER' ||
      key.startsWith('RETRY_') ||
      key === 'MIGRATION_DB_PATH' ||
      key === 'LOG_LEVEL' ||
      key === 'CATEGORY_HIERARCHY_ORDER'
    ) {
      delete process.env[key];
    }
  }
}

function setMinimumValidEnv() {
  process.env.TISTORY_BLOG_URL = 'https://example.tistory.com';
  process.env.WP_BASE_URL = 'https://example.com';
  process.env.WP_APP_USER = 'user';
  process.env.WP_APP_PASSWORD = 'password';
  process.env.TISTORY_SELECTOR_TITLE = 'meta[name="title"]';
  process.env.TISTORY_SELECTOR_PUBLISH_DATE = 'meta[property="article:published_time"]';
  process.env.TISTORY_SELECTOR_MODIFIED_DATE = 'meta[property="article:modified_time"]';
  process.env.TISTORY_SELECTOR_CATEGORY = 'div.another_category h4 a';
  process.env.TISTORY_SELECTOR_TAG = 'div.area_tag a[rel="tag"]';
  process.env.TISTORY_SELECTOR_POST_LINK = 'a.link_category';
  process.env.TISTORY_SELECTOR_CONTENT = 'div.tt_article_useless_p_margin.contents_style';
  process.env.TISTORY_SELECTOR_FEATURED_IMAGE =
    '#main > div > div > div.article_header.type_article_header_cover > div';
  process.env.TISTORY_BOOKMARK_SELECTOR = 'figure[data-ke-type="opengraph"]';
}

// const realDotenv = require('dotenv');

jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('loadConfig', () => {
  beforeEach(() => {
    resetEnv();
    // clear cachedConfig via re-require
    jest.resetModules();
  });

  afterAll(() => {
    // restore real dotenv
    jest.unmock('dotenv');
  });

  it('throws ConfigurationError when required TISTORY_BLOG_URL is missing', () => {
    setMinimumValidEnv();
    delete process.env.TISTORY_BLOG_URL;

    // Re-require the module to reset cachedConfig
    const { loadConfig, ConfigurationError } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError for invalid TISTORY_BLOG_URL URL format', () => {
    setMinimumValidEnv();
    process.env.TISTORY_BLOG_URL = 'not-a-url';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow('TISTORY_BLOG_URL must be a valid URL');
  });

  // it('applies defaults and validates numeric fields', () => {
  it('throws error when there is no tistory bookmark selector', () => {
    setMinimumValidEnv();
    // no numeric envs set -> defaults used, should not throw
    delete process.env.TISTORY_BOOKMARK_SELECTOR;
    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    // const config = loadConfig();
    expect(() => loadConfig()).toThrow(
      'TISTORY_BOOKMARK_SELECTOR must be a non-empty string with length <= 200.'
    );
  });

  it('throws error when bookmark selector is missing', () => {
    setMinimumValidEnv();
    delete process.env.TISTORY_BOOKMARK_SELECTOR;

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow(
      'TISTORY_BOOKMARK_SELECTOR must be a non-empty string with length <= 200.'
    );
  });

  it('validates bookmark selector length and non-empty', () => {
    setMinimumValidEnv();
    process.env.TISTORY_BOOKMARK_SELECTOR = '';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow(
      'TISTORY_BOOKMARK_SELECTOR must be a non-empty string with length <= 200.'
    );
  });

  it('rejects overly long bookmark selector', () => {
    setMinimumValidEnv();
    process.env.TISTORY_BOOKMARK_SELECTOR = 'a'.repeat(201);

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow(
      'TISTORY_BOOKMARK_SELECTOR must be a non-empty string with length <= 200.'
    );
  });

  it('throws ConfigurationError when WORKER_COUNT is out of range', () => {
    setMinimumValidEnv();
    process.env.WORKER_COUNT = '0';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow('WORKER_COUNT must be a number between 1 and 16');
  });

  it('throws ConfigurationError when LOG_LEVEL is invalid', () => {
    setMinimumValidEnv();
    process.env.LOG_LEVEL = 'verbose';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow('LOG_LEVEL must be one of');
  });

  it('throws ConfigurationError when WP_BASE_URL is invalid', () => {
    setMinimumValidEnv();
    process.env.WP_BASE_URL = 'not-a-url';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow('WP_BASE_URL must be a valid URL');
  });

  it('uses CATEGORY_HIERARCHY_ORDER default when invalid', () => {
    setMinimumValidEnv();
    process.env.CATEGORY_HIERARCHY_ORDER = 'invalid-order';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    const config = loadConfig();

    expect(warnSpy).toHaveBeenCalled();
    expect(config.categoryHierarchyOrder).toBe('first-is-parent');

    warnSpy.mockRestore();
  });

  it('loads concurrency config from environment variable', () => {
    setMinimumValidEnv();
    process.env.WORKER_COUNT = '8';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    const config = loadConfig();

    expect(config.workerCount).toBe(8);
  });

  it('loads rate limit config from environment variable', () => {
    setMinimumValidEnv();
    process.env.RATE_LIMIT_PER_WORKER = '500';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    const config = loadConfig();

    expect(config.rateLimitPerWorker).toBe(500);
  });

  it('validates WORKER_COUNT upper bound', () => {
    setMinimumValidEnv();
    process.env.WORKER_COUNT = '17';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow('WORKER_COUNT must be a number between 1 and 16');
  });

  it('validates RATE_LIMIT_PER_WORKER is positive', () => {
    setMinimumValidEnv();
    process.env.RATE_LIMIT_PER_WORKER = '0';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    expect(() => loadConfig()).toThrow('RATE_LIMIT_PER_WORKER must be a positive number');
  });

  it('handles string values for numeric config', () => {
    setMinimumValidEnv();
    process.env.WORKER_COUNT = '4';
    process.env.RATE_LIMIT_PER_WORKER = '2000';

    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    const config = loadConfig();

    expect(config.workerCount).toBe(4);
    expect(config.rateLimitPerWorker).toBe(2000);
  });
});
