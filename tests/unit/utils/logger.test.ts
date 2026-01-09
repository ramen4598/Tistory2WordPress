import * as fs from 'fs';
import * as path from 'path';
import {
  Logger,
  getLogger,
  closeLogger,
  configureLogger,
  LoggerConfig,
} from '../../../src/utils/logger';
import { LogLevel } from '../../../src/enums/config.enum';

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

describe('Logger', () => {
  const testLogDir = path.join(__dirname, '../../tmp/logs');
  const testLogFile = path.join(testLogDir, 'test.log');

  beforeEach(() => {
    resetEnv();
    // clear cachedConfig via re-require
    jest.resetModules();
  });

  beforeEach(() => {
    // Clean up test log directory
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    closeLogger();
    // Clean up test log directory
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // restore real dotenv
    jest.unmock('dotenv');
  });

  describe('Logger class', () => {
    it('should create logger with console-only output', () => {
      const config: LoggerConfig = { level: LogLevel.INFO };
      const logger = new Logger(config);

      expect(logger).toBeInstanceOf(Logger);
      logger.close();
    });

    it('should create logger with file output', () => {
      const config: LoggerConfig = { level: LogLevel.INFO, logFile: testLogFile };
      const logger = new Logger(config);

      expect(logger).toBeInstanceOf(Logger);
      expect(fs.existsSync(testLogDir)).toBe(true);
      logger.close();
    });

    it('should write log messages to file', (done) => {
      const config: LoggerConfig = { level: LogLevel.INFO, logFile: testLogFile };
      const logger = new Logger(config);

      logger.info('Test message');
      logger.close();

      // Wait for file stream to flush
      setTimeout(() => {
        const content = fs.readFileSync(testLogFile, 'utf-8');
        expect(content).toContain('[INFO] Test message');
        done();
      }, 100);
    });

    it('should filter logs based on log level', (done) => {
      const config: LoggerConfig = { level: LogLevel.WARN, logFile: testLogFile };
      const logger = new Logger(config);

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      logger.close();

      setTimeout(() => {
        const content = fs.readFileSync(testLogFile, 'utf-8');
        expect(content).not.toContain('Debug message');
        expect(content).not.toContain('Info message');
        expect(content).toContain('Warn message');
        expect(content).toContain('Error message');
        done();
      }, 100);
    });

    it('should include timestamp in log messages', (done) => {
      const config: LoggerConfig = { level: LogLevel.INFO, logFile: testLogFile };
      const logger = new Logger(config);

      logger.info('Timestamped message');
      logger.close();

      setTimeout(() => {
        const content = fs.readFileSync(testLogFile, 'utf-8');
        // Check timestamp format: [YYYY-MM-DDTHH:mm:ss.sssZ]
        expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
        expect(content).toContain('[INFO] Timestamped message');
        done();
      }, 100);
    });

    it('should serialize additional arguments', (done) => {
      const config: LoggerConfig = { level: LogLevel.INFO, logFile: testLogFile };
      const logger = new Logger(config);

      logger.info('Message with data', { key: 'value' }, [1, 2, 3]);
      logger.close();

      setTimeout(() => {
        const content = fs.readFileSync(testLogFile, 'utf-8');
        expect(content).toContain('{"key":"value"}');
        expect(content).toContain('[1,2,3]');
        done();
      }, 100);
    });

    it('should append to existing log file', (done) => {
      const config: LoggerConfig = { level: LogLevel.INFO, logFile: testLogFile };

      const logger1 = new Logger(config);
      logger1.info('First message');
      logger1.close();

      setTimeout(() => {
        const logger2 = new Logger(config);
        logger2.info('Second message');
        logger2.close();

        setTimeout(() => {
          const content = fs.readFileSync(testLogFile, 'utf-8');
          expect(content).toContain('First message');
          expect(content).toContain('Second message');
          done();
        }, 100);
      }, 100);
    });
  });

  describe('Global logger functions (singleton)', () => {
    it('should lazily create a default global logger via getLogger', () => {
      setMinimumValidEnv();
      const logger = getLogger();
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should configure global logger with custom settings using configureLogger', () => {
      const config: LoggerConfig = { level: LogLevel.DEBUG, logFile: testLogFile };
      const logger = configureLogger(config);

      expect(logger).toBeInstanceOf(Logger);
      logger.debug('Configured message');
      logger.close();
    });

    it('should reconfigure global logger and close previous instance', () => {
      const config1: LoggerConfig = { level: LogLevel.INFO, logFile: testLogFile };
      const logger1 = configureLogger(config1);
      const closeSpy = jest.spyOn(logger1, 'close');

      const config2: LoggerConfig = { level: LogLevel.DEBUG };
      const logger2 = configureLogger(config2);

      expect(closeSpy).toHaveBeenCalled();
      expect(logger2).toBeInstanceOf(Logger);
      expect(logger2).not.toBe(logger1);
    });

    it('should close global logger and allow lazy re-creation', () => {
      const logger = getLogger();
      const closeSpy = jest.spyOn(logger, 'close');

      closeLogger();

      expect(closeSpy).toHaveBeenCalled();

      const newLogger = getLogger();
      expect(newLogger).toBeInstanceOf(Logger);
      expect(newLogger).not.toBe(logger);
    });
  });

  describe('Log levels', () => {
    it('should log debug messages when level is debug', (done) => {
      const config: LoggerConfig = { level: LogLevel.DEBUG, logFile: testLogFile };
      const logger = new Logger(config);

      logger.debug('Debug message');
      logger.close();

      setTimeout(() => {
        const content = fs.readFileSync(testLogFile, 'utf-8');
        expect(content).toContain('[DEBUG] Debug message');
        done();
      }, 100);
    });

    it('should log info messages when level is info', (done) => {
      const config: LoggerConfig = { level: LogLevel.INFO, logFile: testLogFile };
      const logger = new Logger(config);

      logger.info('Info message');
      logger.close();

      setTimeout(() => {
        const content = fs.readFileSync(testLogFile, 'utf-8');
        expect(content).toContain('[INFO] Info message');
        done();
      }, 100);
    });

    it('should log warn messages when level is warn', (done) => {
      const config: LoggerConfig = { level: LogLevel.WARN, logFile: testLogFile };
      const logger = new Logger(config);

      logger.warn('Warn message');
      logger.close();

      setTimeout(() => {
        const content = fs.readFileSync(testLogFile, 'utf-8');
        expect(content).toContain('[WARN] Warn message');
        done();
      }, 100);
    });

    it('should log error messages when level is error', (done) => {
      const config: LoggerConfig = { level: LogLevel.ERROR, logFile: testLogFile };
      const logger = new Logger(config);

      logger.error('Error message');
      logger.close();

      setTimeout(() => {
        const content = fs.readFileSync(testLogFile, 'utf-8');
        expect(content).toContain('[ERROR] Error message');
        done();
      }, 100);
    });
  });
});
