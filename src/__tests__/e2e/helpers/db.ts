// Direct database access for the E2E suite, signed in as the test account.
//
// Uses the public anon key plus the test user's session, so row-level security
// confines every read and write to that one account. The suite never needs the
// service-role key.

import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'clothing-images';
const FIXTURES = path.resolve(__dirname, '../fixtures');

export function testCredentials() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.e2e (see README → End-to-end tests).',
    );
  }
  // Every run deletes this account's closet, so the owner has to say so.
  if (process.env.E2E_WIPES_THIS_ACCOUNT !== 'yes') {
    throw new Error(
      "Add E2E_WIPES_THIS_ACCOUNT=yes to .env.e2e to confirm: every run deletes that account's closet, so it must not be an account you use.",
    );
  }
  return { email, password };
}

let cached: Promise<{ db: SupabaseClient; userId: string }> | null = null;

/** A Supabase client signed in as the test user (shared across a worker). */
export function testDb(): Promise<{ db: SupabaseClient; userId: string }> {
  cached ??= (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing: is .env.local present?');
    }
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: true },
    });
    const { data, error } = await db.auth.signInWithPassword(testCredentials());
    if (error || !data.user) throw new Error(`Test account sign-in failed: ${error?.message}`);
    return { db, userId: data.user.id };
  })();
  return cached;
}

/**
 * Throw on a Supabase error instead of silently continuing. (Writes without
 * .select() return null data; callers only read data from selects.)
 */
export function ok<T>(
  res: { data: T; error: { message: string } | null },
  what: string,
): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as NonNullable<T>;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

export interface SeedItem {
  type: string;
  colors: string[];
  file: string;
  is_dirty?: boolean;
  /** The item's accessible name in the UI (describeItem). */
  name: string;
}

/** A small closet: two clean tops (+1 dirty), two bottoms, one pair of shoes. */
export const SEED_ITEMS = {
  whiteTee: { type: 'T-Shirt', colors: ['white'], file: 'white-tee.png', name: 'White T-Shirt' },
  navyShirt: {
    type: 'Button-Up Shirt',
    colors: ['navy blue'],
    file: 'navy-shirt.png',
    name: 'Navy blue Button-Up Shirt',
  },
  blackSweatshirt: {
    type: 'Sweatshirt',
    colors: ['black'],
    file: 'black-sweatshirt.png',
    is_dirty: true,
    name: 'Black Sweatshirt',
  },
  denimJeans: { type: 'Jeans', colors: ['denim'], file: 'denim-jeans.png', name: 'Denim Jeans' },
  beigePants: { type: 'Pants', colors: ['beige'], file: 'beige-pants.png', name: 'Beige Pants' },
  whiteShoes: { type: 'Shoes', colors: ['white'], file: 'white-shoes.png', name: 'White Shoes' },
} satisfies Record<string, SeedItem>;

export type SeedKey = keyof typeof SEED_ITEMS;
export type SeededIds = Record<SeedKey, string>;

const seedPath = (userId: string, file: string) => `${userId}/e2e-${file}`;

/**
 * Make sure every seed photo is in storage, and remove any other file in the
 * test user's folder (e.g. photos uploaded by a previous run's tests).
 */
async function syncSeedPhotos(): Promise<void> {
  const { db, userId } = await testDb();
  const listed = ok(await db.storage.from(BUCKET).list(userId, { limit: 1000 }), 'list photos');
  const existing = new Set((listed ?? []).map((f) => `${userId}/${f.name}`));
  const wanted = new Set(Object.values(SEED_ITEMS).map((i) => seedPath(userId, i.file)));

  const stale = [...existing].filter((p) => !wanted.has(p));
  if (stale.length) ok(await db.storage.from(BUCKET).remove(stale), 'remove stale photos');

  for (const item of Object.values(SEED_ITEMS)) {
    const p = seedPath(userId, item.file);
    if (existing.has(p)) continue;
    const body = fs.readFileSync(path.join(FIXTURES, item.file));
    ok(
      await db.storage.from(BUCKET).upload(p, body, { contentType: 'image/png', upsert: true }),
      `upload ${item.file}`,
    );
  }
}

/**
 * Wipe the test user's data and seed the standard closet. Profile settings go
 * back to defaults: no ZIP, onboarding done, daily email off.
 */
export async function resetAndSeed(
  opts: { items?: boolean; profile?: Record<string, unknown> } = {},
): Promise<SeededIds> {
  const { db, userId } = await testDb();

  for (const table of [
    'outfit_impressions',
    'outfit_ratings',
    'outfit_wears',
    'saved_outfits',
    'clothing_items',
    'color_preferences',
    'weather_preferences',
    'occasion_preferences',
    'outfit_model_weights',
  ]) {
    ok(await db.from(table).delete().eq('user_id', userId), `clear ${table}`);
  }
  ok(
    await db.from('profiles').upsert({
      id: userId,
      zip_code: null,
      onboarding_completed: true,
      daily_email_enabled: false,
      daily_email_time: '07:00',
      timezone: null,
      daily_email_last_sent: null,
      ...opts.profile,
    }),
    'reset profile',
  );

  const ids = {} as SeededIds;
  // Also drops photos earlier tests uploaded, and restores any they deleted.
  await syncSeedPhotos();
  if (opts.items === false) return ids;

  const rows = Object.entries(SEED_ITEMS).map(([key, item]) => ({
    key,
    user_id: userId,
    type: item.type,
    colors: item.colors,
    image_url: seedPath(userId, item.file),
    is_dirty: 'is_dirty' in item ? item.is_dirty : false,
  }));
  const inserted = ok(
    await db
      .from('clothing_items')
      .insert(rows.map(({ key: _key, ...row }) => row))
      .select('id, type'),
    'seed items',
  );
  for (const row of rows) {
    const match = inserted?.find((r) => r.type === row.type);
    if (!match) throw new Error(`Seeded item missing: ${row.type}`);
    ids[row.key as SeedKey] = match.id;
  }
  return ids;
}

/** Local calendar date (YYYY-MM-DD), `offset` days from today. */
export function localDate(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
