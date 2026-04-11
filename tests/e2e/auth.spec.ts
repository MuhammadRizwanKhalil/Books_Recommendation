import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
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
});
