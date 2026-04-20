# Feature 17: Custom Lists — Add to List

**Phase:** 4 — Lists & Shelves  
**Priority:** P14 (High-Priority Gap)  
**Competitors:** Goodreads ✅, Amazon ✅, Hardcover ✅, StoryGraph ✅, OpenLibrary ✅  
**Status:** Not Started

---

## 1. Feature Overview

Add an "Add to List" button on book pages and book cards that opens a modal showing user's custom lists with checkboxes. All competitors except BookBub offer quick add-to-shelf from the book page. Existing reading_lists feature is the backend — this adds the critical frontend UX.

---

## 2. Database Changes

**None** — Uses existing `reading_lists` and `reading_list_items` tables.

---

## 3. API Endpoints

### 3.1 `GET /api/reading-lists/for-book/:bookId`
**Auth:** Required  
**Response:** User's lists with boolean `containsBook` flag:
```json
[
  { "id": "uuid", "name": "Summer Reads 2026", "containsBook": true, "itemCount": 15 },
  { "id": "uuid", "name": "Book Club Picks", "containsBook": false, "itemCount": 8 }
]
```

### 3.2 `POST /api/reading-lists/:listId/books/:bookId` (existing, verify)
### 3.3 `DELETE /api/reading-lists/:listId/books/:bookId` (existing, verify)

---

## 4. Frontend Components

### 4.1 `app/src/components/book/AddToListModal.tsx`
**Trigger:** "Add to List" button (📋 icon) on BookPage and BookCard  
**Features:**
- Shows all user's lists with checkboxes
- Pre-checked for lists already containing this book
- Toggle checkbox adds/removes book from list
- "Create New List" inline form at bottom
- Empty state: "No lists yet — create your first list"

### 4.2 `app/src/components/book/AddToListButton.tsx`
**Location:** Next to wishlist button on BookPage + BookCard  
**Compact icon button with tooltip "Add to List"

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/add-to-list.spec.ts`

#### Happy Path
- [ ] "Add to List" button visible on book page for authenticated users
- [ ] Clicking button opens modal with user's lists
- [ ] Lists already containing this book show checked checkboxes
- [ ] Checking a list adds book to that list
- [ ] Unchecking removes book from that list
- [ ] "Create New List" form creates list and auto-adds book
- [ ] Modal closes on backdrop click or Escape
- [ ] Success toast shows "Added to [List Name]"

#### Edge Cases
- [ ] User with 0 lists sees "Create your first list" prompt
- [ ] User at max list limit (free tier: 3) shows upgrade prompt
- [ ] Adding book already in list is idempotent
- [ ] Book in all lists shows all checked

#### Error/Responsive/Accessibility
- [ ] Unauthenticated: shows sign-in prompt
- [ ] Mobile: Modal as bottom sheet
- [ ] Modal traps focus, Escape closes
- [ ] Checkboxes have labels
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/reading-lists/for-book/:bookId` without auth → 401
- [ ] With auth → 200 with lists + containsBook flags
- [ ] `POST /api/reading-lists/:listId/books/:bookId` adds book → 200
- [ ] Duplicate add → 200 (idempotent)
- [ ] `DELETE` removes book → 200
- [ ] Free tier limit enforced for list creation

---

## 7. Dependencies

- **None** (uses existing reading_lists)

---

## 8. Acceptance Criteria

- [ ] "Add to List" button on book pages and cards
- [ ] Modal shows all lists with correct checked state
- [ ] Add/remove works in real-time
- [ ] Create new list from modal works
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **API** — for-book endpoint returning containsBook
- [ ] **Frontend** — AddToListModal, AddToListButton
- [ ] **Integration** — BookPage + BookCard buttons
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Deployed** — Live on production
