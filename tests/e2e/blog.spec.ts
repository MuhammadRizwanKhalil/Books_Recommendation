import { test, expect } from '../fixtures/test';
import { TEST_BLOG_URL, VIEWPORTS } from '../fixtures/test-data';

test.describe('Blog @testing @blog', () => {
  test('blog listing route shows heading and either posts or empty state', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL('/blog');
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(/blog/i);

    const body = page.locator('body');
    await expect(body).toContainText(/our blog|articles published|no blog posts yet/i);

    await expect(body).toContainText(/read more|read full article|no blog posts yet/i);

    const postLinks = page.locator('main a[href^="/blog/"]');
    if ((await postLinks.count()) > 0) {
      await expect(postLinks.first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('blog listing supports page query routes', async ({ page }) => {
    await page.goto('/blog?page=2');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/blog\?page=2/);
    const title = await page.title();
    expect(title).toMatch(/blog/i);

    await expect(page.locator('body')).toContainText(/our blog|no blog posts yet|articles published/i);
  });

  test('blog listing links navigate into blog detail routes when posts exist', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    const firstPostLink = page.locator('a[href^="/blog/"]').first();
    if (await firstPostLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await firstPostLink.getAttribute('href');
      expect(href).toBeTruthy();

      await firstPostLink.click();
      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveURL(/\/blog\//);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    }
  });

  test('known blog detail route shows article content, metadata, and navigation controls', async ({ page }) => {
    await page.goto(TEST_BLOG_URL);
    await page.waitForLoadState('domcontentloaded');

    const heading = page.getByRole('heading', { level: 1 }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
    await expect(heading).not.toHaveText(/^\s*$/);

    const body = page.locator('body');
    await expect(body).toContainText(/share|back|all posts|words|read/i);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect((description || '').length).toBeGreaterThan(5);

    const breadcrumbBlog = page.getByRole('link', { name: /^blog$/i }).first();
    await expect(breadcrumbBlog).toBeVisible();
  });

  test('unknown blog detail route renders not-found fallback and recovery actions', async ({ page }) => {
    await page.goto('/blog/non-existent-blog-post-e2e-slug');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText(/blog post not found|doesn't exist|browse all posts|go back/i);
    const browseAllPosts = page.getByRole('link', { name: /browse all posts/i });
    await expect(browseAllPosts).toBeVisible();
    await browseAllPosts.click();
    await expect(page).toHaveURL('/blog');
  });

  test('blog routes do not surface visible runtime errors', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    const listText = await page.locator('body').innerText();
    expect(listText).not.toMatch(/TypeError:|ReferenceError:|Cannot read properties of|Application error/i);

    await page.goto(TEST_BLOG_URL);
    await page.waitForLoadState('domcontentloaded');

    const detailText = await page.locator('body').innerText();
    expect(detailText).not.toMatch(/TypeError:|ReferenceError:|Cannot read properties of|Application error/i);
  });

  test('blog listing and detail routes are stable on mobile viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const listWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const listViewport = await page.evaluate(() => document.documentElement.clientWidth);
    expect(listWidth).toBeLessThanOrEqual(listViewport + 20);

    await page.goto(TEST_BLOG_URL);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const detailWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const detailViewport = await page.evaluate(() => document.documentElement.clientWidth);
    expect(detailWidth).toBeLessThanOrEqual(detailViewport + 20);
  });
});
