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

async function navigateToGenerator(page: Page) {
  await page.locator('button:has-text("Generator")').first().click();
  await page.waitForLoadState('networkidle');
}

test.describe('Outfit Generator', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToGenerator(page);
  });

  test('shows Generator tab with Generate button', async ({ page }) => {
    await expect(page.locator('button:has-text("Generate")').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows Weather section', async ({ page }) => {
    await expect(page.locator('text=Weather')).toBeVisible({ timeout: 10_000 });
  });

  test('shows Actions panel with Save and Wear Today', async ({ page }) => {
    await expect(page.locator('text=Actions')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Save Outfit")')).toBeVisible();
    await expect(page.locator('button:has-text("Wear Today")')).toBeVisible();
  });

  test('shows View Calendar button', async ({ page }) => {
    await expect(page.locator('button:has-text("View Calendar")')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking View Calendar navigates to Calendar tab', async ({ page }) => {
    await page.locator('button:has-text("View Calendar")').click();
    // Should show calendar day headers
    await expect(
      page.locator('text=/Sun|Mon|Tue|Wed|Thu|Fri|Sat/').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows Saved tab button', async ({ page }) => {
    await expect(
      page.locator('button').filter({ hasText: /Saved/ }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Generate produces outfit slots or a no-items message', async ({ page }) => {
    await page.locator('button:has-text("Generate")').first().click();
    // Either outfit slots appear, or a message about needing items
    await expect(
      page.locator('text=/no items|add some|Top|Bottom|Shoes|No valid/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('can switch to Saved tab', async ({ page }) => {
    await page.locator('button').filter({ hasText: /Saved/ }).first().click();
    // Should show "No saved outfits" or list of saved outfits
    await expect(
      page.locator('text=/No saved outfits|saved outfits/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
