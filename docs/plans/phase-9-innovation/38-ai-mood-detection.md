# Feature 38: AI Mood Detection

**Phase:** 9 — Innovation  
**Priority:** P20 (Unique Differentiator)  
**Competitors:** None (novel feature)  
**Status:** Not Started

---

## 1. Feature Overview

Use OpenAI to automatically analyze book descriptions, reviews, and metadata to suggest mood tags, pace, and content warnings. Instead of relying entirely on community voting (Features #2, #3, #12), AI pre-seeds these attributes. Also powers "Read for my mood" discovery — "I want something uplifting and fast-paced."

---

## 2. Database Changes

### Migration: `server/src/migrations/046_ai_mood_detection.ts`

```sql
CREATE TABLE ai_book_analysis (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  analysis_type ENUM('mood', 'pace', 'content_warnings', 'themes', 'difficulty') NOT NULL,
  result JSON NOT NULL COMMENT '{"moods": ["hopeful", "inspiring"], "confidence": 0.85}',
  model_version VARCHAR(50) DEFAULT 'gpt-4o-mini',
  analyzed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  UNIQUE KEY uq_book_analysis (book_id, analysis_type),
  INDEX idx_analysis (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/ai-analysis` — All AI insights for a book
### 3.2 `GET /api/discover/mood?mood=uplifting&pace=fast` — Mood-based discovery
### 3.3 Admin: `POST /api/admin/ai/analyze-book/:id` — Trigger analysis for one book
### 3.4 Admin: `POST /api/admin/ai/batch-analyze` — Batch analyze unanalyzed books

---

## 4. Frontend Components

### 4.1 `app/src/components/book/AIInsights.tsx`
**Location:** BookPage — "AI Insights" badge section  
**Shows:** AI-suggested moods, themes, difficulty level, with confidence indicators

### 4.2 `app/src/components/MoodDiscovery.tsx`
**Route:** `/discover/mood`  
**Interactive mood selector: "I want to read something..." with emoji mood buttons → shows matching books**

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/ai-mood.spec.ts`

- [ ] AI Insights section visible on book page when analyzed
- [ ] Mood tags display with confidence indicators
- [ ] Mood discovery page loads with mood selector
- [ ] Selecting mood shows matching books
- [ ] Combining mood + pace filters works
- [ ] "AI-detected" label distinguishes from community tags
- [ ] Section hidden for unanalyzed books
- [ ] Mobile: Mood selector grid responsive
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/books/:id/ai-analysis` → 200
- [ ] Unanalyzed book → empty results
- [ ] `GET /api/discover/mood?mood=uplifting` → books matching
- [ ] Admin trigger → calls OpenAI (mocked) → saves result
- [ ] Batch analyze → processes multiple books
- [ ] Invalid mood parameter → 400

---

## 7. Dependencies

- **Uses existing OpenAI integration** (gpt-4o-mini)
- **Benefits from Feature #2** (Mood Tags) for shared mood taxonomy

---

## 8. Acceptance Criteria

- [ ] AI auto-analyzes books for mood/pace/warnings
- [ ] Mood-based discovery page works
- [ ] AI insights displayed on book pages
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **AI Service** — Mood detection prompts
- [ ] **API** — Analysis + discovery endpoints
- [ ] **Frontend** — AIInsights + MoodDiscovery
- [ ] **Admin** — Batch analysis UI
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
