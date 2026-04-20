# Feature 07: Half-Star Ratings

**Phase:** 2 — Reading Engagement  
**Priority:** P12 (Quick Win)  
**Competitors:** StoryGraph ✅ (0.25-star), LibraryThing ✅ (0.5-star)  
**Status:** Not Started

---

## 1. Feature Overview

Allow 0.5-star rating increments (e.g., 3.5 stars) instead of whole numbers only. "I can't decide between 3 and 4 stars" is a universal frustration. This is a **breaking change** affecting the reviews table, all rating displays, and all API responses.

---

## 2. Database Changes

### Migration: `server/src/migrations/018_half_star_ratings.ts`

```sql
-- Change rating column from INT to DECIMAL
ALTER TABLE reviews MODIFY COLUMN rating DECIMAL(2,1) NOT NULL;

-- Existing integer ratings (1-5) remain valid as DECIMAL (1.0-5.0)
-- No data migration needed — INT values auto-convert to DECIMAL
```

---

## 3. API Endpoints

### Changes to existing endpoints:
- `POST /api/books/:slug/reviews` — Accept `rating` as decimal (0.5 increments: 0.5, 1.0, 1.5, ... 5.0)
- `POST /api/books/:slug/rate` — Same decimal validation
- `GET /api/books/:slug` — `googleRating` and `computedScore` already decimal; `userRating` now decimal
- `GET /api/books/:slug/reviews` — Each review `rating` field is now decimal

### Validation (Zod):
```typescript
const ratingSchema = z.number().min(0.5).max(5).multipleOf(0.5);
```

---

## 4. Frontend Components

### 4.1 Update `StarRating` display component
- Render half-filled stars (CSS clip-path or two overlapping star SVGs)
- 3.5 → ★★★½☆

### 4.2 Update `InlineRatingWidget` (Feature #06)
- Allow clicking left half of star (0.5) vs right half (1.0)
- Or: hover-based preview with snap to 0.5 increments

### 4.3 Update `BookReviews.tsx` review form
- Star input supports half-star selection

### 4.4 Update all BookCard rating displays
- Render half-star for decimal values

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/half-star-ratings.spec.ts`

#### Happy Path
- [ ] Book detail page displays half-star ratings (e.g., 4.5 shows 4 full + 1 half)
- [ ] Rating widget allows selecting half-star values
- [ ] Clicking left side of star gives X.5, right side gives X.0
- [ ] Submitting 3.5 star review persists correctly
- [ ] Average rating display shows decimal (e.g., "4.3")
- [ ] Review cards show half-star display for decimal ratings

#### Edge Cases
- [ ] Rating 0.5 (minimum) works correctly
- [ ] Rating 5.0 (maximum) works correctly
- [ ] Existing whole-number ratings display unchanged (4.0 shows as 4 full stars)
- [ ] Average of mixed half/whole ratings calculates correctly
- [ ] Rating distribution bars handle decimal values

#### Error States
- [ ] Invalid rating 0.0 rejected
- [ ] Invalid rating 5.5 rejected
- [ ] Invalid rating 3.3 (not 0.5 multiple) rejected
- [ ] String rating rejected

#### Responsive
- [ ] Mobile stars large enough to tap half-star precision (consider simplified UI)
- [ ] Mobile: optional "slider" alternative for precise selection

#### Accessibility
- [ ] Half-star state announced by screen reader ("3 and a half stars")
- [ ] ARIA value reflects decimal (aria-valuenow="3.5")

---

## 6. API Test Scenarios (Vitest)

- [ ] `POST /api/books/:slug/reviews` with `rating: 3.5` → 201
- [ ] `POST` with `rating: 0.5` → 201 (minimum)
- [ ] `POST` with `rating: 5.0` → 201 (maximum)
- [ ] `POST` with `rating: 0` → 400
- [ ] `POST` with `rating: 5.5` → 400
- [ ] `POST` with `rating: 3.3` → 400
- [ ] `GET /api/books/:slug` returns decimal rating values
- [ ] `GET /api/books/:slug/reviews` returns decimal ratings per review
- [ ] Existing integer ratings still return correctly (backward compatible)

---

## 7. Dependencies

- **None** (but Feature #06 Inline Rating Widget should support this)

---

## 8. Acceptance Criteria

- [ ] Half-star (0.5 increment) ratings supported in all inputs
- [ ] Half-star visual display works (half-filled star SVG)
- [ ] All existing integer ratings display correctly
- [ ] Database migration runs without data loss
- [ ] All existing tests still pass (backward compatible)
- [ ] All new tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration ALTER column run
- [ ] **API** — Validation updated to accept decimals
- [ ] **Frontend** — StarRating, InlineRatingWidget, BookReviews updated
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Regression** — All 133 existing tests still pass
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
