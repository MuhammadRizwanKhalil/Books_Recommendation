# Feature 33: Year in Books

**Phase:** 8 — Gamification & Insights  
**Priority:** P18 (Strategic Engagement)  
**Competitors:** Goodreads ✅ ("Year in Books"), StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Annual reading recap — a shareable, visually rich summary of a user's reading year. Goodreads' "Year in Books" generates massive social sharing in December-January. Shows: total books, total pages, average rating, genre breakdown, shortest/longest book, reading pace chart, favorite book, and a shareable card.

---

## 2. Database Changes

**None** — Aggregated from existing tables (reading_progress, reviews, books).

---

## 3. API Endpoints

### 3.1 `GET /api/users/:id/year-in-books/:year`
**Auth:** Public (if user profile is public)  
**Response:**
```json
{
  "year": 2026,
  "totalBooks": 42,
  "totalPages": 12480,
  "averageRating": 3.8,
  "genreBreakdown": [{ "genre": "Fiction", "count": 18 }, ...],
  "shortestBook": { "title": "...", "pages": 120 },
  "longestBook": { "title": "...", "pages": 890 },
  "monthlyBreakdown": [{ "month": "Jan", "booksRead": 3 }, ...],
  "topRatedBooks": [...],
  "readingStreak": { "longest": 15, "current": 7 },
  "shareImageUrl": "/api/users/:id/year-in-books/2026/share-image"
}
```

### 3.2 `GET /api/users/:id/year-in-books/:year/share-image`
**Returns:** Generated PNG/JPEG card for social sharing (server-rendered)

---

## 4. Frontend Components

### 4.1 `app/src/components/YearInBooks.tsx`
**Route:** `/year-in-books/:year`  
**Features:**
- Animated scroll-through experience (like Spotify Wrapped)
- Stats cards with animations (Framer Motion)
- Genre pie chart (Recharts)
- Monthly reading bar chart
- Share buttons (Twitter, Instagram story, download image)
- Year selector dropdown

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/year-in-books.spec.ts`

- [ ] Year in Books page loads for authenticated user
- [ ] Total books and pages display correctly
- [ ] Genre breakdown chart renders
- [ ] Monthly breakdown chart renders
- [ ] Top rated books list shows
- [ ] Shortest/longest book cards display
- [ ] Share button generates shareable link
- [ ] Year selector switches between years
- [ ] User with 0 books → "Start reading to see your recap"
- [ ] Mobile: Cards stack vertically, charts resize
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/users/:id/year-in-books/2026` → 200 with stats
- [ ] Nonexistent year → empty stats (zeroes)
- [ ] Privacy: private user's stats → 403 (or limited)
- [ ] Genre breakdown sums to totalBooks
- [ ] Monthly breakdown has 12 entries

---

## 7. Dependencies

- **Benefits from Feature #10** (Reading Statistics Dashboard) for shared aggregation logic

---

## 8. Acceptance Criteria

- [ ] Annual recap with key stats
- [ ] Charts and visualizations
- [ ] Shareable image/link
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **API** — Year in Books aggregation endpoint
- [ ] **Share image** — Server-rendered social card
- [ ] **Frontend** — YearInBooks animated page
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
