# Feature 02: Mood Tags

**Phase:** 1 — Book Page Foundation  
**Priority:** P3 (Critical Gap — StoryGraph's #1 Differentiator)  
**Competitors:** Hardcover ✅, StoryGraph ✅, OpenLibrary ✅  
**Status:** Not Started

---

## 1. Feature Overview

Allow users to tag books with moods (Adventurous, Dark, Funny, Hopeful, etc.) and display community-voted mood percentages on book detail pages. This powers mood-based discovery — "I want something lighthearted and fast-paced" — which is how real readers choose books.

**Mood Taxonomy (12 predefined):**
Adventurous · Dark · Emotional · Funny · Hopeful · Informative · Inspiring · Lighthearted · Mysterious · Romantic · Sad · Tense

**User Stories:**
- As a reader, I want to see what moods others associate with this book
- As a reader who has finished a book, I want to vote on its moods
- As a reader, I want to discover books by mood ("What mood are you in?")

---

## 2. Database Changes

### Migration: `server/src/migrations/016_mood_tags.ts`

```sql
CREATE TABLE mood_taxonomy (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  emoji VARCHAR(10) DEFAULT NULL,
  color VARCHAR(7) DEFAULT NULL COMMENT 'Hex color for pill display',
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO mood_taxonomy (id, name, slug, emoji, color, display_order) VALUES
  (UUID(), 'Adventurous', 'adventurous', '🗺️', '#F59E0B', 1),
  (UUID(), 'Dark', 'dark', '🌑', '#1F2937', 2),
  (UUID(), 'Emotional', 'emotional', '💔', '#EC4899', 3),
  (UUID(), 'Funny', 'funny', '😂', '#10B981', 4),
  (UUID(), 'Hopeful', 'hopeful', '🌅', '#6366F1', 5),
  (UUID(), 'Informative', 'informative', '📚', '#3B82F6', 6),
  (UUID(), 'Inspiring', 'inspiring', '✨', '#8B5CF6', 7),
  (UUID(), 'Lighthearted', 'lighthearted', '☀️', '#FBBF24', 8),
  (UUID(), 'Mysterious', 'mysterious', '🔮', '#7C3AED', 9),
  (UUID(), 'Romantic', 'romantic', '❤️', '#EF4444', 10),
  (UUID(), 'Sad', 'sad', '😢', '#6B7280', 11),
  (UUID(), 'Tense', 'tense', '😰', '#DC2626', 12);

CREATE TABLE book_mood_votes (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  mood_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (mood_id) REFERENCES mood_taxonomy(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_book_mood_user (book_id, mood_id, user_id),
  INDEX idx_book_moods (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/moods`
**Auth:** None (public)  
**Response:**
```json
[
  { "id": "uuid", "name": "Adventurous", "slug": "adventurous", "emoji": "🗺️", "color": "#F59E0B" }
]
```

### 3.2 `GET /api/books/:id/moods`
**Auth:** Optional (to show user's own votes)  
**Response:**
```json
{
  "totalVotes": 150,
  "moods": [
    { "id": "uuid", "name": "Adventurous", "slug": "adventurous", "emoji": "🗺️", "color": "#F59E0B", "votes": 87, "percentage": 58, "userVoted": true },
    { "id": "uuid", "name": "Lighthearted", "slug": "lighthearted", "emoji": "☀️", "color": "#FBBF24", "votes": 45, "percentage": 30, "userVoted": false }
  ]
}
```

### 3.3 `POST /api/books/:id/moods/vote`
**Auth:** Required  
**Rate Limit:** 30 votes per 15 minutes  
**Body:** `{ moodIds: ["uuid1", "uuid2"] }` (max 5 moods per book per user)  
**Response:** `200` with updated moods

### 3.4 `DELETE /api/books/:id/moods/vote/:moodId`
**Auth:** Required  
**Response:** `200`

### 3.5 `GET /api/books/discover/mood/:slug`
**Auth:** None  
**Query:** `?page=1&limit=20`  
**Response:** Paginated books most-voted for this mood, sorted by vote count desc

---

## 4. Frontend Components

### 4.1 `app/src/components/book/MoodTags.tsx`
**Location:** Below category badges in BookPage.tsx  
**Props:** `{ bookId: string }`  
**Features:**
- Display mood pills with emoji, name, vote percentage
- Color-coded pills matching mood taxonomy
- Percentage bar behind each pill (like StoryGraph)
- "Vote on moods" button for authenticated users → opens modal
- Show "You voted" indicator on user's selections
- Sorted by vote percentage descending, top 5 shown with "Show all" expand

### 4.2 `app/src/components/book/MoodVoteModal.tsx`
**Trigger:** Click "Vote on moods" in MoodTags  
**Features:**
- Grid of all 12 moods with emoji + name
- Select up to 5 moods (checkbox-style)
- Show currently selected count "3 of 5"
- Submit button sends all selected moods
- Pre-select user's previous votes for editing

### 4.3 `app/src/components/MoodDiscoveryPage.tsx`
**Route:** `/discover/mood` or extend `/for-you`  
**Features:**
- "What mood are you in?" heading
- Grid of mood cards (emoji + name + color)
- Click a mood → shows BookGrid filtered by that mood
- Combine moods for multi-mood filtering

### 4.4 API Client: `app/src/api/client.ts`
```typescript
export const moodApi = {
  getAll: () => fetchApi('/api/moods'),
  getForBook: (bookId: string) => fetchApi(`/api/books/${bookId}/moods`),
  vote: (bookId: string, moodIds: string[]) => fetchApi(`/api/books/${bookId}/moods/vote`, { method: 'POST', body: { moodIds } }),
  removeVote: (bookId: string, moodId: string) => fetchApi(`/api/books/${bookId}/moods/vote/${moodId}`, { method: 'DELETE' }),
  discoverByMood: (slug: string, page?: number) => fetchApi(`/api/books/discover/mood/${slug}?page=${page || 1}`),
};
```

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/mood-tags.spec.ts`

#### Happy Path
- [ ] Book detail page shows mood tags section
- [ ] Mood pills display with emoji, name, and percentage
- [ ] Moods are sorted by highest percentage first
- [ ] Top 5 moods shown; "Show all" expands remaining
- [ ] Clicking "Vote on moods" opens modal (authenticated user)
- [ ] Modal shows all 12 moods in a grid
- [ ] Selecting moods updates count display "3 of 5"
- [ ] Submitting votes updates mood percentages on page
- [ ] User's voted moods show "You voted" indicator
- [ ] Re-opening modal pre-selects user's previous votes

#### Edge Cases
- [ ] Book with zero mood votes shows "Be the first to add moods" message
- [ ] Book with exactly 1 mood vote shows correct percentage (100%)
- [ ] Max 5 moods selected — 6th selection disabled or shows warning
- [ ] Very short book slug with special characters loads correctly
- [ ] Mood pills with 0% don't display (only show voted moods)
- [ ] Percentages sum to ~100% (rounding tolerance)

#### Error States
- [ ] "Vote on moods" button not shown for unauthenticated users (or shows sign-in prompt)
- [ ] Voting without auth returns error and shows sign-in modal
- [ ] Network failure during vote shows error toast
- [ ] Empty moodIds submission shows validation error

#### Responsive
- [ ] Mobile (375×812): Mood pills wrap to multiple lines
- [ ] Mobile: Vote modal is full-screen or bottom sheet
- [ ] Tablet: Mood pills in 2 rows max
- [ ] Desktop: Mood pills in single row with expand

#### Accessibility
- [ ] Mood pills are keyboard navigable
- [ ] Vote modal traps focus when open
- [ ] Screen reader announces mood name and percentage
- [ ] Color is not the only indicator (emoji + text always present)
- [ ] axe-core audit passes

#### Mood Discovery Page
- [ ] `/discover/mood` page loads with mood grid
- [ ] Clicking a mood card shows books with that mood
- [ ] Book results include covers, titles, ratings
- [ ] Back navigation returns to mood grid
- [ ] Multiple mood selection filters correctly

---

## 6. API Test Scenarios (Vitest)

### File: `tests/api/moods.test.ts`

#### `GET /api/moods`
- [ ] Returns 200 with array of 12 moods
- [ ] Each mood has: id, name, slug, emoji, color
- [ ] Moods sorted by display_order

#### `GET /api/books/:id/moods`
- [ ] Returns 200 with totalVotes and moods array
- [ ] Each mood entry has: name, slug, votes, percentage
- [ ] Percentages are integers (0-100)
- [ ] Without auth: `userVoted` is always false
- [ ] With auth: `userVoted` reflects user's votes
- [ ] Book with no votes returns `{ totalVotes: 0, moods: [] }`

#### `POST /api/books/:id/moods/vote`
- [ ] Without auth → 401
- [ ] With auth + valid moodIds → 200
- [ ] Empty moodIds array → 400
- [ ] More than 5 moodIds → 400
- [ ] Invalid mood ID → 400
- [ ] Duplicate vote (re-submit same mood) handled idempotently
- [ ] Rate limit enforced: 31st vote in 15min → 429

#### `DELETE /api/books/:id/moods/vote/:moodId`
- [ ] Without auth → 401
- [ ] Valid removal → 200
- [ ] Removing non-existent vote → 404 or 200 (idempotent)

#### `GET /api/books/discover/mood/:slug`
- [ ] Returns paginated books sorted by vote count for that mood
- [ ] Valid mood slug returns books
- [ ] Invalid mood slug → 404
- [ ] Pagination works (page, limit, total, totalPages)

---

## 7. Dependencies

- **None** — Fully independent feature

---

## 8. Acceptance Criteria

- [ ] 12 predefined moods seeded in database
- [ ] Mood pills with percentages display on book detail page
- [ ] Authenticated users can vote on up to 5 moods per book
- [ ] Vote percentages update in real-time after voting
- [ ] User can change their votes
- [ ] Mood discovery page shows books by mood
- [ ] Unauthenticated users see moods but cannot vote
- [ ] All E2E tests pass across 4 browsers
- [ ] All API tests pass
- [ ] Accessibility audit passes

## 9. Completion Tracking

- [ ] **Database** — Migration + seed data run
- [ ] **API** — moods routes created and tested
- [ ] **Frontend** — MoodTags, MoodVoteModal, MoodDiscoveryPage
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
