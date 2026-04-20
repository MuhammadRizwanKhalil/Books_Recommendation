# Existing Test Coverage Gaps — Backfill Plan

**Priority:** Pre-work (before new features)  
**Status:** Not Started

---

## 1. Overview

The current test suite has **133 tests across 10 files** but significant gaps exist. This document lists every untested area with specific test scenarios to write before building new features.

---

## 2. E2E Coverage Gaps

### 2.1 Categories Page (`/categories`, `/category/:slug`)
**File:** `tests/e2e/categories.spec.ts`

- [ ] Categories listing page loads with heading
- [ ] Category cards/tiles are visible with names
- [ ] Clicking a category navigates to `/category/:slug`
- [ ] Category detail page shows books in that category
- [ ] Category page shows book count
- [ ] Category page has pagination (if > 20 books)
- [ ] Category page SEO meta tags set correctly
- [ ] Breadcrumb navigation shows (Home > Categories > Category Name)
- [ ] Empty category shows appropriate message
- [ ] Mobile: category grid stacks to single column

### 2.2 Author Page (`/author/:slug`)
**File:** `tests/e2e/author.spec.ts`

- [ ] Author page loads with author name as heading
- [ ] Author bio/description visible
- [ ] Author's books are listed
- [ ] Author social links visible (if present)
- [ ] Follow author button visible (if logged in)
- [ ] Clicking a book navigates to book detail
- [ ] SEO meta tags set correctly
- [ ] Mobile layout works at 375×812

### 2.3 Reading Lists Page (`/lists`)
**File:** `tests/e2e/reading-lists.spec.ts`

- [ ] Page loads for authenticated user
- [ ] Redirects or shows message for unauthenticated user
- [ ] "Create List" button visible
- [ ] Existing lists displayed with names
- [ ] Clicking a list shows its books
- [ ] Public list URL accessible without auth (`/lists/public/:userId/:slug`)
- [ ] Empty state shown for new user with no lists

### 2.4 For You Page (`/for-you`)
**File:** `tests/e2e/for-you.spec.ts`

- [ ] Page loads with personalized heading
- [ ] Shows genre preferences prompt for new users
- [ ] Shows recommended books based on preferences
- [ ] Book cards are clickable and navigate correctly
- [ ] Works on mobile viewport

### 2.5 Book Comparison (`/compare`)
**File:** `tests/e2e/book-compare.spec.ts`

- [ ] Comparison page loads
- [ ] Can search and add books to compare
- [ ] Shows side-by-side comparison fields
- [ ] Can remove a book from comparison
- [ ] Empty state with instructions shown

### 2.6 Newsletter Submission
**File:** `tests/e2e/newsletter.spec.ts` (or extend homepage.spec.ts)

- [ ] Newsletter email input accepts text
- [ ] Submit button triggers subscription
- [ ] Success message shown after valid submit
- [ ] Invalid email shows error
- [ ] Duplicate email handled gracefully

### 2.7 Dark Mode Functional Test
**File:** `tests/e2e/theme.spec.ts`

- [ ] Theme toggle button is clickable
- [ ] Clicking toggle switches body class to dark/light
- [ ] Background color changes after toggle
- [ ] Theme persists after page reload
- [ ] Respects system preference on first load

### 2.8 User Login Happy Path (E2E)
**File:** extend `tests/e2e/auth.spec.ts`

- [ ] Register with new email succeeds → user avatar/name appears in nav
- [ ] Login with valid credentials → redirected / modal closes → user name visible
- [ ] Session persists on page refresh
- [ ] Logout clears session → Sign In button returns

### 2.9 Legal Pages (`/legal/:pageKey`)
**File:** `tests/e2e/legal.spec.ts`

- [ ] Privacy policy page loads (`/legal/privacy`)
- [ ] Terms of service page loads (`/legal/terms`)
- [ ] Content is non-empty
- [ ] Footer links to legal pages work

### 2.10 Pricing Page (`/pricing`)
**File:** `tests/e2e/pricing.spec.ts`

- [ ] Pricing page loads with tier cards (Free, Plus, Premium)
- [ ] Each tier shows features list
- [ ] CTA buttons visible on each tier
- [ ] Mobile layout stacks cards

---

## 3. API Coverage Gaps

### 3.1 Search API
**File:** `tests/api/search.test.ts`

- [ ] `GET /api/books/search?q=habit` returns results with required fields
- [ ] Empty query returns error or empty results
- [ ] Search with filters (category, rating range, year)
- [ ] Search pagination (page, limit params)
- [ ] Special characters in query handled safely (XSS/SQL injection)
- [ ] Search respects `status=PUBLISHED` filter

### 3.2 Newsletter API
**File:** `tests/api/newsletter.test.ts`

- [ ] `POST /api/newsletter/subscribe` with valid email → 200/201
- [ ] Subscribe with invalid email → 400
- [ ] Subscribe with duplicate email → appropriate response
- [ ] `POST /api/newsletter/unsubscribe` with valid email → 200
- [ ] Unsubscribe unknown email → 404
- [ ] Rate limiting enforced (5/hour)

### 3.3 Reviews API
**File:** `tests/api/reviews.test.ts`

- [ ] `GET /api/books/:slug/reviews` returns array with review fields
- [ ] Reviews include user info (name, avatar)
- [ ] Rating distribution included
- [ ] `POST /api/books/:slug/reviews` requires auth → 401 without token
- [ ] `POST` with valid token creates review → 201
- [ ] Duplicate review by same user → 409
- [ ] `PUT /api/reviews/:id` updates own review → 200
- [ ] `PUT /api/reviews/:id` on other's review → 403
- [ ] `DELETE /api/reviews/:id` deletes own review → 200
- [ ] Review validation: rating 1-5, content min 20 chars, title max 100 chars

### 3.4 Reading Lists API
**File:** `tests/api/reading-lists.test.ts`

- [ ] `GET /api/reading-lists` requires auth → 401 without token
- [ ] `GET /api/reading-lists` with auth returns user's lists
- [ ] `POST /api/reading-lists` creates new list → 201
- [ ] `POST /api/reading-lists/:id/books` adds book → 200
- [ ] `DELETE /api/reading-lists/:id/books/:bookId` removes book → 200
- [ ] `PUT /api/reading-lists/:id` updates list name/description → 200
- [ ] `DELETE /api/reading-lists/:id` deletes list → 200
- [ ] Free tier limit: max 3 lists → 403 on 4th
- [ ] Public list accessible without auth

### 3.5 Reading Progress API
**File:** `tests/api/reading-progress.test.ts`

- [ ] `GET /api/reading-progress` requires auth
- [ ] `PUT /api/reading-progress/:bookId` sets status → 200
- [ ] Valid statuses: 'want-to-read', 'reading', 'finished', 'none'
- [ ] Invalid status rejected → 400
- [ ] Reading progress includes book info in response

### 3.6 User Profile API
**File:** `tests/api/user-profile.test.ts`

- [ ] `GET /api/auth/me` returns user profile with all fields
- [ ] `PUT /api/auth/me` updates name → 200
- [ ] `PUT /api/auth/me` updates password (requires current password) → 200
- [ ] `PUT /api/auth/me` with wrong current password → 400/401
- [ ] Profile update rate limit enforced (10/15min)

### 3.7 Wishlist API
**File:** `tests/api/wishlist.test.ts`

- [ ] `GET /api/wishlist` requires auth
- [ ] `POST /api/wishlist/:bookId` adds to wishlist → 200/201
- [ ] `DELETE /api/wishlist/:bookId` removes from wishlist → 200
- [ ] Duplicate add handled gracefully
- [ ] Wishlist items include book info

### 3.8 Categories API
**File:** `tests/api/categories.test.ts`

- [ ] `GET /api/categories` returns array of categories
- [ ] Each category has id, name, slug, bookCount
- [ ] `GET /api/categories/:slug` returns category with books
- [ ] Category books are paginated
- [ ] Non-existent category slug → 404

### 3.9 Authors API
**File:** `tests/api/authors.test.ts`

- [ ] `GET /api/books/authors` returns array (existing test)
- [ ] `GET /api/authors/:slug` returns single author with details
- [ ] Author response includes books array
- [ ] Non-existent author slug → 404

---

## 4. Admin Panel Smoke Tests

### File: `tests/e2e/admin.spec.ts`

- [ ] Admin login page renders
- [ ] Non-admin user sees error on admin login
- [ ] Admin dashboard loads with stats
- [ ] Admin Books page lists books
- [ ] Admin Users page lists users
- [ ] Admin Blog page lists posts
- [ ] Admin Categories page loads
- [ ] Admin Reviews page loads
- [ ] Admin Settings page loads
- [ ] Admin Analytics page loads
- [ ] Admin Newsletter page shows subscribers
- [ ] Admin Email Marketing page loads
- [ ] Admin Authors page loads
- [ ] Admin Import page loads
- [ ] Admin Campaigns page loads

---

## 5. Performance & Accessibility

### File: `tests/e2e/accessibility.spec.ts`

- [ ] Homepage passes axe-core WCAG 2.1 AA audit
- [ ] Book detail page passes accessibility audit
- [ ] Blog page passes accessibility audit
- [ ] All interactive elements are keyboard-navigable (Tab, Enter, Escape)
- [ ] All images have alt text
- [ ] Color contrast meets WCAG AA requirements

---

## Acceptance Criteria

- [ ] All 30+ new E2E test scenarios written and passing
- [ ] All 40+ new API test scenarios written and passing
- [ ] Admin smoke tests (15) written and passing
- [ ] Accessibility tests for top 3 pages passing
- [ ] Total test count increases from 133 to ~220+
- [ ] No existing tests broken

## Completion Tracking

- [ ] **E2E gaps** — Categories, Author, Reading Lists, For You, Compare, Newsletter, Theme, Auth happy path, Legal, Pricing
- [ ] **API gaps** — Search, Newsletter, Reviews, Reading Lists, Progress, Profile, Wishlist, Categories detail, Authors detail
- [ ] **Admin gaps** — 15 smoke tests
- [ ] **Accessibility** — axe-core tests for 3 pages
- [ ] **CI passing** — All tests green in GitHub Actions
