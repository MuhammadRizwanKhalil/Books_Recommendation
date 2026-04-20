# Feature 09: Annual Reading Challenge

**Phase:** 2 — Reading Engagement  
**Priority:** P1 (Critical — #1 engagement driver)  
**Competitors:** Goodreads ✅, StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Users set a yearly book goal (e.g., "Read 52 books in 2026"), track progress via visual progress bar, and see it on their profile. This is the single most engaging feature — driving daily return visits, social accountability, and viral sharing ("I'm 15 books ahead of schedule!").

---

## 2. Database Changes

### Migration: `server/src/migrations/020_reading_challenge.ts`

```sql
CREATE TABLE reading_challenges (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  year INT NOT NULL,
  goal_books INT NOT NULL DEFAULT 12 COMMENT 'Number of books to read',
  books_completed INT NOT NULL DEFAULT 0 COMMENT 'Cached count of finished books',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_year (user_id, year),
  INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/reading-challenge`
**Auth:** Required  
**Query:** `?year=2026` (defaults to current year)  
**Response:**
```json
{
  "id": "uuid",
  "year": 2026,
  "goalBooks": 52,
  "booksCompleted": 23,
  "percentComplete": 44,
  "onTrack": true,
  "booksAhead": 3,
  "projectedTotal": 55,
  "recentBooks": [
    { "id": "uuid", "title": "...", "slug": "...", "coverImage": "...", "finishedAt": "2026-04-01" }
  ]
}
```

### 3.2 `POST /api/reading-challenge`
**Auth:** Required  
**Body:** `{ year: 2026, goalBooks: 52 }`  
**Response:** `201` with challenge data

### 3.3 `PUT /api/reading-challenge/:id`
**Auth:** Required  
**Body:** `{ goalBooks: 60 }`  
**Response:** `200` with updated challenge

### 3.4 `GET /api/reading-challenge/:userId/public`
**Auth:** None (public)  
**Response:** Same structure but limited fields (no private data)

---

## 4. Frontend Components

### 4.1 `app/src/components/ReadingChallenge.tsx`
**Route:** `/reading-challenge`  
**Features:**
- Set/edit yearly goal
- Circular or linear progress bar (books_completed / goal_books)
- "23 of 52 books (44%)" label
- On-track/behind/ahead indicator with motivational message
- Grid of completed books this year with finish dates
- Share button → generate image card for social media

### 4.2 `app/src/components/ChallengeWidget.tsx`
**Location:** Homepage sidebar for logged-in users  
**Compact progress bar with goal + CTA to set goal if none exists

### 4.3 `app/src/components/ChallengeSetupModal.tsx`
**Trigger:** "Set Reading Goal" CTA  
- Number input for goal (min 1, max 999)
- Suggested goals: 12 (1/month), 24 (2/month), 52 (1/week)
- "Start Challenge" button

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/reading-challenge.spec.ts`

#### Happy Path
- [ ] Reading challenge page loads for authenticated user
- [ ] "Set Reading Goal" CTA shown when no challenge exists
- [ ] Setting goal to 52 creates challenge with progress bar
- [ ] Progress bar shows "0 of 52 (0%)" initially
- [ ] Finishing a book incrementBooksCompleted (test via reading status change)
- [ ] Progress bar updates after marking book as finished
- [ ] "On track" / "Behind" / "Ahead" message displays correctly
- [ ] Edit goal button allows changing target
- [ ] Recent completed books grid shows book covers
- [ ] Share button generates shareable card
- [ ] Challenge widget visible on homepage for logged-in users

#### Edge Cases
- [ ] Goal of 1 (minimum) works — shows "0 of 1"
- [ ] Goal of 999 (maximum) accepted
- [ ] User with 0 books shows empty state with encouragement
- [ ] User exceeding goal (60/52) shows celebration message
- [ ] Challenge page for previous year (2025) shows historical data
- [ ] No challenge exists for requested year → "Set a goal" prompt
- [ ] December 31 → challenge auto-suggests for next year

#### Error States
- [ ] Unauthenticated → redirect to sign in
- [ ] Goal of 0 → validation error
- [ ] Goal of -1 → validation error
- [ ] Non-numeric goal → validation error
- [ ] Network failure during save → error toast

#### Responsive
- [ ] Mobile (375×812): Progress bar stacks vertically, books grid 2 columns
- [ ] Tablet: 3-column book grid
- [ ] Desktop: Full layout with sidebar widget

#### Accessibility
- [ ] Progress bar has aria-valuenow, aria-valuemin, aria-valuemax
- [ ] Goal input has label
- [ ] Screen reader: "Reading challenge: 23 of 52 books, 44 percent complete"
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/reading-challenge` without auth → 401
- [ ] `GET /api/reading-challenge` with auth, no challenge → 404 or empty response
- [ ] `POST /api/reading-challenge` creates challenge → 201
- [ ] `POST` duplicate year → 409
- [ ] `POST` with goalBooks 0 → 400
- [ ] `POST` with goalBooks -1 → 400
- [ ] `PUT /api/reading-challenge/:id` updates goal → 200
- [ ] `GET` returns correct booksCompleted count
- [ ] booksCompleted updates when user marks book as finished
- [ ] `GET /api/reading-challenge/:userId/public` → public data visible
- [ ] percentComplete calculated correctly (round to integer)
- [ ] onTrack flag correct based on days elapsed vs books completed

---

## 7. Dependencies

- **None** (uses existing reading_progress to count finished books)

---

## 8. Acceptance Criteria

- [ ] Users can set annual reading goal
- [ ] Progress bar tracks books completed vs goal
- [ ] On-track/behind/ahead indicator works
- [ ] Goal is editable
- [ ] booksCompleted auto-increments when book marked as "finished"
- [ ] Share card generation works
- [ ] Homepage widget shows compact progress
- [ ] All tests pass across 4 browsers
- [ ] Accessibility audit passes

## 9. Completion Tracking

- [ ] **Database** — Migration created and run
- [ ] **API** — Challenge routes created and tested
- [ ] **Frontend** — ReadingChallenge page, Widget, SetupModal
- [ ] **Auto-increment** — Hook into reading_progress status change
- [ ] **Share card** — Social share image generation
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
