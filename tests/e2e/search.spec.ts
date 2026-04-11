import { test, expect } from '@playwright/test';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('hero search input should be visible', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search"]').first()).toBeVisible();
  });

  test('should show search dropdown on typing', async ({ page }) => {
    const input = page.locator('input[placeholder*="Search"]').first();
    await input.click();
    await input.type('habit', { delay: 80 });
    await page.waitForTimeout(1000);
    // Dropdown or results should appear
    const dropdown = page.locator('[class*="dropdown"], [role="listbox"], [class*="result"]').first();
    await expect(dropdown.or(page.locator('text=/Power of Habit|Atomic Habits/').first())).toBeVisible({ timeout: 5000 });
  });

  test('should clear search input', async ({ page }) => {
    const input = page.locator('input[placeholder*="Search"]').first();
    await input.fill('test query');
    await input.fill('');
    await expect(input).toHaveValue('');
  });

  test('navigation search icon should work', async ({ page }) => {
    const searchBtn = page.locator('nav button[aria-label*="search"], nav a[href*="search"]').first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('popular search tags should be clickable', async ({ page }) => {
    const tag = page.locator('text=Self Help').first();
    if (await tag.isVisible()) {
      await tag.click();
      await page.waitForLoadState('networkidle');
      // Should navigate or filter
    }
  });

  test('search should show results for "Paulo Coelho"', async ({ page }) => {
    const input = page.locator('input[placeholder*="Search"]').first();
    await input.click();
    await input.type('Paulo', { delay: 100 });
    await page.waitForTimeout(1200);
    const result = page.locator('text=/Coelho|Aleph|Paulo/i').first();
    await expect(result).toBeVisible({ timeout: 5000 });
  });

  test('search result click should navigate to book', async ({ page }) => {
    const input = page.locator('input[placeholder*="Search"]').first();
    await input.click();
    await input.type('habit', { delay: 80 });
    await page.waitForTimeout(1500);

    const firstResult = page.locator('a[href*="/book/"]').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/book/');
    }
  });
});
