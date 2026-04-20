# Feature 34: Annual Choice Awards

**Phase:** 8 — Gamification & Insights  
**Priority:** P19 (Strategic Engagement)  
**Competitors:** Goodreads ✅ ("Goodreads Choice Awards" — iconic)  
**Status:** Not Started

---

## 1. Feature Overview

Annual community voting awards — "TheBookTimes Choice Awards 2026". Goodreads' Choice Awards drive massive traffic (millions of votes). Categories like "Best Fiction", "Best Mystery", "Best Debut Novel". Two rounds: nomination then final voting.

---

## 2. Database Changes

### Migration: `server/src/migrations/042_choice_awards.ts`

```sql
CREATE TABLE choice_awards (
  id VARCHAR(36) PRIMARY KEY,
  year YEAR NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  nomination_start DATE NOT NULL,
  nomination_end DATE NOT NULL,
  voting_start DATE NOT NULL,
  voting_end DATE NOT NULL,
  results_published BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE award_categories (
  id VARCHAR(36) PRIMARY KEY,
  award_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL COMMENT 'e.g. Best Fiction',
  display_order INT DEFAULT 0,
  FOREIGN KEY (award_id) REFERENCES choice_awards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE award_nominees (
  id VARCHAR(36) PRIMARY KEY,
  category_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  is_official BOOLEAN DEFAULT FALSE COMMENT 'Admin-nominated vs community',
  vote_count INT DEFAULT 0,
  is_winner BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (category_id) REFERENCES award_categories(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  UNIQUE KEY uq_category_book (category_id, book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE award_votes (
  id VARCHAR(36) PRIMARY KEY,
  nominee_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nominee_id) REFERENCES award_nominees(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_category_vote (user_id, nominee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/awards/:year` — Categories with nominees/results
### 3.2 `POST /api/awards/:year/categories/:catId/vote` — Vote for nominee
### 3.3 Admin: `POST /api/admin/awards` — Create award year
### 3.4 Admin: `POST /api/admin/awards/:id/categories` — Create category
### 3.5 Admin: `POST /api/admin/awards/categories/:catId/nominees` — Add nominee
### 3.6 Admin: `PUT /api/admin/awards/:id/publish-results`

---

## 4. Frontend Components

### 4.1 `app/src/components/ChoiceAwardsPage.tsx`
**Route:** `/awards/:year`  
**Features:** Category cards, book covers in each category, vote buttons (one per category), results with winner badges, progress bar showing vote counts

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/choice-awards.spec.ts`

- [ ] Awards page loads with categories
- [ ] Each category shows book nominations
- [ ] Vote button works (one vote per category)
- [ ] Vote count updates
- [ ] Cannot vote twice in same category
- [ ] Results display after voting period ends
- [ ] Winner badge displayed
- [ ] Unauthenticated: shows "Sign in to vote"
- [ ] Mobile: Category cards stack
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/awards/2026` → 200
- [ ] Vote during voting period → 200
- [ ] Vote outside period → 400
- [ ] Duplicate vote same category → 409
- [ ] Admin create award → 201
- [ ] Non-admin create → 403
- [ ] Published results include vote counts

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Annual awards with nomination and voting phases
- [ ] One vote per user per category
- [ ] Results publish with winners
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Awards CRUD + voting
- [ ] **Admin** — Awards management UI
- [ ] **Frontend** — ChoiceAwardsPage
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
