# Feature 29: Editions Browser

**Phase:** 7 — Book Metadata & UX  
**Priority:** P4 (Critical Book Page Gap)  
**Competitors:** Goodreads ✅ ("Other Editions"), OpenLibrary ✅ (120+ editions), Hardcover ✅  
**Status:** Not Started

---

## 1. Feature Overview

Show all editions of a book (hardcover, paperback, large print, audiobook, foreign language) in a browsable list/grid. OpenLibrary excels here with 120+ editions per title. Currently TheBookTimes treats each book as a single canonical entry. This feature groups editions under a "work" concept.

---

## 2. Database Changes

### Migration: `server/src/migrations/038_editions.ts`

```sql
CREATE TABLE works (
  id VARCHAR(36) PRIMARY KEY,
  canonical_book_id VARCHAR(36) NOT NULL COMMENT 'The "main" edition shown by default',
  title VARCHAR(500) NOT NULL COMMENT 'Work-level title',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (canonical_book_id) REFERENCES books(id),
  INDEX idx_canonical (canonical_book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE books ADD COLUMN work_id VARCHAR(36) DEFAULT NULL;
ALTER TABLE books ADD COLUMN edition_format ENUM('hardcover','paperback','ebook','audiobook','large_print','mass_market') DEFAULT NULL;
ALTER TABLE books ADD COLUMN edition_language VARCHAR(10) DEFAULT 'en';
ALTER TABLE books ADD COLUMN edition_publisher VARCHAR(255) DEFAULT NULL;
ALTER TABLE books ADD COLUMN edition_year YEAR DEFAULT NULL;
ALTER TABLE books ADD FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE SET NULL;
ALTER TABLE books ADD INDEX idx_work (work_id);
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/editions`
**Auth:** None  
**Response:**
```json
{
  "workTitle": "Atomic Habits",
  "canonicalEditionId": "uuid",
  "editions": [
    {
      "id": "uuid", "title": "Atomic Habits (Hardcover)",
      "format": "hardcover", "language": "en", "publisher": "Avery",
      "year": 2018, "coverImage": "...", "isbn": "9780735211292", "pageCount": 320
    }
  ],
  "totalEditions": 12
}
```

### 3.2 Admin: `POST /api/admin/works` — Create work grouping
### 3.3 Admin: `PUT /api/admin/books/:id/work` — Assign book to work

---

## 4. Frontend Components

### 4.1 `app/src/components/book/EditionsBrowser.tsx`
**Location:** Collapsible section on BookPage  
**Features:** Grid of edition covers, format badges, filter by format/language  
**"All Editions (12)" expand link**

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/editions.spec.ts`

- [ ] Book page shows "X Editions" link when editions exist
- [ ] Clicking shows editions grid
- [ ] Editions display cover, format, publisher, year
- [ ] Filter by format works
- [ ] Clicking edition navigates to that edition's book page
- [ ] Section hidden for single-edition books
- [ ] Mobile: edition cards stack
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/books/:id/editions` → 200
- [ ] Book with no work_id → `{ editions: [], totalEditions: 0 }`
- [ ] Multiple editions return all grouped under work
- [ ] Admin create work → 201
- [ ] Admin assign book to work → 200

---

## 7. Dependencies

- **None** (but consider during Feature #11 Goodreads Import)

---

## 8. Acceptance Criteria

- [ ] Editions grouped under works
- [ ] Browser shows all editions with metadata
- [ ] Admin can manage work groupings
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Editions endpoint + admin work management
- [ ] **Frontend** — EditionsBrowser component
- [ ] **Admin** — Work management UI
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
