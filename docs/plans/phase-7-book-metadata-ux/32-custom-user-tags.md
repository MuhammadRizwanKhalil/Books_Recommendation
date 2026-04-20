# Feature 32: Custom User Tags

**Phase:** 7 — Book Metadata & UX  
**Priority:** P15 (Medium Gap)  
**Competitors:** OpenLibrary ✅ ("Subjects"), Hardcover ✅ (tagging), StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Let users add personal tags/labels to books for their own organization (e.g., "comfort reads", "book-club-2026", "beach-vacation", "re-read-worthy"). Different from community mood tags (#2) — these are private per-user organizational labels.

---

## 2. Database Changes

### Migration: `server/src/migrations/041_custom_tags.ts`

```sql
CREATE TABLE user_tags (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT NULL COMMENT 'Hex color for display',
  book_count INT DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_tag (user_id, name),
  INDEX idx_user_tags (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE book_user_tags (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES user_tags(id) ON DELETE CASCADE,
  UNIQUE KEY uq_book_tag (book_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/tags` — Current user's tags with book counts
### 3.2 `POST /api/tags` — Create tag `{ name, color? }`
### 3.3 `PUT /api/tags/:id` — Update name/color
### 3.4 `DELETE /api/tags/:id` — Delete tag (removes from all books)
### 3.5 `POST /api/books/:id/tags` — Add tags to book `{ tagIds: [...] }`
### 3.6 `DELETE /api/books/:id/tags/:tagId` — Remove tag from book
### 3.7 `GET /api/tags/:id/books` — All books with a specific tag

---

## 4. Frontend Components

### 4.1 `app/src/components/book/TagManager.tsx`
**Location:** BookPage — small tag pills below reading status  
**Features:** Inline tag pills with "+" button to add, autocomplete from existing tags, create new inline

### 4.2 `app/src/components/TagsPage.tsx`
**Route:** `/my-tags`  
Tag cloud view, click tag → filtered book grid

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/custom-tags.spec.ts`

- [ ] Tag pills visible on book page for authenticated user
- [ ] "+" button opens tag picker
- [ ] Creating new tag from picker works
- [ ] Adding existing tag to book works
- [ ] Removing tag from book works
- [ ] Tags page shows all user tags with counts
- [ ] Clicking tag shows filtered books
- [ ] Deleting tag removes from all books
- [ ] Tag color picker works
- [ ] Mobile: Tag pills wrap properly
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `POST /api/tags` → 201
- [ ] Duplicate name → 409
- [ ] `POST /api/books/:id/tags` → 200
- [ ] `GET /api/tags` → user's tags with counts
- [ ] `DELETE` tag → cascades to book_user_tags
- [ ] Tag name max length enforced (100 chars)
- [ ] Without auth → 401

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Private user tags on books
- [ ] Tag management page
- [ ] Filter books by tag
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Tags CRUD + book tagging
- [ ] **Frontend** — TagManager + TagsPage
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
