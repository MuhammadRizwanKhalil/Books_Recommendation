/**
 * Backend API Tests — Books
 * Tests against https://thebooktimes.com/api
 */

const BASE_URL = process.env.API_URL || 'https://thebooktimes.com/api';

async function get(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  return { status: res.status, data: await res.json() };
}

describe('GET /api/books/trending', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/books/trending?limit=8');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return an array', () => {
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should return books with required fields', () => {
    const book = response.data[0];
    expect(book).toHaveProperty('id');
    expect(book).toHaveProperty('title');
    expect(book).toHaveProperty('author');
    expect(book).toHaveProperty('slug');
    expect(book).toHaveProperty('status', 'PUBLISHED');
  });

  it('should respect limit parameter', async () => {
    const { data } = await get('/books/trending?limit=4');
    expect(data.length).toBeLessThanOrEqual(4);
  });

  it('should have cover image or null', () => {
    const book = response.data[0];
    expect('coverImage' in book).toBe(true);
  });

  it('should have computedScore for ranking', () => {
    const book = response.data[0];
    expect(book).toHaveProperty('computedScore');
  });
});

describe('GET /api/books/top-rated', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/books/top-rated?limit=10');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return an array', () => {
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should be sorted by rating (highest first)', () => {
    const ratings = response.data
      .map((b: any) => b.googleRating || 0)
      .filter((r: number) => r > 0);

    for (let i = 0; i < ratings.length - 1; i++) {
      expect(ratings[i]).toBeGreaterThanOrEqual(ratings[i + 1]);
    }
  });

  it('first book should have high rating', () => {
    const topBook = response.data.find((b: any) => b.googleRating);
    if (topBook) {
      expect(topBook.googleRating).toBeGreaterThan(3);
    }
  });
});

describe('GET /api/books/new-releases', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/books/new-releases?period=this-month&limit=8');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return an array', () => {
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('each book should have publishedDate', () => {
    response.data.forEach((book: any) => {
      expect(book).toHaveProperty('publishedDate');
    });
  });
});

describe('GET /api/books/:slug', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/books/the-power-of-habit-charles-duhigg');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return correct book', () => {
    expect(response.data.title).toMatch(/Power of Habit/);
    expect(response.data.author).toMatch(/Duhigg/);
  });

  it('should have all required book fields', () => {
    const book = response.data;
    expect(book).toHaveProperty('id');
    expect(book).toHaveProperty('title');
    expect(book).toHaveProperty('author');
    expect(book).toHaveProperty('slug');
    expect(book).toHaveProperty('description');
    expect(book).toHaveProperty('coverImage');
    expect(book).toHaveProperty('googleRating');
    expect(book).toHaveProperty('ratingsCount');
    expect(book).toHaveProperty('amazonUrl');
    expect(book).toHaveProperty('pageCount');
    expect(book).toHaveProperty('publisher');
    expect(book).toHaveProperty('publishedDate');
    expect(book).toHaveProperty('status');
  });

  it('should have correct SEO fields', () => {
    const book = response.data;
    expect(book).toHaveProperty('metaTitle');
    expect(book).toHaveProperty('metaDescription');
    expect(book).toHaveProperty('canonicalUrl');
    expect(book).toHaveProperty('focusKeyword');
    expect(book).toHaveProperty('seoRobots');
  });

  it('should return 404 for non-existent book', async () => {
    const { status } = await get('/books/this-book-does-not-exist-xyz-abc-123');
    expect(status).toBe(404);
  });

  it('amazon URL should be valid', () => {
    expect(response.data.amazonUrl).toMatch(/amazon\.com/);
  });
});

describe('GET /api/books/book-of-the-day', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/books/book-of-the-day');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return a single book object', () => {
    expect(response.data).toHaveProperty('title');
    expect(response.data).toHaveProperty('author');
    expect(response.data).toHaveProperty('slug');
  });

  it('should be a published book', () => {
    expect(response.data.status).toBe('PUBLISHED');
  });
});

describe('GET /api/books/authors', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/books/authors?limit=12');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return an array of authors', () => {
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('each author should have name and slug', () => {
    if (response.data.length > 0) {
      const author = response.data[0];
      expect(author).toHaveProperty('name');
      expect(author).toHaveProperty('slug');
    }
  });
});

describe('GET /api/categories', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/categories');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return an array', () => {
    expect(Array.isArray(response.data)).toBe(true);
  });
});

describe('Rate limiting', () => {
  it('should include rate limit headers', async () => {
    const res = await fetch(`${BASE_URL}/books/trending?limit=1`);
    const remaining = res.headers.get('x-ratelimit-remaining');
    const limit = res.headers.get('x-ratelimit-limit');
    expect(limit).toBeTruthy();
    expect(remaining).toBeTruthy();
  });
});
