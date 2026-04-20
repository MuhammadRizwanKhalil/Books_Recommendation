# Feature 37: Story Arc Visualization

**Phase:** 9 — Innovation  
**Priority:** P20 (Unique Differentiator)  
**Competitors:** None (novel feature — first mover advantage)  
**Status:** Not Started

---

## 1. Feature Overview

A visual representation of a book's emotional/narrative arc. Plot the intensity curve (tension vs. page progression) based on community votes or AI analysis. Think "story shape" — Kurt Vonnegut's shapes of stories visualized as an interactive chart. No competitor does this — first mover opportunity.

---

## 2. Database Changes

### Migration: `server/src/migrations/045_story_arc.ts`

```sql
CREATE TABLE story_arc_points (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  position_percent DECIMAL(5,2) NOT NULL COMMENT '0-100 position in book',
  intensity DECIMAL(3,2) NOT NULL COMMENT '0-1 emotional intensity',
  label VARCHAR(100) DEFAULT NULL COMMENT 'e.g. "Inciting incident", "Climax"',
  source ENUM('ai', 'community_avg', 'admin') DEFAULT 'ai',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_book_arc (book_id, position_percent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE story_arc_votes (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  position_percent DECIMAL(5,2) NOT NULL,
  intensity DECIMAL(3,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/books/:id/story-arc`
**Auth:** None  
**Response:**
```json
{
  "arc": [
    { "position": 0, "intensity": 0.2, "label": "Introduction" },
    { "position": 15, "intensity": 0.4, "label": "Inciting Incident" },
    { "position": 50, "intensity": 0.6, "label": "Midpoint" },
    { "position": 75, "intensity": 0.95, "label": "Climax" },
    { "position": 95, "intensity": 0.3, "label": "Resolution" }
  ],
  "source": "ai",
  "voterCount": 23
}
```

### 3.2 `POST /api/books/:id/story-arc/vote` — Community arc point vote
### 3.3 Admin/Service: `POST /api/admin/books/:id/story-arc/generate` — Trigger AI generation

---

## 4. Frontend Components

### 4.1 `app/src/components/book/StoryArcChart.tsx`
**Location:** BookPage — collapsible "Story Arc" section  
**Uses Recharts** AreaChart with smooth curve, labeled key points  
**Interactive:** Hover on points reveals labels  
**Spoiler warning** at start of section

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/story-arc.spec.ts`

- [ ] Story Arc section visible on book page when data exists
- [ ] Chart renders with smooth intensity curve
- [ ] Key points labeled (hoverable)
- [ ] Spoiler warning displayed
- [ ] Section hidden when no arc data
- [ ] Community vote interface works
- [ ] Mobile: Chart scales to viewport
- [ ] axe-core passes (chart has aria label)

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/books/:id/story-arc` → 200 with arc points
- [ ] No data → empty array
- [ ] `POST` vote → 201
- [ ] Vote without auth → 401
- [ ] Admin generate → triggers AI service

---

## 7. Dependencies

- **Uses existing OpenAI integration** (gpt-4o-mini) for AI arc generation

---

## 8. Acceptance Criteria

- [ ] Visual arc chart on book pages
- [ ] AI-generated and community-voted arcs
- [ ] Spoiler protection
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Arc endpoints + AI generation
- [ ] **AI Service** — Story arc analysis prompt
- [ ] **Frontend** — StoryArcChart (Recharts)
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
