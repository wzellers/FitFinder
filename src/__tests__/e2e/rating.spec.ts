import { test, expect, openApp, expectImagesLoaded } from './helpers/test';
import { localDate, ok, testDb } from './helpers/db';

test("asks for a rating of yesterday's outfit, and the model learns from it", async ({
  page,
  seeded,
}) => {
  const { db, userId } = await testDb();
  ok(
    await db.from('outfit_wears').insert({
      user_id: userId,
      worn_date: localDate(-1),
      top_id: seeded.navyShirt,
      bottom_id: seeded.denimJeans,
      shoes_id: seeded.whiteShoes,
    }),
    'seed wear',
  );

  await openApp(page);
  const prompt = page.getByRole('dialog', { name: "Rate yesterday's outfit" });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole('img', { name: 'Navy blue Button-Up Shirt' })).toBeVisible();
  await expectImagesLoaded(page, '[role="dialog"] img', 3);

  await prompt.getByLabel('How did it feel?').fill('9');
  await prompt.getByRole('button', { name: 'Save rating' }).click();
  await expect(prompt).toHaveCount(0);

  const wear = ok(
    await db.from('outfit_wears').select('rating').eq('user_id', userId).single(),
    'wear',
  );
  expect(wear.rating).toBe(9);
  // The rating nudges the user's learned weights (saved in the background).
  await expect
    .poll(async () => {
      const rows = ok(
        await db.from('outfit_model_weights').select('user_id').eq('user_id', userId),
        'weights',
      );
      return rows?.length;
    })
    .toBe(1);

  // Rated, so no prompt next time.
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(prompt).toHaveCount(0);
});

test('"Remind me later" tucks the prompt away until reopened', async ({ page, seeded }) => {
  const { db, userId } = await testDb();
  ok(
    await db.from('outfit_wears').insert({
      user_id: userId,
      worn_date: localDate(-1),
      top_id: seeded.whiteTee,
      bottom_id: seeded.beigePants,
      shoes_id: seeded.whiteShoes,
    }),
    'seed wear',
  );

  await openApp(page);
  const prompt = page.getByRole('dialog', { name: "Rate yesterday's outfit" });
  await prompt.getByRole('button', { name: 'Remind me later' }).click();
  await expect(prompt).toHaveCount(0);
  await page.getByRole('button', { name: "Rate yesterday's outfit" }).click();
  await expect(prompt).toBeVisible();
});
