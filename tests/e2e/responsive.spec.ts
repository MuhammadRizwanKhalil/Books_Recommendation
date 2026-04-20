import { test, expect } from '../fixtures/test';
import { VIEWPORTS } from '../fixtures/test-data';

test.describe('Responsive Design', () => {
  test('mobile: header renders compact navigation with menu trigger', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('link', { name: /the book times|home/i }).first()).toBeVisible();
    await expect(page.getByRole('button').filter({ has: page.locator('svg.lucide-menu') }).first()).toBeVisible();
  });

  test('mobile: opening menu exposes key route links', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button').filter({ has: page.locator('svg.lucide-menu') }).first().click();
    await expect(page.getByRole('navigation', { name: /mobile navigation/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /blog/i }).first()).toBeVisible();

    const secondaryNavLink = page
      .getByRole('link', { name: /giveaways|feed|for you/i })
      .first();
    await expect(secondaryNavLink).toBeVisible();
  });
  test('mobile: no major horizontal overflow on core routes', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    for (const route of ['/', '/blog', '/pricing', '/search?q=habit', '/for-you']) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 24);
    }
  });

  test('mobile: search remains accessible from navigation drawer', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button').filter({ has: page.locator('svg.lucide-menu') }).first().click();

    const searchInput = page
      .locator('[role="dialog"] input[type="search"], [role="dialog"] input[placeholder*="Search" i], [role="dialog"] input[placeholder*="book" i]')
      .first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('habit');
    await expect(searchInput).toHaveValue(/habit/i);
  });
  test('tablet: home and blog routes keep main heading visible', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1').first()).toBeVisible();

    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('desktop: primary navigation links are visible without opening drawer', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('link', { name: /trending/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /categories/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /blog/i }).first()).toBeVisible();
  });

  test('mobile: book detail route renders either book content or fallback state', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/book/the-power-of-habit-charles-duhigg');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText(/power of habit|buy on amazon|wishlist|rating|book not found|browse books|couldn't load|please try again/i);
  });
  test('mobile: blog route keeps content readable', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('body')).toContainText(/our blog|no blog posts yet/i);
  });

  test('mobile: app shell does not expose visible runtime errors on key routes', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    for (const route of ['/', '/blog', '/pricing', '/compare']) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(/TypeError:|ReferenceError:|Cannot read properties of|Application error/i);
    }
  });

  test('no horizontal scroll on mobile home route', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 24);
  });
});
