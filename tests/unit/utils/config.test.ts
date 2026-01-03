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

  it('applies defaults and validates numeric fields', () => {
    setMinimumValidEnv();
    // no numeric envs set -> defaults used, should not throw
    const { loadConfig } =
      require('../../../src/utils/config') as typeof import('../../../src/utils/config');

    const config = loadConfig();

    expect(config.workerCount).toBe(4);
    expect(config.rateLimitPerWorker).toBe(1000);
    expect(config.maxRetryAttempts).toBe(3);
    expect(config.retryInitialDelayMs).toBe(500);
    expect(config.retryMaxDelayMs).toBe(10000);
    expect(config.retryBackoffMultiplier).toBe(2);
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
});
