# Feature 27: Book Clubs / Buddy Reads

**Phase:** 6 — Community  
**Priority:** P19 (Strategic Feature)  
**Competitors:** Goodreads ✅ (Groups/reading challenges), StoryGraph ✅ (Buddy Reads)  
**Status:** Done

---

## 1. Feature Overview

Create book clubs where members read the same book together with a shared discussion thread and reading schedule. StoryGraph's buddy reads are 1-on-1 or small group; Goodreads has full groups with monthly picks. We'll combine both approaches.

---

## 2. Database Changes

### Migration: `server/src/migrations/038_book_clubs.ts`

```sql
CREATE TABLE book_clubs (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  cover_image VARCHAR(500) DEFAULT NULL,
  owner_id VARCHAR(36) NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  member_count INT DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_public_clubs (is_public, member_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE book_club_members (
  id VARCHAR(36) PRIMARY KEY,
  club_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('owner', 'moderator', 'member') DEFAULT 'member',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES book_clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_club_member (club_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE book_club_picks (
  id VARCHAR(36) PRIMARY KEY,
  club_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  month_label VARCHAR(50) NOT NULL COMMENT 'e.g. June 2026',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  discussion_id VARCHAR(36) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES book_clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/book-clubs` — Discover public clubs
### 3.2 `POST /api/book-clubs` — Create club (auth)
### 3.3 `GET /api/book-clubs/:id` — Club details + current pick + members
### 3.4 `POST /api/book-clubs/:id/join` — Join club
### 3.5 `DELETE /api/book-clubs/:id/leave` — Leave club
### 3.6 `POST /api/book-clubs/:id/picks` — Set monthly pick (owner/mod)
### 3.7 `GET /api/book-clubs/:id/picks` — Pick history

---

## 4. Frontend Components

### 4.1 `app/src/components/BookClubsPage.tsx` — Discover clubs
### 4.2 `app/src/components/BookClubDetail.tsx` — Club page with current pick, members, discussion

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/book-clubs.spec.ts`

- [x] Discover page lists public clubs
- [x] Create club works
- [x] Join club adds user to members
- [x] Club detail shows current pick + discussion
- [x] Owner can set monthly pick
- [x] Leave club works
- [x] Private club not listed in discover
- [x] Mobile layout works
- [x] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [x] `POST /api/book-clubs` → 201
- [x] `POST /join` → 200
- [x] Rejoin → 409
- [x] `DELETE /leave` → 200
- [x] Set pick (owner) → 200
- [x] Set pick (member) → 403
- [x] Private club excluded from discover

---

## 7. Dependencies

- **Benefits from Feature #25** (Discussions) for club discussion threads

---

## 8. Acceptance Criteria

- [x] Book clubs with create/join/leave
- [x] Monthly picks with discussion
- [x] Public discovery
- [x] All tests pass

## 9. Completion Tracking

- [x] **Database** — Migration run
- [x] **API** — Club CRUD + picks endpoints
- [x] **Frontend** — BookClubsPage + BookClubDetail
- [x] **E2E Tests** — Passing
- [x] **API Tests** — Passing
- [ ] **Deployed** — Live
