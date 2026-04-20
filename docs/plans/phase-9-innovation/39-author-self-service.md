# Feature 39: Author Self-Service Portal

**Phase:** 9 — Innovation  
**Priority:** P19 (Strategic / Revenue)  
**Competitors:** Amazon ✅ (Author Central), Goodreads ✅ (Author Program), BookBub ✅ (Author Dashboard)  
**Status:** Not Started

---

## 1. Feature Overview

Allow verified authors to claim and manage their author profile, respond to reviews, post updates, and access analytics about their books. Amazon Author Central and Goodreads Author Program are major draws for authors. This builds the supply side of the marketplace.

---

## 2. Database Changes

### Migration: `server/src/migrations/047_author_portal.ts`

```sql
CREATE TABLE author_claims (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  verification_method ENUM('email', 'social_media', 'publisher', 'manual') NOT NULL,
  verification_proof TEXT DEFAULT NULL COMMENT 'URL or document reference',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  reviewed_by VARCHAR(36) DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_author (user_id, author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE authors ADD COLUMN claimed_by VARCHAR(36) DEFAULT NULL;
ALTER TABLE authors ADD COLUMN website VARCHAR(500) DEFAULT NULL;
ALTER TABLE authors ADD COLUMN social_links JSON DEFAULT NULL;
ALTER TABLE authors ADD FOREIGN KEY (claimed_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE author_posts (
  id VARCHAR(36) PRIMARY KEY,
  author_id VARCHAR(36) NOT NULL,
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  is_published BOOLEAN DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  INDEX idx_author_posts (author_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `POST /api/author-claims` — Submit claim `{ authorId, verificationMethod, proof }`
### 3.2 `GET /api/author-portal/dashboard` — Author stats (views, ratings, review volume)
### 3.3 `PUT /api/author-portal/profile` — Update bio, photo, website, social links
### 3.4 `POST /api/author-portal/posts` — Publish author update/announcement
### 3.5 `POST /api/author-portal/reviews/:id/response` — Author response to a review
### 3.6 Admin: `PUT /api/admin/author-claims/:id` — Approve/reject claim

---

## 4. Frontend Components

### 4.1 `app/src/components/AuthorPortal.tsx`
**Route:** `/author-portal`  
**Dashboard with:** Stats, profile editor, post creator, review responses

### 4.2 Update `app/src/components/AuthorPage.tsx`
**Show:** "Verified Author" badge, author posts, social links

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/author-portal.spec.ts`

- [ ] "Claim this profile" button on unclaimed author page
- [ ] Claim submission form works
- [ ] Pending claim shows "Verification pending" status
- [ ] After approval: author portal accessible
- [ ] Profile editing updates author page
- [ ] Publishing author post works
- [ ] Author response visible on review
- [ ] "Verified Author" badge displays
- [ ] Mobile: Portal dashboard responsive
- [ ] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `POST /api/author-claims` → 201
- [ ] Duplicate claim → 409
- [ ] Non-approved claim can't access portal → 403
- [ ] After approval → portal endpoints work
- [ ] Profile update → 200
- [ ] Post create → 201
- [ ] Review response → 200
- [ ] Non-author accessing portal → 403

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Authors can claim profiles with verification
- [ ] Admin approval workflow
- [ ] Author dashboard with analytics
- [ ] Author posts and review responses
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Claims + portal endpoints
- [ ] **Admin** — Claim review UI
- [ ] **Frontend** — AuthorPortal + AuthorPage updates
- [ ] **E2E Tests** — Passing
- [ ] **API Tests** — Passing
- [ ] **Deployed** — Live
