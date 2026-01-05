import fs from 'fs';
import path from 'path';
import {
  closeDb,
  createMigrationJob,
  createMigrationJobItem,
  insertInternalLink,
} from '../../../src/db';
import { MigrationJobType } from '../../../src/enums/db.enum';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('../../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

const TEST_DB_PATH = path.join(__dirname, 'test-migration.db');
const TEST_OUTPUT_DIR = path.join(__dirname, 'test-output');

describe('link mapping export (integration)', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });

    mockedLoadConfig.mockReturnValue({
      ...baseConfig,
      migrationDbPath: TEST_DB_PATH,
      outputDir: TEST_OUTPUT_DIR,
    });
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
    jest.resetAllMocks();
  });

  describe('exportLinkMapping function', () => {
    it('exports internal links from DB to link_mapping.json', async () => {
      const { exportLinkMapping } = await import('../../../src/services/linkMapper');

      const job = createMigrationJob(MigrationJobType.SINGLE);
      const item1 = createMigrationJobItem({
        job_id: job.id,
        tistory_url: 'https://example.tistory.com/post1',
      });
      const item2 = createMigrationJobItem({
        job_id: job.id,
        tistory_url: 'https://example.tistory.com/post2',
      });

      insertInternalLink({
        job_item_id: item1.id,
        source_url: 'https://example.tistory.com/post1',
        target_url: 'https://example.tistory.com/post2',
        link_text: 'Next post',
        context: 'See the next post',
      });

      insertInternalLink({
        job_item_id: item1.id,
        source_url: 'https://example.tistory.com/post1',
        target_url: 'https://example.tistory.com/post3',
        link_text: null,
        context: null,
      });

      insertInternalLink({
        job_item_id: item2.id,
        source_url: 'https://example.tistory.com/post2',
        target_url: 'https://example.tistory.com/post1',
        link_text: 'Previous post',
        context: 'Go back to previous',
      });

      await exportLinkMapping(path.join(TEST_OUTPUT_DIR, 'link_mapping.json'));

      const filePath = path.join(TEST_OUTPUT_DIR, 'link_mapping.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(3);

      const link1 = data.find(
        (l: { source_url: string; target_url: string }) =>
          l.target_url === 'https://example.tistory.com/post2'
      );
      expect(link1).toBeDefined();
      expect(link1.source_url).toBe('https://example.tistory.com/post1');
      expect(link1.target_url).toBe('https://example.tistory.com/post2');
      expect(link1.link_text).toBe('Next post');
      expect(link1.context).toBe('See the next post');

      const link2 = data.find(
        (l: { source_url: string; target_url: string }) =>
          l.target_url === 'https://example.tistory.com/post3'
      );
      expect(link2).toBeDefined();
      expect(link2.link_text).toBeUndefined();
      expect(link2.context).toBeUndefined();
    });

    it('exports empty array when no internal links exist', async () => {
      const { exportLinkMapping } = await import('../../../src/services/linkMapper');

      const job = createMigrationJob(MigrationJobType.SINGLE);
      createMigrationJobItem({
        job_id: job.id,
        tistory_url: 'https://example.tistory.com/post1',
      });

      await exportLinkMapping(path.join(TEST_OUTPUT_DIR, 'link_mapping.json'));

      const filePath = path.join(TEST_OUTPUT_DIR, 'link_mapping.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it('filters internal links by job ID when exporting', async () => {
      const { exportLinkMapping } = await import('../../../src/services/linkMapper');

      const job1 = createMigrationJob(MigrationJobType.SINGLE);
      const job2 = createMigrationJob(MigrationJobType.SINGLE);

      const item1 = createMigrationJobItem({
        job_id: job1.id,
        tistory_url: 'https://example.tistory.com/job1/post',
      });

      const item2 = createMigrationJobItem({
        job_id: job2.id,
        tistory_url: 'https://example.tistory.com/job2/post',
      });

      insertInternalLink({
        job_item_id: item1.id,
        source_url: 'https://example.tistory.com/job1/post',
        target_url: 'https://example.tistory.com/target1',
        link_text: 'link from job1',
        context: 'context1',
      });

      insertInternalLink({
        job_item_id: item2.id,
        source_url: 'https://example.tistory.com/job2/post',
        target_url: 'https://example.tistory.com/target2',
        link_text: 'link from job2',
        context: 'context2',
      });

      await exportLinkMapping(path.join(TEST_OUTPUT_DIR, 'link_mapping.json'), job1.id);

      const filePath = path.join(TEST_OUTPUT_DIR, 'link_mapping.json');
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveLength(1);
      expect(data[0].source_url).toBe('https://example.tistory.com/job1/post');
      expect(data[0].link_text).toBe('link from job1');
    });

    it('creates output directory if it does not exist', async () => {
      const { exportLinkMapping } = await import('../../../src/services/linkMapper');

      const job = createMigrationJob(MigrationJobType.SINGLE);
      const item = createMigrationJobItem({
        job_id: job.id,
        tistory_url: 'https://example.tistory.com/post1',
      });

      insertInternalLink({
        job_item_id: item.id,
        source_url: 'https://example.tistory.com/post1',
        target_url: 'https://example.tistory.com/post2',
        link_text: 'link',
        context: 'context',
      });

      const nonExistentDir = path.join(TEST_OUTPUT_DIR, 'nested', 'dir');
      await exportLinkMapping(path.join(nonExistentDir, 'link_mapping.json'));

      expect(fs.existsSync(nonExistentDir)).toBe(true);
      expect(fs.existsSync(path.join(nonExistentDir, 'link_mapping.json'))).toBe(true);
    });

    it('handles special characters in link text and context', async () => {
      const { exportLinkMapping } = await import('../../../src/services/linkMapper');

      const job = createMigrationJob(MigrationJobType.SINGLE);
      const item = createMigrationJobItem({
        job_id: job.id,
        tistory_url: 'https://example.tistory.com/post1',
      });

      const specialText = 'Link with <special> & "characters" and \'quotes\' and émojis 🎉';
      const specialContext = 'Context with <tag> & "quotes" and special chars: <>&"\' émojis ✨';

      insertInternalLink({
        job_item_id: item.id,
        source_url: 'https://example.tistory.com/post1',
        target_url: 'https://example.tistory.com/post2',
        link_text: specialText,
        context: specialContext,
      });

      await exportLinkMapping(path.join(TEST_OUTPUT_DIR, 'link_mapping.json'));

      const filePath = path.join(TEST_OUTPUT_DIR, 'link_mapping.json');
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveLength(1);
      expect(data[0].link_text).toBe(specialText);
      expect(data[0].context).toBe(specialContext);
    });

    it('exports links in consistent order (by creation time)', async () => {
      const { exportLinkMapping } = await import('../../../src/services/linkMapper');

      const job = createMigrationJob(MigrationJobType.SINGLE);
      const item = createMigrationJobItem({
        job_id: job.id,
        tistory_url: 'https://example.tistory.com/post1',
      });

      insertInternalLink({
        job_item_id: item.id,
        source_url: 'https://example.tistory.com/post1',
        target_url: 'https://example.tistory.com/target1',
        link_text: 'first',
        context: 'first',
      });

      insertInternalLink({
        job_item_id: item.id,
        source_url: 'https://example.tistory.com/post1',
        target_url: 'https://example.tistory.com/target2',
        link_text: 'second',
        context: 'second',
      });

      insertInternalLink({
        job_item_id: item.id,
        source_url: 'https://example.tistory.com/post1',
        target_url: 'https://example.tistory.com/target3',
        link_text: 'third',
        context: 'third',
      });

      await exportLinkMapping(path.join(TEST_OUTPUT_DIR, 'link_mapping.json'));

      const filePath = path.join(TEST_OUTPUT_DIR, 'link_mapping.json');
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveLength(3);
      expect(data[0].target_url).toBe('https://example.tistory.com/target1');
      expect(data[1].target_url).toBe('https://example.tistory.com/target2');
      expect(data[2].target_url).toBe('https://example.tistory.com/target3');
    });

    it('validates JSON structure includes all required fields', async () => {
      const { exportLinkMapping } = await import('../../../src/services/linkMapper');

      const job = createMigrationJob(MigrationJobType.SINGLE);
      const item = createMigrationJobItem({
        job_id: job.id,
        tistory_url: 'https://example.tistory.com/post1',
      });

      insertInternalLink({
        job_item_id: item.id,
        source_url: 'https://example.tistory.com/post1',
        target_url: 'https://example.tistory.com/post2',
        link_text: 'link text',
        context: 'link context',
      });

      await exportLinkMapping(path.join(TEST_OUTPUT_DIR, 'link_mapping.json'));

      const filePath = path.join(TEST_OUTPUT_DIR, 'link_mapping.json');
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveLength(1);
      const link = data[0];

      expect(link).toHaveProperty('source_url');
      expect(link).toHaveProperty('target_url');
      expect(link).toHaveProperty('link_text');
      expect(link).toHaveProperty('context');

      expect(typeof link.source_url).toBe('string');
      expect(typeof link.target_url).toBe('string');
      expect(typeof link.link_text).toBe('string');
      expect(typeof link.context).toBe('string');
    });
  });
});
