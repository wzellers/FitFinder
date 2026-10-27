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
  // The outfit is the focus: on a laptop-sized screen it and the Generate
  // button start above the fold.
  await expect(page.getByRole('button', { name: 'Generate outfit' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Choose a top' })).toBeInViewport();
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

test('shows every outfit once before repeating any', async ({ page }) => {
  // The seeded closet makes 4 clean outfits: 2 tops × 2 bottoms × 1 pair of shoes.
  await openApp(page, 'Outfits');
  const shown = new Set<string>();
  for (let i = 0; i < 4; i++) {
    await generate(page);
    shown.add(`${await currentPiece(page, 'top')} + ${await currentPiece(page, 'bottom')}`);
  }
  expect(shown.size).toBe(4);
});

test('"Try another" teaches the model a little, without counting as a rating', async ({ page }) => {
  const { db, userId } = await testDb();
  await openApp(page, 'Outfits');
  await generate(page);
  await generate(page); // "Try another" on the first outfit

  await expect
    .poll(async () => {
      const { data } = await db
        .from('outfit_model_weights')
        .select('feature_meta')
        .eq('user_id', userId)
        .maybeSingle();
      return (data?.feature_meta as { updates?: number } | undefined)?.updates;
    })
    .toBe(0);
  // It did learn: the belief is more certain than the cold start (precision 3).
  const model = ok(
    await db.from('outfit_model_weights').select('feature_meta').eq('user_id', userId).single(),
    'model',
  );
  const { precision } = (model.feature_meta as { posterior: { precision: number[][] } }).posterior;
  expect(Math.max(...precision.map((row, i) => row[i]))).toBeGreaterThan(3);
  // The first outfit is logged as skipped.
  await expect
    .poll(async () => {
      const { data } = await db
        .from('outfit_impressions')
        .select('outcome')
        .eq('user_id', userId)
        .order('shown_at');
      return (data ?? []).map((r) => r.outcome);
    })
    .toEqual(['skipped', null]);
  // Skipping logs nothing as worn or rated.
  expect(
    ok(await db.from('outfit_wears').select('id').eq('user_id', userId), 'wears'),
  ).toHaveLength(0);
  expect(
    ok(await db.from('outfit_ratings').select('id').eq('user_id', userId), 'ratings'),
  ).toHaveLength(0);
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

async function impressionOutcomes(db: Awaited<ReturnType<typeof testDb>>['db'], userId: string) {
  const { data } = await db
    .from('outfit_impressions')
    .select('outcome')
    .eq('user_id', userId)
    .order('shown_at');
  return (data ?? []).map((r) => r.outcome);
}

test('swaps just one piece with its arrow, and learns it as a skip', async ({ page }) => {
  const { db, userId } = await testDb();
  await openApp(page, 'Outfits');
  await generate(page);
  const before = {
    top: await currentPiece(page, 'top'),
    bottom: await currentPiece(page, 'bottom'),
    shoes: await currentPiece(page, 'shoes'),
  };

  // The seeded closet has two clean tops, so the other one comes in.
  await page.getByRole('button', { name: 'Swap top (slide right)' }).click();
  await expect(slot(page, 'top')).not.toHaveAttribute('aria-label', `Change top: ${before.top}`);
  expect(await currentPiece(page, 'bottom')).toBe(before.bottom);
  expect(await currentPiece(page, 'shoes')).toBe(before.shoes);

  // Only one pair of shoes is clean: there's nothing to swap them for.
  await page.getByRole('button', { name: 'Swap shoes (slide left)' }).click();
  await expect(
    page.getByText('No other pair of shoes goes with the rest of this outfit right now.'),
  ).toBeVisible();

  // The first outfit was passed on; the swapped one is still on screen.
  await expect.poll(() => impressionOutcomes(db, userId)).toEqual(['skipped', null]);
});

test('swipes a piece sideways to swap it, without opening the picker', async ({ page }) => {
  await openApp(page, 'Outfits');
  await generate(page);
  const top = await currentPiece(page, 'top');

  await slot(page, 'top').scrollIntoViewIfNeeded();
  const box = (await slot(page, 'top').boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 6 });
  await page.mouse.up();

  await expect(slot(page, 'top')).not.toHaveAttribute('aria-label', `Change top: ${top}`);
  await expect(page.getByRole('dialog', { name: 'Choose a top' })).toHaveCount(0);
  // The drag didn't select the page's text.
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
});

test("a kept piece can't be swapped", async ({ page }) => {
  await openApp(page, 'Outfits');
  await generate(page);
  await page.getByRole('button', { name: 'Lock top' }).click();
  await expect(page.getByRole('button', { name: 'Swap top (slide left)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Swap top (slide right)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Swap bottom (slide left)' })).toBeEnabled();
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
    await db.from('outfit_wears').select('worn_date, top_id, features').eq('user_id', userId),
    'wears',
  );
  expect(wears).toHaveLength(1);
  expect(wears![0].worn_date).toBe(localDate());
  // The outfit's features as worn are stored, so a later rating learns from them.
  const features = wears![0].features as { items: string[]; values: Record<string, number> };
  expect(features.items[0]).toBe(wears![0].top_id);
  expect(features.values.variety).toBe(1); // nothing worn recently

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

test('rates an outfit without wearing it, learns from it, and shows the next', async ({ page }) => {
  const { db, userId } = await testDb();
  await openApp(page, 'Outfits');
  await generate(page);
  const shown = {
    top: await slot(page, 'top').getAttribute('aria-label'),
    bottom: await slot(page, 'bottom').getAttribute('aria-label'),
  };

  const rating = page.getByRole('group', { name: /Rate this outfit/ });
  await rating.getByRole('button', { name: '8 out of 10' }).click();
  await expect(toast(page, "Rated 8/10. Here's another.")).toBeVisible();

  // Saved for exactly the shown outfit, with the features it was learned from.
  const rows = ok(
    await db
      .from('outfit_ratings')
      .select('rating, top_id, features, rated_on')
      .eq('user_id', userId),
    'ratings',
  );
  expect(rows).toHaveLength(1);
  expect(rows![0].rating).toBe(8);
  const features = rows![0].features as { items: string[]; values: Record<string, number> };
  expect(features.items[0]).toBe(rows![0].top_id);
  expect(Object.keys(features.values).sort()).toEqual(['color', 'rating', 'variety']);

  // The model learned from it, and nothing was logged as worn.
  const model = ok(
    await db.from('outfit_model_weights').select('feature_meta').eq('user_id', userId).single(),
    'model',
  );
  expect((model.feature_meta as { updates: number }).updates).toBe(1);
  expect(
    ok(await db.from('outfit_wears').select('id').eq('user_id', userId), 'wears'),
  ).toHaveLength(0);

  // Both shown outfits were logged for measuring recommendations, the rated
  // one with its outcome.
  await expect
    .poll(async () => {
      const { data } = await db
        .from('outfit_impressions')
        .select('outcome, rating, top_id, predicted')
        .eq('user_id', userId)
        .order('shown_at');
      return data ?? [];
    })
    .toMatchObject([
      { outcome: 'rated', rating: 8, top_id: rows![0].top_id },
      { outcome: null, rating: null },
    ]);

  // A next outfit is shown (the reels spin again; with a small closet it may
  // repeat), and rating stays available.
  await expect(slot(page, 'top')).toBeVisible();
  expect(shown.top).toBeTruthy();
  await expect(rating.getByRole('button', { name: '8 out of 10' })).toBeEnabled();
});
