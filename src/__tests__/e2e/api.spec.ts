// Server routes, called directly. Detection and weather hit the real Claude
// and OpenWeatherMap APIs, so a pass means those keys and integrations work.

import fs from 'fs';
import path from 'path';
import { test, expect } from './helpers/test';
import { ok, testDb } from './helpers/db';

async function bearer() {
  const { db } = await testDb();
  const { data } = await db.auth.getSession();
  return { Authorization: `Bearer ${data.session!.access_token}` };
}

test.describe('/api/detect-clothing', () => {
  test('requires a signed-in user', async ({ request }) => {
    const res = await request.post('/api/detect-clothing', { data: { image: 'data:,' } });
    expect(res.status()).toBe(401);
  });

  test('detects a red T-shirt with Claude', async ({ request }) => {
    const png = fs.readFileSync(path.resolve(__dirname, 'fixtures/red-tee.png'));
    const res = await request.post('/api/detect-clothing', {
      headers: await bearer(),
      data: { image: `data:image/png;base64,${png.toString('base64')}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('T-Shirt');
    expect(body.color).toBe('red');
  });
});

test.describe('/api/weather', () => {
  test('requires a signed-in user', async ({ request }) => {
    const res = await request.post('/api/weather', { data: { zip: '10001' } });
    expect(res.status()).toBe(401);
  });

  test('returns the current weather for a ZIP code', async ({ request }) => {
    const res = await request.post('/api/weather', {
      headers: await bearer(),
      data: { zip: '10001' },
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(typeof body.temperature).toBe('number');
    expect(typeof body.condition).toBe('string');
  });

  test('rejects a malformed ZIP code', async ({ request }) => {
    const res = await request.post('/api/weather', {
      headers: await bearer(),
      data: { zip: 'abc' },
    });
    expect(res.status()).toBe(400);
  });
});

test('/api/email/send-due refuses callers without the cron secret', async ({ request }) => {
  const attempts: Record<string, string>[] = [{}, { Authorization: 'Bearer not-the-secret' }];
  for (const headers of attempts) {
    const res = await request.post('/api/email/send-due', { headers });
    // 401 when configured; 500 "not configured" on a dev server without the
    // email env vars. Either way it must not run.
    expect([401, 500]).toContain(res.status());
    expect(await res.json()).not.toHaveProperty('sent');
  }
});

test.describe('/api/email/unsubscribe', () => {
  test.use({ seedOptions: { profile: { daily_email_enabled: true } } });

  test('rejects a malformed link', async ({ request }) => {
    const res = await request.get('/api/email/unsubscribe?token=nope');
    expect(res.status()).toBe(400);
  });

  test("confirms first, then turns the user's email off", async ({ page }) => {
    const { db, userId } = await testDb();
    const { email_unsubscribe_token: token } = ok(
      await db.from('profiles').select('email_unsubscribe_token').eq('id', userId).single(),
      'token',
    );

    // Opening the link (as mail scanners do) changes nothing.
    await page.goto(`/api/email/unsubscribe?token=${token}`);
    const still = ok(
      await db.from('profiles').select('daily_email_enabled').eq('id', userId).single(),
      'profile',
    );
    expect(still.daily_email_enabled).toBe(true);

    await page.getByRole('button', { name: /unsubscribe/i }).click();
    await expect(page.getByRole('heading', { name: "You're unsubscribed" })).toBeVisible();
    const after = ok(
      await db.from('profiles').select('daily_email_enabled').eq('id', userId).single(),
      'profile',
    );
    expect(after.daily_email_enabled).toBe(false);
  });
});
