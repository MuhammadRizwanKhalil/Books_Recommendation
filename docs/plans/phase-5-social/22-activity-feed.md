# Feature 22: Activity Feed

**Phase:** 5 — Social Features  
**Priority:** P8 (High-Priority Social Gap)  
**Competitors:** Goodreads ✅  
**Status:** Completed — 2026-04-14

---

## 1. Feature Overview

A personalized feed showing recent reading activity from users you follow: new reviews, ratings, books added to shelves, reading status changes. Goodreads' "Home" page centers entirely on this feed. This is the primary engagement/retention driver for social reading platforms.

---

## 2. Database Changes

### Migration: `server/src/migrations/034_activity_feed.ts`

```sql
CREATE TABLE user_activities (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  activity_type ENUM('review', 'rating', 'shelved', 'started', 'finished', 'dnf', 'progress', 'list_created', 'challenge_set') NOT NULL,
  book_id VARCHAR(36) DEFAULT NULL,
  reference_id VARCHAR(36) DEFAULT NULL COMMENT 'ID of review, list, etc.',
  metadata JSON DEFAULT NULL COMMENT 'Extra context per type',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_activity (user_id, created_at DESC),
  INDEX idx_activity_time (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/feed`
**Auth:** Required  
**Query:** `?page=1&limit=20&type=review,rating,shelved`  
**Logic:** Return activities from users the authenticated user follows, ordered by created_at DESC  
**Response:**
```json
{
  "activities": [
    {
      "id": "uuid",
      "type": "review",
      "user": { "id": "uuid", "name": "Jane", "avatarUrl": "..." },
      "book": { "id": "uuid", "title": "Atomic Habits", "coverImage": "..." },
      "metadata": { "rating": 4.5, "reviewExcerpt": "This book..." },
      "createdAt": "2026-04-10T..."
    }
  ],
  "hasMore": true
}
```

### 3.2 Activity creation is implicit — triggered by existing actions (hooks on review create, rating, reading_progress update, etc.)

---

## 4. Frontend Components

### 4.1 `app/src/components/ActivityFeed.tsx`
**Route:** `/feed` or homepage widget  
**Features:**
- Infinite scroll feed
- Activity cards vary by type (review card, rating card, shelved card)
- User avatar + name + action text ("Jane rated Atomic Habits ★★★★½")
- Book cover thumbnail
- Relative timestamps ("2 hours ago")
- Filter tabs: All / Reviews / Ratings / Shelved

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/activity-feed.spec.ts`

- [x] Feed page shows activities from followed users
- [x] Different activity types render correctly (review, rating, shelved, finished)
- [x] Feed is empty if following no one — shows "Follow readers to see their activity"
- [x] Filter tabs work (Reviews only, Ratings only, etc.)
- [x] Infinite scroll loads more activities
- [x] Clicking activity navigates to book/review
- [x] New activity appears after followed user takes action (covered by setup + live activity assertions)
- [x] Mobile: Feed cards full width
- [x] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [x] `GET /api/feed` without auth → 401
- [x] With auth but following nobody → empty array
- [x] After follow + followed user reviews → activity appears in feed
- [x] Filter by type works
- [x] Pagination returns correct pages
- [x] Activities from unfollowed users excluded
- [x] Activity auto-created on review creation
- [x] Activity auto-created on rating
- [x] Activity auto-created on reading status change

---

## 7. Dependencies

- **Requires Feature #21** (User Following) — must be completed first

---

## 8. Acceptance Criteria

- [x] Personalized feed from followed users
- [x] Multiple activity types rendered
- [x] Filter and pagination work
- [x] Activities auto-generated from user actions
- [x] All tests pass

## 9. Completion Tracking

- [x] **Database** — Migration run
- [x] **API** — Feed endpoint + activity triggers
- [x] **Backend hooks** — Activities created on reviews, ratings, shelving, progress
- [x] **Frontend** — ActivityFeed component
- [x] **E2E Tests** — Passing
- [x] **API Tests** — Passing
- [ ] **Deployed** — Live
