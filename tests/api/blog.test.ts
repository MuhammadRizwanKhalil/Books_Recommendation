/**
 * Backend API Tests — Blog
 */

const BASE_URL = process.env.API_URL || 'https://thebooktimes.com/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rizwankhalil87@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'o6SNgYdeMih2iwP/F7Lk9zUxfEl3FzrJ';

async function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  return { status: res.status, data: await res.json() };
}

async function post(path: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function getAdminToken(): Promise<string> {
  const { data } = await post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return data.token;
}

describe('GET /api/blog', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/blog');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return paginated response with posts and pagination', () => {
    expect(response.data).toHaveProperty('posts');
    expect(response.data).toHaveProperty('pagination');
    expect(Array.isArray(response.data.posts)).toBe(true);
  });

  it('pagination should have correct shape', () => {
    const { pagination } = response.data;
    expect(pagination).toHaveProperty('page');
    expect(pagination).toHaveProperty('limit');
    expect(pagination).toHaveProperty('total');
    expect(pagination).toHaveProperty('totalPages');
  });

  it('should respect page and limit params', async () => {
    const { data } = await get('/blog?page=1&limit=2');
    expect(data.posts.length).toBeLessThanOrEqual(2);
    expect(data.pagination.limit).toBe(2);
  });

  it('published posts should have required fields', () => {
    if (response.data.posts.length > 0) {
      const post = response.data.posts[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('slug');
      expect(post).toHaveProperty('excerpt');
      expect(post).toHaveProperty('status');
      expect(post.status).toBe('PUBLISHED');
    }
  });

  it('posts should have SEO fields', () => {
    if (response.data.posts.length > 0) {
      const post = response.data.posts[0];
      expect(post).toHaveProperty('metaTitle');
      expect(post).toHaveProperty('metaDescription');
    }
  });
});

describe('GET /api/blog/:slug', () => {
  const slug = 'what-i-have-been-reading-this-spring-and-why-you-should-too';
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get(`/blog/${slug}`);
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return the correct post', () => {
    expect(response.data.slug).toBe(slug);
    expect(response.data).toHaveProperty('title');
    expect(response.data).toHaveProperty('content');
  });

  it('should return full content HTML', () => {
    expect(response.data.content).toContain('<p>');
  });

  it('should have featured image set', () => {
    expect(response.data.featuredImage).toBeTruthy();
  });

  it('should have tags', () => {
    expect(response.data).toHaveProperty('tags');
  });

  it('should return 404 for unknown slug', async () => {
    const { status } = await get('/blog/this-post-does-not-exist-xyz');
    expect(status).toBe(404);
  });
});

describe('POST /api/blog (authentication required)', () => {
  it('should return 401 without token', async () => {
    const { status } = await post('/blog', { title: 'Test', content: 'Test content' });
    expect(status).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const { status } = await post('/blog', { title: 'Test', content: 'Test content' }, 'invalid-token');
    expect(status).toBe(401);
  });

  it('should validate required fields even with valid token', async () => {
    const token = await getAdminToken();
    const { status, data } = await post('/blog', { title: '' }, token);
    expect(status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('admin should be able to create a DRAFT post', async () => {
    const token = await getAdminToken();
    const title = `Test Draft Post ${Date.now()}`;
    const { status, data } = await post('/blog', {
      title,
      content: '<p>This is a test draft post created by automated tests.</p>',
      excerpt: 'Test excerpt.',
      status: 'DRAFT',
      category: 'Test',
      tags: '["test","automated"]',
      metaTitle: title.substring(0, 60),
      metaDescription: 'Test meta description for automated test post.',
      focusKeyword: 'test post',
      seoRobots: 'noindex, nofollow',
    }, token);
    expect(status).toBe(201);
    expect(data).toHaveProperty('id');
    expect(data.title).toBe(title);
    expect(data.status).toBe('DRAFT');
  });
});

describe('GET /api/blog/ai-status', () => {
  it('should return 401 without token', async () => {
    const { status } = await get('/blog/ai-status');
    expect(status).toBe(401);
  });

  it('should return AI status for admin', async () => {
    const token = await getAdminToken();
    const { status, data } = await get('/blog/ai-status', token);
    expect(status).toBe(200);
    expect(data).toHaveProperty('openai');
    expect(data).toHaveProperty('cron');
  });
});
