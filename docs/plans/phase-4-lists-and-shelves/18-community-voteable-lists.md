# Feature 18: Community-Voteable Lists

**Phase:** 4 — Lists & Shelves  
**Priority:** P16 (Medium Gap — massive SEO value)  
**Competitors:** Goodreads ✅ ("Listopia")  
**Status:** Not Started

---

## 1. Feature Overview

Community-created lists where anyone can vote books up/down. E.g., "Best Sci-Fi of All Time", "Books That Made You Cry". Goodreads Listopia drives massive organic traffic (top Google results) and user engagement.

---

## 2. Database Changes

### Migration: `server/src/migrations/028_community_lists.ts`

```sql
ALTER TABLE reading_lists ADD COLUMN is_community BOOLEAN DEFAULT FALSE;
ALTER TABLE reading_lists ADD COLUMN vote_count INT DEFAULT 0;
ALTER TABLE reading_lists ADD COLUMN view_count INT DEFAULT 0;
ALTER TABLE reading_lists ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;

CREATE TABLE list_book_votes (
  id VARCHAR(36) PRIMARY KEY,
  list_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  vote TINYINT NOT NULL DEFAULT 1 COMMENT '1=upvote, -1=downvote',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES reading_lists(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_list_book_vote (list_id, book_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/lists/discover`
**Auth:** None  
**Query:** `?page=1&limit=20&sort=popular|newest|featured&category=fiction`  
**Response:** Paginated community lists

### 3.2 `GET /api/lists/:id`
**Auth:** Optional  
**Response:** List with books sorted by vote score, user's votes included if authenticated

### 3.3 `POST /api/lists/:id/books/:bookId/vote`
**Auth:** Required  
**Body:** `{ vote: 1 }` (1 upvote, -1 downvote)

### 3.4 `POST /api/lists` (extend existing)
**Body addition:** `{ isCommunity: true }` — makes list publicly voteable

---

## 4. Frontend Components

### 4.1 `app/src/components/ListDiscoveryPage.tsx`
**Route:** `/lists/discover`  
**Listopia-style browsing: categories, trending lists, search**

### 4.2 `app/src/components/CommunityListPage.tsx`
**Route:** `/lists/:id`  
**Books with upvote/downvote arrows, sorted by score**

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/community-lists.spec.ts`

- [ ] Lists discovery page loads with community lists
- [ ] Lists show name, creator, book count, vote count
- [ ] Clicking list opens detail with books sorted by votes
- [ ] Upvote/downvote buttons work for authenticated users
- [ ] Vote score updates after voting
- [ ] Creating a community list from reading lists page
- [ ] Search within lists discovery
- [ ] Mobile: Lists card layout stacks

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/lists/discover` → 200 with community lists
- [ ] Only `is_community=true` lists returned
- [ ] Vote endpoint requires auth
- [ ] Upvote/downvote toggles correctly
- [ ] Book order reflects vote scores

---

## 7. Dependencies

- **Benefits from Phase 5 #21** (user following for "lists by people you follow")

---

## 8. Acceptance Criteria

- [ ] Community lists discoverable and browsable
- [ ] Voting on books within lists works
- [ ] Lists sorted by vote score
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Discovery, voting endpoints
- [ ] **Frontend** — ListDiscoveryPage, CommunityListPage
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Deployed** — Live on production
