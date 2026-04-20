# Feature 15: Review Comments

**Phase:** 3 — Reviews & Safety  
**Priority:** P16 (Medium Gap)  
**Competitors:** Goodreads ✅  
**Status:** Not Started

---

## 1. Feature Overview

Allow users to post threaded replies on reviews. Goodreads reviews have comments count and full threaded discussions. This creates engagement loops and deeper community interaction.

---

## 2. Database Changes

### Migration: `server/src/migrations/026_review_comments.ts`

```sql
CREATE TABLE review_comments (
  id VARCHAR(36) PRIMARY KEY,
  review_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  parent_comment_id VARCHAR(36) DEFAULT NULL COMMENT 'For threaded replies',
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES review_comments(id) ON DELETE CASCADE,
  INDEX idx_review_comments (review_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. API Endpoints

### 3.1 `GET /api/reviews/:id/comments`
**Auth:** None  
**Query:** `?page=1&limit=20`  
**Response:**
```json
{
  "comments": [
    {
      "id": "uuid",
      "content": "Great review!",
      "user": { "id": "uuid", "name": "Jane", "avatarUrl": "..." },
      "parentCommentId": null,
      "isEdited": false,
      "createdAt": "2026-04-10T...",
      "replies": [
        {
          "id": "uuid",
          "content": "Thanks!",
          "user": { ... },
          "parentCommentId": "parent-uuid",
          "createdAt": "..."
        }
      ]
    }
  ],
  "totalComments": 5
}
```

### 3.2 `POST /api/reviews/:id/comments`
**Auth:** Required  
**Rate Limit:** 20 per 15 minutes  
**Body:** `{ content: "...", parentCommentId?: "uuid" }`

### 3.3 `PUT /api/reviews/comments/:commentId`
**Auth:** Required (owner only)  
**Body:** `{ content: "updated..." }`

### 3.4 `DELETE /api/reviews/comments/:commentId`
**Auth:** Required (owner or admin)

---

## 4. Frontend Components

### 4.1 `app/src/components/book/ReviewComments.tsx`
**Location:** Expandable section below each review in BookReviews.tsx  
**Features:**
- "X comments" link that expands thread
- Threaded display (indent replies)
- Comment input textarea
- Reply button on each comment
- Edit/Delete on own comments
- Auto-collapse nested threads > 3 levels deep

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/review-comments.spec.ts`

#### Happy Path
- [ ] Review shows comment count (e.g., "5 comments")
- [ ] Clicking comment count expands thread
- [ ] Comments display with user name, avatar, content, date
- [ ] Comment input visible for authenticated users
- [ ] Submitting comment adds it to the thread
- [ ] Reply button creates nested reply
- [ ] Edit own comment works
- [ ] Delete own comment works (with confirmation)
- [ ] Threaded replies indent correctly

#### Edge Cases
- [ ] Review with 0 comments shows "Be the first to comment"
- [ ] Deeply nested replies (5+ levels) cap indentation
- [ ] Comment with very long text wraps properly
- [ ] Emoji in comments renders correctly
- [ ] Multiple rapid comments (within rate limit) all succeed

#### Error/Responsive/Accessibility
- [ ] Unauthenticated: "Sign in to comment" prompt
- [ ] Mobile: Comments full width, indentation reduced
- [ ] Comment textarea has label for accessibility
- [ ] axe-core audit passes

---

## 6. API Test Scenarios (Vitest)

- [ ] `GET /api/reviews/:id/comments` → 200 with comments array
- [ ] Includes nested replies structure
- [ ] `POST` without auth → 401
- [ ] `POST` with valid content → 201
- [ ] `POST` with parentCommentId → 201 (threaded reply)
- [ ] Empty content → 400
- [ ] Content > 2000 chars → 400
- [ ] `PUT` own comment → 200, sets isEdited=true
- [ ] `PUT` other's comment → 403
- [ ] `DELETE` own → 200
- [ ] `DELETE` other's → 403 (unless admin)
- [ ] Rate limit: 21st comment in 15min → 429

---

## 7. Dependencies

- **None**

---

## 8. Acceptance Criteria

- [ ] Comments visible on reviews
- [ ] Threaded replies work
- [ ] CRUD for own comments
- [ ] Rate limiting enforced
- [ ] All tests pass

## 9. Completion Tracking

- [ ] **Database** — Migration run
- [ ] **API** — Comment CRUD endpoints
- [ ] **Frontend** — ReviewComments component
- [ ] **E2E Tests** — All scenarios passing
- [ ] **API Tests** — All scenarios passing
- [ ] **Deployed** — Live on production
