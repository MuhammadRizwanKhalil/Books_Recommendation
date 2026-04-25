/**
 * Backend API Tests — Authentication
 */

const BASE_URL = process.env.API_URL || `${process.env.TEST_BASE_URL || 'http://127.0.0.1:3001'}/api`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const hasAdminCreds = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

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

async function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  return { status: res.status, data: await res.json() };
}

describe('POST /api/auth/login', () => {
  (hasAdminCreds ? it : it.skip)('should return 200 with valid admin credentials', async () => {
    const { status, data } = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('user');
    expect(data.user.role).toBe('admin');
  });

  (hasAdminCreds ? it : it.skip)('token should be a non-empty string', async () => {
    const { data } = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(typeof data.token).toBe('string');
    expect(data.token.length).toBeGreaterThan(20);
  });

  it('should return 401 with wrong password', async () => {
    const { status } = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: 'completelywrongpassword',
    });
    expect(status).toBe(401);
  });

  it('should return 401 with non-existent email', async () => {
    const { status } = await post('/auth/login', {
      email: 'nobody@nonexistent123456.com',
      password: 'anypassword',
    });
    expect(status).toBe(401);
  });

  it('should return 400 with missing email', async () => {
    const { status } = await post('/auth/login', {
      password: 'somepassword',
    });
    expect(status).toBe(400);
  });

  it('should return 400 with missing password', async () => {
    const { status } = await post('/auth/login', {
      email: 'test@test.com',
    });
    expect(status).toBe(400);
  });

  it('should return 400 with invalid email format', async () => {
    const { status } = await post('/auth/login', {
      email: 'not-an-email',
      password: 'password123',
    });
    expect(status).toBe(400);
  });

  (hasAdminCreds ? it : it.skip)('user object should have expected fields', async () => {
    const { data } = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(data.user).toHaveProperty('id');
    expect(data.user).toHaveProperty('email');
    expect(data.user).toHaveProperty('name');
    expect(data.user).toHaveProperty('role');
    expect(data.user).not.toHaveProperty('password');
  });
});

describe('POST /api/auth/register', () => {
  (hasAdminCreds ? it : it.skip)('should return 400 with duplicate email', async () => {
    const { status } = await post('/auth/register', {
      name: 'Test User',
      email: ADMIN_EMAIL,
      password: 'password123',
    });
    expect([400, 409]).toContain(status);
  });

  it('should return 400 with invalid email', async () => {
    const { status } = await post('/auth/register', {
      name: 'Test User',
      email: 'bademail',
      password: 'password123',
    });
    expect(status).toBe(400);
  });

  it('should return 400 with short password', async () => {
    const { status } = await post('/auth/register', {
      name: 'Test User',
      email: 'newuser_test_xyz@test.com',
      password: '123',
    });
    expect(status).toBe(400);
  });
});

describe('Protected routes without token', () => {
  it('GET /api/blog/ai-status should return 401', async () => {
    const { status } = await get('/blog/ai-status');
    expect(status).toBe(401);
  });

  it('POST /api/blog should return 401', async () => {
    const { status } = await post('/blog', { title: 'test', content: 'test' });
    expect(status).toBe(401);
  });

  it('GET /api/analytics/dashboard should return 401', async () => {
    const { status } = await get('/analytics/dashboard');
    expect([401, 403, 404]).toContain(status);
  });
});

describe('Protected routes with valid token', () => {
  let token: string;

  beforeAll(async () => {
    if (!hasAdminCreds) return;
    const { data } = await post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    token = data.token;
  });

  (hasAdminCreds ? it : it.skip)('should access admin blog endpoint with valid token', async () => {
    const { status } = await get('/blog/ai-status', token);
    expect(status).toBe(200);
  });

  it('should return 401 with expired/invalid token', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlIiwicm9sZSI6ImFkbWluIn0.fakesignature';
    const { status } = await get('/blog/ai-status', fakeToken);
    expect(status).toBe(401);
  });
});
