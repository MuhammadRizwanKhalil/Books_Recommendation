# Feature 24: Friends Reading This

**Phase:** 5 — Social Features  
**Priority:** P9 (High-Priority Engagement Gap)  
**Competitors:** Goodreads ✅ ("Friends who have read this"), Amazon ✅  
**Status:** Completed — 2026-04-14

---

## 1. Feature Overview

Show a "Friends Reading This" section on book detail pages displaying avatars of followed users who have rated, read, or are currently reading this book, with their ratings. Powerful social proof — "3 friends rated this 4.5 avg."

---

## 2. Database Changes

**None** — Query joins `user_follows` + `reading_progress` + `reviews`.

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/friends-activity`
**Auth:** Required  
**Response:**
```json
{
  "friends": [
    {
      "user": { "id": "uuid", "name": "Jane", "avatarUrl": "..." },
      "status": "read",
      "rating": 4.5,
      "reviewId": "uuid"
    }
  ],
  "friendsAvgRating": 4.3,
  "totalFriends": 3
}
```
**Query:**
```sql
SELECT u.id, u.name, u.avatar_url, rp.status, r.rating, r.id as review_id
FROM user_follows uf
JOIN users u ON uf.following_id = u.id
LEFT JOIN reading_progress rp ON rp.user_id = u.id AND rp.book_id = :bookId
LEFT JOIN reviews r ON r.user_id = u.id AND r.book_id = :bookId
WHERE uf.follower_id = :currentUserId
  AND (rp.id IS NOT NULL OR r.id IS NOT NULL)
```

---

## 4. Frontend Components

### 4.1 `app/src/components/book/FriendsReadingThis.tsx`
**Location:** Near top of BookPage.tsx (high visibility, social proof)  
**Features:**
- Avatar stack (overlapping circles, max 5 visible + "+X more")
- "3 friends rated this — 4.3 avg"
- Expandable list showing each friend's name, status, and rating
- Click friend → navigate to their profile
- Hidden if no friends have interacted with this book

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/friends-reading.spec.ts`

- [x] Section visible when friends have read/are reading the book
- [x] Avatar stack shows correct friend photos
- [x] "X friends rated this" text accurate
- [x] Friends average rating displayed
- [x] Expanding shows individual friend ratings
- [x] Click friend navigates to profile
- [x] Section hidden when no friends have interacted
- [x] Section hidden for unauthenticated users
- [x] Mobile: avatars smaller, list compact

---

## 6. API Test Scenarios (Vitest)

- [x] `GET /api/books/:id/friends-activity` without auth → 401
- [x] No friends → `{ friends: [], totalFriends: 0 }`
- [x] Friend with read status + rating → included
- [x] Friend wants-to-read without active reading or rating → excluded
- [x] Only followed users included (not followers)
- [x] `friendsAvgRating` calculated correctly

---

## 7. Dependencies

- **Requires Feature #21** (User Following)

---

## 8. Acceptance Criteria

- [x] Friends' activity visible on book pages
- [x] Avatar stack + average rating displayed
- [x] All tests pass

## 9. Completion Tracking

- [x] **API** — Friends-activity endpoint
- [x] **Frontend** — FriendsReadingThis component
- [x] **E2E Tests** — Passing
- [x] **API Tests** — Passing
- [ ] **Deployed** — Live
