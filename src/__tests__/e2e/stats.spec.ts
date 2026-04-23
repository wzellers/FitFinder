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

async function navigateToStats(page: Page) {
  await page.locator('button:has-text("Stats")').first().click();
  await page.waitForLoadState('networkidle');
}

test.describe('Wardrobe Stats', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToStats(page);
  });

  test('shows Wardrobe Statistics heading', async ({ page }) => {
    await expect(page.locator('text=Wardrobe Statistics')).toBeVisible({ timeout: 10_000 });
  });

  test('shows time period toggle buttons (Week, Month, All Time)', async ({ page }) => {
    await expect(page.locator('button:has-text("Week")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Month")')).toBeVisible();
    await expect(page.locator('button:has-text("All Time")')).toBeVisible();
  });

  test('can switch between time periods', async ({ page }) => {
    await expect(page.locator('button:has-text("Week")')).toBeVisible({ timeout: 10_000 });

    // Click Month
    await page.locator('button:has-text("Month")').click();
    await page.waitForLoadState('networkidle');

    // Click All Time
    await page.locator('button:has-text("All Time")').click();
    await page.waitForLoadState('networkidle');

    // Click back to Week
    await page.locator('button:has-text("Week")').click();
    await page.waitForLoadState('networkidle');
  });

  test('shows stat cards with wardrobe data', async ({ page }) => {
    // Should show at least "Total Items" or similar stat labels
    await expect(
      page.locator('text=/Total Items|Total Wears|Clean|Dirty/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows category breakdown', async ({ page }) => {
    // Should show section names in the stats
    await expect(
      page.locator('text=/Tops|Bottoms|Shoes/').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
