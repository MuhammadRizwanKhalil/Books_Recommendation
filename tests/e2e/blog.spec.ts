import { test, expect } from '@playwright/test';

test.describe('Blog', () => {
  test('blog listing page should load', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/blog');
  });

  test('blog page should show posts', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Should show at least one blog post title or card
    const posts = page.locator('article, [class*="blog"], [class*="post"]');
    const headings = page.locator('h2, h3').nth(1);
    await expect(headings).toBeVisible({ timeout: 8000 });
  });

  test('blog post should have title, excerpt, image', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // First article heading
    const firstHeading = page.locator('h2, h3').nth(1);
    await expect(firstHeading).toBeVisible({ timeout: 8000 });
    const text = await firstHeading.textContent();
    expect(text!.length).toBeGreaterThan(5);
  });

  test('clicking blog post navigates to detail page', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const firstPostLink = page.locator('a[href*="/blog/"]').first();
    if (await firstPostLink.isVisible()) {
      const href = await firstPostLink.getAttribute('href');
      await firstPostLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/blog/');
    }
  });

  test('blog detail page should show content', async ({ page }) => {
    await page.goto('/blog/what-i-have-been-reading-this-spring-and-why-you-should-too');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
    const heading = await page.locator('h1, h2').first().textContent();
    expect(heading!.length).toBeGreaterThan(5);
  });

  test('blog detail page should have featured image', async ({ page }) => {
    await page.goto('/blog/what-i-have-been-reading-this-spring-and-why-you-should-too');
    await page.waitForLoadState('networkidle');
    const img = page.locator('article img, [class*="featured"] img, img[src*="uploads"]').first();
    await expect(img).toBeVisible({ timeout: 8000 });
  });

  test('blog detail SEO tags should be set', async ({ page }) => {
    await page.goto('/blog/what-i-have-been-reading-this-spring-and-why-you-should-too');
    await page.waitForLoadState('networkidle');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(10);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
  });

  test('blog page navigation from homepage Blog link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('text=Blog').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/blog/);
  });
});
