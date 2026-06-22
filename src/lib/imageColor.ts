// Color detection (PLAN.md A4)
//
// Samples a downscaled copy of the image, maps each non-background pixel to the
// nearest palette color, and returns a ranked list. The caller picks a primary
// (most frequent) and an optional secondary (next most frequent, if it covers
// enough of the garment to be meaningful).

import { colorPalette, colorMap } from '@/lib/constants';

// Secondary color must cover at least this fraction of counted pixels to be kept.
export const SECONDARY_COVERAGE_THRESHOLD = 0.15;

const SAMPLE_SIZE = 64; // downsample for speed

interface ColorRank {
  color: string;
  count: number;
  fraction: number; // share of all counted (non-background) pixels
}

interface PaletteRGB {
  name: string;
  r: number;
  g: number;
  b: number;
}

const paletteRGB: PaletteRGB[] = colorPalette
  .map((name): PaletteRGB | null => {
    const hex = colorMap[name];
    if (!hex) return null;
    return {
      name,
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  })
  .filter((p): p is PaletteRGB => p !== null);

function nearestPaletteColor(r: number, g: number, b: number): string {
  let best = '';
  let bestDist = Infinity;
  for (const p of paletteRGB) {
    const dist = (r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = p.name;
    }
  }
  return best;
}

/**
 * Return palette colors ranked by frequency among non-background pixels.
 * Background = transparent or near-white pixels (matching the prior heuristic).
 */
function rankColors(blob: Blob): Promise<ColorRank[]> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve([]);
        return;
      }
      ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

      const counts: Record<string, number> = {};
      let total = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        // Skip transparent or near-white background pixels.
        if (a < 128) continue;
        if (r > 240 && g > 240 && b > 240) continue;

        const name = nearestPaletteColor(r, g, b);
        if (!name) continue;
        counts[name] = (counts[name] || 0) + 1;
        total++;
      }

      URL.revokeObjectURL(objectUrl);

      if (total === 0) {
        resolve([]);
        return;
      }

      const ranked: ColorRank[] = Object.entries(counts)
        .map(([color, count]) => ({ color, count, fraction: count / total }))
        .sort((a, b) => b.count - a.count);

      resolve(ranked);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve([]);
    };
    img.src = objectUrl;
  });
}

export interface DetectedColors {
  primary: string | null;
  secondary: string | null;
}

/**
 * Detect primary + optional secondary color. Secondary is only returned when it
 * differs from primary and covers at least SECONDARY_COVERAGE_THRESHOLD of the
 * garment.
 */
export async function detectColors(blob: Blob): Promise<DetectedColors> {
  const ranked = await rankColors(blob);
  if (ranked.length === 0) return { primary: null, secondary: null };

  const primary = ranked[0].color;
  const second = ranked[1];
  const secondary =
    second && second.color !== primary && second.fraction >= SECONDARY_COVERAGE_THRESHOLD
      ? second.color
      : null;

  return { primary, secondary };
}
