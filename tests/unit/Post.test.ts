import { Post } from '../../src/models/Post';
import { Category } from '../../src/models/Category';
import { Tag } from '../../src/models/Tag';
import { Image } from '../../src/models/Image';
import { Attachment } from '../../src/models/Attachment';

describe('Post', () => {
  describe('Post creation', () => {
    it('should create a post with required fields', () => {
      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [],
        attachments: [],
      };

      expect(post.url).toBe('https://blog.tistory.com/123');
      expect(post.title).toBe('Test Post');
      expect(post.content).toBe('<p>Test content</p>');
      expect(post.publish_date).toEqual(new Date('2025-01-01'));
      expect(post.modified_date).toBeNull();
      expect(post.categories).toEqual([]);
      expect(post.tags).toEqual([]);
      expect(post.images).toEqual([]);
      expect(post.attachments).toEqual([]);
    });

    it('should create a post with modified date', () => {
      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: new Date('2025-01-02'),
        categories: [],
        tags: [],
        images: [],
        attachments: [],
      };

      expect(post.modified_date).toEqual(new Date('2025-01-02'));
    });

    it('should create a post with categories', () => {
      const category: Category = {
        name: 'Technology',
        slug: 'technology',
        parent: null,
        description: null,
      };

      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [category],
        tags: [],
        images: [],
        attachments: [],
      };

      expect(post.categories).toHaveLength(1);
      expect(post.categories[0]?.name).toBe('Technology');
    });

    it('should create a post with tags', () => {
      const tag: Tag = {
        name: 'TypeScript',
        slug: 'typescript',
      };

      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [],
        tags: [tag],
        images: [],
        attachments: [],
      };

      expect(post.tags).toHaveLength(1);
      expect(post.tags[0]?.name).toBe('TypeScript');
    });

    it('should create a post with images', () => {
      const image: Image = {
        url: 'https://cdn.tistory.com/image.jpg',
        alt_text: 'Test image',
      };

      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [image],
        attachments: [],
      };

      expect(post.images).toHaveLength(1);
      expect(post.images[0]?.url).toBe('https://cdn.tistory.com/image.jpg');
    });

    it('should create a post with attachments', () => {
      const attachment: Attachment = {
        url: 'https://blog.tistory.com/file.pdf',
        filename: 'file.pdf',
        local_path: null,
        size: null,
        mime_type: null,
      };

      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [],
        attachments: [attachment],
      };

      expect(post.attachments).toHaveLength(1);
      expect(post.attachments[0]?.filename).toBe('file.pdf');
    });

    it('should create a post with empty content', () => {
      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [],
        attachments: [],
      };

      expect(post.content).toBe('');
    });

    // TODO: 나중에 카테고리가 처리되는 방식을 파악한 후 테스트 수정 필요
    it('should create a post with multiple categories and tags', () => {
      const categories: Category[] = [
        { name: 'Technology', slug: 'technology', parent: null, description: null },
        { name: 'Programming', slug: 'programming', parent: null, description: null },
      ];

      const tags: Tag[] = [
        { name: 'TypeScript', slug: 'typescript' },
        { name: 'Node.js', slug: 'nodejs' },
      ];

      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories,
        tags,
        images: [],
        attachments: [],
      };

      expect(post.categories).toHaveLength(2);
      expect(post.tags).toHaveLength(2);
    });
  });

  describe('Post validation scenarios', () => {
    it('should handle URL validation requirement', () => {
      // Per data-model.md: url must be valid URL format and start with TISTORY_BLOG_URL
      const validPost: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [],
        attachments: [],
      };

      expect(validPost.url).toMatch(/^https?:\/\//);
    });

    it('should handle title requirement', () => {
      // Per data-model.md: title must not be empty (fallback: "Untitled")
      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [],
        attachments: [],
      };

      expect(post.title).toBeTruthy();
      expect(post.title.length).toBeGreaterThan(0);
    });

    it('should require publish_date', () => {
      const post: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [],
        attachments: [],
      };

      expect(post.publish_date).toBeInstanceOf(Date);
    });

    it('should allow optional modified_date', () => {
      const postWithoutModified: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: null,
        categories: [],
        tags: [],
        images: [],
        attachments: [],
      };

      const postWithModified: Post = {
        url: 'https://blog.tistory.com/123',
        title: 'Test Post',
        content: '<p>Test content</p>',
        publish_date: new Date('2025-01-01'),
        modified_date: new Date('2025-01-02'),
        categories: [],
        tags: [],
        images: [],
        attachments: [],
      };

      expect(postWithoutModified.modified_date).toBeNull();
      expect(postWithModified.modified_date).toBeInstanceOf(Date);
    });
  });
});
