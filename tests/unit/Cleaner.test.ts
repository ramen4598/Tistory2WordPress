/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../src/utils/config';
import { createCleaner } from '../../src/services/cleaner';

jest.mock('../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

const dummyPost637Html = fs.readFileSync(
  path.join(__dirname, '..', 'dummy', 'post637.html'),
  'utf8'
);

const dummyPost634Html = fs.readFileSync(
  path.join(__dirname, '..', 'dummy', 'post634.html'),
  'utf8'
);

describe('Cleaner service', () => {
  const blogUrl = 'https://ramen4598.tistory.com';

  beforeEach(() => {
    mockedLoadConfig.mockReturnValue({
      blogUrl,
      workerCount: 4,
      rateLimitPerWorker: 1000,
      outputDir: './output',
      downloadsDir: './output/downloads',
      logLevel: 'info',
      postTitleSelector: 'meta[name="title"]',
      postPublishDateSelector: 'meta[property="article:published_time"]',
      postModifiedDateSelector: 'meta[property="article:modified_time"]',
      postCategorySelector: 'div.another_category h4 a',
      postTagSelector: 'div.area_tag a[rel="tag"]',
      postListLinkSelector: 'a.link_category',
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Just print out the cleaned HTML of post 637 for manual verification', async () => {
    const cleaner = createCleaner();
    const cleanedHtml = await cleaner.cleanHtml(dummyPost637Html);
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'tmp', 'post637.cleaned.html'),
      cleanedHtml,
      'utf8'
    );
    console.log('Cleaned HTML of post 637 written to post637.cleaned.html');
  });
  it('Just print out the cleaned HTML of post 634 for manual verification', async () => {
    const cleaner = createCleaner();
    const cleanedHtml = await cleaner.cleanHtml(dummyPost634Html);
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'tmp', 'post634.cleaned.html'),
      cleanedHtml,
      'utf8'
    );
    console.log('Cleaned HTML of post 634 written to post634.cleaned.html');
  });
  // TODO: Add more tests to cover different scenarios
});
