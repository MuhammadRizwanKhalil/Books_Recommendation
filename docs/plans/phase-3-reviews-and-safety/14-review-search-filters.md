# Feature 14: Review Search & Filters

**Phase:** 3 — Reviews & Safety  
**Priority:** P13 (High-Priority Gap)  
**Competitors:** Goodreads ✅, Amazon ✅, StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Add the ability to search within reviews, filter by star rating, and sort by multiple criteria on the book detail page. Currently reviews only sort by helpful/newest/oldest/highest/lowest — no text search or star filter.

---

## 2. Database Changes

### Migration: `server/src/migrations/025_review_search.ts`

```sql
-- Add FULLTEXT index for review search
ALTER TABLE reviews ADD FULLTEXT INDEX ft_review_content (title, content);
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:slug/reviews` (extend existing)
**New query params:**
- `q` — Full-text search query (searches title + content)
- `rating` — Filter by exact rating (e.g., `rating=5` or `rating=4.5`)
- `minRating` / `maxRating` — Range filter
- `sort` — `helpful`, `newest`, `oldest`, `highest`, `lowest` (existing)
- `hasSpoiler` — `true`/`false` filter
- `page`, `limit` — Pagination (existing)

**Response:** Same structure + `totalFiltered` count

---

## 4. Frontend Components

### 4.1 `app/src/components/book/ReviewFilters.tsx`
**Location:** Above review list in BookReviews.tsx  
**Features:**
- Search input with debounced typing (300ms)
- Star filter buttons: All / 5★ / 4★ / 3★ / 2★ / 1★
- Sort dropdown (existing, but now alongside filters)
- Active filter pills with "×" clear buttons
- "X reviews matching filters" count
- Clear all filters button

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/review-filters.spec.ts`

#### Happy Path
- [ ] Review filters section visible on book detail page
- [ ] Search input accepts text and filters reviews
- [ ] Typing "excellent" shows only reviews containing "excellent"
- [ ] Star filter buttons filter to that rating
- [ ] Clicking 5★ shows only 5-star reviews
- [ ] Combining search + star filter works
- [ ] "Clear all" resets to full review list
- [ ] Filtered count updates (e.g., "3 of 50 reviews")
- [ ] Sort dropdown works with active filters

#### Edge Cases
- [ ] Search with no results shows "No reviews match your search"
- [ ] Star filter with 0 reviews for that rating shows empty state
- [ ] Search with special characters doesn't break
- [ ] Very long search query handled (truncated or max length)
- [ ] Rapid typing doesn't cause stale results (debounce)

#### Error/Responsive/Accessibility
- [ ] Mobile: Filters collapse into expandable panel
- [ ] Search input has placeholder and label
- [ ] Star filter buttons have ARIA-pressed state
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/books/:slug/reviews?q=excellent` returns filtered results
- [ ] `q` parameter triggers FULLTEXT search
- [ ] `rating=5` returns only 5-star reviews
- [ ] `minRating=3&maxRating=5` returns range
- [ ] Combining `q` + `rating` works
- [ ] Empty `q` returns all reviews
- [ ] SQL injection safe: `q='; DROP TABLE reviews; --` returns 0 results safely
- [ ] `hasSpoiler=false` excludes spoiler reviews
- [ ] Pagination works with filters

---

## 7. Dependencies

- **Benefits from Feature #13** (Spoiler Tags) for `hasSpoiler` filter

---

## 8. Acceptance Criteria

- [ ] Text search within reviews works
- [ ] Star rating filter works
- [ ] Filters combinable
- [ ] Clear all resets properly
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — FULLTEXT index added
- [ ] **API** — Query params on reviews endpoint
- [ ] **Frontend** — ReviewFilters component
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Deployed** — Live on production
