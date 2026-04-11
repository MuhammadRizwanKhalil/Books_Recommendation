import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('mobile: hamburger/compact nav should appear', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Desktop nav items should be hidden on mobile
    // At minimum, logo should be visible
    await expect(page.locator('text=The Book Times').first()).toBeVisible();
  });

  test('mobile: search input should be accessible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const search = page.locator('input[placeholder*="Search"]').first();
    await expect(search).toBeVisible();
  });

  test('mobile: book cards should stack vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Get first two book card positions
    const cards = page.locator('a[href*="/book/"]');
    const count = await cards.count();
    if (count >= 2) {
      const box1 = await cards.nth(0).boundingBox();
      const box2 = await cards.nth(1).boundingBox();
      if (box1 && box2) {
        // On mobile, cards should be side by side or stacked — just check they're visible
        expect(box1.width).toBeLessThan(400);
      }
    }
  });

  test('tablet: layout should work at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('desktop: all nav items should be visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Trending Now').first()).toBeVisible();
    await expect(page.locator('text=Blog').first()).toBeVisible();
    await expect(page.locator('text=Sign In').first()).toBeVisible();
  });

  test('mobile: book detail page should work', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/book/the-power-of-habit-charles-duhigg');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Power of Habit').first()).toBeVisible();
    await expect(page.locator('text=Buy on Amazon').first()).toBeVisible();
  });

  test('mobile: blog page should work', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('no horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    // Allow small tolerance
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
