# Feature 30: Progress Tracker Bar

**Phase:** 7 — Book Metadata & UX  
**Priority:** P10 (High UX Gap)  
**Competitors:** Hardcover ✅ (page/percentage input), Goodreads ✅ ("Update Progress"), StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Visual progress bar showing how far through a book the user is. Input as page number or percentage. Hardcover and Goodreads both show a progress bar that updates in the activity feed. Currently TheBookTimes has reading status (want/reading/read) but no granular progress tracking.

---

## 2. Database Changes

### Migration: `server/src/migrations/039_progress_tracker.ts`

```sql
ALTER TABLE reading_progress ADD COLUMN current_page INT DEFAULT NULL;
ALTER TABLE reading_progress ADD COLUMN total_pages INT DEFAULT NULL;
ALTER TABLE reading_progress ADD COLUMN percentage DECIMAL(5,2) DEFAULT NULL;

CREATE TABLE reading_progress_history (
  id VARCHAR(36) PRIMARY KEY,
  reading_progress_id VARCHAR(36) NOT NULL,
  current_page INT DEFAULT NULL,
  percentage DECIMAL(5,2) DEFAULT NULL,
  note VARCHAR(500) DEFAULT NULL COMMENT 'Optional reading note',
  logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reading_progress_id) REFERENCES reading_progress(id) ON DELETE CASCADE,
  INDEX idx_progress_history (reading_progress_id, logged_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `PUT /api/reading-progress/:bookId/update`
**Auth:** Required  
**Body:** `{ currentPage?: number, percentage?: number, note?: string }`  
**Logic:** Calculates percentage from page/total or accepts directly. Creates history entry.

### 3.2 `GET /api/reading-progress/:bookId/history`
**Auth:** Required  
**Response:** Array of progress updates with timestamps

---

## 4. Frontend Components

### 4.1 `app/src/components/book/ProgressTracker.tsx`
**Location:** Prominent on BookPage when status = "reading"  
**Features:**
- Visual progress bar (gradient fill)
- Page input: "Page __ of 320"
- Percentage display
- "Update Progress" button
- Optional note field
- Progress timeline (mini chart of reading pace)

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/progress-tracker.spec.ts`

- [ ] Progress bar visible on book page when currently reading
- [ ] Entering page number updates bar percentage
- [ ] Progress bar fills proportionally
- [ ] Progress history shows timeline of updates
- [ ] Reaching 100% prompts "Mark as Read?"
- [ ] Adding note with progress update saves
- [ ] Progress hidden for "want to read" status
- [ ] Multiple progress updates create history entries
- [ ] Mobile: Progress input full width
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `PUT` with currentPage → 200, calculates percentage
- [ ] `PUT` with percentage directly → 200
- [ ] currentPage > totalPages → 400
- [ ] percentage > 100 → 400
- [ ] History endpoint returns chronological entries
- [ ] Without auth → 401
- [ ] Book not in "reading" status → 400

---

## 7. Dependencies

- **Benefits from Feature #8** (DNF Status) for status enum awareness

---

## 8. Acceptance Criteria

- [ ] Visual progress bar on book page
- [ ] Page and percentage input
- [ ] Progress history tracked
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Progress update + history endpoints
- [ ] **Frontend** — ProgressTracker component
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
