# Feature 01: Series Information

**Phase:** 1 — Book Page Foundation  
**Priority:** P1 (Critical Gap)  
**Competitors:** Goodreads ✅, Amazon ✅, Hardcover ✅, StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Display series badge with position on book detail pages (e.g., "Book 1 in the Middle-earth Series"), link to a dedicated series page showing all books in order. Series readers are the most loyal users — without series info, users can't discover reading order or related books.

**User Stories:**
- As a reader, I want to see which series a book belongs to and its position
- As a reader, I want to browse all books in a series in order
- As an admin, I want to manage series and assign books to them

---

## 2. Database Changes

### Migration: `server/src/migrations/015_series_information.ts`

```sql
CREATE TABLE book_series (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL UNIQUE,
  description TEXT,
  cover_image TEXT,
  total_books INT DEFAULT 0,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_series_slug (slug),
  FULLTEXT INDEX ft_series_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE book_series_entries (
  id VARCHAR(36) PRIMARY KEY,
  series_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  position DECIMAL(5,1) NOT NULL COMMENT 'Supports 0.5 for novellas like Book 1.5',
  is_main_entry BOOLEAN DEFAULT TRUE COMMENT 'False for companion novellas',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (series_id) REFERENCES book_series(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  UNIQUE KEY uq_series_book (series_id, book_id),
  INDEX idx_series_position (series_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/series/:slug`
**Auth:** None (public)  
**Response:**
```json
{
  "id": "uuid",
  "name": "Middle-earth Series",
  "slug": "middle-earth-series",
  "description": "J.R.R. Tolkien's fantasy saga...",
  "coverImage": "https://...",
  "totalBooks": 5,
  "isComplete": true,
  "books": [
    {
      "id": "uuid",
      "title": "The Hobbit",
      "slug": "the-hobbit-jrr-tolkien",
      "coverImage": "...",
      "position": 1,
      "isMainEntry": true,
      "author": "J.R.R. Tolkien",
      "googleRating": 4.3,
      "pageCount": 310
    }
  ]
}
```

### 3.2 `GET /api/books/:slug` (extend existing)
**Change:** Include `series` field in book detail response:
```json
{
  "series": [
    {
      "id": "uuid",
      "name": "Middle-earth Series",
      "slug": "middle-earth-series",
      "position": 1,
      "totalBooks": 5
    }
  ]
}
```

### 3.3 `POST /api/admin/series` (Admin)
**Auth:** Admin required  
**Body:** `{ name, slug?, description?, coverImage?, isComplete? }`  
**Response:** `201` with created series

### 3.4 `PUT /api/admin/series/:id` (Admin)
**Auth:** Admin required  
**Body:** `{ name?, description?, coverImage?, isComplete?, totalBooks? }`

### 3.5 `POST /api/admin/series/:id/books` (Admin)
**Auth:** Admin required  
**Body:** `{ bookId, position, isMainEntry? }`

### 3.6 `DELETE /api/admin/series/:id/books/:bookId` (Admin)
**Auth:** Admin required

---

## 4. Frontend Components

### 4.1 `app/src/components/book/SeriesBadge.tsx`
**Location:** Above title in BookPage.tsx  
**Props:** `{ series: { name, slug, position, totalBooks }[] }`  
**Renders:** "Book 1 in the Middle-earth Series" with link to `/series/:slug`

### 4.2 `app/src/components/SeriesPage.tsx`
**Route:** `/series/:slug`  
**Layout:** Series header (name, description, cover, completion status) + ordered book grid  
**Uses:** BookCard component for each entry

### 4.3 `app/src/admin/AdminSeries.tsx`
**Route:** `/admin/series`  
**Features:** CRUD for series + assign books with position drag-and-drop

### 4.4 API Client Addition: `app/src/api/client.ts`
```typescript
export const seriesApi = {
  getBySlug: (slug: string) => fetchApi(`/api/series/${slug}`),
};
```

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/series.spec.ts`

#### Happy Path
- [ ] Book detail page shows series badge when book is in a series
- [ ] Series badge shows correct position (e.g., "Book 1")
- [ ] Series badge shows series name as link
- [ ] Clicking series badge navigates to `/series/:slug`
- [ ] Series page loads with series name as heading
- [ ] Series page lists all books in correct order (position ascending)
- [ ] Each book in series list shows cover, title, author, position number
- [ ] Clicking a book in series list navigates to that book's detail page
- [ ] Book not in any series shows no series badge (no error)

#### Edge Cases
- [ ] Book in multiple series shows multiple badges
- [ ] Series with 1 book shows "Book 1 of 1"
- [ ] Series with companion novellas (position 1.5) sorts correctly
- [ ] Series page with 20+ books paginates or shows all
- [ ] Incomplete series shows "Ongoing" or similar indicator
- [ ] Series with very long name truncates gracefully

#### Error States
- [ ] Non-existent series slug shows 404 page
- [ ] Series page with all books deleted shows empty state message

#### Responsive
- [ ] Mobile (375×812): Series badge fits on one line or wraps cleanly
- [ ] Mobile: Series page books stack vertically
- [ ] Tablet (768×1024): 2-column grid on series page
- [ ] Desktop (1440×900): 3-4 column grid on series page

#### Accessibility
- [ ] Series badge link is keyboard focusable
- [ ] Series page heading has correct h1 level
- [ ] Book position announced to screen readers
- [ ] axe-core audit passes on series page

#### SEO
- [ ] Series page has `<title>` with series name
- [ ] Series page has meta description
- [ ] Series page has og:title meta tag

---

## 6. API Test Scenarios (Vitest)

### File: `tests/api/series.test.ts`

#### `GET /api/series/:slug`
- [ ] Returns 200 with series object
- [ ] Response includes books array sorted by position
- [ ] Each book has required fields: id, title, slug, coverImage, position, author
- [ ] Non-existent slug returns 404
- [ ] Series with no books returns empty books array

#### `GET /api/books/:slug` (extended)
- [ ] Book in a series includes `series` array in response
- [ ] Series entry has name, slug, position, totalBooks
- [ ] Book not in any series has `series: []` or `series: null`

#### Admin Endpoints
- [ ] `POST /api/admin/series` without auth → 401
- [ ] `POST /api/admin/series` with admin token → 201
- [ ] `POST /api/admin/series` with duplicate slug → 409
- [ ] `POST /api/admin/series/:id/books` assigns book correctly
- [ ] `DELETE /api/admin/series/:id/books/:bookId` removes assignment
- [ ] `PUT /api/admin/series/:id` updates name/description

---

## 7. Dependencies

- **None** — This feature is fully independent

---

## 8. Acceptance Criteria

- [ ] Series badge appears on book detail page for books in a series
- [ ] Badge shows correct position number and series name
- [ ] Clicking badge navigates to series page
- [ ] Series page lists all books in order
- [ ] Books not in a series show no badge (no errors)
- [ ] Admin can create/edit series and assign books
- [ ] API returns series data in book detail response
- [ ] All E2E tests pass across 4 browsers
- [ ] All API tests pass
- [ ] Accessibility audit passes

## 9. Completion Tracking

- [ ] **Database** — Migration created and run
- [ ] **API** — Routes created and tested
- [ ] **Frontend** — SeriesBadge, SeriesPage, AdminSeries components
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
