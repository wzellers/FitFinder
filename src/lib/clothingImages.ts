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
