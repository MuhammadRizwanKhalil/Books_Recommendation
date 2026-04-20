# Feature 20: Up Next / TBR Queue

**Phase:** 4 — Lists & Shelves  
**Priority:** P14 (Medium Gap)  
**Competitors:** StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

A priority queue of up to 10 books the user plans to read next, separate from the full "want to read" list. "Want to read" lists grow to 500+ books and become useless. An "Up Next" queue forces intentional prioritization with drag-to-reorder.

---

## 2. Database Changes

### Migration: `server/src/migrations/030_tbr_queue.ts`

```sql
CREATE TABLE tbr_queue (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  position INT NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_book_tbr (user_id, book_id),
  INDEX idx_user_queue (user_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/tbr-queue`
**Auth:** Required  
**Response:** Ordered list of books (max 10)

### 3.2 `POST /api/tbr-queue`
**Auth:** Required  
**Body:** `{ bookId: "uuid" }`  
**Logic:** Appends to end. Rejects if already 10 books.

### 3.3 `PUT /api/tbr-queue/reorder`
**Auth:** Required  
**Body:** `{ bookIds: ["uuid1", "uuid2", ...] }` (new order)

### 3.4 `DELETE /api/tbr-queue/:bookId`
**Auth:** Required

---

## 4. Frontend Components

### 4.1 `app/src/components/TBRQueue.tsx`
**Route:** `/up-next` or widget on homepage  
**Features:** Drag-to-reorder list, book covers with titles, remove button, "Add from Want to Read" picker

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/tbr-queue.spec.ts`

- [ ] Queue page shows user's up-next books in order
- [ ] Adding book from want-to-read adds to queue
- [ ] Drag-to-reorder changes position
- [ ] Remove button removes book from queue
- [ ] Max 10 books enforced — shows limit message
- [ ] Empty queue shows "Add books to your Up Next queue"
- [ ] Starting to read a book removes it from queue
- [ ] Mobile: Drag works with touch events
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/tbr-queue` without auth → 401
- [ ] With auth → 200 with ordered books
- [ ] `POST` adds book → 200
- [ ] 11th book → 400 (limit 10)
- [ ] Duplicate book → 409
- [ ] `PUT /api/tbr-queue/reorder` updates positions
- [ ] `DELETE` removes book → 200

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Up-next queue with max 10 books
- [ ] Drag-to-reorder works
- [ ] Quick add from book page
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — TBR queue CRUD endpoints
- [ ] **Frontend** — TBRQueue component with drag-and-drop
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
