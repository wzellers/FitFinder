import { test, expect, nav } from './helpers/test';
import { testCredentials } from './helpers/db';

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows the login form', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(nav(page)).toHaveCount(0);
  });

  test.describe('wrong password', () => {
    // Supabase answers a bad password with a 400, which the browser logs.
    test.use({ allowedErrors: [/status of 400/] });

    test('is rejected with an inline error', async ({ page }) => {
      const { email } = testCredentials();
      await page.goto('/');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill('definitely-not-the-password');
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(nav(page)).toHaveCount(0);
    });
  });

  test('switches between log in and create account', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    await page.getByRole('button', { name: 'Have an account? Log in' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});
