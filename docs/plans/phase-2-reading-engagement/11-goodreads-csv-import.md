# Feature 11: Goodreads CSV Import

**Phase:** 2 — Reading Engagement  
**Priority:** P6 (Critical — removes #1 switching barrier)  
**Competitors:** StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Import reading history, ratings, and shelves from Goodreads CSV export. Users won't switch platforms if they lose years of reading history. StoryGraph grew largely because of easy import from Goodreads. This is GDPR/data portability compliant (user exports their own data).

**Goodreads CSV columns:** Book Id, Title, Author, Author l-f, Additional Authors, ISBN, ISBN13, My Rating, Average Rating, Publisher, Binding, Number of Pages, Year Published, Original Publication Year, Date Read, Date Added, Bookshelves, Bookshelves with positions, Exclusive Shelf, My Review, Spoiler, Private Notes, Read Count, Owned Copies

---

## 2. Database Changes

### Migration: `server/src/migrations/022_goodreads_import.ts`

```sql
CREATE TABLE import_jobs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  source ENUM('goodreads', 'storygraph', 'librarything') NOT NULL DEFAULT 'goodreads',
  status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  total_rows INT DEFAULT 0,
  processed_rows INT DEFAULT 0,
  matched_books INT DEFAULT 0,
  new_books INT DEFAULT 0,
  skipped_rows INT DEFAULT 0,
  error_message TEXT DEFAULT NULL,
  file_name VARCHAR(255) NOT NULL,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_imports (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE import_job_items (
  id VARCHAR(36) PRIMARY KEY,
  import_job_id VARCHAR(36) NOT NULL,
  row_number INT NOT NULL,
  goodreads_book_id VARCHAR(50),
  isbn VARCHAR(13),
  isbn13 VARCHAR(13),
  title VARCHAR(500),
  author VARCHAR(500),
  status ENUM('matched', 'created', 'skipped', 'failed') NOT NULL DEFAULT 'skipped',
  matched_book_id VARCHAR(36) DEFAULT NULL,
  rating DECIMAL(2,1) DEFAULT NULL,
  shelf VARCHAR(50) DEFAULT NULL,
  date_read DATE DEFAULT NULL,
  review_text TEXT DEFAULT NULL,
  error_reason VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE,
  INDEX idx_job_items (import_job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `POST /api/import/goodreads`
**Auth:** Required  
**Rate Limit:** 3 per hour (heavy operation)  
**Body:** Multipart form-data with CSV file  
**Logic:**
1. Parse CSV (validate columns)
2. Create import_job record
3. For each row:
   - Match book by ISBN13 → ISBN → title+author fuzzy match
   - Map shelf: "read" → "finished", "currently-reading" → "reading", "to-read" → "want-to-read"
   - Create/update reading_progress
   - Import rating as review (if rating > 0)
   - Import review text if present
4. Return job ID for progress tracking

**Response:** `202` with `{ jobId: "uuid", status: "processing" }`

### 3.2 `GET /api/import/goodreads/:jobId`
**Auth:** Required (owner only)  
**Response:** Import job with progress

### 3.3 `GET /api/import/history`
**Auth:** Required  
**Response:** List of user's past import jobs

---

## 4. Frontend Components

### 4.1 `app/src/components/ImportGoodreadsPage.tsx`
**Route:** `/settings/import` or `/import/goodreads`  
**Features:**
- Instructions: "Export from Goodreads → My Books → Import & Export → Export Library"
- File upload dropzone (accept .csv)
- Preview table showing first 5 rows parsed
- "Start Import" button
- Progress bar (processed_rows / total_rows)
- Results summary: matched, created, skipped counts
- Error report with skipped items and reasons
- Option to re-import (overwrite vs skip existing)

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/goodreads-import.spec.ts`

#### Happy Path
- [ ] Import page loads for authenticated user
- [ ] Instructions text visible
- [ ] File upload accepts .csv file
- [ ] Preview shows parsed book titles after upload
- [ ] "Start Import" button triggers processing
- [ ] Progress bar updates during import
- [ ] Success message shows matched/created/skipped counts
- [ ] Imported books appear in user's reading lists

#### Edge Cases
- [ ] Empty CSV file → "No books found" message
- [ ] CSV with only headers → appropriate message
- [ ] CSV with 1 book → imports successfully
- [ ] CSV with 5000+ books → handles without timeout
- [ ] Duplicate import (same books already imported) → skips existing
- [ ] CSV with missing columns → partial import with warnings
- [ ] Books not found in database → listed in "Not Matched" report

#### Error States
- [ ] Unauthenticated → redirect to sign in
- [ ] Non-CSV file upload → validation error
- [ ] Corrupted CSV → parsing error message
- [ ] Rate limit exceeded (4th import in 1 hour) → throttle message
- [ ] Network failure during upload → error with retry option

#### Responsive
- [ ] Mobile: Upload area full width, results in list format
- [ ] Desktop: Side-by-side preview and results

#### Accessibility
- [ ] File input has label
- [ ] Progress bar has aria attributes
- [ ] Results table is accessible
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `POST /api/import/goodreads` without auth → 401
- [ ] Without file → 400
- [ ] With non-CSV file → 400
- [ ] With valid CSV → 202 with jobId
- [ ] `GET /api/import/goodreads/:jobId` → 200 with progress
- [ ] Job owned by different user → 403
- [ ] Non-existent jobId → 404
- [ ] `GET /api/import/history` → array of past jobs
- [ ] CSV shelves mapped correctly: "read" → "finished"
- [ ] CSV ratings imported as reviews
- [ ] Rate limit: 4th import in 1 hour → 429

---

## 7. Dependencies

- **None** (but benefits from Feature #07 Half-Star Ratings for importing decimal ratings)

---

## 8. Acceptance Criteria

- [ ] Users can upload Goodreads CSV export
- [ ] Books matched by ISBN and title+author
- [ ] Reading statuses mapped correctly
- [ ] Ratings imported as reviews
- [ ] Progress tracking during import
- [ ] Results summary with match/skip/error counts
- [ ] Rate limiting prevents abuse
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Import jobs/items tables created
- [ ] **API** — Upload, processing, progress endpoints
- [ ] **CSV Parser** — Goodreads format parse + validate
- [ ] **Book Matching** — ISBN + fuzzy title/author matching
- [ ] **Frontend** — ImportGoodreadsPage with upload, preview, progress
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Manual test with real Goodreads export
