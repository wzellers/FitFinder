#!/usr/bin/env node
/**
 * Build a test set for scripts/measureVision.mjs from a user's own closet
 * (measurement tool — NOT app code).
 *
 * Downloads each of the user's clothing photos from the private
 * `clothing-images` bucket (the uncropped original when one was kept) and
 * writes:
 *   - the photos, named <type>-<color>-<id>.<ext>
 *   - labels.json: { filename: { type, color } } from the item as saved in the
 *     app (its type and main colour)
 *   - review.html: a contact sheet of every photo with its label
 *
 * The saved labels started as Claude's own guesses, kept unless the user
 * changed them, so check review.html and fix any wrong labels in labels.json
 * before measuring; otherwise accuracy is measured against the model itself.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (the service role reads any user's rows and photos; it is only read here).
 *
 *    node scripts/exportVisionSet.mjs you@example.com ~/Desktop/bench-images
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });

const BUCKET = 'clothing-images';
const MARKER = `/${BUCKET}/`;
const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

const [email, outArg] = process.argv.slice(2);
if (!email || !outArg) {
  console.error('Usage: node scripts/exportVisionSet.mjs <email> <output folder>');
  process.exit(1);
}
const outDir = path.resolve(outArg.replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

/** The storage path in `image_url` (older rows hold a full URL). */
function storagePath(imageUrl) {
  if (!imageUrl) return null;
  const i = imageUrl.indexOf(MARKER);
  if (i === -1) return /^https?:/.test(imageUrl) ? null : imageUrl;
  return decodeURIComponent(imageUrl.slice(i + MARKER.length).split('?')[0]) || null;
}

const slug = (s) =>
  String(s ?? 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

async function findUserId() {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`users: ${error.message}`);
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user.id;
    if (data.users.length < 200) return null;
  }
}

async function download(p) {
  const { data, error } = await db.storage.from(BUCKET).download(p);
  return error ? null : data;
}

const userId = await findUserId();
if (!userId) {
  console.error(`No user with the email ${email}.`);
  process.exit(1);
}

const { data: items, error } = await db
  .from('clothing_items')
  .select('id, type, colors, image_url')
  .eq('user_id', userId)
  .order('created_at');
if (error) throw new Error(`items: ${error.message}`);

await mkdir(outDir, { recursive: true });
const labels = {};
const cards = [];
let skipped = 0;
for (const item of items ?? []) {
  const p = storagePath(item.image_url);
  // Prefer the uncropped original, closer to what was first uploaded.
  const blob = (await download(`${userId}/originals/${item.id}`)) ?? (p && (await download(p)));
  if (!blob) {
    skipped++;
    continue;
  }
  const color = item.colors?.[0] ?? null;
  const file = `${slug(item.type)}-${slug(color)}-${item.id.slice(0, 8)}${EXT[blob.type] ?? '.png'}`;
  await writeFile(path.join(outDir, file), Buffer.from(await blob.arrayBuffer()));
  labels[file] = { type: item.type, color };
  cards.push(
    `<figure><img src="${escapeHtml(file)}" alt=""><figcaption><b>${escapeHtml(item.type)}</b> · ${escapeHtml(color ?? '?')}<br><code>${escapeHtml(file)}</code></figcaption></figure>`,
  );
}

await writeFile(path.join(outDir, 'labels.json'), JSON.stringify(labels, null, 2) + '\n');
await writeFile(
  path.join(outDir, 'review.html'),
  `<!doctype html><meta charset="utf-8"><title>Vision test set</title>
<style>body{font:14px system-ui;margin:24px;background:#f4f6f7;color:#1f2a33}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}
figure{margin:0;background:#fff;border:1px solid #dde3e8;border-radius:12px;padding:10px}
img{width:100%;aspect-ratio:1;object-fit:contain;background:#e9edf0;border-radius:8px}
code{font-size:11px;color:#56636e;word-break:break-all}</style>
<h1>${cards.length} photos</h1><p>Check each label; fix wrong ones in labels.json (by file name).</p>
<main>${cards.join('\n')}</main>\n`,
);
console.log(
  `Saved ${cards.length} photos to ${outDir}${skipped ? ` (${skipped} without a photo skipped)` : ''}.`,
);
console.log(`Review ${path.join(outDir, 'review.html')}, fix labels.json, then run:`);
console.log(`  node scripts/measureVision.mjs ${outDir} https://fitfinder.website`);
