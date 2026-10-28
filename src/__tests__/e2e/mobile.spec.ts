// Phone-sized checks (Pixel 7), run by the "mobile" project.

import type { Page } from '@playwright/test';
import { test, expect, openApp, goToTab, nav, type Tab } from './helpers/test';

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
}

test('every page fits the screen and the nav stays reachable', async ({ page }) => {
  await openApp(page);
  const box = await nav(page).boundingBox();
  const viewport = page.viewportSize()!;
  // The tab bar sits at the bottom of the screen.
  expect(box!.y + box!.height).toBeGreaterThan(viewport.height * 0.8);

  for (const tab of ['Closet', 'Outfits', 'Calendar', 'Stats', 'Settings'] as Tab[]) {
    await goToTab(page, tab);
    await expectNoSidewaysScroll(page);
  }
});

test('settings sections fit as tabs without truncation', async ({ page }) => {
  await openApp(page, 'Settings');
  const tabs = page.getByRole('navigation', { name: 'Preference sections' });
  for (const name of ['Weather', 'Occasions', 'Colors', 'Email']) {
    const button = tabs.getByRole('button', { name });
    await expect(button).toBeVisible();
    const label = button.locator('span');
    expect(
      await label.evaluate((el) => el.scrollWidth <= el.clientWidth),
      `"${name}" is cut off`,
    ).toBe(true);
  }
  await tabs.getByRole('button', { name: 'Email' }).click();
  await expect(page.getByRole('switch', { name: 'Send me the daily email' })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test('generates an outfit on a phone', async ({ page }) => {
  await openApp(page, 'Outfits');
  // Visible straight away, without scrolling.
  await expect(page.getByRole('button', { name: 'Generate outfit' })).toBeInViewport();
  await page.getByRole('button', { name: 'Generate outfit' }).click();
  await expect(page.getByRole('button', { name: /^Change top: / })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Change shoes: / })).toBeVisible();
  await expectNoSidewaysScroll(page);
});
