# Feature 19: Characters List

**Phase:** 4 — Lists & Shelves  
**Priority:** P6 (Critical Book Page Gap)  
**Competitors:** Hardcover ✅ (25 characters with pages), OpenLibrary ✅ ("People" section)  
**Status:** Not Started

---

## 1. Feature Overview

Display a list of characters on book detail pages. Hardcover lists characters with names and links to dedicated character pages. Excellent for epic fantasy, sci-fi, and literary fiction with large casts.

---

## 2. Database Changes

### Migration: `server/src/migrations/029_characters.ts`

```sql
CREATE TABLE book_characters (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  role ENUM('protagonist', 'antagonist', 'supporting', 'minor') DEFAULT 'supporting',
  display_order INT DEFAULT 0,
  submitted_by VARCHAR(36) DEFAULT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_book_characters (book_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/characters`
**Auth:** None  
**Response:**
```json
{
  "characters": [
    { "id": "uuid", "name": "Bilbo Baggins", "description": "A hobbit...", "role": "protagonist" }
  ],
  "totalCharacters": 25
}
```

### 3.2 `POST /api/books/:id/characters` (community submission)
**Auth:** Required  
**Rate Limit:** 10 per hour  
**Body:** `{ name, description?, role? }`

### 3.3 Admin: `PUT /api/admin/characters/:id/approve`

---

## 4. Frontend Components

### 4.1 `app/src/components/book/CharactersList.tsx`
**Location:** Collapsible section in BookPage.tsx  
**Renders:** Grid of character cards with name, role badge, description  
**Default:** Show first 8, "Show all X characters" expand

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/characters.spec.ts`

- [ ] Book page shows characters section when characters exist
- [ ] Characters display name, role, description
- [ ] "Show all" expands full list
- [ ] Section hidden when no characters
- [ ] Community submit form works for authenticated users
- [ ] Submitted character shows "Pending approval" badge
- [ ] Mobile: Character cards stack in single column
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/books/:id/characters` → 200
- [ ] No characters → empty array
- [ ] `POST` without auth → 401
- [ ] `POST` with valid data → 201 (pending approval)
- [ ] Duplicate character name for same book → 409
- [ ] Admin approve sets is_approved=true

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Characters list on book page
- [ ] Community submissions with admin moderation
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Character endpoints
- [ ] **Frontend** — CharactersList component
- [ ] **Admin** — Approval UI
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
