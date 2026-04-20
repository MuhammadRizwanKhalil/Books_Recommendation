# Feature 06: Inline Rating Widget

**Phase:** 1 — Book Page Foundation  
**Priority:** P10 (High-Priority Gap)  
**Competitors:** Goodreads ✅, Hardcover ✅, StoryGraph ✅, OpenLibrary ✅  
**Status:** Not Started

---

## 1. Feature Overview

Add a quick inline star-picker in the book header area so users can rate a book immediately without scrolling to the reviews section. All major competitors show this prominently. Supports rating-only (no review text required).

**User Stories:**
- As a reader, I want to quickly rate a book without writing a full review
- As a reader, I want to see my current rating at the top of the page

---

## 2. Database Changes

**None** — Uses existing `reviews` table. Reviews with `rating` but empty `title` and `content` are "rating-only" reviews.

Verify existing schema supports this:
```sql
-- reviews table already allows NULL title/content? If not:
ALTER TABLE reviews MODIFY title VARCHAR(255) DEFAULT NULL;
ALTER TABLE reviews MODIFY content TEXT DEFAULT NULL;
```

---

## 3. API Endpoints

### 3.1 `POST /api/books/:slug/rate` (new convenience endpoint)
**Auth:** Required  
**Body:** `{ rating: 4 }` (integer 1-5, or decimal 0.5-5.0 after Feature #07)  
**Logic:**
- If user already has a review → update rating only
- If user has no review → create review with rating only (no title/content)
**Response:** `200` with `{ reviewId, rating, isNew }`

### 3.2 `GET /api/books/:slug` (extend)
**Change:** Include `userRating: 4` field when authenticated user has rated this book.

---

## 4. Frontend Components

### 4.1 `app/src/components/book/InlineRatingWidget.tsx`
**Location:** Next to the star display in BookPage.tsx header  
**Props:** `{ bookSlug: string, userRating?: number, onRate: (rating: number) => void }`  
**Renders:**
- 5 interactive stars (hover to preview, click to rate)
- If user has already rated: stars filled to their rating, "Your rating: 4★" label
- "Rate this book" text for unrated state
- Hover effect: stars fill as cursor moves across them
- Click sends rating immediately (optimistic UI)
- After rating: brief "Rated!" confirmation animation

### 4.2 Integration with BookPage.tsx
- Appears alongside the existing static rating display
- Static display shows community average; widget shows personal rating
- Layout: "⭐ 4.3 (1,200 ratings) · Your rating: ⭐⭐⭐⭐"

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/inline-rating.spec.ts`

#### Happy Path
- [ ] Book page shows inline rating widget for authenticated user
- [ ] Widget shows 5 empty/outlined stars initially (if unrated)
- [ ] Hovering over stars shows preview fill
- [ ] Clicking a star submits rating
- [ ] After rating, stars remain filled at selected level
- [ ] "Your rating: X" label updates
- [ ] Rating persists on page reload
- [ ] Changing rating (click different star) updates immediately
- [ ] Rating also appears in the reviews section below

#### Edge Cases
- [ ] User who already has a full review sees their rating pre-filled
- [ ] Rating 1 star works (minimum)
- [ ] Rating 5 stars works (maximum)
- [ ] Rapid clicks (double-click) don't create duplicate reviews
- [ ] Mobile tap on star registers correctly

#### Error States
- [ ] Unauthenticated user sees prompt "Sign in to rate" instead of interactive stars
- [ ] Network failure during rating shows error, reverts star display
- [ ] Rating without completing auth modal doesn't persist

#### Responsive
- [ ] Mobile (375×812): Stars are touch-friendly size (min 44×44px tap target)
- [ ] Tablet: Stars fit in header layout
- [ ] Desktop: Stars inline with community rating

#### Accessibility
- [ ] Stars are keyboard navigable (Tab + Arrow keys)
- [ ] ARIA: `role="radiogroup"` with `role="radio"` for each star
- [ ] Screen reader: "Rate this book: 1 star, 2 stars, ... 5 stars. Currently 4 of 5 stars."
- [ ] Focus ring visible on keyboard navigation
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

### File: `tests/api/inline-rating.test.ts`

- [ ] `POST /api/books/:slug/rate` without auth → 401
- [ ] With auth + rating 4 → 200 with `{ isNew: true }`
- [ ] Re-rate with rating 3 → 200 with `{ isNew: false }`, rating updated
- [ ] Invalid rating 0 → 400
- [ ] Invalid rating 6 → 400
- [ ] Invalid rating "abc" → 400
- [ ] Non-existent book slug → 404
- [ ] `GET /api/books/:slug` with auth → includes `userRating` field
- [ ] `GET /api/books/:slug` without auth → `userRating` absent or null

---

## 7. Dependencies

- **None** (but benefits from Feature #07 Half-Star Ratings later)

---

## 8. Acceptance Criteria

- [ ] Interactive star-picker visible in book header for authenticated users
- [ ] One-click rating without writing review text
- [ ] Rating persists and displays on reload
- [ ] Can change rating by clicking different star
- [ ] Unauthenticated users see non-interactive prompt
- [ ] All tests pass across 4 browsers
- [ ] Accessibility audit passes (keyboard + screen reader)

## 9. Completion Tracking

- [ ] **Database** — Schema verified/updated for nullable review fields
- [ ] **API** — `/rate` endpoint created and tested
- [ ] **Frontend** — InlineRatingWidget component
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
