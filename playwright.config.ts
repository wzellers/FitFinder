import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// The app's own settings (Supabase URL and anon key, API keys), then the test
// account (E2E_TEST_EMAIL / E2E_TEST_PASSWORD). See README → End-to-end tests.
dotenv.config({ path: path.resolve(__dirname, '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '.env.e2e'), quiet: true });

// Run against a local dev server by default, or a deployed site with
// E2E_BASE_URL=https://… (no server is started then).
const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const AUTH_STATE = path.resolve(__dirname, 'src/__tests__/e2e/.auth-state.json');

export default defineConfig({
  testDir: './src/__tests__/e2e',
  // Every test shares one Supabase test account, so run one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Resets the test account's data and signs in once.
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      testIgnore: /(mobile|signout)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE },
    },
    {
      name: 'mobile',
      dependencies: ['setup'],
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'], storageState: AUTH_STATE },
    },
    // Last: signing out ends every session for the account.
    {
      name: 'signout',
      dependencies: ['desktop', 'mobile'],
      testMatch: /signout\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // CI tests the production build (built in an earlier step), like Vercel
        // serves it; locally, the dev server.
        command: process.env.CI ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
