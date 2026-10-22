import type { Page } from '@playwright/test';
import { test, expect, openApp, goToTab, toast, expectImagesLoaded } from './helpers/test';
import { localDate, ok, testDb } from './helpers/db';

const slot = (page: Page, part: 'top' | 'bottom' | 'shoes') =>
  page.getByRole('button', { name: new RegExp(`^Change ${part}: `) });

async function currentPiece(page: Page, part: 'top' | 'bottom' | 'shoes') {
  const label = await slot(page, part).getAttribute('aria-label');
  return label!.replace(`Change ${part}: `, '');
}

async function generate(page: Page) {
  const button = page.getByRole('button', { name: /^(Generate outfit|Try another outfit)$/ });
  await button.click();
  await expect(slot(page, 'top')).toBeVisible();
  await expect(slot(page, 'bottom')).toBeVisible();
  await expect(slot(page, 'shoes')).toBeVisible();
}

test('generates a full outfit from clean items only', async ({ page }) => {
  await openApp(page, 'Outfits');
  await expect(page.getByText('{ 5 clean items to pick from }')).toBeVisible();

  const tops = new Set<string>();
  for (let i = 0; i < 8; i++) {
    await generate(page);
    tops.add(await currentPiece(page, 'top'));
    expect(['Denim Jeans', 'Beige Pants']).toContain(await currentPiece(page, 'bottom'));
    expect(await currentPiece(page, 'shoes')).toBe('White Shoes');
  }
  // The dirty sweatshirt is never offered.
  expect([...tops].every((t) => ['White T-Shirt', 'Navy blue Button-Up Shirt'].includes(t))).toBe(
    true,
  );
  await expectImagesLoaded(page, 'button[aria-label^="Change "] img', 3);
});

test('a kept piece stays while the rest is regenerated', async ({ page }) => {
  await openApp(page, 'Outfits');
  await generate(page);
  const top = await currentPiece(page, 'top');

  await page.getByRole('button', { name: 'Lock top' }).click();
  await expect(page.getByRole('button', { name: 'Unlock top' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (let i = 0; i < 5; i++) {
    await generate(page);
    expect(await currentPiece(page, 'top')).toBe(top);
  }
});

test('picks a piece by hand', async ({ page }) => {
  await openApp(page, 'Outfits');
  await generate(page);
  await slot(page, 'top').click();
  const picker = page.getByRole('dialog', { name: 'Choose a top' });
  // Only clean tops are offered.
  await expect(picker.getByRole('button', { name: 'Black Sweatshirt' })).toHaveCount(0);
  await picker.getByRole('button', { name: 'Navy blue Button-Up Shirt' }).click();
  await expect(picker).toHaveCount(0);
  expect(await currentPiece(page, 'top')).toBe('Navy blue Button-Up Shirt');
});

test('saves an outfit, reopens it, and deletes it', async ({ page }) => {
  await openApp(page, 'Outfits');
  await generate(page);
  const top = await currentPiece(page, 'top');

  await page.getByRole('button', { name: 'Save outfit' }).click();
  const saveDialog = page.getByRole('dialog', { name: 'Save outfit' });
  await saveDialog.getByLabel('Name').fill('E2E Friday');
  await saveDialog.getByRole('button', { name: 'Save outfit' }).click();
  await expect(toast(page, 'Outfit saved.')).toBeVisible();

  await page.getByRole('button', { name: /^Saved \(1\)$/ }).click();
  await expect(page.getByText('E2E Friday')).toBeVisible();
  await expectImagesLoaded(page, 'li img', 3);

  // Persisted, not just in memory.
  await page.reload();
  await goToTab(page, 'Outfits');
  await page.getByRole('button', { name: /^Saved \(1\)$/ }).click();
  await page.getByRole('button', { name: 'Wear E2E Friday again' }).click();
  await expect(slot(page, 'top')).toHaveAttribute('aria-label', `Change top: ${top}`);

  await page.getByRole('button', { name: /^Saved \(1\)$/ }).click();
  await page.getByRole('button', { name: 'Delete E2E Friday' }).click();
  await page
    .getByRole('dialog', { name: 'Delete this saved outfit?' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(toast(page, 'Outfit deleted')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Saved \(0\)$/ })).toBeVisible();
  await expect(page.getByText('No saved outfits yet')).toBeVisible();
});

test("logs today's outfit once, and it shows in the calendar", async ({ page }) => {
  const { db, userId } = await testDb();
  await openApp(page, 'Outfits');
  await generate(page);
  const top = await currentPiece(page, 'top');

  await page.getByRole('button', { name: 'Wear today' }).click();
  await expect(toast(page, "Logged as today's outfit.")).toBeVisible();

  const wears = ok(
    await db.from('outfit_wears').select('worn_date, top_id').eq('user_id', userId),
    'wears',
  );
  expect(wears).toHaveLength(1);
  expect(wears![0].worn_date).toBe(localDate());

  // A second log for today is refused.
  await page.getByRole('button', { name: 'Wear today' }).click();
  await expect(toast(page, /already logged/i)).toBeVisible();
  expect(
    ok(await db.from('outfit_wears').select('id').eq('user_id', userId), 'wears'),
  ).toHaveLength(1);

  await goToTab(page, 'Calendar');
  await expect(page.getByRole('button', { name: /, today: outfit logged/ })).toBeVisible();
  await page.getByRole('button', { name: /, today: outfit logged/ }).click();
  await expect(page.getByRole('dialog', { name: /^Edit outfit for / })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: top, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
