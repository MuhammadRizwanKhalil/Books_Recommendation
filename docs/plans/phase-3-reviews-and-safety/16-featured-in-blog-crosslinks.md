# Feature 16: Featured In Blog Cross-links

**Phase:** 3 — Reviews & Safety  
**Priority:** P15 (Medium Gap)  
**Competitors:** BookBub ✅ ("As Featured In")  
**Status:** Not Started

---

## 1. Feature Overview

Show a "Featured In" section on book detail pages linking to blog posts that mention this book. BookBub uniquely shows "As Featured In: The Best Books About Dragons, 19 Immersive Books Featuring Large Casts". Since TheBookTimes already has a blog, this is natural cross-promotion.

---

## 2. Database Changes

### Migration: `server/src/migrations/027_blog_book_mentions.ts`

```sql
CREATE TABLE blog_book_mentions (
  id VARCHAR(36) PRIMARY KEY,
  blog_post_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  is_auto_detected BOOLEAN DEFAULT FALSE COMMENT 'Auto-extracted from blog content',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  UNIQUE KEY uq_blog_book (blog_post_id, book_id),
  INDEX idx_book_mentions (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/blog-mentions`
**Auth:** None  
**Response:**
```json
{
  "mentions": [
    {
      "id": "uuid",
      "title": "The Best Books About Habits",
      "slug": "best-books-habits",
      "excerpt": "...",
      "featuredImage": "...",
      "publishedAt": "2026-03-15"
    }
  ],
  "totalMentions": 3
}
```

### 3.2 Admin: `POST /api/admin/blog/:postId/book-mentions`
**Auth:** Admin  
**Body:** `{ bookIds: ["uuid1", "uuid2"] }`

### 3.3 Auto-detection (backend service)
On blog post publish, scan content for book title/ISBN mentions and auto-create links.

---

## 4. Frontend Components

### 4.1 `app/src/components/book/FeaturedInBlog.tsx`
**Location:** After recommendations in BookPage.tsx  
**Renders:**
- "Featured In" heading with blog icon
- Blog post cards: title, excerpt, featured image, date
- Link to full blog post
- Hidden if zero mentions

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/blog-crosslinks.spec.ts`

#### Happy Path
- [ ] Book page shows "Featured In" section when blog mentions exist
- [ ] Blog post cards show title, excerpt, image
- [ ] Clicking blog post navigates to `/blog/:slug`
- [ ] Section hidden when no blog mentions

#### Edge Cases
- [ ] Book mentioned in 10+ posts shows first 3 with "View all" expand
- [ ] Blog post without featured image shows placeholder

#### Responsive/Accessibility
- [ ] Mobile: Blog cards stack vertically
- [ ] Section heading visible to screen readers
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/books/:id/blog-mentions` → 200 with mentions array
- [ ] No mentions → `{ mentions: [], totalMentions: 0 }`
- [ ] Each mention has title, slug, excerpt, publishedAt
- [ ] Only published (not draft) blog posts returned
- [ ] Admin can link books to blog posts

---

## 7. Dependencies

- **None** (uses existing blog_posts and books tables)

---

## 8. Acceptance Criteria

- [ ] "Featured In" section shows relevant blog posts on book page
- [ ] Admin can manually link books to blog posts
- [ ] Auto-detection of book mentions in blog content
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Blog mentions endpoint + admin linking
- [ ] **Auto-detect** — Book mention scanner service
- [ ] **Frontend** — FeaturedInBlog component
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Deployed** — Live on production
