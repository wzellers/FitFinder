// Runs once before the suite: seeds the test account and signs in through the
// real login form, saving the session for every other test.

import path from 'path';
import { test as setup, expect } from '@playwright/test';
import { resetAndSeed, testCredentials } from './helpers/db';

const AUTH_STATE = path.resolve(__dirname, '.auth-state.json');

setup('seed the test account and sign in', async ({ page }) => {
  const { email, password } = testCredentials();
  await resetAndSeed();

  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  await page.context().storageState({ path: AUTH_STATE });
});
