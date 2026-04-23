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

test.describe('Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('all five tabs are visible in navigation', async ({ page }) => {
    // Desktop nav should show all tabs
    for (const tab of ['Closet', 'Generator', 'Calendar', 'Stats', 'Preferences']) {
      await expect(page.locator(`button:has-text("${tab}")`).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('default tab is Closet', async ({ page }) => {
    // Closet content should be shown (has Add Item button)
    await expect(page.locator('button:has-text("Add Item")')).toBeVisible({ timeout: 10_000 });
  });

  test('can navigate to each tab and see correct content', async ({ page }) => {
    // Generator tab
    await page.locator('button:has-text("Generator")').first().click();
    await expect(page.locator('button:has-text("Generate")').first()).toBeVisible({ timeout: 10_000 });

    // Calendar tab
    await page.locator('button:has-text("Calendar")').first().click();
    await expect(page.locator('text=/Sun|Mon|Tue|Wed|Thu|Fri|Sat/').first()).toBeVisible({ timeout: 10_000 });

    // Stats tab
    await page.locator('button:has-text("Stats")').first().click();
    await expect(page.locator('text=Wardrobe Statistics')).toBeVisible({ timeout: 10_000 });

    // Preferences tab
    await page.locator('button:has-text("Preferences")').first().click();
    await expect(page.locator('text=/Weather|Colors/').first()).toBeVisible({ timeout: 10_000 });

    // Back to Closet
    await page.locator('button:has-text("Closet")').first().click();
    await expect(page.locator('button:has-text("Add Item")')).toBeVisible({ timeout: 10_000 });
  });

  test('Sign Out button is visible and functional', async ({ page }) => {
    const signOutBtn = page.locator('button:has-text("Sign Out")').first();
    await expect(signOutBtn).toBeVisible({ timeout: 10_000 });

    await signOutBtn.click();

    // Should return to login form
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  });

  test('FitFinder logo is visible in header', async ({ page }) => {
    await expect(page.locator('text=FitFinder').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Cross-tab Integration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigating between Closet and Generator preserves app state', async ({ page }) => {
    // Start on Closet
    await expect(page.locator('button:has-text("Add Item")')).toBeVisible({ timeout: 10_000 });

    // Go to Generator
    await page.locator('button:has-text("Generator")').first().click();
    await expect(page.locator('button:has-text("Generate")').first()).toBeVisible({ timeout: 10_000 });

    // Back to Closet — should still work
    await page.locator('button:has-text("Closet")').first().click();
    await expect(page.locator('button:has-text("Add Item")')).toBeVisible({ timeout: 10_000 });
  });

  test('Generator shows weather panel and can trigger generation', async ({ page }) => {
    await page.locator('button:has-text("Generator")').first().click();
    await page.waitForLoadState('networkidle');

    // Weather section should be present
    await expect(page.locator('text=Weather')).toBeVisible({ timeout: 10_000 });

    // Click Generate
    await page.locator('button:has-text("Generate")').first().click();

    // Should show outfit or message about needing items
    await expect(
      page.locator('text=/no items|add some|Top|Bottom|Shoes|No valid/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Preferences shows Weather and Colors sections', async ({ page }) => {
    await page.locator('button:has-text("Preferences")').first().click();
    await page.waitForLoadState('networkidle');

    // Weather section
    await expect(page.locator('text=/Weather/').first()).toBeVisible({ timeout: 10_000 });

    // Switch to Colors
    await page.locator('button:has-text("Colors")').first().click();
    await expect(page.locator('text=/Color/i').first()).toBeVisible({ timeout: 10_000 });
  });
});
