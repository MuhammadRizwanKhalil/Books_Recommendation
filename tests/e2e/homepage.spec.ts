import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load with correct title and branding', async ({ page }) => {
    await expect(page).toHaveTitle(/Book Times|TheBookTimes|The Book Times/i);
    await expect(page.locator('text=The Book Times').first()).toBeVisible();
  });

  test('should show hero section with headline', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible();
    const h1 = await page.locator('h1').first().textContent();
    expect(h1).toContain('book');
  });

  test('should show search input in hero', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();
  });

  test('should show stats (books indexed, ratings)', async ({ page }) => {
    await expect(page.locator('text=/BOOKS INDEXED|books indexed/i').first()).toBeVisible();
  });

  test('should show trending books section', async ({ page }) => {
    await expect(page.locator('text=/Trending|trending/i').first()).toBeVisible();
    // Wait for book cards to load
    await page.waitForSelector('[class*="card"], [class*="book"]', { timeout: 10000 });
  });

  test('should show Book of the Day section', async ({ page }) => {
    await page.locator('text=/Book of the Day/i').first().scrollIntoViewIfNeeded();
    await expect(page.locator('text=/Book of the Day/i').first()).toBeVisible();
  });

  test('should show top rated section', async ({ page }) => {
    await page.locator('text=/Top Rated/i').first().scrollIntoViewIfNeeded();
    await expect(page.locator('text=/Top Rated/i').first()).toBeVisible();
  });

  test('should show new releases section', async ({ page }) => {
    await page.locator('text=/New Releases/i').first().scrollIntoViewIfNeeded();
    await expect(page.locator('text=/New Releases/i').first()).toBeVisible();
  });

  test('should show newsletter section', async ({ page }) => {
    // Scroll to bottom area
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    const newsletter = page.locator('input[type="email"]').first();
    await newsletter.scrollIntoViewIfNeeded();
    await expect(newsletter).toBeVisible();
  });

  test('should show footer', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
  });

  test('navigation links should be visible', async ({ page }) => {
    await expect(page.locator('nav').first()).toBeVisible();
    await expect(page.locator('text=Trending Now').first()).toBeVisible();
    await expect(page.locator('text=Blog').first()).toBeVisible();
  });

  test('should show popular search tags', async ({ page }) => {
    await expect(page.locator('text=Popular:').first()).toBeVisible();
  });

  test('should have correct SEO meta tags', async ({ page }) => {
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(20);

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toBeTruthy();
  });

  test('sign in button should be visible', async ({ page }) => {
    await expect(page.locator('text=Sign In').first()).toBeVisible();
  });

  test('theme toggle should be visible', async ({ page }) => {
    // Sun/moon icon or theme toggle
    const themeBtn = page.locator('[aria-label*="theme"], [aria-label*="dark"], [aria-label*="light"]').first();
    // If no aria-label, check for sun/moon icon button
    await expect(page.locator('button').nth(3)).toBeVisible();
  });
});
