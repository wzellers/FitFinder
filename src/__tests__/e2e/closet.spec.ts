import path from 'path';
import { test, expect, openApp, toast, expectImagesLoaded } from './helpers/test';
import { BUCKET, SEED_ITEMS, ok, testDb } from './helpers/db';

const item = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('button', { name: `Edit ${name}`, exact: true });

test('shows every seeded item with its photo', async ({ page }) => {
  await openApp(page);
  await expect(page.getByText('{ 6 items · 1 in the wash }')).toBeVisible();
  for (const { name } of Object.values(SEED_ITEMS)) {
    await expect(item(page, name)).toBeVisible();
  }
  // Photos come from a private bucket through signed URLs; all must load.
  await expectImagesLoaded(page, 'main button[aria-label^="Edit "] img', 6);
});

test('filters by category, color and laundry status', async ({ page }) => {
  await openApp(page);
  const filters = page.getByRole('group', { name: 'Filter closet' });

  await filters.getByLabel('Category').selectOption('Bottoms');
  await expect(item(page, 'Denim Jeans')).toBeVisible();
  await expect(item(page, 'White T-Shirt')).toHaveCount(0);

  await filters.getByRole('button', { name: 'Clear filters' }).click();
  await filters.getByLabel('Color').selectOption('white');
  await expect(item(page, 'White T-Shirt')).toBeVisible();
  await expect(item(page, 'White Shoes')).toBeVisible();
  await expect(item(page, 'Denim Jeans')).toHaveCount(0);

  await filters.getByRole('button', { name: 'Clear filters' }).click();
  await filters.getByRole('button', { name: 'Dirty', exact: true }).click();
  await expect(item(page, 'Black Sweatshirt')).toBeVisible();
  await expect(item(page, 'White T-Shirt')).toHaveCount(0);
});

test('toggles one item dirty and the change persists', async ({ page }) => {
  await openApp(page);
  // The badge flips at once and saves in the background; wait for the save
  // before reloading, as reloading cancels it.
  const saved = page.waitForResponse(
    (res) => res.url().includes('/rest/v1/clothing_items') && res.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'White T-Shirt is clean. Mark as dirty' }).click();
  expect((await saved).ok()).toBe(true);
  await expect(
    page.getByRole('button', { name: 'White T-Shirt is dirty. Mark as clean' }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: 'White T-Shirt is dirty. Mark as clean' }),
  ).toBeVisible();
  await expect(page.getByText('{ 6 items · 2 in the wash }')).toBeVisible();
});

test('marks everything dirty, then everything clean', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Mark all dirty' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark all dirty' }).click();
  await expect(toast(page, 'Everything is in the wash.')).toBeVisible();
  await expect(page.getByText('{ 6 items · 6 in the wash }')).toBeVisible();

  await page.getByRole('button', { name: 'Mark all clean' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark all clean' }).click();
  await expect(toast(page, 'Everything is clean.')).toBeVisible();
  await expect(page.getByText('{ 6 items · 0 in the wash }')).toBeVisible();
});

test('edits an item and the change persists', async ({ page }) => {
  await openApp(page);
  await item(page, 'White T-Shirt').click();
  const dialog = page.getByRole('dialog', { name: 'Edit White T-Shirt' });
  await expect(dialog).toBeVisible();
  await expectImagesLoaded(page, '[role="dialog"] img');

  await dialog.getByLabel('Type').selectOption('Polo');
  await dialog
    .getByRole('group', { name: /Main color/ })
    .getByRole('button', { name: 'Gray' })
    .click();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Changes saved.')).toBeVisible();

  await page.reload();
  await expect(item(page, 'Gray Polo')).toBeVisible();
  await expect(item(page, 'White T-Shirt')).toHaveCount(0);
});

test('deletes an item and its photo', async ({ page, seeded }) => {
  const { db, userId } = await testDb();
  await openApp(page);
  await item(page, 'Beige Pants').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete item' }).click();
  await page
    .getByRole('dialog', { name: /Delete this pants\?/ })
    .getByRole('button', { name: 'Delete item' })
    .click();
  await expect(toast(page, 'Item deleted.')).toBeVisible();
  await expect(item(page, 'Beige Pants')).toHaveCount(0);

  const rows = ok(await db.from('clothing_items').select('id').eq('id', seeded.beigePants), 'item');
  expect(rows).toHaveLength(0);
  // The photo is removed from storage too (the next reset re-uploads it).
  const files = ok(await db.storage.from(BUCKET).list(userId), 'list');
  expect(files?.map((f) => f.name)).not.toContain('e2e-beige-pants.png');
});

/** Stub detection (the live model is checked in api.spec.ts) so the form is
 * filled predictably, and skip automatic background removal, which downloads
 * a large model. */
async function stubAdding(page: import('@playwright/test').Page) {
  await page.route('**/api/detect-clothing', (route) =>
    route.fulfill({ json: { type: 'T-Shirt', color: 'red', secondaryColor: null } }),
  );
  await page.addInitScript(() => localStorage.setItem('fitfinder:auto-remove-bg', 'off'));
}

const RED_TEE = path.resolve(__dirname, 'fixtures/red-tee.png');

test('adds an item from a photo', async ({ page }) => {
  await stubAdding(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Add item' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a clothing item' });
  await dialog.locator('input[type="file"][multiple]').setInputFiles(RED_TEE);

  // What detection found shows as chips; tapping one opens the editors.
  await expect(dialog.getByRole('button', { name: 'Type: T-Shirt. Edit' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Main color: Red. Edit' }).click();
  await expect(dialog.getByLabel('Type', { exact: true })).toHaveValue('T-Shirt');
  await expect(
    dialog.getByRole('group', { name: 'Main color' }).getByRole('button', { name: 'Red' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Add to closet' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(item(page, 'Red T-Shirt')).toBeVisible();
  await expect(page.getByText('{ 7 items · 1 in the wash }')).toBeVisible();
  await expectImagesLoaded(page, 'main button[aria-label="Edit Red T-Shirt"] img');
});

test('drops a photo onto the closet to add it, and highlights it', async ({ page }) => {
  await stubAdding(page);
  await openApp(page);
  const png = (await import('fs')).readFileSync(RED_TEE).toString('base64');
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], 'red-tee.png', { type: 'image/png' }));
    for (const type of ['dragenter', 'dragover', 'drop']) {
      document.body.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
      );
    }
  }, png);

  const dialog = page.getByRole('dialog', { name: 'Add a clothing item' });
  await expect(dialog.getByRole('button', { name: 'Type: T-Shirt. Edit' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Add to closet' }).click();
  await expect(dialog).toHaveCount(0);
  // It settles into the grid with a short highlight, and is really saved.
  await expect(
    page.locator('[data-just-added] button[aria-label="Edit Red T-Shirt"]'),
  ).toBeVisible();
  await page.reload();
  await expect(item(page, 'Red T-Shirt')).toBeVisible();
});
