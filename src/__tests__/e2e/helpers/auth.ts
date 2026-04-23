import { Page, Browser } from '@playwright/test';
import path from 'path';

export const STORAGE_STATE_PATH = path.resolve(
  __dirname,
  '../.auth-state.json',
);

/** Sign in via the UI and save storage state for reuse across test files. */
export async function loginAndSave(browser: Browser): Promise<void> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in .env.e2e');
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/');
  await signIn(page, email, password);

  // Wait for the main app to load (tabs visible)
  await page.waitForSelector('text=Closet', { timeout: 15_000 });

  await context.storageState({ path: STORAGE_STATE_PATH });
  await context.close();
}

/** Sign into the app via the AuthForm UI. */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  // If already on a logged-in page, nothing to do
  if (await page.locator('text=Sign Out').count() > 0) return;

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Sign In")');
}

/** Sign out via the Sign Out button. */
export async function signOut(page: Page): Promise<void> {
  const signOutBtn = page.locator('button:has-text("Sign Out")').first();
  if (await signOutBtn.count() > 0) {
    await signOutBtn.click();
  }
}
