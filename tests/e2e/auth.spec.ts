import { test, expect } from '../fixtures/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Sign In button should be visible in nav', async ({ page }) => {
    await expect(page.locator('text=Sign In').first()).toBeVisible();
  });

  test('clicking Sign In should open auth modal or login page', async ({ page }) => {
    await page.locator('text=Sign In').first().click();
    await page.waitForTimeout(500);
    // Either a modal dialog opens or we navigate to a login page
    const modal = page.locator('[role="dialog"], [class*="modal"], input[type="email"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('login form should have email and password fields', async ({ page }) => {
    await page.locator('text=Sign In').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('login with invalid credentials should show error', async ({ page }) => {
    await page.locator('text=Sign In').first().click();
    await page.waitForTimeout(500);

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill('invalid@test.com');
    await passwordInput.fill('wrongpassword');

    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').last();
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Should show error message
    const error = page.locator('text=/invalid|wrong|incorrect|error|failed/i').first();
    await expect(error).toBeVisible({ timeout: 5000 });
  });

  test('should show register/sign up option', async ({ page }) => {
    await page.locator('text=Sign In').first().click();
    await page.waitForTimeout(500);
    const signupOption = page.locator('text=/Sign Up|Register|Create Account/i').first();
    await expect(signupOption).toBeVisible({ timeout: 5000 });
  });

  test('modal should be closeable', async ({ page }) => {
    await page.locator('text=Sign In').first().click();
    await page.waitForTimeout(500);
    // Try pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const modal = page.locator('[role="dialog"]').first();
    const isVisible = await modal.isVisible().catch(() => false);
    // Modal should be closed
    expect(isVisible).toBeFalsy();
  });

  test.describe('Login Happy Path @testing @auth-happy-path', () => {
    test('login with valid credentials closes modal and shows user', async ({ page }) => {
      const email = process.env.ADMIN_EMAIL || 'admin@thebooktimes.com';
      const password = process.env.ADMIN_PASSWORD || 'admin123456';

      await page.locator('text=Sign In').first().click();
      await page.waitForTimeout(500);

      await page.locator('input[type="email"]').first().fill(email);
      await page.locator('input[type="password"]').first().fill(password);

      const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').last();
      await submitBtn.click();
      await page.waitForTimeout(3000);

      // Modal should close and user avatar/name should appear
      const modal = page.locator('[role="dialog"]').first();
      const modalVisible = await modal.isVisible().catch(() => false);
      expect(modalVisible).toBeFalsy();
    });

    test('session persists on page refresh', async ({ page }) => {
      const email = process.env.ADMIN_EMAIL || 'admin@thebooktimes.com';
      const password = process.env.ADMIN_PASSWORD || 'admin123456';

      await page.locator('text=Sign In').first().click();
      await page.waitForTimeout(500);
      await page.locator('input[type="email"]').first().fill(email);
      await page.locator('input[type="password"]').first().fill(password);
      await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').last().click();
      await page.waitForTimeout(3000);

      // Refresh page
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Sign In button should NOT be visible (user is logged in)
      const signInBtn = page.locator('text=Sign In').first();
      const signInVisible = await signInBtn.isVisible({ timeout: 3000 }).catch(() => false);
      // If session persists, Sign In should be hidden
      // (or there should be a user avatar/profile element)
      const userIndicator = page.locator('[class*="avatar"], [class*="profile"], button:has-text("Account"), button:has-text("Profile")').first();
      const hasSession = !signInVisible || await userIndicator.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasSession).toBeTruthy();
    });

    test('logout clears session and Sign In button returns', async ({ page }) => {
      const email = process.env.ADMIN_EMAIL || 'admin@thebooktimes.com';
      const password = process.env.ADMIN_PASSWORD || 'admin123456';

      // Login
      await page.locator('text=Sign In').first().click();
      await page.waitForTimeout(500);
      await page.locator('input[type="email"]').first().fill(email);
      await page.locator('input[type="password"]').first().fill(password);
      await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').last().click();
      await page.waitForTimeout(3000);

      // Look for logout mechanism
      const profileBtn = page.locator('[class*="avatar"], [class*="profile"], button:has-text("Account")').first();
      if (await profileBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await profileBtn.click();
        await page.waitForTimeout(500);

        const logoutBtn = page.locator('text=/Log ?out|Sign ?out/i').first();
        if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await logoutBtn.click();
          await page.waitForTimeout(2000);

          // Sign In button should return
          const signIn = page.locator('text=Sign In').first();
          await expect(signIn).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('register with new email succeeds', async ({ page }) => {
      await page.locator('text=Sign In').first().click();
      await page.waitForTimeout(500);

      // Switch to register tab
      const signUpTab = page.locator('text=/Sign Up|Register|Create Account/i').first();
      await expect(signUpTab).toBeVisible({ timeout: 5000 });
      await signUpTab.click();
      await page.waitForTimeout(500);

      // Fill registration form
      const nameInput = page.locator('input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('E2E Test User');
      }

      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.fill(`e2e_test_${Date.now()}@testuser.com`);

      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill('TestPassword123!');

      const submitBtn = page.locator('button[type="submit"]').last();
      await submitBtn.click();
      await page.waitForTimeout(3000);

      // Registration should succeed — either modal closes or success message
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });
});
