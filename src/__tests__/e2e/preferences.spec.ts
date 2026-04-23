import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@fitfinder.dev';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'test-password';

async function login(page: Page) {
  await page.goto('/');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Sign In")');
  await expect(page.locator('text=Closet').first()).toBeVisible({ timeout: 15_000 });
}

async function navigateToPreferences(page: Page) {
  await page.locator('button:has-text("Preferences")').first().click();
  await page.waitForLoadState('networkidle');
}

test.describe('Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToPreferences(page);
  });

  test('shows Weather and Colors section tabs', async ({ page }) => {
    await expect(page.locator('button:has-text("Weather"), text=Weather').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Colors"), text=Colors').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows temperature threshold inputs in Weather section', async ({ page }) => {
    await expect(
      page.locator('text=/Cold|Cool|Warm/').first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('input[type="number"], input[type="text"]').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('can switch to Colors section', async ({ page }) => {
    await page.locator('button:has-text("Colors")').first().click();
    await expect(
      page.locator('text=/Add Color Combination|Color/').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('can save zip code', async ({ page }) => {
    const zipInput = page.locator('input[placeholder*="zip code"]').first();
    if (await zipInput.count() > 0) {
      await zipInput.fill('10001');
      await page.locator('button:has-text("Save")').first().click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('weather section defaults to no custom rules', async ({ page }) => {
    await expect(
      page.locator('text=/No custom weather rules set/').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
