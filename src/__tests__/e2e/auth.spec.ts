import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@fitfinder.dev';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'test-password';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows AuthForm when not logged in', async ({ page }) => {
    // The auth form should be visible
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('can switch between sign-in and sign-up modes', async ({ page }) => {
    // Ensure we see the sign-in form
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });

    // Click the toggle to switch to sign-up
    await page.click('text=Sign up');
    await expect(page.locator('button:has-text("Sign Up")')).toBeVisible({ timeout: 5_000 });

    // Switch back to sign-in
    await page.click('text=Sign in');
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible({ timeout: 5_000 });
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign In")');

    // Should show an error message (toast or inline)
    await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({ timeout: 10_000 });
  });

  test('can log in with valid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Sign In")');

    // After login the main tabs should appear
    await expect(page.locator('text=Closet').first()).toBeVisible({ timeout: 15_000 });
  });

  test('can log out', async ({ page }) => {
    // Log in first
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('text=Closet').first()).toBeVisible({ timeout: 15_000 });

    // Sign out
    await page.locator('button:has-text("Sign Out")').first().click();

    // Auth form should reappear
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  });

  test('session persists on page reload', async ({ page }) => {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('text=Closet').first()).toBeVisible({ timeout: 15_000 });

    // Reload and confirm still logged in
    await page.reload();
    await expect(page.locator('text=Closet').first()).toBeVisible({ timeout: 15_000 });
  });
});
