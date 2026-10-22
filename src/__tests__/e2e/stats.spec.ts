import type { Page } from '@playwright/test';
import { test, expect, openApp } from './helpers/test';
import { localDate, ok, testDb } from './helpers/db';

/** The value printed next to a summary line, e.g. line(page, 'Items') → "6". */
const line = (page: Page, label: string) =>
  page
    .locator('dl > div')
    .filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) })
    .locator('dd');

const period = (page: Page, name: 'Week' | 'Month' | 'All time') =>
  page.getByRole('group', { name: 'Time period' }).getByRole('button', { name });

test('counts the closet', async ({ page }) => {
  await openApp(page, 'Stats');
  await expect(line(page, 'Items')).toHaveText('6');
  await expect(line(page, 'Tops')).toHaveText('3');
  await expect(line(page, 'Bottoms')).toHaveText('2');
  await expect(line(page, 'Shoes')).toHaveText('1');
  await expect(line(page, 'Clean')).toHaveText('5');
  await expect(line(page, 'In the wash')).toHaveText('1');
  await expect(line(page, 'Outfits logged')).toHaveText('0');
  await expect(line(page, 'Average rating')).toHaveText('—');
});

test('summarises logged outfits by period', async ({ page, seeded }) => {
  const { db, userId } = await testDb();
  const wear = (daysAgo: number, bottom: string, rating: number) => ({
    user_id: userId,
    worn_date: localDate(-daysAgo),
    top_id: seeded.whiteTee,
    bottom_id: bottom,
    shoes_id: seeded.whiteShoes,
    rating,
  });
  ok(
    await db
      .from('outfit_wears')
      .insert([
        wear(2, seeded.denimJeans, 8),
        wear(5, seeded.beigePants, 6),
        wear(60, seeded.denimJeans, 2),
      ]),
    'seed wears',
  );

  await openApp(page, 'Stats');
  await period(page, 'Week').click();
  await expect(period(page, 'Week')).toHaveAttribute('aria-pressed', 'true');
  await expect(line(page, 'Outfits logged')).toHaveText('2');
  await expect(line(page, 'Average rating')).toHaveText('7.0 / 10');
  const mostWorn = page.locator('section[aria-labelledby="most-worn"]');
  await expect(mostWorn.getByText('White T-Shirt')).toBeVisible();
  await expect(mostWorn.getByText('Worn 2 times').first()).toBeVisible();

  await period(page, 'All time').click();
  await expect(line(page, 'Outfits logged')).toHaveText('3');
  await expect(line(page, 'Average rating')).toHaveText('5.3 / 10');
  await expect(
    page.locator('section[aria-labelledby="neglected"]').getByText('Never worn').first(),
  ).toBeVisible();
});
