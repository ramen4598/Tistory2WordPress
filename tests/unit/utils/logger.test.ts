import * as fs from 'fs';
import * as path from 'path';
import {
  Logger,
  getLogger,
  closeLogger,
  configureLogger,
  LoggerConfig,
} from '../../../src/utils/logger';

describe('Logger', () => {
  const testLogDir = path.join(__dirname, '../../tmp/logs');
  const testLogFile = path.join(testLogDir, 'test.log');

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

  describe('Logger class', () => {
    it('should create logger with console-only output', () => {
      const config: LoggerConfig = { level: 'info' };
      const logger = new Logger(config);

      expect(logger).toBeInstanceOf(Logger);
      logger.close();
    });

    it('should create logger with file output', () => {
      const config: LoggerConfig = { level: 'info', logFile: testLogFile };
      const logger = new Logger(config);

      expect(logger).toBeInstanceOf(Logger);
      expect(fs.existsSync(testLogDir)).toBe(true);
      logger.close();
    });

    it('should write log messages to file', (done) => {
      const config: LoggerConfig = { level: 'info', logFile: testLogFile };
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
      const config: LoggerConfig = { level: 'warn', logFile: testLogFile };
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
      const config: LoggerConfig = { level: 'info', logFile: testLogFile };
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
      const config: LoggerConfig = { level: 'info', logFile: testLogFile };
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
      const config: LoggerConfig = { level: 'info', logFile: testLogFile };

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
      const logger = getLogger();
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should configure global logger with custom settings using configureLogger', () => {
      const config: LoggerConfig = { level: 'debug', logFile: testLogFile };
      const logger = configureLogger(config);

      expect(logger).toBeInstanceOf(Logger);
      logger.debug('Configured message');
      logger.close();
    });

    it('should reconfigure global logger and close previous instance', () => {
      const config1: LoggerConfig = { level: 'info', logFile: testLogFile };
      const logger1 = configureLogger(config1);
      const closeSpy = jest.spyOn(logger1, 'close');

      const config2: LoggerConfig = { level: 'debug' };
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
      const config: LoggerConfig = { level: 'debug', logFile: testLogFile };
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
      const config: LoggerConfig = { level: 'info', logFile: testLogFile };
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
      const config: LoggerConfig = { level: 'warn', logFile: testLogFile };
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
      const config: LoggerConfig = { level: 'error', logFile: testLogFile };
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
