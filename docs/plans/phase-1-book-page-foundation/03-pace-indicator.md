# Feature 03: Pace Indicator

**Phase:** 1 — Book Page Foundation  
**Priority:** P3 (Critical Gap)  
**Competitors:** StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Display a Slow / Medium / Fast pace bar on book detail pages based on community votes. After marking a book as "Read" or "DNF", users can vote on pacing. StoryGraph popularized this feature — it helps readers set expectations and choose books matching their preferred reading pace.

**User Stories:**
- As a reader, I want to see how fast/slow-paced a book is before starting it
- As a reader who finished a book, I want to share my perception of its pace

---

## 2. Database Changes

### Migration: `server/src/migrations/017_pace_indicator.ts`

```sql
CREATE TABLE book_pace_votes (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  pace ENUM('slow', 'medium', 'fast') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_book_pace_user (book_id, user_id),
  INDEX idx_book_pace (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/pace`
**Auth:** Optional (to show user's vote)  
**Response:**
```json
{
  "totalVotes": 200,
  "slow": { "votes": 30, "percentage": 15 },
  "medium": { "votes": 100, "percentage": 50 },
  "fast": { "votes": 70, "percentage": 35 },
  "userVote": "medium"
}
```

### 3.2 `POST /api/books/:id/pace/vote`
**Auth:** Required  
**Rate Limit:** 30 per 15 minutes  
**Body:** `{ pace: "slow" | "medium" | "fast" }`  
**Response:** `200` with updated pace data

### 3.3 `DELETE /api/books/:id/pace/vote`
**Auth:** Required  
**Response:** `200`

---

## 4. Frontend Components

### 4.1 `app/src/components/book/PaceIndicator.tsx`
**Location:** Below MoodTags in BookPage.tsx  
**Props:** `{ bookId: string }`  
**Renders:**
- Horizontal bar divided into 3 segments (Slow | Medium | Fast)
- Segment widths proportional to vote percentages
- Color coding: Slow = blue, Medium = yellow, Fast = red
- Total vote count label
- Click to vote (authenticated) — highlights user's selection
- Tooltip on segment hover showing percentage

### 4.2 API Client
```typescript
export const paceApi = {
  getForBook: (bookId: string) => fetchApi(`/api/books/${bookId}/pace`),
  vote: (bookId: string, pace: 'slow' | 'medium' | 'fast') =>
    fetchApi(`/api/books/${bookId}/pace/vote`, { method: 'POST', body: { pace } }),
  removeVote: (bookId: string) =>
    fetchApi(`/api/books/${bookId}/pace/vote`, { method: 'DELETE' }),
};
```

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/pace-indicator.spec.ts`

#### Happy Path
- [ ] Book detail page shows pace indicator bar
- [ ] Bar displays 3 segments: Slow, Medium, Fast
- [ ] Segment widths reflect vote percentages
- [ ] Total vote count displayed
- [ ] Clicking a segment votes for that pace (authenticated)
- [ ] User's previous vote is highlighted
- [ ] Changing vote updates bar immediately (optimistic UI)

#### Edge Cases
- [ ] Book with zero pace votes shows "No pace data yet — be the first to vote"
- [ ] Book with all votes on one pace shows 100% single segment
- [ ] Equal votes (33/33/34) renders roughly equal segments
- [ ] Very low vote count (1 vote) shows correctly

#### Error States
- [ ] Unauthenticated click shows sign-in prompt (not error)
- [ ] Network failure during vote shows error toast, reverts optimistic update
- [ ] Invalid pace value rejected by API

#### Responsive
- [ ] Mobile (375×812): Bar stretches full width, labels visible
- [ ] Tablet: Bar maintains proportion
- [ ] Desktop: Bar contained within metadata column

#### Accessibility
- [ ] Bar segments have ARIA labels with percentages
- [ ] Keyboard users can Tab to each segment and press Enter to vote
- [ ] Screen reader announces "Pace: 15% slow, 50% medium, 35% fast"
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

### File: `tests/api/pace.test.ts`

- [ ] `GET /api/books/:id/pace` → 200 with slow/medium/fast percentages
- [ ] No votes returns `totalVotes: 0` with all percentages 0
- [ ] Without auth: `userVote` is null
- [ ] With auth: `userVote` reflects user's selection
- [ ] `POST /api/books/:id/pace/vote` without auth → 401
- [ ] With auth + valid pace → 200
- [ ] Invalid pace value → 400
- [ ] Changing vote (re-vote with different pace) → 200, old vote replaced
- [ ] `DELETE /api/books/:id/pace/vote` → 200
- [ ] Rate limit: 31st vote in 15min → 429

---

## 7. Dependencies

- **None** — Fully independent

---

## 8. Acceptance Criteria

- [ ] Pace bar visible on book detail page
- [ ] Three segments with correct proportional widths
- [ ] Authenticated users can vote and change their vote
- [ ] Vote percentages update after voting
- [ ] Unauthenticated users see bar but can't vote
- [ ] All E2E and API tests pass
- [ ] Accessibility audit passes

## 9. Completion Tracking

- [ ] **Database** — Migration created and run
- [ ] **API** — Pace routes created and tested
- [ ] **Frontend** — PaceIndicator component
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
