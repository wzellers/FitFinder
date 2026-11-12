import path from 'path';
import { test, expect, nav } from './helpers/test';
import { ok, testDb } from './helpers/db';

// A brand-new user: empty closet, onboarding not done.
test.use({ seedOptions: { items: false, profile: { onboarding_completed: false } } });

const step = (page: import('@playwright/test').Page, n: number) =>
  expect(page.getByText(new RegExp(`^Step ${n} of 6`))).toBeVisible();

test('sets up weather, colours and the daily email, then opens the closet', async ({ page }) => {
  const { db, userId } = await testDb();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to FitFinder' })).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  await page.getByRole('button', { name: /Get started/ }).click();

  await page.getByLabel(/US ZIP code/).fill('94103');
  await page.getByRole('button', { name: 'I run cold' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();

  await expect(page.getByRole('heading', { name: 'Build your closet' })).toBeVisible();
  await page.getByRole('button', { name: /Skip for now/ }).click();

  await step(page, 4);
  await page.getByRole('button', { name: 'white top with denim bottoms' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();

  await step(page, 5);
  await page.getByRole('switch', { name: /Daily outfit email/ }).click();
  await page.getByRole('button', { name: '7:30 AM' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();

  // Nothing to make an outfit from yet, so setup ends in the closet.
  await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
  await page.getByRole('button', { name: 'Go to my closet' }).click();
  await expect(nav(page)).toBeVisible();
  await expect(page.getByText('Your closet is empty')).toBeVisible();

  const profile = ok(
    await db
      .from('profiles')
      .select('zip_code, onboarding_completed, daily_email_enabled, daily_email_time')
      .eq('id', userId)
      .single(),
    'profile',
  );
  expect(profile).toEqual({
    zip_code: '94103',
    onboarding_completed: true,
    daily_email_enabled: true,
    daily_email_time: '07:30:00',
  });
  const weather = ok(
    await db.from('weather_preferences').select('thresholds').eq('user_id', userId).single(),
    'weather',
  );
  expect(weather?.thresholds).toEqual({ cold: 50, cool: 70, warm: 85 });
  const colors = ok(
    await db.from('color_preferences').select('liked_combinations').eq('user_id', userId).single(),
    'colors',
  );
  expect(colors?.liked_combinations).toEqual([{ topColor: 'white', bottomColor: 'denim' }]);

  // Done once: a reload goes straight to the app.
  await page.reload();
  await expect(nav(page)).toBeVisible();
});

const FIXTURES = ['red-tee.png', 'denim-jeans.png', 'white-shoes.png'].map((f) =>
  path.resolve(__dirname, 'fixtures', f),
);

test('adds a first outfit’s worth of clothes and opens it on the Outfits screen', async ({
  page,
}) => {
  // Detection is stubbed (a top, then jeans, then shoes) to keep this quick.
  const detected = [
    { type: 'T-Shirt', color: 'red', secondaryColor: null },
    { type: 'Jeans', color: 'denim', secondaryColor: null },
    { type: 'Shoes', color: 'white', secondaryColor: null },
  ];
  let calls = 0;
  await page.route('**/api/detect-clothing', (route) =>
    route.fulfill({ json: detected[calls++ % detected.length] }),
  );
  await page.addInitScript(() => localStorage.setItem('fitfinder:auto-remove-bg', 'off'));

  await page.goto('/');
  await page.getByRole('button', { name: /Get started/ }).click();
  await page.getByRole('button', { name: /Skip for now/ }).click();

  const sections = page.getByRole('list', { name: 'Closet so far' });
  await expect(sections).toContainText('Tops0 / 3');
  await page.getByRole('button', { name: /Add photos/ }).click();
  // The dialog is renamed for the batch once several photos are in it.
  const dialog = page.getByRole('dialog', { name: /^Add (a clothing item|3 items)$/ });
  await dialog.locator('input[type="file"][multiple]').setInputFiles(FIXTURES);
  await dialog.getByRole('button', { name: 'Add 3 items to closet' }).click();
  await expect(dialog).toHaveCount(0);
  for (const s of ['Tops1 / 3', 'Bottoms1 / 3', 'Shoes1 / 3'])
    await expect(sections).toContainText(s);

  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.getByRole('button', { name: /Not now/ }).click();
  await page.getByRole('button', { name: /Spin my first outfit/ }).click();
  const first = page.getByRole('list', { name: 'First outfit' });
  await expect(first).toContainText('Red T-Shirt');
  await expect(first).toContainText('Denim Jeans');
  await page.getByRole('button', { name: /See it in Outfits/ }).click();

  // The same outfit is on the Outfits screen, and setup is done.
  await expect(nav(page).getByRole('button', { name: 'Outfits' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: /Change top: Red T-Shirt/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Change bottom: Denim Jeans/ })).toBeVisible();
  await page.reload();
  await expect(nav(page)).toBeVisible();
});
