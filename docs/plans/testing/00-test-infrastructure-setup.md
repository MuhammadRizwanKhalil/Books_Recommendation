# Test Infrastructure Setup

**Priority:** Pre-work (before any feature implementation)  
**Status:** Not Started

---

## 1. Overview

Before implementing any competitive features, establish shared test infrastructure to avoid duplicating helpers across 40+ new test files. Currently, each API test file independently defines `get()`, `post()`, `getAdminToken()` — and E2E tests have no Page Object Model or shared fixtures.

---

## 2. Shared API Test Helpers

### File: `tests/helpers/api.ts`

```typescript
const BASE_URL = process.env.TEST_BASE_URL || 'https://thebooktimes.com';

export async function get(path: string, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}

export async function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}

export async function put(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}

export async function del(path: string, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}

export async function getAdminToken(): Promise<string> {
  const email = process.env.ADMIN_EMAIL || 'admin@thebooktimes.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123456';
  const { data } = await post('/api/auth/login', { email, password });
  return data.token;
}

export async function getUserToken(email?: string, password?: string): Promise<string> {
  const e = email || `testuser_${Date.now()}@test.com`;
  const p = password || 'TestPassword123!';
  // Try login first, register if not found
  let { status, data } = await post('/api/auth/login', { email: e, password: p });
  if (status !== 200) {
    ({ status, data } = await post('/api/auth/register', { name: 'Test User', email: e, password: p }));
  }
  return data.token;
}
```

---

## 3. Shared E2E Test Fixtures

### File: `tests/fixtures/test-data.ts`

```typescript
export const TEST_BOOK_SLUG = 'the-power-of-habit-charles-duhigg';
export const TEST_BOOK_TITLE = 'The Power of Habit';
export const TEST_BOOK_AUTHOR = 'Charles Duhigg';
export const TEST_BOOK_URL = `/book/${TEST_BOOK_SLUG}`;

export const TEST_BLOG_SLUG = 'what-i-have-been-reading-this-spring-and-why-you-should-too';
export const TEST_BLOG_URL = `/blog/${TEST_BLOG_SLUG}`;

export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;
```

---

## 4. Page Object Models

### File: `tests/pages/BookDetailPage.ts`

```typescript
import { type Page, type Locator } from '@playwright/test';

export class BookDetailPage {
  readonly page: Page;
  readonly title: Locator;
  readonly author: Locator;
  readonly coverImage: Locator;
  readonly rating: Locator;
  readonly description: Locator;
  readonly buyButton: Locator;
  readonly wishlistButton: Locator;
  readonly readingStatus: Locator;
  readonly reviewsSection: Locator;
  readonly recommendationsSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1').first();
    this.author = page.getByText(/by\s/i).first();
    this.coverImage = page.locator('img[alt]').first();
    this.rating = page.getByText(/rating/i).first();
    this.description = page.getByText(/about this book/i);
    this.buyButton = page.getByText(/buy/i).first();
    this.wishlistButton = page.getByRole('button', { name: /wishlist|heart/i });
    this.readingStatus = page.getByRole('combobox').or(page.getByText(/reading status/i));
    this.reviewsSection = page.getByText(/reviews/i).first();
    this.recommendationsSection = page.getByText(/you may also like|similar|recommend/i).first();
  }

  async goto(slug: string) {
    await this.page.goto(`/book/${slug}`);
    await this.page.waitForLoadState('networkidle');
  }

  async scrollToSection(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
  }

  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.page.waitForTimeout(500);
  }
}
```

### File: `tests/pages/HomePage.ts`

```typescript
import { type Page, type Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly heroSection: Locator;
  readonly searchInput: Locator;
  readonly trendingSection: Locator;
  readonly botdSection: Locator;
  readonly topRatedSection: Locator;
  readonly newReleasesSection: Locator;
  readonly newsletterSection: Locator;
  readonly footer: Locator;
  readonly signInButton: Locator;
  readonly themeToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroSection = page.locator('h1').first();
    this.searchInput = page.locator('input[placeholder*="Search"]').first();
    this.trendingSection = page.getByText(/trending/i).first();
    this.botdSection = page.getByText(/book of the day/i).first();
    this.topRatedSection = page.getByText(/top rated/i).first();
    this.newReleasesSection = page.getByText(/new releases/i).first();
    this.newsletterSection = page.locator('input[type="email"]').last();
    this.footer = page.locator('footer');
    this.signInButton = page.getByText(/sign in/i).first();
    this.themeToggle = page.getByRole('button').nth(3);
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }
}
```

---

## 5. Accessibility Testing Setup

### Install
```bash
cd app && npm install -D @axe-core/playwright
```

### File: `tests/helpers/a11y.ts`

```typescript
import AxeBuilder from '@axe-core/playwright';
import { type Page, expect } from '@playwright/test';

export async function checkAccessibility(page: Page, options?: { exclude?: string[] }) {
  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  
  if (options?.exclude) {
    for (const selector of options.exclude) {
      builder.exclude(selector);
    }
  }
  
  const results = await builder.analyze();
  expect(results.violations).toEqual([]);
}
```

---

## 6. Test Tagging Convention

```typescript
// Use describe blocks with tags for selective runs
test.describe('Feature Name @phase-1 @series-info @smoke', () => {
  // ...
});

// Run specific phase:   npx playwright test --grep @phase-1
// Run smoke tests:      npx playwright test --grep @smoke
// Run specific feature: npx playwright test --grep @series-info
```

---

## 7. CI/CD Updates

### File: `.github/workflows/test.yml` additions

```yaml
- name: Run E2E tests
  run: npx playwright test --reporter=html
  env:
    TEST_BASE_URL: https://thebooktimes.com

- name: Run API tests
  run: npx vitest run tests/api/
  env:
    TEST_BASE_URL: https://thebooktimes.com

- name: Upload test report
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

---

## Acceptance Criteria

- [ ] `tests/helpers/api.ts` created with `get`, `post`, `put`, `del`, `getAdminToken`, `getUserToken`
- [ ] `tests/helpers/a11y.ts` created with `checkAccessibility` function
- [ ] `tests/fixtures/test-data.ts` created with shared constants
- [ ] `tests/pages/BookDetailPage.ts` POM created
- [ ] `tests/pages/HomePage.ts` POM created
- [ ] `@axe-core/playwright` installed as dev dependency
- [ ] All existing 10 test files still pass after infrastructure changes
- [ ] CI workflow updated to run both E2E and API tests
- [ ] Test tagging convention documented and working (`--grep @phase-1`)

## Completion Tracking

- [ ] **Implementation** — Files created
- [ ] **Verification** — Existing tests still pass
- [ ] **CI Updated** — GitHub Actions workflow modified
- [ ] **Documentation** — README updated with test commands
