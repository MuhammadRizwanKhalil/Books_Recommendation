/**
 * Backend API Tests — Settings & Analytics
 */

const BASE_URL = process.env.API_URL || 'https://thebooktimes.com/api';

async function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  return { status: res.status, data: await res.json() };
}

describe('GET /api/settings', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/settings');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return settings object', () => {
    expect(typeof response.data).toBe('object');
    expect(response.data).not.toBeNull();
  });

  it('should include site name', () => {
    const settings = response.data;
    // Settings can be a flat object or nested
    const hasSiteName = JSON.stringify(settings).toLowerCase().includes('site') ||
      JSON.stringify(settings).toLowerCase().includes('booktimes');
    expect(hasSiteName).toBe(true);
  });
});

describe('GET /api/analytics/public-stats', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/analytics/public-stats');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return stats with numeric counts', () => {
    const stats = response.data;
    // Should have some count fields
    const hasNumbers = Object.values(stats).some((v) => typeof v === 'number');
    expect(hasNumbers).toBe(true);
  });
});

describe('GET /api/testimonials', () => {
  let response: { status: number; data: any };

  beforeAll(async () => {
    response = await get('/testimonials');
  });

  it('should return status 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return an array', () => {
    expect(Array.isArray(response.data)).toBe(true);
  });
});

describe('API Caching Headers', () => {
  it('/api/books/trending should have cache-control header', async () => {
    const res = await fetch(`${BASE_URL}/books/trending?limit=1`);
    const cacheControl = res.headers.get('cache-control');
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain('max-age');
  });

  it('/api/blog should have cache-control header', async () => {
    const res = await fetch(`${BASE_URL}/blog`);
    const cacheControl = res.headers.get('cache-control');
    expect(cacheControl).toBeTruthy();
  });

  it('/api/settings should have cache-control header', async () => {
    const res = await fetch(`${BASE_URL}/settings`);
    const cacheControl = res.headers.get('cache-control');
    expect(cacheControl).toBeTruthy();
  });

  it('CORS header should allow thebooktimes.com origin', async () => {
    const res = await fetch(`${BASE_URL}/books/trending?limit=1`, {
      headers: { Origin: 'https://thebooktimes.com' },
    });
    const corsHeader = res.headers.get('access-control-allow-origin');
    expect(corsHeader).toBeTruthy();
  });
});

describe('API Error handling', () => {
  it('unknown route should return 404', async () => {
    const res = await fetch(`${BASE_URL}/nonexistent-route-xyz`);
    expect([404, 400]).toContain(res.status);
  });

  it('should handle malformed query gracefully', async () => {
    const res = await fetch(`${BASE_URL}/books/trending?limit=invalid`);
    expect([200, 400]).toContain(res.status);
  });
});
