import { test, expect, nav } from './helpers/test';
import { ok, testDb } from './helpers/db';

// A brand-new user: empty closet, onboarding not done.
test.use({ seedOptions: { items: false, profile: { onboarding_completed: false } } });

test('walks a new user through setup into an empty closet', async ({ page }) => {
  const { db, userId } = await testDb();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to FitFinder' })).toBeVisible();
  await expect(nav(page)).toHaveCount(0);

  await page.getByLabel(/US ZIP code/).fill('94103');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add your first items' })).toBeVisible();
  await page.getByRole('button', { name: /Skip for now/ }).click();
  await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
  await page.getByRole('button', { name: 'Go to my closet' }).click();

  await expect(nav(page)).toBeVisible();
  await expect(page.getByText('Your closet is empty')).toBeVisible();
  const profile = ok(
    await db.from('profiles').select('zip_code, onboarding_completed').eq('id', userId).single(),
    'profile',
  );
  expect(profile).toEqual({ zip_code: '94103', onboarding_completed: true });

  // Done once: a reload goes straight to the app.
  await page.reload();
  await expect(nav(page)).toBeVisible();
});
