import type { Page } from '@playwright/test';
import { test, expect, openApp, goToTab, toast } from './helpers/test';
import { ok, testDb } from './helpers/db';

async function openSection(page: Page, name: 'Weather' | 'Occasions' | 'Colors' | 'Email') {
  await openApp(page, 'Settings');
  await page
    .getByRole('navigation', { name: 'Preference sections' })
    .getByRole('button', { name })
    .click();
}

test('saves a ZIP code, and Outfits shows live weather for it', async ({ page }) => {
  await openSection(page, 'Weather');
  await page.getByLabel('US ZIP code').fill('10001');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(toast(page, 'ZIP code saved.')).toBeVisible();

  await page.reload();
  await goToTab(page, 'Settings');
  await expect(page.getByLabel('US ZIP code')).toHaveValue('10001');

  // The forecast comes from OpenWeatherMap through /api/weather.
  await goToTab(page, 'Outfits');
  const weather = page.locator('section[aria-labelledby="weather-heading"]');
  await expect(weather.getByText(/^-?\d+°F$/)).toBeVisible();
  await expect(weather.getByRole('switch', { name: /Dress for the weather/ })).toBeChecked();
});

test('a ZIP code saved in Settings shows on Outfits without reloading', async ({ page }) => {
  // Outfits opened first, so it's already loaded (and kept) when the ZIP changes.
  await openApp(page, 'Outfits');
  const weather = page.locator('section[aria-labelledby="weather-heading"]');
  await expect(weather.getByText(/Add your ZIP code/)).toBeVisible();

  await goToTab(page, 'Settings');
  await page
    .getByRole('navigation', { name: 'Preference sections' })
    .getByRole('button', { name: 'Weather' })
    .click();
  await page.getByLabel('US ZIP code').fill('10001');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(toast(page, 'ZIP code saved.')).toBeVisible();

  await goToTab(page, 'Outfits');
  await expect(weather.getByText(/^-?\d+°F$/)).toBeVisible();
  await expect(weather.getByText(/Add your ZIP code/)).toHaveCount(0);
});

test('adds a liked color combination and deletes it', async ({ page }) => {
  await openSection(page, 'Colors');
  await page.getByRole('button', { name: 'Top Color' }).click();
  await page.getByRole('button', { name: 'navy blue', exact: true }).click();
  await page.getByRole('button', { name: 'Bottom Color' }).click();
  await page.getByRole('button', { name: 'beige', exact: true }).click();
  await page.getByRole('button', { name: 'Add to Liked' }).click();
  await expect(toast(page, 'Combination added')).toBeVisible();

  const combo = page.getByRole('button', { name: 'Edit Navy Blue top with Beige bottom' });
  await page.reload();
  await goToTab(page, 'Settings');
  await page
    .getByRole('navigation', { name: 'Preference sections' })
    .getByRole('button', { name: 'Colors' })
    .click();
  await expect(combo).toBeVisible();

  await combo.click();
  await page
    .getByRole('dialog', { name: 'Edit color combination' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await page
    .getByRole('dialog', { name: 'Delete this color combination?' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(toast(page, 'Deleted')).toBeVisible();
  await expect(combo).toHaveCount(0);
  await expect(page.getByText('No liked combinations yet')).toBeVisible();
});

test('changes which types suit an occasion', async ({ page }) => {
  const { db, userId } = await testDb();
  await openSection(page, 'Occasions');
  const toggle = page.getByRole('button', { name: 'Jeans for Work' });
  const before = (await toggle.getAttribute('aria-pressed')) === 'true';

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(!before));
  await page.getByRole('button', { name: 'Save occasion rules' }).click();
  await expect(toast(page, 'Occasion preferences saved')).toBeVisible();

  await page.reload();
  await goToTab(page, 'Settings');
  await page
    .getByRole('navigation', { name: 'Preference sections' })
    .getByRole('button', { name: 'Occasions' })
    .click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(!before));
  const rows = ok(
    await db.from('occasion_preferences').select('user_id').eq('user_id', userId),
    'rules',
  );
  expect(rows).toHaveLength(1);
});

test('turns on the daily email with a time and time zone', async ({ page }) => {
  const { db, userId } = await testDb();
  await openSection(page, 'Email');
  const toggle = page.getByRole('switch', { name: 'Send me the daily email' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await page.getByLabel('Time', { exact: true }).fill('06:45');
  await page.getByLabel('Time zone').selectOption('America/Chicago');
  await toggle.click();
  await expect(toast(page, 'Daily email is on.')).toBeVisible();

  await page.reload();
  await goToTab(page, 'Settings');
  await page
    .getByRole('navigation', { name: 'Preference sections' })
    .getByRole('button', { name: 'Email' })
    .click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Time', { exact: true })).toHaveValue('06:45');
  await expect(page.getByLabel('Time zone')).toHaveValue('America/Chicago');

  const profile = ok(
    await db
      .from('profiles')
      .select('daily_email_enabled, daily_email_time, timezone')
      .eq('id', userId)
      .single(),
    'profile',
  );
  expect(profile).toEqual({
    daily_email_enabled: true,
    daily_email_time: '06:45:00',
    timezone: 'America/Chicago',
  });
});
