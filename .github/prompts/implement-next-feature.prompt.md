---
description: "Continue implementing the next feature from TheBookTimes master plan queue. Reads PROGRESS.md, picks the next NOT STARTED feature, implements it fully, and marks it done."
agent: "agent"
model: "GPT-5 (copilot)"
---

# TheBookTimes — Implement Next Feature from Queue

You are implementing competitive features for **TheBookTimes** (a book recommendation platform) following a detailed 40-feature master plan.

## Project Context

- **Stack:** React 19 + Vite (frontend), Express.js + MySQL 8.0 (backend), Playwright (E2E), Vitest (API tests)
- **Frontend:** `app/src/` — components in `components/`, API client in `api/client.ts`, admin pages in `admin/`
- **Backend:** `server/src/` — routes in `routes/`, migrations in `migrations/`, middleware in `middleware/`
- **Tests:** `tests/` — E2E in `e2e/`, API tests in `api/`
- **Plans:** `docs/plans/` — each feature has a detailed spec document
- **Progress:** `docs/plans/PROGRESS.md` — tracks what's done and what's next
- **Master Plan:** [docs/plans/00-MASTER-PLAN.md](docs/plans/00-MASTER-PLAN.md) — global conventions, tech stack, patterns

## Your Workflow — Execute These Steps In Order

### Step 1: Read the Progress Tracker

Read `docs/plans/PROGRESS.md` and find the **first row with status `NOT STARTED`**. That is the feature you will implement now.

### Step 2: Read the Feature Spec

Read the full feature document from `docs/plans/`. The path mapping is:
- `testing/*` → `docs/plans/testing/`
- `phase-1/*` → `docs/plans/phase-1-book-page-foundation/`
- `phase-2/*` → `docs/plans/phase-2-reading-engagement/`
- `phase-3/*` → `docs/plans/phase-3-reviews-and-safety/`
- `phase-4/*` → `docs/plans/phase-4-lists-and-shelves/`
- `phase-5/*` → `docs/plans/phase-5-social/`
- `phase-6/*` → `docs/plans/phase-6-community/`
- `phase-7/*` → `docs/plans/phase-7-book-metadata-ux/`
- `phase-8/*` → `docs/plans/phase-8-gamification-insights/`
- `phase-9/*` → `docs/plans/phase-9-innovation/`

Read the **entire** document — every section. Do not skip anything.

### Step 3: Read the Master Plan Conventions

Read `docs/plans/00-MASTER-PLAN.md` for global conventions (migration naming, API patterns, frontend patterns, test patterns). Follow them exactly.

### Step 4: Understand Existing Code

Before writing any code, read the relevant existing files to understand patterns:
- `server/src/index.ts` — how routes are registered
- `server/src/routes/` — existing route patterns (pick one similar route file)
- `server/src/migrations/` — latest migration number (to pick the next one)
- `app/src/api/client.ts` — existing API client patterns
- `app/src/components/BookPage.tsx` — if the feature adds to the book detail page
- `app/src/App.tsx` — if the feature adds a new route/page
- Any file the feature spec says to modify

### Step 5: Implement — Database Migration

Create the migration file in `server/src/migrations/` following the spec exactly:
- Use the next sequential migration number
- Include all tables, indexes, foreign keys, and seed data from the spec
- Follow the existing migration pattern in the codebase

### Step 6: Implement — Backend API

Create or modify route files in `server/src/routes/`:
- Implement every endpoint listed in the spec
- Include authentication middleware where specified
- Include rate limiting where specified
- Include input validation (sanitize all user inputs)
- Include proper error responses
- Register the routes in `server/src/index.ts`

### Step 7: Implement — Frontend Components

Create or modify components as specified:
- Follow the component hierarchy from the spec
- Add API client methods to `app/src/api/client.ts`
- Add new routes to `app/src/App.tsx` if needed
- Use existing UI patterns (Tailwind, Radix UI, Framer Motion)
- Ensure responsive design (mobile-first)
- Ensure accessibility (ARIA labels, keyboard navigation)

### Step 8: Implement — Admin Interface

If the feature has admin functionality:
- Add or modify admin pages in `app/src/admin/`
- Add admin routes to the admin layout
- Include CRUD operations as specified

### Step 9: Write Tests

Create test files as specified in the feature doc:
- **E2E tests** in `tests/e2e/feature-name.spec.ts` — all scenarios from the spec
- **API tests** in `tests/api/feature-name.test.ts` — all scenarios from the spec
- Use shared helpers from `tests/helpers/` if they exist
- Use the tag pattern: `test.describe('Feature Name @phase-N @feature-name', ...)`
- Cover: happy path, validation errors, auth errors, edge cases, responsive, a11y

### Step 10: Update Progress Tracker

After ALL implementation is complete, update `docs/plans/PROGRESS.md`:
- Change the feature's status from `NOT STARTED` to `DONE`
- Add today's date in the Completed column
- Update the Stats section at the bottom (increment Completed, decrement Remaining)

Also update `docs/plans/00-MASTER-PLAN.md`:
- Check the checkbox `[x]` for the completed feature in the Phase Completion Tracker

### Step 11: Verify

- Run `Get-Errors` on all modified files to check for TypeScript/lint errors
- Fix any issues found
- Provide a summary of everything that was implemented

## Critical Rules

1. **Follow the spec document EXACTLY** — do not skip sections, do not improvise
2. **Read before writing** — always read existing files before modifying them
3. **One feature per run** — implement exactly one feature, then stop
4. **Sequential order** — always pick the FIRST `NOT STARTED` item from PROGRESS.md
5. **No placeholders** — every function must have real implementation, not TODOs
6. **No skipping tests** — tests are mandatory for every feature
7. **Update the tracker** — always mark progress when done
8. **Match existing patterns** — study the codebase before adding new code
9. **Security first** — validate inputs, use parameterized queries, sanitize output
10. **Commit-ready code** — everything you write should be ready to commit and deploy
