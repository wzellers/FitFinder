// Upload helpers (PLAN.md A0)
//
// Background removal is run on demand by the user (the model's anti-aliased
// output is uploaded untouched, which keeps edges smooth). Detection of the
// clothing type and colors runs automatically to pre-fill the review form:
//   - Color detection  (imageColor) — runs locally, always available
//   - Type detection    (Claude /api/detect-clothing) — needs ANTHROPIC_API_KEY
//
// Detection degrades gracefully: if either signal is unavailable, the user just
// fills the corresponding field in manually.

import { supabase } from '@/lib/supabaseClient';
import { typeToSection } from '@/lib/constants';
import { detectColors } from '@/lib/imageColor';
import type { ClothingSection } from '@/lib/types';

export interface ItemSuggestions {
  /** Suggested clothing type, or null if undetected. */
  suggestedType: string | null;
  /** Suggested section derived from the type, or '' if unknown. */
  suggestedSection: ClothingSection | '';
  /** Suggested colors: [primary] or [primary, secondary]. May be empty. */
  suggestedColors: string[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Claude rejects images whose base64 payload exceeds 10 MB. Detection only needs
// a modestly sized image, so cap the longest edge and re-encode as JPEG before
// sending. The original blob is never mutated — it's still uploaded full-quality.
const DETECTION_MAX_EDGE = 1024;
const DETECTION_JPEG_QUALITY = 0.85;

/**
 * Return a JPEG data URL of the image scaled so its longest edge is at most
 * DETECTION_MAX_EDGE. Falls back to the raw data URL if a canvas isn't available
 * (e.g. SSR) or decoding fails — the API call may then still hit the size limit,
 * which is handled gracefully by the caller.
 */
async function imageDataUrlForDetection(blob: Blob): Promise<string> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return blobToDataUrl(blob);
  }
  try {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    const scale = Math.min(1, DETECTION_MAX_EDGE / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return blobToDataUrl(blob);
    }
    // Flatten onto white so transparent PNGs (post background-removal) stay valid JPEGs.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    return canvas.toDataURL('image/jpeg', DETECTION_JPEG_QUALITY);
  } catch {
    return blobToDataUrl(blob);
  }
}

/**
 * Remove the image background using the local model and return the result
 * untouched (its soft, anti-aliased edges are kept). Throws on failure so the
 * caller can surface an error and leave the original image in place.
 */
export async function removeImageBackground(blob: Blob): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');
  const result = await removeBackground(blob, { output: { format: 'image/png' } });
  return result as Blob;
}

interface DetectResult {
  type: string | null;
  color: string | null;
  secondaryColor: string | null;
}

async function tryDetectType(blob: Blob): Promise<DetectResult> {
  try {
    const dataUrl = await imageDataUrlForDetection(blob);
    const res = await fetch('/api/detect-clothing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    });
    if (!res.ok) return { type: null, color: null, secondaryColor: null };
    const data = await res.json();
    return {
      type: data.type ?? null,
      color: data.color ?? null,
      secondaryColor: data.secondaryColor ?? null,
    };
  } catch {
    return { type: null, color: null, secondaryColor: null };
  }
}

/**
 * Merge color signals: local pixel detection is the default; Claude's colors are
 * preferred when present since they account for the garment semantically.
 * Returns [primary] or [primary, secondary], with primary at index 0.
 */
function mergeColors(
  local: { primary: string | null; secondary: string | null },
  remote: { color: string | null; secondaryColor: string | null },
): string[] {
  const primary = remote.color ?? local.primary;
  if (!primary) return [];

  const secondary = remote.secondaryColor ?? local.secondary;
  if (secondary && secondary !== primary) return [primary, secondary];
  return [primary];
}

/**
 * Detect the clothing type and colors for an image, to pre-fill the review form.
 * Does not modify the image. Color (local) and type (Claude) detection run in
 * parallel; either may come back empty, in which case the user fills it in.
 */
export async function detectItem(blob: Blob): Promise<ItemSuggestions> {
  const [localColors, detected] = await Promise.all([
    detectColors(blob),
    tryDetectType(blob),
  ]);

  const suggestedColors = mergeColors(localColors, detected);
  const suggestedType = detected.type;
  const suggestedSection = suggestedType ? (typeToSection[suggestedType] ?? '') : '';

  return { suggestedType, suggestedSection, suggestedColors };
}

/**
 * Run an async `worker` over every item with at most `limit` in flight at once.
 * Results are returned in the same order as `items`. Used to detect/upload a
 * batch of clothing items without firing every request simultaneously.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function runner(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, runner);
  await Promise.all(runners);
  return results;
}

const BUCKET = 'clothing-images';

/** Build a unique storage path for a user's image. */
function newImagePath(userId: string): string {
  return `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
}

export interface UploadItemInput {
  userId: string;
  blob: Blob;
  type: string;
  colors: string[];
  isDirty: boolean;
}

/** Upload a blob to the bucket and return its public URL. */
async function uploadBlob(userId: string, blob: Blob): Promise<string> {
  const fileName = newImagePath(userId);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, blob, { contentType: 'image/png' });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return urlData.publicUrl;
}

/**
 * Upload a processed item: store the image, then insert the clothing_items row.
 * Throws on failure so callers can surface per-item errors.
 */
export async function uploadItem({
  userId,
  blob,
  type,
  colors,
  isDirty,
}: UploadItemInput): Promise<void> {
  const url = await uploadBlob(userId, blob);

  const { error } = await supabase
    .from('clothing_items')
    .insert([{ user_id: userId, type, colors, image_url: url, is_dirty: isDirty }])
    .select();
  if (error) throw error;
}
