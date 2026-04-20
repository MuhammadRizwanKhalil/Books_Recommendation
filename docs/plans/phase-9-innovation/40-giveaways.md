# Feature 40: Giveaways

**Phase:** 9 — Innovation  
**Priority:** P20 (Strategic / Revenue)  
**Competitors:** Goodreads ✅ (Giveaways — major traffic driver), Amazon ✅  
**Status:** Not Started

---

## 1. Feature Overview

Book giveaways where publishers/authors offer free copies and users enter to win. Goodreads Giveaways is a massive traffic driver (millions of entries, adds books to TBR automatically). Revenue opportunity: charge publishers/authors for listing giveaways.

---

## 2. Database Changes

### Migration: `server/src/migrations/048_giveaways.ts`

```sql
CREATE TABLE giveaways (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT DEFAULT NULL,
  format ENUM('ebook', 'paperback', 'hardcover', 'audiobook') DEFAULT 'ebook',
  copies_available INT NOT NULL DEFAULT 1,
  entry_count INT DEFAULT 0,
  country_restriction VARCHAR(255) DEFAULT NULL COMMENT 'Comma-separated ISO codes, NULL=worldwide',
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  status ENUM('draft', 'active', 'ended', 'winners_selected') DEFAULT 'draft',
  auto_add_to_tbr BOOLEAN DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_active_giveaways (status, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE giveaway_entries (
  id VARCHAR(36) PRIMARY KEY,
  giveaway_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  is_winner BOOLEAN DEFAULT FALSE,
  entered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_giveaway_user (giveaway_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/giveaways` — Browse active giveaways `?sort=ending_soon|newest|popular`
### 3.2 `GET /api/giveaways/:id` — Giveaway details + entry status
### 3.3 `POST /api/giveaways/:id/enter` — Enter giveaway (auth required)
### 3.4 `POST /api/giveaways` — Create giveaway (author/admin)
### 3.5 `POST /api/giveaways/:id/select-winners` — Random winner selection (creator)
### 3.6 `GET /api/giveaways/my-entries` — User's giveaway entries + results

---

## 4. Frontend Components

### 4.1 `app/src/components/GiveawaysPage.tsx`
**Route:** `/giveaways`  
**Browse ending-soon, newest, genre-filtered giveaways with cover, title, copies, days remaining**

### 4.2 `app/src/components/GiveawayDetailPage.tsx`
**Route:** `/giveaways/:id`  
**Enter button, entry count, countdown timer, winner announcement**

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/giveaways.spec.ts`

- [ ] Giveaways page lists active giveaways
- [ ] Giveaway cards show title, book, copies, days remaining
- [ ] Enter giveaway button works for authenticated users
- [ ] "Already entered" state after entering
- [ ] Book auto-added to want-to-read (if enabled)
- [ ] Ended giveaway shows "Giveaway ended"
- [ ] Winner announcement visible to winners
- [ ] Unauthenticated: "Sign in to enter" prompt
- [ ] My entries page shows entered giveaways + results
- [ ] Mobile: Cards stack, enter button full-width
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/giveaways` → only active giveaways
- [ ] `POST /api/giveaways/:id/enter` → 200
- [ ] Duplicate entry → 409
- [ ] Enter ended giveaway → 400
- [ ] Without auth → 401
- [ ] Select winners → randomly picks from entries
- [ ] Winners flagged in entries table
- [ ] Auto-add to TBR creates reading_progress entry

---

## 7. Dependencies

- **Benefits from Feature #39** (Author Self-Service) for author-created giveaways

---

## 8. Acceptance Criteria

- [ ] Browse and enter giveaways
- [ ] Random winner selection
- [ ] Auto-add to TBR works
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Giveaway CRUD + entry + winner selection
- [ ] **Frontend** — GiveawaysPage + GiveawayDetailPage
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
