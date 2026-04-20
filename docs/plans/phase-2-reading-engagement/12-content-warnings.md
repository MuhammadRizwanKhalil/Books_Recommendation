# Feature 12: Content Warnings

**Phase:** 2 — Reading Engagement  
**Priority:** P4 (Critical Gap)  
**Competitors:** StoryGraph ✅  
**Status:** Not Started

---

## 1. Feature Overview

Community-sourced content/trigger warnings for sensitive topics (violence, sexual content, death, mental health, etc.) so readers can make informed choices. Hidden by default to avoid spoilers. Hugely valued by modern readers, especially YA/romance/thriller audiences. Growing cultural expectation, especially among Gen Z.

**Warning Taxonomy (25 predefined):**
Abuse, Addiction, Animal Cruelty, Body Image, Bullying, Death, Domestic Violence, Eating Disorders, Gore, Grief, Homophobia, Kidnapping, Mental Health, Murder, Racism, Rape/Sexual Assault, Self-Harm, Sexism, Sexual Content, Slavery, Suicide, Terminal Illness, Torture, Transphobia, War

---

## 2. Database Changes

### Migration: `server/src/migrations/023_content_warnings.ts`

```sql
CREATE TABLE content_warning_taxonomy (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  category ENUM('violence', 'sexual', 'mental_health', 'discrimination', 'death', 'other') NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed 25 predefined warnings
INSERT INTO content_warning_taxonomy (id, name, slug, category, display_order) VALUES
  (UUID(), 'Abuse', 'abuse', 'violence', 1),
  (UUID(), 'Addiction', 'addiction', 'mental_health', 2),
  (UUID(), 'Animal Cruelty', 'animal-cruelty', 'violence', 3),
  -- ... (all 25 warnings seeded)
  (UUID(), 'War', 'war', 'violence', 25);

CREATE TABLE book_content_warnings (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  warning_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  severity ENUM('mild', 'moderate', 'severe') NOT NULL DEFAULT 'moderate',
  details TEXT DEFAULT NULL COMMENT 'Optional context like chapter/scene',
  is_approved BOOLEAN DEFAULT FALSE COMMENT 'Admin moderation',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (warning_id) REFERENCES content_warning_taxonomy(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_book_warning_user (book_id, warning_id, user_id),
  INDEX idx_book_warnings (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_warning_votes (
  id VARCHAR(36) PRIMARY KEY,
  book_content_warning_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  vote ENUM('agree', 'disagree') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_content_warning_id) REFERENCES book_content_warnings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cw_vote_user (book_content_warning_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/content-warnings`
**Auth:** None  
**Response:** Full taxonomy list

### 3.2 `GET /api/books/:id/content-warnings`
**Auth:** None  
**Response:**
```json
{
  "totalWarnings": 5,
  "warnings": [
    {
      "id": "uuid",
      "name": "Violence",
      "slug": "violence",
      "category": "violence",
      "severity": "moderate",
      "reportCount": 12,
      "agreeCount": 10,
      "disagreeCount": 2,
      "confidence": 83
    }
  ]
}
```

### 3.3 `POST /api/books/:id/content-warnings`
**Auth:** Required  
**Rate Limit:** 20 per hour  
**Body:** `{ warningId: "uuid", severity: "moderate", details?: "Chapter 5 has..." }`

### 3.4 `POST /api/content-warnings/:id/vote`
**Auth:** Required  
**Body:** `{ vote: "agree" | "disagree" }`

### 3.5 Admin: `GET /api/admin/content-warnings/pending`
**Auth:** Admin  
**Response:** Unapproved warnings for moderation

### 3.6 Admin: `PUT /api/admin/content-warnings/:id/approve`
**Auth:** Admin

---

## 4. Frontend Components

### 4.1 `app/src/components/book/ContentWarnings.tsx`
**Location:** Collapsible section on BookPage.tsx (before description)  
**Default:** Collapsed with "⚠️ Content Warnings (5)" header  
**Expanded:** Warning pills with severity colors + agree/disagree counts  
**Colors:** mild=yellow, moderate=orange, severe=red

### 4.2 `app/src/components/book/ContentWarningSubmitModal.tsx`
- Select from taxonomy
- Choose severity
- Optional details text
- Submit for moderation

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/content-warnings.spec.ts`

#### Happy Path
- [ ] Book page shows collapsed content warnings section with count
- [ ] Clicking expand reveals warning pills
- [ ] Each warning shows name, severity color, and vote counts
- [ ] "Report a warning" button visible for authenticated users
- [ ] Submit modal shows warning taxonomy list
- [ ] Selecting warning + severity + submit creates warning
- [ ] Agree/Disagree voting buttons work
- [ ] Vote counts update after voting
- [ ] Warnings sorted by report count (most reported first)

#### Edge Cases
- [ ] Book with no content warnings shows "No warnings reported" or hides section
- [ ] Warning with 0 agree/disagree votes shows counts as 0
- [ ] User votes agree, then changes to disagree → vote updated
- [ ] Same user can't submit same warning twice (duplicate prevention)
- [ ] Details text with 500+ characters truncated
- [ ] Multiple severity levels for same warning (different users) → show consensus

#### Error States
- [ ] Unauthenticated submit attempt → sign-in prompt
- [ ] Network failure during submit → error toast
- [ ] Rate limit exceeded → throttle message

#### Responsive
- [ ] Mobile: Warning pills wrap, modal is fullscreen
- [ ] Desktop: Inline collapsible

#### Accessibility
- [ ] Collapsed section has aria-expanded="false"
- [ ] Warning severity conveyed via text + color (not color alone)
- [ ] Vote buttons have ARIA labels
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/content-warnings` → 200 with taxonomy array (25 items)
- [ ] `GET /api/books/:id/content-warnings` → 200 with warnings array
- [ ] No warnings → `{ totalWarnings: 0, warnings: [] }`
- [ ] `POST /api/books/:id/content-warnings` without auth → 401
- [ ] With auth + valid data → 201
- [ ] Invalid warningId → 400
- [ ] Invalid severity → 400
- [ ] Duplicate warning by same user → 409
- [ ] `POST /api/content-warnings/:id/vote` → 200
- [ ] Double vote changes vote (not duplicates)
- [ ] Rate limit: 21st warning in 1 hour → 429
- [ ] Admin approve endpoint → 200

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] 25 predefined content warnings seeded
- [ ] Collapsible section on book page with warning count
- [ ] Users can submit new warnings (moderated)
- [ ] Agree/disagree voting works
- [ ] Severity displayed with color coding
- [ ] Admin moderation queue functional
- [ ] Hidden by default (user must click to reveal)
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration + seed data run
- [ ] **API** — Warning endpoints + admin moderation
- [ ] **Frontend** — ContentWarnings collapsible + submit modal
- [ ] **Admin** — Moderation queue page
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Code Review** — PR reviewed
- [ ] **Deployed** — Live on production
- [ ] **Verified** — Smoke test on production
