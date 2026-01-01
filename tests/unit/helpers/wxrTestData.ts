import { WXRData } from '../../../src/models/WXRData';
import { Post } from '../../../src/models/Post';
import { Category } from '../../../src/models/Category';
import { Tag } from '../../../src/models/Tag';

export const createMinimalWXRData = (): WXRData => ({
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
});

export const createWXRDataWithPost = (post?: Post): WXRData => {
  const defaultPost: Post = {
    url: 'https://blog.tistory.com/1',
    title: 'First Post',
    content: '<p>Content 1</p>',
    publish_date: new Date('2025-01-01T10:00:00Z'),
    modified_date: null,
    categories: [],
    tags: [],
    images: [],
    attachments: [],
  };

  const minimalWXRData = createMinimalWXRData();
  return {
    ...minimalWXRData,
    posts: [post ?? defaultPost],
  };
};

export const createPostWithCategories = (count: number): WXRData => {
  const categories: Category[] = createHierarchicalCategories(count);

  const postWithoutCategories: WXRData = createWXRDataWithPost();
  return {
    ...postWithoutCategories,
    posts: postWithoutCategories.posts.map((post) => ({
      ...post,
      categories,
    })),
    categories,
  };
};

export const createPostWithTags = (count: number): WXRData => {
  const tags: Tag[] = Array.from({ length: count }, (_, i) => ({
    name: `tag${i + 1}`,
    slug: `tag${i + 1}`,
  }));

  const postWithoutTags: WXRData = createWXRDataWithPost();
  return {
    ...postWithoutTags,
    posts: postWithoutTags.posts.map((post) => ({
      ...post,
      tags,
    })),
    tags,
  };
};

export const createHierarchicalCategories = (count: number): Category[] => {
  if (count > 2) {
    throw new Error('Only supports up to 2 levels of categories.');
  }

  const parent: Category = {
    name: 'Tech',
    slug: 'tech',
    parent: null,
    description: null,
  };
  if (count === 1) {
    return [parent];
  }

  const child: Category = {
    name: 'Programming',
    slug: 'programming',
    parent,
    description: null,
  };
  return [child, parent];
};

export const createWXRDataWithMultiplePosts = (count: number): WXRData => {
  const posts: Post[] = Array.from({ length: count }, (_, i) => ({
    url: `https://blog.tistory.com/${i + 1}`,
    title: `Post ${i + 1}`,
    content: `<p>Content ${i + 1}</p>`,
    publish_date: new Date(`2025-01-0${i + 1}T10:00:00Z`),
    modified_date: null,
    categories: [],
    tags: [],
    images: [],
    attachments: [],
  }));

  const minimalWXRData = createMinimalWXRData();
  return {
    ...minimalWXRData,
    posts,
  };
};
