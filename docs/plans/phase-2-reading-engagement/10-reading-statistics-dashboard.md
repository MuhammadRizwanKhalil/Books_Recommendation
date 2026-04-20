# Feature 10: Reading Statistics Dashboard

**Phase:** 2 — Reading Engagement  
**Priority:** P2 (Critical — StoryGraph's killer feature)  
**Competitors:** StoryGraph ✅ (rich charts), Goodreads ✅ (basic)  
**Status:** Not Started

---

## 1. Feature Overview

Visual dashboard showing reading habits over time — books per month, genre distribution, mood breakdown, rating distribution, pages read, reading pace, and streak tracking. StoryGraph's analytics-focused audience loves data about their habits.

---

## 2. Database Changes

### Migration: `server/src/migrations/021_reading_stats.ts`

```sql
-- Reading streaks tracking
CREATE TABLE reading_streaks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  current_streak_days INT NOT NULL DEFAULT 0,
  longest_streak_days INT NOT NULL DEFAULT 0,
  last_reading_date DATE DEFAULT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_streak (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Most stats are computed from existing tables (reading_progress, reviews, books).

---

## 3. API Endpoints

### 3.1 `GET /api/users/me/stats`
**Auth:** Required  
**Query:** `?year=2026` (optional, default = all time)  
**Response:**
```json
{
  "period": "2026",
  "booksRead": 23,
  "pagesRead": 7450,
  "averageRating": 3.8,
  "averagePageCount": 324,
  "shortestBook": { "title": "...", "pageCount": 120 },
  "longestBook": { "title": "...", "pageCount": 890 },
  "booksPerMonth": [
    { "month": "2026-01", "count": 4 },
    { "month": "2026-02", "count": 3 }
  ],
  "pagesPerMonth": [
    { "month": "2026-01", "pages": 1200 }
  ],
  "genreDistribution": [
    { "genre": "Fiction", "count": 10, "percentage": 43 },
    { "genre": "Self-Help", "count": 5, "percentage": 22 }
  ],
  "ratingDistribution": [
    { "rating": 5, "count": 5 },
    { "rating": 4, "count": 10 },
    { "rating": 3, "count": 6 },
    { "rating": 2, "count": 1 },
    { "rating": 1, "count": 1 }
  ],
  "streak": {
    "currentDays": 15,
    "longestDays": 42,
    "lastReadingDate": "2026-04-13"
  },
  "topAuthors": [
    { "name": "Brandon Sanderson", "booksRead": 4 }
  ],
  "readingPace": {
    "averageDaysPerBook": 8.5,
    "fastestBook": { "title": "...", "days": 2 },
    "slowestBook": { "title": "...", "days": 45 }
  }
}
```

### 3.2 `GET /api/users/:id/stats/public`
**Auth:** None  
**Response:** Subset of stats (no private data)

---

## 4. Frontend Components

### 4.1 `app/src/components/ReadingStatsPage.tsx`
**Route:** `/my-stats`  
**Features:**
- Year selector (tabs: 2024, 2025, 2026, All Time)
- Summary cards: books read, pages read, avg rating, streak
- Recharts line chart: books per month
- Recharts pie chart: genre distribution
- Recharts bar chart: rating distribution
- Top authors list
- Shortest/longest book cards
- Reading pace stats
- Share stats button

### 4.2 `app/src/components/StatsCard.tsx`
**Reusable stat card with icon, number, label, optional trend arrow**

### 4.3 `app/src/components/StreakWidget.tsx`
**Compact streak display for homepage sidebar**
- 🔥 15-day streak
- Calendar heatmap (like GitHub contribution graph)

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/reading-stats.spec.ts`

#### Happy Path
- [ ] Stats page loads for authenticated user
- [ ] Summary cards show: books read, pages read, avg rating, streak
- [ ] Books per month chart renders with data points
- [ ] Genre distribution pie chart renders with segments
- [ ] Rating distribution bar chart renders
- [ ] Year selector switches data between years
- [ ] "All Time" tab shows cumulative stats
- [ ] Top authors list shows names and book counts
- [ ] Reading pace section shows average days per book
- [ ] Share button works

#### Edge Cases
- [ ] New user with zero reading data sees encouraging empty state
- [ ] User with 1 book shows stats correctly (no divide-by-zero)
- [ ] Year with no reading data shows "No books read in 2024"
- [ ] User who only rates but doesn't track progress sees partial stats
- [ ] Very active reader (500+ books) charts perform well

#### Error States
- [ ] Unauthenticated → redirect to sign in
- [ ] API timeout shows graceful loading/error state
- [ ] Invalid year parameter shows current year

#### Responsive
- [ ] Mobile (375×812): Charts stack vertically, full width
- [ ] Mobile: Summary cards in 2×2 grid
- [ ] Tablet: 2-column chart layout
- [ ] Desktop: Full multi-column dashboard

#### Accessibility
- [ ] Charts have alternative text descriptions
- [ ] All data accessible without relying solely on color
- [ ] Screen reader: summary card values read correctly
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/users/me/stats` without auth → 401
- [ ] With auth → 200 with stats object
- [ ] booksRead is non-negative integer
- [ ] pagesRead is non-negative integer
- [ ] averageRating is decimal 0-5
- [ ] booksPerMonth is sorted chronologically
- [ ] genreDistribution percentages sum to ~100
- [ ] ratingDistribution has entries for relevant ratings
- [ ] streak fields are non-negative
- [ ] `?year=2026` filters to that year only
- [ ] `?year=9999` (no data) returns zeros
- [ ] Public stats endpoint returns limited fields

---

## 7. Dependencies

- **None** (uses existing reading_progress, reviews, books)

---

## 8. Acceptance Criteria

- [ ] Stats dashboard shows all chart types with real data
- [ ] Year filter works correctly
- [ ] Streak tracking accurate (updated on reading progress changes)
- [ ] Empty states for new users
- [ ] Charts render on all browsers
- [ ] Share functionality works
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Streaks table migration run
- [ ] **API** — Stats endpoint with aggregation queries
- [ ] **Frontend** — StatsPage with 6+ chart types
- [ ] **Streak logic** — Auto-update on reading progress change
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
