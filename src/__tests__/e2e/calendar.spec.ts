import type { Page } from '@playwright/test';
import { test, expect, openApp } from './helpers/test';
import { localDate, ok, testDb } from './helpers/db';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const daysAgoDate = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/** Show the month containing the day `daysAgo` days back. */
async function showMonthOf(page: Page, daysAgo: number) {
  const d = daysAgoDate(daysAgo);
  if (d.getMonth() !== new Date().getMonth()) {
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByText(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`)).toBeVisible();
  }
}

/** The calendar cell for the day `daysAgo` days back (its month must be shown). */
function dayCell(page: Page, daysAgo: number) {
  const label = daysAgoDate(daysAgo).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return page.getByRole('button', { name: new RegExp(`^${label}: `) });
}

test('moves between months and back to today', async ({ page }) => {
  await openApp(page, 'Calendar');
  const now = new Date();
  const thisMonth = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  await expect(page.getByText(thisMonth, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /, today: / })).toBeVisible();

  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByText(thisMonth, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByText(thisMonth, { exact: true })).toBeVisible();
});

test('logs a past day by picking items, edits it, and deletes it', async ({ page, seeded }) => {
  const { db, userId } = await testDb();
  await openApp(page, 'Calendar');

  await showMonthOf(page, 3);
  const day = dayCell(page, 3);
  await expect(day).toHaveAccessibleName(/: nothing logged$/);
  await day.click();
  const dialog = page.getByRole('dialog', { name: /^Log outfit for / });
  await dialog
    .getByRole('group', { name: 'Tops' })
    .getByRole('button', { name: 'White T-Shirt' })
    .click();
  await dialog
    .getByRole('group', { name: 'Bottoms' })
    .getByRole('button', { name: 'Denim Jeans' })
    .click();
  await dialog
    .getByRole('group', { name: 'Shoes' })
    .getByRole('button', { name: 'White Shoes' })
    .click();
  await dialog.getByRole('button', { name: '7 out of 10' }).click();
  await dialog.getByLabel(/Notes/).fill('E2E: comfy');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  const logged = dayCell(page, 3);
  await expect(logged).toHaveAccessibleName(/: outfit logged, rated 7 out of 10$/);

  const rows = ok(
    await db.from('outfit_wears').select('worn_date, top_id, rating, notes').eq('user_id', userId),
    'wears',
  );
  expect(rows).toEqual([
    { worn_date: localDate(-3), top_id: seeded.whiteTee, rating: 7, notes: 'E2E: comfy' },
  ]);

  // Edit the rating.
  await logged.click();
  const edit = page.getByRole('dialog', { name: /^Edit outfit for / });
  await edit.getByRole('button', { name: '9 out of 10' }).click();
  await edit.getByRole('button', { name: 'Update' }).click();
  await expect(logged).toHaveAccessibleName(/rated 9 out of 10$/);

  // Delete it.
  await logged.click();
  await page
    .getByRole('dialog', { name: /^Edit outfit for / })
    .getByRole('button', { name: 'Delete entry' })
    .click();
  await page
    .getByRole('dialog', { name: /Delete this day's outfit/ })
    .getByRole('button', { name: 'Delete entry' })
    .click();
  await expect(logged).toHaveAccessibleName(/: nothing logged$/);
  expect(ok(await db.from('outfit_wears').select('id').eq('user_id', userId), 'wears')).toEqual([]);
});

test('logs a day from a saved outfit', async ({ page, seeded }) => {
  const { db, userId } = await testDb();
  ok(
    await db.from('saved_outfits').insert({
      user_id: userId,
      name: 'E2E Work',
      outfit_items: {
        top_id: seeded.navyShirt,
        bottom_id: seeded.beigePants,
        shoes_id: seeded.whiteShoes,
      },
    }),
    'saved outfit',
  );

  await openApp(page, 'Calendar');
  await showMonthOf(page, 2);
  await dayCell(page, 2).click();
  const dialog = page.getByRole('dialog', { name: /^Log outfit for / });
  await dialog.getByRole('button', { name: 'From a saved outfit' }).click();
  await dialog.getByLabel('Saved outfit').selectOption({ label: 'E2E Work' });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  const rows = ok(
    await db.from('outfit_wears').select('top_id, bottom_id, shoes_id').eq('user_id', userId),
    'wears',
  );
  expect(rows).toEqual([
    { top_id: seeded.navyShirt, bottom_id: seeded.beigePants, shoes_id: seeded.whiteShoes },
  ]);
});
