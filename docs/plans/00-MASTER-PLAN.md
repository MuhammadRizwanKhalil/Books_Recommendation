# TheBookTimes — Master Implementation Plan

**Version:** 1.0  
**Date:** April 13, 2026  
**Developer:** Solo  
**Source Documents:**
- `COMPETITIVE_ANALYSIS.md` (20 feature gaps)
- `BOOK_DETAIL_PAGE_COMPETITIVE_ANALYSIS.md` (38 feature gaps)

---

## Overview

This plan implements **40 competitive features** across **9 phases**, each with its own detailed document containing database migrations, API endpoints, frontend components, and exhaustive Playwright test scenarios.

---

## Phase Completion Tracker

### Pre-Work: Testing Infrastructure
- [x] `testing/00-test-infrastructure-setup.md` — Shared helpers, POM, fixtures, CI
- [x] `testing/01-existing-coverage-gaps.md` — Backfill 30+ untested areas

### Phase 1: Book Page Foundation (6 Features)
- [x] `01-series-information.md` — Series badge, position, all-books-in-series page
- [x] `02-mood-tags.md` — Community-voted mood tags with percentages
- [x] `03-pace-indicator.md` — Slow/Medium/Fast community-voted bar
- [x] `04-author-section-on-book-page.md` — Inline author bio, photo, book count
- [x] `05-reading-counts.md` — "X currently reading · Y want to read" stats
- [x] `06-inline-rating-widget.md` — Quick star-picker in book header

### Phase 2: Reading Engagement (6 Features)
- [x] `07-half-star-ratings.md` — 0.5-increment ratings (INT → DECIMAL)
- [x] `08-dnf-status.md` — "Did Not Finish" status + reason
- [x] `09-annual-reading-challenge.md` — Yearly book goal with progress
- [x] `10-reading-statistics-dashboard.md` — Charts, streaks, genre breakdown
- [x] `11-goodreads-csv-import.md` — Import reading history from Goodreads
- [x] `12-content-warnings.md` — Community-sourced trigger warnings

### Phase 3: Reviews & Safety (4 Features)
- [x] `13-spoiler-tags.md` — Spoiler blur/reveal toggle on reviews
- [x] `14-review-search-filters.md` — Search, star filter, sort within reviews
- [x] `15-review-comments.md` — Threaded replies on reviews
- [x] `16-featured-in-blog-crosslinks.md` — "Featured In" blog articles section

### Phase 4: Lists & Shelves (4 Features)
- [x] `17-custom-lists-add-to-list.md` — "Add to List" modal on book page
- [x] `18-community-voteable-lists.md` — Listopia-style public voteable lists
- [x] `19-characters-list.md` — Book characters with descriptions
- [x] `20-up-next-tbr-queue.md` — Prioritized 10-book TBR queue

### Phase 5: Social (4 Features)
- [x] `21-user-following.md` — Follow/unfollow users, followers list
- [x] `22-activity-feed.md` — Social feed of reading updates
- [x] `23-social-login.md` — Google + Apple OAuth2
- [x] `24-friends-reading-this.md` — "X friends reading this" badge

### Phase 6: Community (4 Features)
- [x] `25-discussion-forums.md` — Per-book threaded discussions
- [x] `26-community-prompts.md` — Book discussion prompts
- [x] `27-book-clubs-buddy-reads.md` — Create/join clubs, spoiler protection
- [x] `28-owned-books-tracking.md` — Mark books as owned (physical/digital)

### Phase 7: Advanced Book Page (4 Features)
- [x] `29-editions-browser.md` — Browse editions by format/language
- [x] `30-progress-tracker-bar.md` — Inline page/percent progress bar
- [x] `31-cover-zoom-gallery.md` — Lightbox cover zoom, pinch on mobile
- [x] `32-custom-user-tags.md` — Personal tags on books

### Phase 8: Viral & Events (4 Features)
- [x] `33-year-in-books.md` — Annual reading wrap-up with shareable cards
- [x] `34-annual-choice-awards.md` — Community-voted book awards
- [x] `35-reading-journal.md` — Private notes per book
- [x] `36-quizzes-trivia.md` — Fun book quizzes with shareable results

### Phase 9: Innovation (4 Features)
- [x] `37-story-arc-visualization.md` — Emotional pacing chart
- [x] `38-ai-mood-detection.md` — Auto-detect moods from reviews via AI
- [x] `39-author-self-service.md` — Author claim + dashboard portal
- [x] `40-giveaways.md` — Author-sponsored book giveaways

---

## Phase Dependencies

```
Phase 1 (Book Page)     ─── independent ───────────────────────┐
Phase 2 (Engagement)    ─── independent ──┬──→ Phase 7 (#30)   │
Phase 3 (Reviews)       ─── independent ──┤   Phase 8 (#33)    │
Phase 4 (Lists)         ←── benefits #18 ─┤                    │
Phase 5 (Social)        ─── independent ──┼──→ Phase 6 (all)   │
                                          │   Phase 9 (#39)    │
Phases 1-3: fully parallel               │                    │
Phase 6: requires Phase 5 complete       │                    │
Phase 8: requires Phase 2 data           └────────────────────┘
```

---

## Tech Stack Reference

| Layer | Technology | Key Files |
|-------|-----------|-----------|
| Database | MySQL 8.0 | `server/src/database.ts`, `server/src/migrations/` |
| Backend | Express.js 4.21 | `server/src/routes/`, `server/src/middleware.ts` |
| Frontend | React 19 + Vite | `app/src/components/`, `app/src/api/client.ts` |
| E2E Tests | Playwright | `tests/e2e/`, `playwright.config.ts` |
| API Tests | Vitest | `tests/api/`, `vitest.config.ts` |
| Styling | Tailwind 3.4 | `app/tailwind.config.js` |
| UI Components | Radix UI | `app/src/components/ui/` |
| Animation | Framer Motion 12 | Used in BookPage.tsx, BookCard.tsx |
| Charts | Recharts | For stats dashboard, year-in-books |

---

## Existing Test Coverage (133 tests)

| File | Tests | Area |
|------|-------|------|
| `tests/e2e/homepage.spec.ts` | 15 | Homepage sections, SEO, nav |
| `tests/e2e/book-detail.spec.ts` | 15 | Book page, SEO, recommendations |
| `tests/e2e/auth.spec.ts` | 6 | Auth modal, form fields |
| `tests/e2e/blog.spec.ts` | 8 | Blog listing, detail, SEO |
| `tests/e2e/responsive.spec.ts` | 8 | Mobile/tablet/desktop layouts |
| `tests/e2e/search.spec.ts` | 7 | Hero search, dropdown, navigation |
| `tests/api/auth.test.ts` | 15 | Login, register, protected routes |
| `tests/api/blog.test.ts` | 18 | Blog CRUD, pagination, AI status |
| `tests/api/books.test.ts` | 28 | Trending, top-rated, BOTD, detail |
| `tests/api/settings.test.ts` | 13 | Settings, analytics, caching, CORS |

---

## Document Template

Every feature document follows this structure:

1. **Feature Overview** — What, why, which competitors have it
2. **Database Changes** — Migration SQL with schemas, indexes, constraints
3. **API Endpoints** — Method, path, request/response, auth, rate limits
4. **Frontend Components** — File paths, props, state, component hierarchy
5. **Playwright E2E Tests** — Happy path, edge cases, errors, responsive, a11y
6. **API Tests (Vitest)** — Success, validation, auth, rate limits, edge cases
7. **Dependencies** — Which features must exist first
8. **Acceptance Criteria** — Checkboxes for done definition
9. **Completion Tracking** — Implementation, testing, review, deploy checkboxes

---

## Global Conventions

### Migration Naming
```
server/src/migrations/015_series_information.ts
server/src/migrations/016_mood_tags.ts
... (sequential from current 014)
```

### API Pattern
```typescript
// Route: server/src/routes/featureName.ts
router.get('/api/endpoint', optionalAuth(), async (req, res) => { ... });
router.post('/api/endpoint', authenticate(), rateLimit('action', 10, 900000), async (req, res) => { ... });
```

### Frontend Pattern
```typescript
// API client: app/src/api/client.ts → export const featureApi = { ... }
// Component: app/src/components/book/FeatureName.tsx
// Page: app/src/components/FeaturePage.tsx
// Hook: app/src/hooks/useFeature.ts (if complex state)
```

### Test Pattern
```typescript
// E2E: tests/e2e/feature-name.spec.ts
// API: tests/api/feature-name.test.ts
// Tags: test.describe('Feature Name @phase-1 @feature-name', () => { ... })
```
