# Feature 35: Reading Journal / Notes

**Phase:** 8 — Gamification & Insights  
**Priority:** P15 (Medium Gap)  
**Competitors:** Hardcover ✅ (Journaling), StoryGraph ✅ (Reading Journal)  
**Status:** Not Started

---

## 1. Feature Overview

Private reading journal where users can write notes, highlight quotes, and capture thoughts while reading a book. More granular than a review — these are in-progress reflections. Hardcover's journaling feature includes page-specific notes and timestamped entries.

---

## 2. Database Changes

### Migration: `server/src/migrations/043_reading_journal.ts`

```sql
CREATE TABLE journal_entries (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  entry_type ENUM('note', 'quote', 'highlight', 'reaction') DEFAULT 'note',
  content TEXT NOT NULL,
  page_number INT DEFAULT NULL,
  chapter VARCHAR(100) DEFAULT NULL,
  is_private BOOLEAN DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_user_book_journal (user_id, book_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/journal?bookId=uuid` — Journal entries for a book
### 3.2 `GET /api/journal` — All entries across all books
### 3.3 `POST /api/journal` — Create entry `{ bookId, content, entryType, pageNumber?, chapter? }`
### 3.4 `PUT /api/journal/:id` — Edit entry
### 3.5 `DELETE /api/journal/:id` — Delete entry
### 3.6 `GET /api/books/:id/quotes` — Public quotes from this book (if is_private=false)

---

## 4. Frontend Components

### 4.1 `app/src/components/book/ReadingJournal.tsx`
**Location:** Tab on BookPage or floating "Journal" button  
**Features:** Chronological notes stream, type filter (notes/quotes/highlights), quick add form, page/chapter reference, rich text (basic markdown)

### 4.2 `app/src/components/JournalPage.tsx`
**Route:** `/journal`  
**All entries across all books, filterable, searchable**

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/reading-journal.spec.ts`

- [ ] Journal tab/button visible on book page when reading
- [ ] Creating a note with content works
- [ ] Creating a quote with page number works
- [ ] Entries appear in chronological order
- [ ] Edit entry updates content
- [ ] Delete entry removes it
- [ ] Filter by type works (notes vs quotes)
- [ ] Journal page shows entries across books
- [ ] Private entries not visible to other users
- [ ] Mobile: Full-screen journal editor
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `POST /api/journal` → 201
- [ ] Without auth → 401
- [ ] Empty content → 400
- [ ] `GET /api/journal?bookId=uuid` → entries for that book
- [ ] `PUT` own entry → 200
- [ ] `PUT` other's entry → 403
- [ ] `DELETE` own → 200
- [ ] Public quotes endpoint returns only is_private=false

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Private journal entries per book
- [ ] Multiple entry types (note, quote, highlight)
- [ ] Journal page aggregates all books
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Journal CRUD endpoints
- [ ] **Frontend** — ReadingJournal + JournalPage
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
