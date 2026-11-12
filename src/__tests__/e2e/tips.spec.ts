import { test, expect, openApp, goToTab } from './helpers/test';

test.use({ showTips: true });

const tips = (page: import('@playwright/test').Page) => page.getByTestId('tip-tour');

test("shows each screen's tips once, and again after Show tips again", async ({ page }) => {
  await page.goto('/');

  // The Closet's tips, stepped through to the end.
  await expect(page.getByRole('dialog', { name: 'Add more clothes' })).toBeVisible();
  await expect(tips(page)).toContainText('Tip 1 of 3');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit or reorder' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'In the wash' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(tips(page)).toHaveCount(0);

  // The Outfits tips, skipped.
  await goToTab(page, 'Outfits');
  await expect(page.getByRole('dialog', { name: 'Swap one piece' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip tips' }).click();
  await expect(tips(page)).toHaveCount(0);

  // Seen tips stay seen after a reload.
  await openApp(page);
  await goToTab(page, 'Outfits');
  await page.waitForTimeout(1500);
  await expect(tips(page)).toHaveCount(0);

  // Settings → Effects → Show tips again brings them back.
  await goToTab(page, 'Settings');
  await expect(page.getByRole('dialog', { name: 'Make it yours' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Effects' }).click();
  await page.getByRole('button', { name: /Show tips again/ }).click();
  await expect(page.getByRole('dialog', { name: 'Make it yours' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await goToTab(page, 'Closet');
  await expect(page.getByRole('dialog', { name: 'Add more clothes' })).toBeVisible();
});
