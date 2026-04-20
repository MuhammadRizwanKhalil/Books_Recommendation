# Feature 26: Community Prompts

**Phase:** 6 — Community  
**Priority:** P18 (Unique Differentiator)  
**Competitors:** StoryGraph ✅ ("Community Prompts" — unique feature)  
**Status:** Done

---

## 1. Feature Overview

StoryGraph-style community prompts — structured questions about a book that readers can answer. Different from discussions (free-form) or reviews (overall assessment). Prompts target specific aspects: "Who would you cast as the main character?", "What genre mashup does this feel like?", "Best quote from this book?"

---

## 2. Database Changes

### Migration: `server/src/migrations/037_community_prompts.ts`

```sql
CREATE TABLE book_prompts (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  prompt_text VARCHAR(500) NOT NULL,
  created_by VARCHAR(36) DEFAULT NULL COMMENT 'NULL = system prompt',
  response_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_book_prompts (book_id, response_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE prompt_responses (
  id VARCHAR(36) PRIMARY KEY,
  prompt_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  like_count INT DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prompt_id) REFERENCES book_prompts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_prompt (prompt_id, user_id),
  INDEX idx_prompt_responses (prompt_id, like_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/prompts` — List prompts with response counts
### 3.2 `GET /api/prompts/:id/responses` — Paginated responses for a prompt
### 3.3 `POST /api/books/:id/prompts` — Create prompt (auth required)
### 3.4 `POST /api/prompts/:id/responses` — Submit response (one per user per prompt)
### 3.5 `POST /api/prompt-responses/:id/like` — Like a response

---

## 4. Frontend Components

### 4.1 `app/src/components/book/CommunityPrompts.tsx`
**Tab or section on BookPage**  
Prompt cards with question text, response count, "Answer" button  
Top responses preview

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/community-prompts.spec.ts`

- [x] Book page shows prompts section
- [x] Prompts display question and response count
- [x] Clicking prompt shows responses sorted by likes
- [x] Submitting response works (one per user per prompt)
- [x] Liking responses works
- [x] Creating new prompt works
- [x] Cannot submit second response to same prompt
- [x] Mobile: Prompt cards full width
- [x] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [x] `GET /api/books/:id/prompts` → 200
- [x] `POST` response → 201
- [x] Duplicate response → 409
- [x] Like → increments count
- [x] Empty content → 400

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [x] Community prompts on book pages
- [x] One response per user per prompt
- [x] Liking system works
- [x] All tests pass

## 9. Completion Tracking

- [x] **Database** — Migration run
- [x] **API** — Prompts + responses endpoints
- [x] **Frontend** — CommunityPrompts component
- [x] **E2E Tests** — Passing
- [x] **API Tests** — Passing
- [ ] **Deployed** — Live
