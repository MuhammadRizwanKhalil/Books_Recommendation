# Feature 08: DNF (Did Not Finish) Status

**Phase:** 2 — Reading Engagement  
**Priority:** P11 (Quick Win)  
**Competitors:** StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Add "Did Not Finish" (DNF) as a first-class reading status alongside existing statuses (none, want-to-read, reading, finished). Include optional percentage completed and reason. Many readers DNF frequently and want to track it.

---

## 2. Database Changes

### Migration: `server/src/migrations/019_dnf_status.ts`

```sql
-- Modify reading_progress status enum to include 'dnf'
ALTER TABLE reading_progress
  MODIFY COLUMN status ENUM('none', 'want-to-read', 'reading', 'finished', 'dnf') NOT NULL DEFAULT 'none';

-- Add DNF-specific fields
ALTER TABLE reading_progress
  ADD COLUMN dnf_percentage TINYINT UNSIGNED DEFAULT NULL COMMENT 'How far through before stopping (0-100)',
  ADD COLUMN dnf_reason TEXT DEFAULT NULL COMMENT 'Optional reason for not finishing';
```

---

## 3. API Endpoints

### 3.1 `PUT /api/reading-progress/:bookId` (extend existing)
**Body additions:**
```json
{
  "status": "dnf",
  "dnfPercentage": 45,
  "dnfReason": "Too slow-paced for me"
}
```
- `dnfPercentage`: Optional INT 0-100, only valid when status = 'dnf'
- `dnfReason`: Optional string max 500 chars, only valid when status = 'dnf'

### 3.2 `GET /api/reading-progress` (extend existing)
**Response addition:** DNF entries include `dnfPercentage` and `dnfReason`.

---

## 4. Frontend Components

### 4.1 Update `ReadingStatus.tsx` dropdown
- Add "Did Not Finish" option with 🚫 icon
- When DNF is selected, show optional sub-form:
  - Percentage slider (0-100%)
  - Reason text field (optional, max 500 chars)

### 4.2 Update `ReadingCounts.tsx` (Feature #05)
- Add DNF count to reading counts display

### 4.3 Update TypeScript types
```typescript
type ReadingStatus = 'none' | 'want-to-read' | 'reading' | 'finished' | 'dnf';
```

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/dnf-status.spec.ts`

#### Happy Path
- [ ] Reading status dropdown shows "Did Not Finish" option
- [ ] Selecting DNF changes status to DNF
- [ ] DNF sub-form appears with percentage slider and reason field
- [ ] Setting percentage to 45% saves correctly
- [ ] Adding reason text saves correctly
- [ ] DNF status persists on page reload
- [ ] Changing from DNF to "Reading" clears DNF fields
- [ ] Book shows DNF status in reading lists page

#### Edge Cases
- [ ] DNF with 0% percentage (didn't start reading)
- [ ] DNF with 100% percentage (finished but didn't enjoy — edge case)
- [ ] DNF with empty reason (reason is optional)
- [ ] DNF reason with 500 characters (max)
- [ ] DNF reason with special characters/emoji
- [ ] Switching reading → dnf → reading → finished flow

#### Error States
- [ ] DNF without auth → sign-in prompt
- [ ] DNF reason exceeding 500 chars → validation error
- [ ] Percentage > 100 rejected
- [ ] Negative percentage rejected

#### Responsive
- [ ] Mobile: DNF sub-form fits within dropdown or expands below
- [ ] Percentage slider is touch-friendly

#### Accessibility
- [ ] DNF option selectable via keyboard
- [ ] Percentage slider has ARIA labels
- [ ] Reason textarea has label
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `PUT /api/reading-progress/:bookId` with status 'dnf' → 200
- [ ] DNF with percentage 45 → saved correctly
- [ ] DNF with reason → saved correctly
- [ ] DNF without percentage/reason → 200 (both optional)
- [ ] Percentage 0 → valid
- [ ] Percentage 100 → valid
- [ ] Percentage 101 → 400
- [ ] Percentage -1 → 400
- [ ] Reason > 500 chars → 400
- [ ] `GET /api/reading-progress` includes dnf entries with percentage/reason
- [ ] Setting status from 'dnf' to 'reading' clears dnf fields

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] "Did Not Finish" available in reading status dropdown
- [ ] Optional percentage and reason capture on DNF
- [ ] DNF status displays correctly in all lists/pages
- [ ] All tests pass
- [ ] Backward compatible with existing statuses

## 9. Completion Tracking

- [ ] **Database** — Migration run (ALTER enum + new columns)
- [ ] **API** — Updated validation + response for DNF
- [ ] **Frontend** — ReadingStatus dropdown + DNF sub-form
- [ ] **Types** — TypeScript ReadingStatus type updated
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
