# Feature 04: Author Section on Book Page

**Phase:** 1 — Book Page Foundation  
**Priority:** P5 (High-Priority Gap)  
**Competitors:** Goodreads ✅, Amazon ✅, Hardcover ✅, BookBub ✅  
**Status:** Not Started

---

## 1. Feature Overview

Display an inline "About the Author" section on the book detail page with photo, truncated bio, book count, follower count, and Follow button. Currently users must click through to the author page — an inline section increases engagement and keeps users on the book page longer.

**User Stories:**
- As a reader, I want to learn about the author without leaving the book page
- As a reader, I want to follow the author directly from the book page

---

## 2. Database Changes

**None** — Uses existing `authors` table + `reading_progress` for book count. May need:

```sql
-- If not already present, add follower count caching
ALTER TABLE authors ADD COLUMN follower_count INT NOT NULL DEFAULT 0;
ALTER TABLE authors ADD COLUMN book_count INT NOT NULL DEFAULT 0;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:slug` (extend existing)
**Change:** Include expanded author info:
```json
{
  "authorsData": [
    {
      "id": "uuid",
      "name": "Charles Duhigg",
      "slug": "charles-duhigg",
      "photoUrl": "https://...",
      "bio": "Charles Duhigg is a Pulitzer Prize-winning reporter...",
      "bookCount": 3,
      "followerCount": 1250,
      "isFollowed": false
    }
  ]
}
```

### 3.2 `POST /api/authors/:id/follow` (if not existing)
**Auth:** Required  
**Response:** `200` with `{ following: true, followerCount: 1251 }`

### 3.3 `DELETE /api/authors/:id/follow`
**Auth:** Required  
**Response:** `200` with `{ following: false, followerCount: 1250 }`

---

## 4. Frontend Components

### 4.1 `app/src/components/book/AuthorSection.tsx`
**Location:** Below description in BookPage.tsx (right column)  
**Props:** `{ authors: AuthorData[] }`  
**Renders:**
- "About the Author" heading
- Author photo (circular, 80px)
- Author name (linked to `/author/:slug`)
- Truncated bio (2-3 lines, "Show more" expand)
- "X books" count
- "X followers" count
- Follow/Unfollow button (toggles on click)
- Multiple authors: show each in a card stack

### 4.2 Updates to BookPage.tsx
Insert `<AuthorSection>` between description and reviews section.

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/author-section.spec.ts`

#### Happy Path
- [ ] Book page shows "About the Author" section
- [ ] Author photo is visible (or placeholder if no photo)
- [ ] Author name displayed and linked to author page
- [ ] Author bio text visible (truncated)
- [ ] "Show more" expands full bio
- [ ] Book count displayed (e.g., "3 books")
- [ ] Follow button visible for authenticated users
- [ ] Clicking Follow changes button to "Following"
- [ ] Clicking "Following" unfollows (toggle)
- [ ] Follower count updates after follow/unfollow

#### Edge Cases
- [ ] Author with no photo shows placeholder avatar
- [ ] Author with no bio shows just name and stats
- [ ] Author with very long bio truncates at 3 lines
- [ ] Book with multiple authors shows all author cards
- [ ] Author with 0 books shows "0 books" (shouldn't happen but graceful)
- [ ] Author with 0 followers shows "0 followers"

#### Error States
- [ ] Follow button not shown for unauthenticated users (or shows sign-in prompt)
- [ ] Network failure on follow shows error toast
- [ ] Author data missing gracefully hides section (no crash)

#### Responsive
- [ ] Mobile (375×812): Author section full width, photo + text stacked
- [ ] Tablet: Author section fits in right column
- [ ] Desktop: Author section in right column with photo left, text right

#### Accessibility
- [ ] Author photo has alt text with author name
- [ ] Follow button has ARIA label "Follow [Author Name]"
- [ ] Section has heading level h2 or h3
- [ ] Keyboard navigation: Tab to Follow button, Enter to toggle
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

### File: `tests/api/author-section.test.ts`

- [ ] `GET /api/books/:slug` includes `authorsData` with photo, bio, bookCount
- [ ] Author bio is present (non-empty string)
- [ ] `POST /api/authors/:id/follow` without auth → 401
- [ ] `POST /api/authors/:id/follow` with auth → 200 with `following: true`
- [ ] `DELETE /api/authors/:id/follow` with auth → 200 with `following: false`
- [ ] Double-follow is idempotent (doesn't increment count twice)
- [ ] Follow count reflects actual number

---

## 7. Dependencies

- **None** — Uses existing `authors` table

---

## 8. Acceptance Criteria

- [ ] "About the Author" section visible on book page
- [ ] Shows photo, name, bio, book count, follower count
- [ ] Follow/Unfollow toggle works for authenticated users
- [ ] Author name links to full author page
- [ ] Multi-author books show all authors
- [ ] All tests pass across 4 browsers
- [ ] Accessibility audit passes

## 9. Completion Tracking

- [ ] **Database** — Column additions (if needed)
- [ ] **API** — Extended book response + follow endpoints
- [ ] **Frontend** — AuthorSection component
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
