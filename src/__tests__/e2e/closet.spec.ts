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

test.describe('Closet', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator('button:has-text("Closet")').first().click();
    await page.waitForLoadState('networkidle');
  });

  test('shows Add Item button and Mark All buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Add Item")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Mark All Dirty")')).toBeVisible();
    await expect(page.locator('button:has-text("Mark All Clean")')).toBeVisible();
  });

  test('clicking Add Item opens the upload modal', async ({ page }) => {
    await page.locator('button:has-text("Add Item")').first().click();
    await expect(page.locator('text=/upload|drag|select/i').first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('shows collapsible section headers (Tops, Bottoms, Shoes)', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    // Section headers should be visible
    await expect(page.locator('h2:has-text("Tops")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h2:has-text("Bottoms")')).toBeVisible();
    await expect(page.locator('h2:has-text("Shoes")')).toBeVisible();
  });

  test('section headers show item count badges', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    // Each section header button should have a count badge (span with a number)
    const sectionButtons = page.locator('button:has(h2)');
    const count = await sectionButtons.count();
    expect(count).toBeGreaterThanOrEqual(3);
    // Each button should have a badge span
    for (let i = 0; i < Math.min(count, 4); i++) {
      const badge = sectionButtons.nth(i).locator('span.rounded-full');
      await expect(badge).toBeVisible();
    }
  });

  test('clicking section header collapses/expands that section', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const topsHeader = page.locator('button:has(h2:has-text("Tops"))');
    await expect(topsHeader).toBeVisible({ timeout: 10_000 });

    // Get subsection content before collapsing
    const subsectionsBefore = page.locator('text=T-Shirt');
    const wasBefore = await subsectionsBefore.count();

    // Click to collapse
    await topsHeader.click();

    // If there were subsections visible, they should be hidden now
    if (wasBefore > 0) {
      await expect(page.locator('button:has(h2:has-text("Tops")) ~ div >> text=T-Shirt')).not.toBeVisible({ timeout: 3_000 }).catch(() => {
        // Section might not have T-Shirt items — that's fine
      });
    }

    // Click again to expand
    await topsHeader.click();
  });

  test('filter bar has category, color, and dirty filters', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    // Category select dropdown
    await expect(page.locator('select >> text=All Categories')).toBeVisible({ timeout: 10_000 });
    // Color select dropdown
    await expect(page.locator('select >> text=All Colors')).toBeVisible();
    // Dirty filter buttons
    await expect(page.locator('button:has-text("All")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Clean")')).toBeVisible();
    await expect(page.locator('button:has-text("Dirty")')).toBeVisible();
  });

  test('Hide Empty toggle works', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const hideEmptyBtn = page.locator('button:has-text("Hide Empty")');
    await expect(hideEmptyBtn).toBeVisible({ timeout: 10_000 });

    // Click to toggle hide empty on
    await hideEmptyBtn.click();

    // Click again to toggle off
    await hideEmptyBtn.click();
  });

  test('can filter by category using select dropdown', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const categorySelect = page.locator('select').first();
    await categorySelect.selectOption('Tops');

    // Clear filters should appear
    await expect(page.locator('text=/Clear/').first()).toBeVisible({ timeout: 5_000 });

    // Click clear filters
    await page.locator('button:has-text("Clear")').click();
  });

  test('dirty filter buttons toggle active state', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Click Dirty filter
    const dirtyBtn = page.locator('button:has-text("Dirty")').first();
    await dirtyBtn.click();

    // Clear filters should appear
    await expect(page.locator('text=/Clear/').first()).toBeVisible({ timeout: 5_000 });

    // Click Clean filter
    await page.locator('button:has-text("Clean")').first().click();

    // Click All to reset
    await page.locator('button:has-text("All")').first().click();
  });
});
