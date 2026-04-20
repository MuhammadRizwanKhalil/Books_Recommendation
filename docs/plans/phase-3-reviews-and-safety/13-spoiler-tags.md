# Feature 13: Spoiler Tags

**Phase:** 3 — Reviews & Safety  
**Priority:** P12 (Medium Gap)  
**Competitors:** Goodreads ✅, StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Allow reviewers to mark their review (or portions of it) as containing spoilers. Spoiler content is blurred/hidden by default and revealed on click. Protects readers from unwanted plot reveals.

---

## 2. Database Changes

### Migration: `server/src/migrations/024_spoiler_tags.ts`

```sql
ALTER TABLE reviews ADD COLUMN has_spoiler BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN spoiler_text TEXT DEFAULT NULL COMMENT 'Optional separate spoiler section';
```

---

## 3. API Endpoints

### Changes to existing:
- `POST /api/books/:slug/reviews` — Accept `hasSpoiler: boolean` and optional `spoilerText: string`
- `PUT /api/reviews/:id` — Same fields
- `GET /api/books/:slug/reviews` — Include `hasSpoiler` flag; `spoilerText` only sent when `?includeSpoilers=true`

---

## 4. Frontend Components

### 4.1 Update `BookReviews.tsx`
- Review form: "Contains spoilers" checkbox
- Optional spoiler text area (hidden behind checkbox)
- Review card: if `hasSpoiler`, show "⚠️ This review contains spoilers" with blurred content
- "Show spoiler" button reveals text with CSS transition
- CSS class `.spoiler-blur { filter: blur(5px); user-select: none; }`

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/spoiler-tags.spec.ts`

#### Happy Path
- [ ] Review form shows "Contains spoilers" checkbox
- [ ] Checking spoiler checkbox reveals spoiler text area
- [ ] Submitting review with spoiler flag saves correctly
- [ ] Review card shows blurred spoiler overlay
- [ ] "Show spoiler" button reveals content
- [ ] Non-spoiler reviews display normally (no blur)
- [ ] Re-hiding spoiler after reveal works

#### Edge Cases
- [ ] Review with hasSpoiler=true but empty spoilerText shows blur on main content
- [ ] Very long spoiler text renders correctly
- [ ] Multiple spoiler reviews on same book all independently controllable

#### Error/Responsive/Accessibility
- [ ] Mobile: Blur effect works on touch devices
- [ ] Spoiler button keyboard accessible (Enter to reveal)
- [ ] Screen reader announces "Spoiler content hidden. Press to reveal."
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `POST` review with `hasSpoiler: true` → 201 with flag saved
- [ ] `GET` reviews default excludes `spoilerText` content
- [ ] `GET` reviews with `?includeSpoilers=true` includes `spoilerText`
- [ ] `PUT` review can toggle `hasSpoiler` on existing review
- [ ] `hasSpoiler` defaults to false if not provided

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Reviewers can mark content as spoiler
- [ ] Spoiler content blurred by default
- [ ] Click to reveal works
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Spoiler fields in review CRUD
- [ ] **Frontend** — Spoiler checkbox + blur/reveal UI
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Deployed** — Live on production
