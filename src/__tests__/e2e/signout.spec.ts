// Runs last (its own project): signing out ends every session for the
// account, including the saved one the other tests use.

import { test, expect, nav } from './helpers/test';
import { testCredentials } from './helpers/db';

test.use({ storageState: { cookies: [], origins: [] } });

test('logs in, stays logged in on reload, and signs out', async ({ page }) => {
  const { email, password } = testCredentials();
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(nav(page)).toBeVisible();

  await page.reload();
  await expect(nav(page)).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
});
