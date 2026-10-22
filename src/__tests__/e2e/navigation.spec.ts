import { test, expect, openApp, goToTab, nav, type Tab } from './helpers/test';

const PAGES: Array<[Tab, string]> = [
  ['Closet', 'Closet'],
  ['Outfits', "Today's fit"],
  ['Calendar', 'Calendar'],
  ['Stats', 'Stats'],
  ['Settings', 'Settings'],
];

test('opens on the closet with every tab in the nav', async ({ page }) => {
  await openApp(page);
  for (const [tab] of PAGES) {
    await expect(nav(page).getByRole('button', { name: tab, exact: true })).toBeVisible();
  }
  await expect(nav(page).getByRole('button', { name: 'Closet' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { level: 2, name: 'Closet' })).toBeVisible();
});

test('every tab loads its page without errors', async ({ page }) => {
  await openApp(page);
  for (const [tab, heading] of PAGES) {
    await goToTab(page, tab);
    await expect(page.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible();
    // No page should show its "couldn't load" toast.
    await expect(page.getByRole('alert').filter({ hasText: /couldn.t load/i })).toHaveCount(0);
  }
});

test('the generated outfit survives switching tabs', async ({ page }) => {
  await openApp(page, 'Outfits');
  await page.getByRole('button', { name: 'Generate outfit' }).click();
  const top = page.getByRole('button', { name: /^Change top: / });
  await expect(top).toBeVisible();
  const name = await top.getAttribute('aria-label');

  await goToTab(page, 'Stats');
  await goToTab(page, 'Outfits');
  await expect(page.getByRole('button', { name: name! })).toBeVisible();
});
