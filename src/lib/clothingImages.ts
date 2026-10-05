// Helpers for the clothing-images Storage bucket.
//
// Each image lives at `<userId>/<file>.png`. Rows in clothing_items keep a
// reference to it in `image_url`, so these helpers translate between the two.

import { supabase } from '@/lib/supabaseClient';

export const CLOTHING_BUCKET = 'clothing-images';

const BUCKET_MARKER = `/${CLOTHING_BUCKET}/`;

/**
 * Return the storage path (`<userId>/<file>`) for an `image_url` value, or
 * null if it doesn't point into the clothing bucket. Accepts a bare path too.
 */
export function imagePathFromUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const idx = imageUrl.indexOf(BUCKET_MARKER);
  if (idx === -1) return /^https?:/.test(imageUrl) ? null : imageUrl;
  const path = imageUrl.slice(idx + BUCKET_MARKER.length).split('?')[0];
  return decodeURIComponent(path) || null;
}

/**
 * Best-effort removal of stored images. A failure only leaves an orphaned
 * file behind, so it is logged rather than surfaced to the user.
 */
export async function removeClothingImages(paths: Array<string | null>): Promise<void> {
  const valid = paths.filter((p): p is string => Boolean(p));
  if (valid.length === 0) return;
  const { error } = await supabase.storage.from(CLOTHING_BUCKET).remove(valid);
  if (error) console.warn('Could not remove clothing images', error);
}

// ---------------------------------------------------------------------------
// Signed URLs
//
// The bucket is private, so images are shown through short-lived signed URLs.
// Requests made in the same tick are batched into one createSignedUrls call,
// and URLs are cached until shortly before they expire.
// ---------------------------------------------------------------------------

const SIGNED_URL_TTL_S = 60 * 60;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const cache = new Map<string, { url: string; expiresAt: number }>();
let pending: Map<string, Array<(url: string | null) => void>> | null = null;

async function flushPending() {
  const batch = pending;
  pending = null;
  if (!batch) return;

  const paths = [...batch.keys()];
  const { data, error } = await supabase.storage
    .from(CLOTHING_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_S);

  const byPath = new Map<string, string>();
  if (!error) {
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl);
    }
  }
  const expiresAt = Date.now() + SIGNED_URL_TTL_S * 1000;
  for (const [path, resolvers] of batch) {
    const url = byPath.get(path) ?? null;
    if (url) cache.set(path, { url, expiresAt });
    resolvers.forEach((resolve) => resolve(url));
  }
}

/** Resolve an `image_url` value (path or legacy public URL) to a displayable URL. */
export function getClothingImageUrl(imageUrl: string | null | undefined): Promise<string | null> {
  const path = imagePathFromUrl(imageUrl);
  if (!path) return Promise.resolve(imageUrl ?? null);

  const hit = cache.get(path);
  if (hit && hit.expiresAt - Date.now() > REFRESH_MARGIN_MS) return Promise.resolve(hit.url);

  return new Promise((resolve) => {
    if (!pending) {
      pending = new Map();
      queueMicrotask(flushPending);
    }
    const waiting = pending.get(path) ?? [];
    waiting.push(resolve);
    pending.set(path, waiting);
  });
}

/** Synchronous cache lookup, so already-signed images render without a flash. */
export function getCachedClothingImageUrl(imageUrl: string | null | undefined): string | null {
  const path = imagePathFromUrl(imageUrl);
  if (!path) return null;
  const hit = cache.get(path);
  return hit && hit.expiresAt - Date.now() > REFRESH_MARGIN_MS ? hit.url : null;
}
