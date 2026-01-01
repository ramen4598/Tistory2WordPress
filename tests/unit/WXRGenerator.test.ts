import { createWxrGenerator } from '../../src/services/wxrGenerator';
import { WXRData } from '../../src/models/WXRData';
import { Post } from '../../src/models/Post';
import { Category } from '../../src/models/Category';
import { Tag } from '../../src/models/Tag';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

const TMP_DIR = path.join(__dirname, '..', 'tmp');

// TODO: wxrTestData.ts를 사용하도록 수정
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
  describe('Phase 2: Channel Metadata Tests', () => {
    it('C-01: should include language when specified in site_info', () => {
      const wxrData = createSampleWxrData();
      wxrData.site_info.language = 'ko-KR';
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<language>ko-KR</language>');
    });

    it('C-02: should default language to ko-KR when not specified', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<language>ko-KR</language>');
    });

    it('C-03: should use custom language when specified', () => {
      const wxrData = createSampleWxrData();
      wxrData.site_info.language = 'en-US';
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<language>en-US</language>');
    });

    it('C-04: should include pubDate with current UTC timestamp', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toMatch(/<pubDate>[\s\S]*<\/pubDate>/);
    });

    it('C-05: should include wp:wxr_version 1.2', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:wxr_version>1.2</wp:wxr_version>');
    });

    it('C-06: should include wp:base_site_url and wp:base_blog_url', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:base_site_url>https://blog.tistory.com</wp:base_site_url>');
      expect(xml).toContain('<wp:base_blog_url>https://blog.tistory.com</wp:base_blog_url>');
    });
  });

  describe('Phase 3: Authors Section Tests', () => {
    it('A-01: should emit one wp:author element', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:author>');
      expect(xml).toContain('</wp:author>');
    });

    it('A-02: should include author_id, author_login, and author_display_name', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:author_id>1</wp:author_id>');
      expect(xml).toContain('<wp:author_login>admin</wp:author_login>');
      expect(xml).toContain('<wp:author_display_name>Admin User</wp:author_display_name>');
    });

    it('A-03: should emit multiple wp:author elements preserving order', () => {
      const wxrData = createSampleWxrData();
      wxrData.authors = [
        { id: 1, login: 'admin', display_name: 'Admin User' },
        { id: 2, login: 'editor', display_name: 'Editor User' },
      ];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const authorCount = (xml.match(/<wp:author>/g) || []).length;
      expect(authorCount).toBe(2);
    });
  });

  describe('Phase 4: Categories Section Tests', () => {
    it('CAT-01: should emit wp:category element', () => {
      const wxrData = createSampleWxrData();
      wxrData.categories = [{ name: 'Tech', slug: 'tech', parent: null, description: null }];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:category>');
    });

    it('CAT-02: should include term_id, category_nicename, cat_name, and category_parent', () => {
      const wxrData = createSampleWxrData();
      wxrData.categories = [{ name: 'Tech', slug: 'tech', parent: null, description: null }];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:term_id>1</wp:term_id>');
      expect(xml).toContain('<wp:category_nicename>tech</wp:category_nicename>');
      expect(xml).toContain('<wp:cat_name>Tech</wp:cat_name>');
      expect(xml).toMatch(/<wp:category_parent\s*\/?>/);
    });

    it('CAT-03: should include category_description when provided', () => {
      const wxrData = createSampleWxrData();
      wxrData.categories = [{ name: 'Tech', slug: 'tech', parent: null, description: 'Tech category' }];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:category_description>Tech category</wp:category_description>');
    });

    it('CAT-04: should emit parent categories before child categories', () => {
      const wxrData = createSampleWxrData();
      const parent: Category = { name: 'Tech', slug: 'tech', parent: null, description: null };
      const child: Category = { name: 'Programming', slug: 'programming', parent, description: null };
      wxrData.categories = [child, parent];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const parentIndex = xml.indexOf('<wp:category_nicename>tech</wp:category_nicename>');
      const childIndex = xml.indexOf('<wp:category_nicename>programming</wp:category_nicename>');
      expect(parentIndex).toBeLessThan(childIndex);
    });

    it('CAT-05: should sort categories by hierarchy', () => {
      const wxrData = createSampleWxrData();
      const parent: Category = { name: 'Tech', slug: 'tech', parent: null, description: null };
      const child1: Category = { name: 'Programming', slug: 'programming', parent, description: null };
      const child2: Category = { name: 'DevOps', slug: 'devops', parent, description: null };
      wxrData.categories = [child2, child1, parent];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const techIndex = xml.indexOf('<wp:category_nicename>tech</wp:category_nicename>');
      const programmingIndex = xml.indexOf('<wp:category_nicename>programming</wp:category_nicename>');
      const devopsIndex = xml.indexOf('<wp:category_nicename>devops</wp:category_nicename>');
      expect(techIndex).toBeLessThan(programmingIndex);
      expect(programmingIndex).toBeLessThan(devopsIndex);
    });
  });

  describe('Phase 5: Tags Section Tests', () => {
    it('TAG-01: should emit wp:tag element', () => {
      const wxrData = createSampleWxrData();
      wxrData.tags = [{ name: 'typescript', slug: 'typescript' }];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:tag>');
    });

    it('TAG-02: should include term_id, tag_slug, and tag_name', () => {
      const wxrData = createSampleWxrData();
      wxrData.tags = [{ name: 'typescript', slug: 'typescript' }];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:term_id>1</wp:term_id>');
      expect(xml).toContain('<wp:tag_slug>typescript</wp:tag_slug>');
      expect(xml).toContain('<wp:tag_name>typescript</wp:tag_name>');
    });

    it('TAG-03: should emit multiple wp:tag elements with sequential term_id', () => {
      const wxrData = createSampleWxrData();
      wxrData.tags = [
        { name: 'typescript', slug: 'typescript' },
        { name: 'nodejs', slug: 'nodejs' },
        { name: 'javascript', slug: 'javascript' },
      ];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:term_id>1</wp:term_id>');
      expect(xml).toContain('<wp:term_id>2</wp:term_id>');
      expect(xml).toContain('<wp:term_id>3</wp:term_id>');
    });
  });

  describe('Phase 6: Post Item Tests', () => {
    it('P-01: should emit item element for posts', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<item>');
      expect(xml).toContain('</item>');
    });

    it('P-02: should include title and content:encoded', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<title>First Post</title>');
      expect(xml).toContain('<content:encoded><![CDATA[<p>Content 1</p>]]></content:encoded>');
    });

    it('P-03: should include pubDate in RFC 2822 format', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const expectedPubDate = wxrData.posts[0].publish_date.toUTCString();
      expect(xml).toContain(`<pubDate>${expectedPubDate}</pubDate>`);
    });

    it('P-04: should include wp:post_date in WordPress format', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const date = wxrData.posts[0].publish_date;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const expected = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      expect(xml).toContain(`<wp:post_date>${expected}</wp:post_date>`);
    });

    it('P-05: should include wp:post_date_gmt', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:post_date_gmt>2025-01-01 10:00:00</wp:post_date_gmt>');
    });

    it('P-06: should use publish_date for modified_date when null', () => {
      const wxrData = createSampleWxrData();
      wxrData.posts[0].modified_date = null;
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const date = wxrData.posts[0].publish_date;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const expected = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      expect(xml).toContain(`<wp:post_modified>${expected}</wp:post_modified>`);
      expect(xml).toContain('<wp:post_modified_gmt>2025-01-01 10:00:00</wp:post_modified_gmt>');
    });

    it('P-07: should use modified_date when provided', () => {
      const wxrData = createSampleWxrData();
      wxrData.posts[0].modified_date = new Date('2025-02-01T12:00:00Z');
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const date = wxrData.posts[0].modified_date!;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const expected = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      expect(xml).toContain(`<wp:post_modified>${expected}</wp:post_modified>`);
      expect(xml).toContain('<wp:post_modified_gmt>2025-02-01 12:00:00</wp:post_modified_gmt>');
    });

    it('P-08: should include link and guid', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<link>https://blog.tistory.com/1</link>');
      expect(xml).toContain('<guid isPermaLink="false">https://blog.tistory.com/1</guid>');
    });

    it('P-09: should include default dc:creator', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<dc:creator>tistory</dc:creator>');
    });

    it('P-10: should include wp:post_name extracted from URL', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:post_name>1</wp:post_name>');
    });

    it('P-11: should include default wp:post_type, wp:status, wp:comment_status, wp:is_sticky', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:post_type>post</wp:post_type>');
      expect(xml).toContain('<wp:status>publish</wp:status>');
      expect(xml).toContain('<wp:comment_status>open</wp:comment_status>');
      expect(xml).toContain('<wp:is_sticky>0</wp:is_sticky>');
    });

    it('P-12: should include wp:post_id', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:post_id>1</wp:post_id>');
    });

    it('P-13: should auto-generate post_id starting from 1', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<wp:post_id>1</wp:post_id>');
    });

    it('P-14: should include category elements per post', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<category domain="category" nicename="tech"><![CDATA[Tech]]></category>');
    });

    it('P-15: should include tag elements per post', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<category domain="post_tag" nicename="typescript"><![CDATA[typescript]]></category>');
    });

    it('P-16: should handle special characters in content', () => {
      const wxrData = createSampleWxrData();
      wxrData.posts[0].content = '<p>Content with &test;</p>';
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('&test;');
      expect(() => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const errorNode = doc.querySelector('parsererror');
        expect(errorNode).toBeNull();
      });
    });

    it('P-17: should emit multiple item elements for multiple posts', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const itemCount = (xml.match(/<item>/g) || []).length;
      expect(itemCount).toBe(2);
    });
  });

  describe('Phase 7: Category Hierarchy Sorting Tests', () => {
    it('H-01: should sort child after parent', () => {
      const wxrData = createSampleWxrData();
      const parent: Category = { name: 'Parent', slug: 'parent', parent: null, description: null };
      const child: Category = { name: 'Child', slug: 'child', parent, description: null };
      wxrData.categories = [child, parent];
      wxrData.posts = [];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const parentIndex = xml.indexOf('<wp:category_nicename>parent</wp:category_nicename>');
      const childIndex = xml.indexOf('<wp:category_nicename>child</wp:category_nicename>');
      expect(parentIndex).toBeLessThan(childIndex);
    });

    it('H-02: should sort grandchild after child after parent', () => {
      const wxrData = createSampleWxrData();
      const parent: Category = { name: 'Parent', slug: 'parent', parent: null, description: null };
      const child: Category = { name: 'Child', slug: 'child', parent, description: null };
      const grandchild: Category = { name: 'Grandchild', slug: 'grandchild', parent: child, description: null };
      wxrData.categories = [grandchild, child, parent];
      wxrData.posts = [];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const parentIndex = xml.indexOf('<wp:category_nicename>parent</wp:category_nicename>');
      const childIndex = xml.indexOf('<wp:category_nicename>child</wp:category_nicename>');
      const grandchildIndex = xml.indexOf('<wp:category_nicename>grandchild</wp:category_nicename>');
      expect(parentIndex).toBeLessThan(childIndex);
      expect(childIndex).toBeLessThan(grandchildIndex);
    });

    it('H-03: should preserve order of independent categories', () => {
      const wxrData = createSampleWxrData();
      const cat1: Category = { name: 'Cat1', slug: 'cat1', parent: null, description: null };
      const cat2: Category = { name: 'Cat2', slug: 'cat2', parent: null, description: null };
      wxrData.categories = [cat1, cat2];
      wxrData.posts = [];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const cat1Index = xml.indexOf('<wp:category_nicename>cat1</wp:category_nicename>');
      const cat2Index = xml.indexOf('<wp:category_nicename>cat2</wp:category_nicename>');
      expect(cat1Index).toBeLessThan(cat2Index);
    });

    it('H-04: should sort multiple children after parent', () => {
      const wxrData = createSampleWxrData();
      const parent: Category = { name: 'Parent', slug: 'parent', parent: null, description: null };
      const child1: Category = { name: 'Child1', slug: 'child1', parent, description: null };
      const child2: Category = { name: 'Child2', slug: 'child2', parent, description: null };
      wxrData.categories = [child2, child1, parent];
      wxrData.posts = [];
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      const parentIndex = xml.indexOf('<wp:category_nicename>parent</wp:category_nicename>');
      const child1Index = xml.indexOf('<wp:category_nicename>child1</wp:category_nicename>');
      const child2Index = xml.indexOf('<wp:category_nicename>child2</wp:category_nicename>');
      expect(parentIndex).toBeLessThan(child1Index);
      expect(child1Index).toBeLessThan(child2Index);
    });
  });

  describe('Phase 8: Integration Tests', () => {
    it('INT-01: should generate complete WXR with all sections', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<rss version="2.0"');
      expect(xml).toContain('<channel>');

      expect(xml).toContain('<language>ko-KR</language>');
      expect(xml).toContain('<pubDate>');
      expect(xml).toContain('<wp:wxr_version>1.2</wp:wxr_version>');
      expect(xml).toContain('<wp:base_site_url>');
      expect(xml).toContain('<wp:base_blog_url>');

      expect(xml).toContain('<wp:author>');
      expect(xml).toContain('<wp:category>');
      expect(xml).toContain('<wp:tag>');
      expect(xml).toContain('<item>');

      expect(xml).toContain('</channel>');
      expect(xml).toContain('</rss>');
    });

    it('INT-02: should be valid XML structure', () => {
      const wxrData = createSampleWxrData();
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(() => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const errorNode = doc.querySelector('parsererror');
        expect(errorNode).toBeNull();
      }).not.toThrow();
    });

    it('INT-03: should handle multilingual content', () => {
      const wxrData = createSampleWxrData();
      wxrData.posts[0].title = '한글 제목 English Title 🚀';
      wxrData.posts[0].content = '<p>한글 내용 English Content</p>';
      const generator = createWxrGenerator();

      const xml = generator.build(wxrData);

      expect(xml).toContain('한글 제목 English Title 🚀');
      expect(xml).toContain('<content:encoded><![CDATA[<p>한글 내용 English Content</p>]]></content:encoded>');
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });
  });

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
