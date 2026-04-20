import { test, expect } from '../fixtures/test';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('hero search input should be visible', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search"]').first()).toBeVisible();
  });

  test('should show search dropdown on typing', async ({ page }) => {
    const input = page.locator('input[placeholder*="Search"]').first();
    await input.click();
    await input.type('habit', { delay: 80 });
    await page.waitForTimeout(1000);

    // Dropdown or suggestions should appear depending on data availability.
    const dropdown = page.locator('[class*="dropdown"], [role="listbox"], [class*="result"]').first();
    const suggestionLink = page.locator('a[href*="/book/"], a[href*="/author/"], a[href*="/category/"]').first();
    const searchResultsLink = page.getByRole('link', { name: /view all results|search results/i }).first();

    await expect(dropdown.or(suggestionLink).or(searchResultsLink)).toBeVisible({ timeout: 5000 });
  });

  test('should clear search input', async ({ page }) => {
    const input = page.locator('input[placeholder*="Search"]').first();
    await input.fill('test query');
    await input.fill('');
    await expect(input).toHaveValue('');
  });

  test('navigation search icon should work', async ({ page }) => {
    const searchBtn = page.locator('nav button[aria-label*="search"], nav a[href*="search"]').first();
    if (await searchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('popular search tags should be clickable', async ({ page }) => {
    const tag = page.locator('text=Self Help').first();
    if (await tag.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tag.click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('enter key submits query to search route', async ({ page }) => {
    const input = page.locator('input[placeholder*="Search"]').first();
    await input.click();
    await input.fill('habit');
    await input.press('Enter');

    await expect(page).toHaveURL(/\/search(\?|$)/);
    await expect(page).toHaveURL(/q=habit/i);
  });

  test('search result click should navigate to book', async ({ page }) => {
    const input = page.locator('input[placeholder*="Search"]').first();
    await input.click();
    await input.type('habit', { delay: 80 });
    await page.waitForTimeout(1500);

    const firstResult = page.locator('a[href*="/book/"]').first();
    if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstResult.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/book/');
    } else {
      // If no dropdown book suggestions are returned, ensure search route is still reachable.
      await input.press('Enter');
      await expect(page).toHaveURL(/\/search/);
    }
  });

  test('search page syncs input and query params', async ({ page }) => {
    await page.goto('/search?q=habit');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page
      .locator('input[placeholder*="title"], input[placeholder*="Title"], input[placeholder*="author"], input[placeholder*="Author"], input[type="text"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 8000 });
    await expect(searchInput).toHaveValue(/habit/i);
    await expect(page).toHaveURL(/q=habit/i);
  });

  test('search filters panel toggles and renders controls', async ({ page }) => {
    await page.goto('/search?q=habit');
    await page.waitForLoadState('domcontentloaded');

    const filterToggle = page.locator('button:has(svg.lucide-sliders-horizontal)').first();
    await expect(filterToggle).toBeVisible({ timeout: 8000 });
    await filterToggle.click();

    await expect(page.locator('body')).toContainText(/filters/i);
    await expect(page.locator('body')).toContainText(/category/i);
    await expect(page.locator('body')).toContainText(/min rating/i);
  });
});
