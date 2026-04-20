# Feature 21: User Following

**Phase:** 5 — Social Features  
**Priority:** P7 (Critical Social Gap)  
**Competitors:** Goodreads ✅, Hardcover ✅, StoryGraph ✅, BookBub ✅  
**Status:** Done

---

## 1. Feature Overview

Allow users to follow other users to see their reviews, ratings, and activity. Foundation for the social graph — required by Activity Feed (#22) and Friends Reading This (#24).

---

## 2. Database Changes

### Migration: `server/src/migrations/031_user_following.ts`

```sql
CREATE TABLE user_follows (
  id VARCHAR(36) PRIMARY KEY,
  follower_id VARCHAR(36) NOT NULL,
  following_id VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_follow (follower_id, following_id),
  INDEX idx_follower (follower_id),
  INDEX idx_following (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users ADD COLUMN follower_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INT DEFAULT 0;
```

---

## 3. API Endpoints

### 3.1 `POST /api/users/:id/follow`
**Auth:** Required  
**Response:** `{ following: true, followerCount: 42 }`

### 3.2 `DELETE /api/users/:id/follow`
**Auth:** Required  
**Response:** `{ following: false, followerCount: 41 }`

### 3.3 `GET /api/users/:id/followers`
**Auth:** Optional  
**Query:** `?page=1&limit=20`

### 3.4 `GET /api/users/:id/following`
**Auth:** Optional  
**Query:** `?page=1&limit=20`

### 3.5 `GET /api/users/:id` (extend existing)
Add: `followerCount`, `followingCount`, `isFollowing` (if authenticated)

---

## 4. Frontend Components

### 4.1 `app/src/components/FollowButton.tsx`
**Location:** User profile page, review cards, author pages  
**States:** "Follow" → "Following" (with unfollow on hover "Unfollow")

### 4.2 Update `app/src/components/UserProfile.tsx`
**Add:** Follower/Following counts as links to lists  
**Add:** Followers/Following tabs

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/user-following.spec.ts`

#### Happy Path
- [ ] Follow button visible on other user's profile
- [ ] Clicking "Follow" changes to "Following"
- [ ] Follower count increments
- [ ] "Following" button changes to "Unfollow" on hover
- [ ] Clicking "Unfollow" reverts to "Follow"
- [ ] Followers tab shows list of followers
- [ ] Following tab shows list of followed users
- [ ] Follow button also works on review cards

#### Edge Cases
- [ ] Cannot follow yourself — button hidden on own profile
- [ ] Already following — button shows "Following" state
- [ ] Rapid follow/unfollow doesn't break count

#### Error/Responsive/Accessibility
- [ ] Unauthenticated: Follow button shows sign-in prompt
- [ ] Mobile: Follow button full width on profile page
- [ ] ARIA-pressed state on follow button
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `POST /api/users/:id/follow` without auth → 401
- [ ] Follow user → 200, following: true
- [ ] Follow same user again → 200 (idempotent)
- [ ] Follow yourself → 400
- [ ] `DELETE /api/users/:id/follow` → 200, following: false
- [ ] `GET /api/users/:id/followers` → paginated list
- [ ] `GET /api/users/:id/following` → paginated list
- [ ] User profile includes isFollowing flag

---

## 7. Dependencies

- **None** (foundation feature)
- **Required by:** #22 Activity Feed, #24 Friends Reading This

---

## 8. Acceptance Criteria

- [x] Follow/unfollow other users
- [x] Follower/following counts accurate
- [x] Follower/following lists browsable
- [x] All tests pass

## 9. Completion Tracking

- [x] **Database** — Migration run
- [x] **API** — Follow/unfollow + lists endpoints
- [x] **Frontend** — FollowButton + UserProfile update
- [x] **E2E Tests** — Passing
- [x] **API Tests** — Passing
- [ ] **Deployed** — Live
