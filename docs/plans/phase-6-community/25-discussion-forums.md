# Feature 25: Discussion Forums

**Phase:** 6 — Community  
**Priority:** P17 (Strategic Gap)  
**Competitors:** Goodreads ✅ (Groups with discussion boards)  
**Status:** Completed — 2026-04-14

---

## 1. Feature Overview

Book-level discussion threads separate from reviews. Goodreads has extensive per-book discussion boards with topics like "Questions about the ending" or "Historical accuracy". Creates long-tail content and SEO value.

---

## 2. Database Changes

### Migration: `server/src/migrations/036_discussions.ts`

```sql
CREATE TABLE discussions (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) DEFAULT NULL,
  category_id VARCHAR(36) DEFAULT NULL COMMENT 'For general/category-level discussions',
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  reply_count INT DEFAULT 0,
  last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_book_discussions (book_id, last_activity_at DESC),
  FULLTEXT INDEX ft_discussion (title, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE discussion_replies (
  id VARCHAR(36) PRIMARY KEY,
  discussion_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_discussion_replies (discussion_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/discussions`
**Query:** `?page=1&limit=20&sort=recent|active`

### 3.2 `POST /api/books/:id/discussions`
**Auth:** Required  
**Body:** `{ title, content }`

### 3.3 `GET /api/discussions/:id`
**Response:** Discussion with paginated replies

### 3.4 `POST /api/discussions/:id/replies`
**Auth:** Required  
**Body:** `{ content }`

### 3.5 Admin: `PUT /api/admin/discussions/:id` (pin/lock)

---

## 4. Frontend Components

### 4.1 `app/src/components/book/BookDiscussions.tsx`
**Tab on BookPage** — "Discussions (X)"  
List of threads with title, author, reply count, last activity

### 4.2 `app/src/components/DiscussionThread.tsx`
**Route:** `/discussions/:id`  
Full thread view with chronological replies

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/discussions.spec.ts`

- [x] Book page shows "Discussions" tab with count
- [x] Discussion list renders threads with title, author, reply count
- [x] Creating new discussion works for authenticated users
- [x] Clicking thread opens full thread view
- [x] Posting reply adds to thread
- [x] Thread locked → reply form hidden
- [x] Pinned discussions appear first
- [x] Search within discussions
- [x] Mobile: compact thread list
- [x] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [x] `GET /api/books/:id/discussions` → 200
- [x] `POST` without auth → 401
- [x] `POST` with valid data → 201
- [x] Empty title → 400
- [x] `GET /api/discussions/:id` includes replies
- [x] `POST` reply to locked discussion → 403
- [x] Admin pin/lock → 200

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [x] Per-book discussion threads
- [x] Create, view, reply
- [x] Admin pin/lock controls
- [x] All tests pass

## 9. Completion Tracking

- [x] **Database** — Migration run
- [x] **API** — Discussion CRUD endpoints
- [x] **Frontend** — BookDiscussions + DiscussionThread
- [x] **E2E Tests** — Passing
- [x] **API Tests** — Passing
- [ ] **Deployed** — Live
