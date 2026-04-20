# Feature 05: Reading Counts

**Phase:** 1 — Book Page Foundation  
**Priority:** P9 (High-Priority Gap)  
**Competitors:** Goodreads ✅ ("114,885 currently reading"), OpenLibrary ✅ ("873 Want to read · 61 Currently reading")  
**Status:** Not Started

---

## 1. Feature Overview

Display aggregate reading counts on book detail pages: "X currently reading · Y want to read · Z have read". This social proof encourages users to pick up popular books and creates a sense of community activity.

**User Stories:**
- As a reader, I want to see how many others are reading the same book
- As a potential reader, I want to see how popular a book is among the community

---

## 2. Database Changes

**None** — Data is aggregated from existing `reading_progress` table. May add a cached counts table for performance:

```sql
CREATE TABLE book_reading_counts (
  book_id VARCHAR(36) PRIMARY KEY,
  currently_reading INT NOT NULL DEFAULT 0,
  want_to_read INT NOT NULL DEFAULT 0,
  have_read INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Alternatively, compute on-the-fly with a simple `GROUP BY status` query.

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/reading-counts`
**Auth:** None (public)  
**Cache:** 5 minutes  
**Response:**
```json
{
  "currentlyReading": 245,
  "wantToRead": 1340,
  "haveRead": 890,
  "total": 2475
}
```

### 3.2 Alternative: Include in existing `GET /api/books/:slug` response
Add `readingCounts` field to book detail response to avoid extra API call.

---

## 4. Frontend Components

### 4.1 `app/src/components/book/ReadingCounts.tsx`
**Location:** Below rating in BookPage.tsx  
**Props:** `{ bookId: string }` or `{ counts: ReadingCountsData }`  
**Renders:**
- "245 currently reading · 1,340 want to read · 890 have read"
- Icons: 📖 currently reading, 📋 want to read, ✅ have read
- Numbers formatted with commas (1,340)
- Compact variant for BookCard hover

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/reading-counts.spec.ts`

#### Happy Path
- [ ] Book detail page shows reading counts section
- [ ] Three count labels visible: "currently reading", "want to read", "have read"
- [ ] Numbers are formatted with commas for large values
- [ ] Counts update after user changes their reading status on the same page

#### Edge Cases
- [ ] Book with zero reading activity shows "0 currently reading · 0 want to read · 0 have read" or "Be the first to read"
- [ ] Book with only 1 reader shows correct singular/plural
- [ ] Very large numbers (100,000+) formatted correctly

#### Error States
- [ ] API failure gracefully hides counts section (no error shown)

#### Responsive
- [ ] Mobile: Counts stack vertically or wrap to 2 lines
- [ ] Desktop: Counts in single horizontal line

#### Accessibility
- [ ] Counts are in a `<dl>` or ARIA-labeled region
- [ ] Screen reader reads "245 people currently reading"
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

### File: `tests/api/reading-counts.test.ts`

- [ ] `GET /api/books/:id/reading-counts` → 200
- [ ] Response has: currentlyReading, wantToRead, haveRead, total
- [ ] All values are non-negative integers
- [ ] Total equals sum of individual counts
- [ ] Non-existent book ID → 404
- [ ] Cache-control header present (max-age >= 300)

---

## 7. Dependencies

- **None** — Uses existing `reading_progress` table

---

## 8. Acceptance Criteria

- [ ] Reading counts visible on book detail page
- [ ] Shows currently reading, want to read, have read counts
- [ ] Numbers formatted with commas
- [ ] Updates reflect when user changes reading status
- [ ] All tests pass
- [ ] Accessibility audit passes

## 9. Completion Tracking

- [ ] **Database** — Cache table created (or query optimized)
- [ ] **API** — Endpoint created and tested
- [ ] **Frontend** — ReadingCounts component
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
