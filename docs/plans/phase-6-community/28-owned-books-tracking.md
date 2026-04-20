# Feature 28: Owned Books Tracking

**Phase:** 6 — Community  
**Priority:** P20 (Unique Differentiator)  
**Competitors:** Hardcover ✅ (unique feature)  
**Status:** Not Started

---

## 1. Feature Overview

Hardcover uniquely tracks which books a user physically owns, including format (hardcover, paperback, ebook, audiobook) and condition. Separate from "read" or "want to read" — purely ownership tracking. Useful for lending decisions, collection management, and avoiding duplicate purchases.

---

## 2. Database Changes

### Migration: `server/src/migrations/037_owned_books.ts`

```sql
CREATE TABLE owned_books (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  format ENUM('hardcover', 'paperback', 'ebook', 'audiobook') NOT NULL,
  condition_note VARCHAR(255) DEFAULT NULL,
  purchase_date DATE DEFAULT NULL,
  is_lendable BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_book_format (user_id, book_id, format),
  INDEX idx_user_owned (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/owned-books` — Current user's collection
### 3.2 `POST /api/owned-books` — Add owned copy
### 3.3 `PUT /api/owned-books/:id` — Update format/condition
### 3.4 `DELETE /api/owned-books/:id` — Remove
### 3.5 `GET /api/books/:id/ownership` — Check if current user owns (for book page badge)

---

## 4. Frontend Components

### 4.1 `app/src/components/OwnedBooksPage.tsx` — Collection grid by format
### 4.2 Badge on BookPage: "You own this (Paperback)"
### 4.3 "I Own This" button alongside reading status

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/owned-books.spec.ts`

- [ ] "I Own This" button on book page
- [ ] Adding owned book with format selection
- [ ] Owned badge displays on book page
- [ ] Owned books collection page shows library
- [ ] Filter by format works
- [ ] Remove from owned works
- [ ] Can own multiple formats of same book
- [ ] Mobile: grid layout responsive
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `POST /api/owned-books` → 201
- [ ] Duplicate user+book+format → 409
- [ ] Different format same book → 201
- [ ] `GET /api/owned-books` → user's collection
- [ ] `DELETE` → 200
- [ ] `GET /api/books/:id/ownership` → formats owned

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Track owned books by format
- [ ] Collection page viewable
- [ ] Ownership badge on book pages
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Owned books CRUD
- [ ] **Frontend** — OwnedBooksPage + BookPage badge
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
