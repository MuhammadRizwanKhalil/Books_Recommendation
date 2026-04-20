# Scroll-to-Top Fix - Test Checklist

## Navigation Scenarios to Test

### Blog
- [ ] From blog listing (`/blog`) → click blog post → **verify scroll to top**
- [ ] From blog post → back to blog listing → **verify scroll to top**
- [ ] On blog listing, click pagination next page → **should scroll smoothly to top**

### Books
- [ ] From category → click book → **verify scroll to top**
- [ ] From trending → click book → **verify scroll to top**
- [ ] From search results → click book → **verify scroll to top**
- [ ] From book detail → click related/recommended book → **verify scroll to top**

### Categories
- [ ] From categories listing → click category → **verify scroll to top**
- [ ] From category detail → click another category → **verify scroll to top**

### Authors
- [ ] From author page → click related author link → **verify scroll to top**
- [ ] From books → click author → **verify scroll to top**

### Discovery
- [ ] From `/discover/mood` → click mood → **verify scroll to top** (e.g., `/discover/mood/hopeful`)
- [ ] From mood results → click book → **verify scroll to top**

### Lists
- [ ] From `/lists` → click list detail → **verify scroll to top**
- [ ] From `/lists/discover` → click community list → **verify scroll to top**

### Other Pages
- [ ] From any page → navigate to `/search` → **verify scroll to top**
- [ ] From search → click book → **verify scroll to top**
- [ ] Navigate to `/pricing` from any page → **verify scroll to top**
- [ ] Navigate to legal pages (`/legal/privacy`) → **verify scroll to top**

### Mobile (375px viewport)
- [ ] Mobile: Blog listing → blog post → **verify scroll to top**
- [ ] Mobile: Category listing → category detail → **verify scroll to top**
- [ ] Mobile: Hamburger menu click → navigate → **verify scroll to top**

### Edge Cases
- [ ] Direct URL navigation (type URL or refresh) → **verify no double-scroll**
- [ ] Browser back button → **verify scroll appropriate**
- [ ] Pagination on blog/search → **verify smooth scroll only, not jarring**
- [ ] From scrolled position → navigate → **verify immediately at top**

## Acceptance Criteria

✅ **All page navigations scroll to top automatically**
- No manual button clicking needed
- Works for all `<Link>` components
- Works for programmatic navigation
- Works for direct URL changes

✅ **Smooth appearance**
- No double-scrolls or flashing
- Instant scroll (not smooth animated for route change)
- Pagination scrolls are smooth (existing behavior)

✅ **No breaking changes**
- Existing scroll behaviors still work
- Pagination still smooth-scrolls
- Custom nav functions still work as before

## Browser/Device Testing

Run locally:
```bash
cd app
npm run dev
# Base URL: http://127.0.0.1:5173
```

Test on:
- [ ] Desktop (Chrome/Edge/Firefox)
- [ ] Mobile Safari (iPhone)
- [ ] Android Chrome
- [ ] Tablet landscape/portrait

## Playwright E2E Test Additions

Add to `tests/e2e/comprehensive-all-pages.spec.ts`:

```typescript
test('navigating from blog listing to blog post scrolls to top', async ({ page }) => {
  await page.goto('/blog');
  await page.waitForLoadState('domcontentloaded');
  
  // Scroll down
  await page.evaluate(() => window.scrollTo({ top: 400 }));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  
  // Click first blog post
  const firstPost = page.locator('article a, a[href*="/blog/"]').first();
  await firstPost.click();
  await page.waitForLoadState('domcontentloaded');
  
  // Verify scrolled to top
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeLessThan(100);
});

test('navigating from category to book scrolls to top', async ({ page }) => {
  await page.goto('/categories');
  await page.waitForLoadState('domcontentloaded');
  
  const firstCategory = page.locator('a[href*="/category/"]').first();
  if (await firstCategory.isVisible()) {
    await firstCategory.click();
    await page.waitForLoadState('domcontentloaded');
    
    // Scroll down
    await page.evaluate(() => window.scrollTo({ top: 300 }));
    
    // Click first book
    const firstBook = page.locator('a[href*="/book/"]').first();
    await firstBook.click();
    await page.waitForLoadState('domcontentloaded');
    
    // Verify scrolled to top
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThan(100);
  }
});
```

## Notes

- Scroll-to-top is **instant** (`behavior: 'auto'`) for route changes
- Pagination within a page still uses **smooth** scrolling
- The global effect in `App.tsx` catches all route changes via pathname
- Individual pages can override with `useScrollToTop` hook if needed
