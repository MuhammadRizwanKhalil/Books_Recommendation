# Feature 36: Quizzes & Trivia

**Phase:** 8 — Gamification & Insights  
**Priority:** P20 (Fun Engagement Feature)  
**Competitors:** Goodreads ✅ (Quizzes section)  
**Status:** Not Started

---

## 1. Feature Overview

Per-book and general book trivia quizzes. Goodreads has thousands of community-created quizzes (e.g., "How Well Do You Know Harry Potter?"). Drives engagement and repeat visits.

---

## 2. Database Changes

### Migration: `server/src/migrations/044_quizzes.ts`

```sql
CREATE TABLE quizzes (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  description TEXT DEFAULT NULL,
  book_id VARCHAR(36) DEFAULT NULL COMMENT 'NULL for general quizzes',
  created_by VARCHAR(36) NOT NULL,
  question_count INT DEFAULT 0,
  attempt_count INT DEFAULT 0,
  avg_score DECIMAL(5,2) DEFAULT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_book_quizzes (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quiz_questions (
  id VARCHAR(36) PRIMARY KEY,
  quiz_id VARCHAR(36) NOT NULL,
  question_text TEXT NOT NULL,
  question_order INT NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quiz_answers (
  id VARCHAR(36) PRIMARY KEY,
  question_id VARCHAR(36) NOT NULL,
  answer_text VARCHAR(500) NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quiz_attempts (
  id VARCHAR(36) PRIMARY KEY,
  quiz_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_attempts (user_id, completed_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/quizzes` — Quizzes for a book
### 3.2 `GET /api/quizzes/discover` — Popular/recent quizzes
### 3.3 `GET /api/quizzes/:id` — Quiz with questions (answers hidden)
### 3.4 `POST /api/quizzes/:id/submit` — Submit answers `{ answers: [{ questionId, answerId }] }`
### 3.5 `POST /api/quizzes` — Create quiz (community)
### 3.6 `GET /api/quizzes/:id/leaderboard` — Top scores

---

## 4. Frontend Components

### 4.1 `app/src/components/QuizPage.tsx` — Take a quiz (question-by-question flow)
### 4.2 `app/src/components/QuizResultsPage.tsx` — Score + correct answers reveal
### 4.3 `app/src/components/book/BookQuizzes.tsx` — Quizzes section on book page

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/quizzes.spec.ts`

- [ ] Book page shows "Quizzes" section with count
- [ ] Quiz discovery page lists popular quizzes
- [ ] Starting quiz shows questions one-by-one
- [ ] Selecting answer and advancing works
- [ ] Submitting quiz shows score and results
- [ ] Correct/incorrect answers revealed
- [ ] Leaderboard displays top scores
- [ ] Creating community quiz works
- [ ] Mobile: Full-screen quiz experience
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/quizzes/:id` returns questions without correct answers
- [ ] `POST /api/quizzes/:id/submit` calculates score → 200
- [ ] Submit with missing answers → 400
- [ ] `GET /api/quizzes/:id/leaderboard` → ordered by score DESC
- [ ] Create quiz with < 2 questions → 400
- [ ] Without auth (submit) → 401

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Per-book quizzes with multiple choice
- [ ] Score tracking and leaderboards
- [ ] Community quiz creation
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Quiz CRUD + submission + leaderboard
- [ ] **Frontend** — QuizPage + ResultsPage + BookQuizzes
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
