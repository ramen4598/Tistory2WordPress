import { createWxrGenerator } from '../../src/services/wxrGenerator';
import { WXRData } from '../../src/models/WXRData';
import { Post } from '../../src/models/Post';
import { Category } from '../../src/models/Category';
import { Tag } from '../../src/models/Tag';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

const TMP_DIR = path.join(__dirname, '..', 'tmp');

const createSampleWxrData = (): WXRData => {
  const categories: Category[] = [
    { name: 'Tech', slug: 'tech', parent: null, description: null },
    { name: 'Life', slug: 'life', parent: null, description: null },
  ];

  const tags: Tag[] = [
    { name: 'typescript', slug: 'typescript' },
    { name: 'nodejs', slug: 'nodejs' },
  ];

  const posts: Post[] = [
    {
      url: 'https://blog.tistory.com/1',
      title: 'First Post',
      content: '<p>Content 1</p>',
      publish_date: new Date('2025-01-01T10:00:00Z'),
      modified_date: null,
      categories: [categories[0]],
      tags: [tags[0]],
      images: [],
      attachments: [],
    },
    {
      url: 'https://blog.tistory.com/2',
      title: 'Second Post',
      content: '<p>Content 2</p>',
      publish_date: new Date('2025-01-02T11:00:00Z'),
      modified_date: null,
      categories: [categories[1]],
      tags: [tags[1]],
      images: [],
      attachments: [],
    },
  ];

  return {
    posts,
    categories,
    tags,
    authors: [
      {
        id: 1,
        login: 'admin',
        display_name: 'Admin User',
      },
    ],
    site_info: {
      title: 'My Tistory Blog',
      description: 'A sample Tistory blog',
      url: 'https://blog.tistory.com',
    },
  };
};

describe('WxrGenerator', () => {
  it('should build base WXR XML structure with channel metadata', () => {
    const wxrData = createSampleWxrData();
    const generator = createWxrGenerator();

    const xml = generator.build(wxrData);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('<title>My Tistory Blog</title>');
    expect(xml).toContain('<link>https://blog.tistory.com</link>');
    expect(xml).toContain('<description>A sample Tistory blog</description>');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
  });

  it('should add posts and deduplicate categories and tags when using addPost', () => {
    const generator = createWxrGenerator();

    const base: WXRData = {
      posts: [],
      categories: [],
      tags: [],
      authors: [
        {
          id: 1,
          login: 'admin',
          display_name: 'Admin User',
        },
      ],
      site_info: {
        title: 'My Tistory Blog',
        description: 'A sample Tistory blog',
        url: 'https://blog.tistory.com',
      },
    };

    const commonCategory: Category = {
      name: 'Tech',
      slug: 'tech',
      parent: null,
      description: null,
    };
    const commonTag: Tag = { name: 'typescript', slug: 'typescript' };

    const post1: Post = {
      url: 'https://blog.tistory.com/1',
      title: 'First Post',
      content: '<p>Content 1</p>',
      publish_date: new Date('2025-01-01T10:00:00Z'),
      modified_date: null,
      categories: [commonCategory],
      tags: [commonTag],
      images: [],
      attachments: [],
    };

    const post2: Post = {
      url: 'https://blog.tistory.com/2',
      title: 'Second Post',
      content: '<p>Content 2</p>',
      publish_date: new Date('2025-01-02T11:00:00Z'),
      modified_date: null,
      categories: [commonCategory],
      tags: [commonTag],
      images: [],
      attachments: [],
    };

    const afterFirst = generator.addPost(base, post1);
    const afterSecond = generator.addPost(afterFirst, post2);

    expect(afterSecond.posts).toHaveLength(2);
    expect(afterSecond.categories).toHaveLength(1);
    expect(afterSecond.categories[0].slug).toBe('tech');
    expect(afterSecond.tags).toHaveLength(1);
    expect(afterSecond.tags[0].slug).toBe('typescript');
  });

  it('should write WXR XML to the given file path when finalize is called', async () => {
    const wxrData = createSampleWxrData();
    const generator = createWxrGenerator();

    const tmpDir = path.join(TMP_DIR, 'wxr-tests');
    const filePath = path.join(tmpDir, 'output.wxr.xml');

    await fs.rm(tmpDir, { recursive: true, force: true });

    await generator.finalize(wxrData, filePath);

    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toContain('<rss version="2.0"');
    expect(content).toContain('<channel>');
    expect(content).toContain('<title>My Tistory Blog</title>');
  });
});
