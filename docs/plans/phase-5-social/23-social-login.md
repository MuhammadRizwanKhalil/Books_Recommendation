# Feature 23: Social Login (Google/Apple)

**Phase:** 5 — Social Features  
**Priority:** P11 (High-Priority Gap)  
**Competitors:** Goodreads ✅ (Facebook, Google, Apple), Amazon ✅, BookBub ✅  
**Status:** Completed — 2026-04-14

---

## 1. Feature Overview

Add "Sign in with Google" and "Sign in with Apple" to reduce sign-up friction. Currently only email/password. Social login can increase conversion by 20-50%.

---

## 2. Database Changes

### Migration: `server/src/migrations/035_social_login.ts`

```sql
CREATE TABLE user_social_accounts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  provider ENUM('google', 'apple') NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  access_token TEXT DEFAULT NULL,
  refresh_token TEXT DEFAULT NULL,
  token_expires_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_provider_user (provider, provider_user_id),
  INDEX idx_user_social (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL COMMENT 'NULL for social-only accounts';
```

---

## 3. API Endpoints

### 3.1 `POST /api/auth/google`
**Auth:** None  
**Body:** `{ idToken: "..." }` (from Google Sign-In SDK)  
**Logic:** Verify token with Google, find/create user, return JWT  
**Response:** `{ token: "jwt", user: { ... } }`

### 3.2 `POST /api/auth/apple`
**Auth:** None  
**Body:** `{ identityToken: "...", authorizationCode: "..." }`  
**Logic:** Verify with Apple, find/create user, return JWT

### 3.3 `GET /api/users/me/linked-accounts`
**Auth:** Required  
**Response:** `{ google: true, apple: false }`

### 3.4 `POST /api/users/me/link-account`
**Auth:** Required  
**Body:** `{ provider: "google", idToken: "..." }`

### 3.5 `DELETE /api/users/me/linked-accounts/:provider`
**Auth:** Required (only if user has password set)

---

## 4. Frontend Components

### 4.1 Update `app/src/components/AuthModal.tsx`
**Add:**
- "Continue with Google" button (Google brand colors/logo)
- "Continue with Apple" button (Apple brand colors/logo)
- Divider: "or continue with email"
- Google Sign-In SDK integration
- Apple Sign-In JS integration

### 4.2 `app/src/components/LinkedAccounts.tsx`
**Location:** Settings page  
**Manage linked social accounts**

---

## 5. Playwright E2E Test Scenarios

### File: `tests/e2e/social-login.spec.ts`

> Note: Social login requires mocking OAuth providers in tests

#### Happy Path
- [x] Login modal shows Google and Apple buttons
- [x] Google button has correct branding
- [x] Apple button has correct branding
- [x] Clicking Google triggers OAuth flow (mocked in test)
- [x] Successful Google login creates account and redirects
- [x] Returning Google user logs in without new account creation
- [x] Settings page shows linked accounts
- [x] Can link Google to existing email account

#### Edge Cases
- [x] Email conflict: Google email matches existing account → merges/link flow supported
- [x] Unlinking last auth method blocked if no password set
- [x] Apple "Hide My Email" creates account with relay email

#### Error/Responsive/Accessibility
- [x] OAuth failure shows error message
- [x] Mobile: Social buttons full width
- [x] Buttons have proper ARIA labels
- [x] axe-core passes

---

## 6. API Test Scenarios (Vitest)

- [x] `POST /api/auth/google` with valid mock token → 200 + JWT
- [x] Invalid/expired token → 401
- [x] New user auto-created with Google name/email/avatar
- [x] Existing email merges accounts (if not already linked)
- [x] `POST /api/auth/apple` with valid mock token → 200
- [x] `GET /api/users/me/linked-accounts` shows providers
- [x] `DELETE` unlink with password set → 200
- [x] `DELETE` unlink without password → 400 "Set a password first"

---

## 7. Dependencies

- **None**  
- **External:** Google Cloud Console OAuth credentials, Apple Developer Program

---

## 8. Acceptance Criteria

- [x] Google Sign-In works end-to-end
- [x] Apple Sign-In works end-to-end
- [x] Account linking and unlinking
- [x] Proper branding compliance
- [x] All tests pass

## 9. Completion Tracking

- [x] **Database** — Migration run
- [x] **Google OAuth** — Development mock/server verification added
- [x] **Apple OAuth** — Development mock/server verification added
- [x] **API** — Social auth + linked accounts endpoints
- [x] **Frontend** — AuthModal social buttons + LinkedAccounts
- [x] **E2E Tests** — Passing (with mocked OAuth)
- [x] **API Tests** — Passing
- [ ] **Deployed** — Live
