# Feature 31: Cover Zoom / Gallery

**Phase:** 7 — Book Metadata & UX  
**Priority:** P5 (Critical UX Gap)  
**Competitors:** Amazon ✅ (zoom + "Look Inside"), Hardcover ✅ (zoom)  
**Status:** Not Started

---

## 1. Feature Overview

Allow users to click on a book cover to see a larger, zoomable version. Amazon has full zoom with "Look Inside" preview pages. We'll implement cover zoom as a modal lightbox with pinch-zoom on mobile.

---

## 2. Database Changes

### Migration: `server/src/migrations/040_cover_gallery.ts`

```sql
CREATE TABLE book_images (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  image_type ENUM('cover_front', 'cover_back', 'spine', 'sample_page', 'author_signed') DEFAULT 'cover_front',
  display_order INT DEFAULT 0,
  alt_text VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_book_images (book_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/images`
**Auth:** None  
**Response:** `{ images: [{ id, url, type, altText }] }`

### 3.2 Admin: `POST /api/admin/books/:id/images` — Upload additional images
### 3.3 Admin: `DELETE /api/admin/books/:id/images/:imageId`

---

## 4. Frontend Components

### 4.1 `app/src/components/book/CoverZoom.tsx`
**Trigger:** Click on book cover image in BookPage  
**Features:**
- Modal overlay with large cover image
- Pinch-to-zoom on mobile (touch events)
- Scroll-wheel zoom on desktop
- Image gallery dots if multiple images
- Swipe between images on mobile
- Close on backdrop click, Escape, or X button

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/cover-zoom.spec.ts`

- [ ] Clicking cover opens zoom modal
- [ ] Large image displayed at higher resolution
- [ ] Close button works
- [ ] Escape key closes modal
- [ ] Backdrop click closes
- [ ] Gallery dots appear for multi-image books
- [ ] Cursor changes to zoom cursor on hover over cover
- [ ] Mobile: Pinch gesture hint displayed
- [ ] axe-core passes (focus trap, alt text)

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/books/:id/images` → 200
- [ ] No images → fallback to main cover_image
- [ ] Admin upload → 201
- [ ] Admin delete → 200
- [ ] Non-admin upload → 403

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Cover click opens zoom modal
- [ ] Zoom works on desktop and mobile
- [ ] Multi-image gallery support
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Book images endpoint
- [ ] **Frontend** — CoverZoom modal with gallery
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
