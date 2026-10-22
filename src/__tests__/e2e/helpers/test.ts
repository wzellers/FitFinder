// The suite's `test`: every test starts from a freshly seeded test account,
// and fails if the page logs an error or throws, even when the assertions
// pass. A green run therefore means nothing broke silently.

import { test as base, expect, type Page } from '@playwright/test';
import { resetAndSeed, type SeededIds } from './db';

type SeedOptions = Parameters<typeof resetAndSeed>[0];

// Errors that aren't the app's fault.
const IGNORED_ERRORS = [/Download the React DevTools/, /\[Fast Refresh\]/, /favicon\.ico/];

export const test = base.extend<{
  seedOptions: SeedOptions;
  seeded: SeededIds;
  /** Extra error patterns a test expects (e.g. a failed login's 400). */
  allowedErrors: RegExp[];
  pageErrors: string[];
}>({
  seedOptions: [{}, { option: true }],
  allowedErrors: [[], { option: true }],

  // Auto: every test gets a clean account, whether or not it reads the ids.
  seeded: [
    async ({ seedOptions }, use) => {
      await use(await resetAndSeed(seedOptions));
    },
    { auto: true },
  ],

  pageErrors: [
    async ({ page, allowedErrors }, use) => {
      const ignored = [...IGNORED_ERRORS, ...allowedErrors];
      const errors: string[] = [];
      page.on('pageerror', (err) => {
        if (!ignored.some((re) => re.test(err.message))) errors.push(`pageerror: ${err.message}`);
      });
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (!ignored.some((re) => re.test(text))) errors.push(`console.error: ${text}`);
      });
      await use(errors);
      expect(errors, 'the page logged errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export type Tab = 'Closet' | 'Outfits' | 'Calendar' | 'Stats' | 'Settings';

/** Open the app (signed in via saved state) and wait for the main nav. */
export async function openApp(page: Page, tab: Tab = 'Closet') {
  await page.goto('/');
  await expect(nav(page)).toBeVisible();
  if (tab !== 'Closet') await goToTab(page, tab);
}

export const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

export async function goToTab(page: Page, tab: Tab) {
  await nav(page).getByRole('button', { name: tab, exact: true }).click();
  await expect(nav(page).getByRole('button', { name: tab, exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
}

/** The toast region's latest message. */
export const toast = (page: Page, text: string | RegExp) =>
  page.getByRole('status').filter({ hasText: text }).first();

/** Every <img> inside `scope` has finished loading real pixels. */
export async function expectImagesLoaded(page: Page, selector: string, min = 1) {
  const imgs = page.locator(selector);
  await expect.poll(() => imgs.count()).toBeGreaterThanOrEqual(min);
  await expect
    .poll(() =>
      imgs.evaluateAll((els) =>
        (els as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth > 0),
      ),
    )
    .toBe(true);
}
