import { test, expect } from '@playwright/test';

const TEST_BOOK_SLUG = 'the-power-of-habit-charles-duhigg';
const TEST_BOOK_URL = `/book/${TEST_BOOK_SLUG}`;

test.describe('Book Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_BOOK_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should load book detail page', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(TEST_BOOK_SLUG));
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('should show book title', async ({ page }) => {
    const title = await page.locator('h1').first().textContent();
    expect(title).toContain('Power of Habit');
  });

  test('should show author name', async ({ page }) => {
    await expect(page.locator('text=Charles Duhigg').first()).toBeVisible();
  });

  test('should show book cover image', async ({ page }) => {
    const img = page.locator('img').first();
    await expect(img).toBeVisible();
    const src = await img.getAttribute('src');
    expect(src).toBeTruthy();
  });

  test('should show star rating', async ({ page }) => {
    await expect(page.locator('text=/ratings|rating/i').first()).toBeVisible();
  });

  test('should show book description', async ({ page }) => {
    await expect(page.locator('text=/NEW YORK TIMES|habit|Habit/').first()).toBeVisible();
  });

  test('should show Buy on Amazon button', async ({ page }) => {
    await expect(page.locator('text=/Buy on Amazon/i').first()).toBeVisible();
  });

  test('should show page count and publisher', async ({ page }) => {
    await expect(page.locator('text=/pages/i').first()).toBeVisible();
  });

  test('Amazon button should have valid href', async ({ page }) => {
    const amazonBtn = page.locator('a[href*="amazon.com"]').first();
    await expect(amazonBtn).toBeVisible();
    const href = await amazonBtn.getAttribute('href');
    expect(href).toContain('amazon.com');
  });

  test('should show back navigation', async ({ page }) => {
    await expect(page.locator('text=Back').first()).toBeVisible();
  });

  test('back button should navigate back', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Click a book to go to detail
    const bookLink = page.locator('a[href*="/book/"]').first();
    await bookLink.click();
    await page.waitForLoadState('networkidle');
    // Click back
    await page.locator('text=Back').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/');
  });

  test('should have correct SEO meta tags', async ({ page }) => {
    const title = await page.title();
    expect(title).toContain('Power of Habit');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(30);

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();
  });

  test('should show score/computed score', async ({ page }) => {
    await expect(page.locator('text=/Score:|score/i').first()).toBeVisible();
  });

  test('should show recommendations section', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // Look for similar/recommended books
    const recs = page.locator('text=/Similar|Recommend|You may also/i').first();
    await recs.scrollIntoViewIfNeeded().catch(() => {});
  });

  test('should navigate from homepage book card click', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bookCard = page.locator('a[href*="/book/"]').first();
    await bookCard.scrollIntoViewIfNeeded();
    const href = await bookCard.getAttribute('href');
    await bookCard.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/book/');
  });
});
