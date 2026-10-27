// A shareable image of today's outfit: the three pieces stacked on a clean
// card with the palette, the date and the wordmark. Drawn on a canvas in the
// browser, then shared (phones) or downloaded (desktop).

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardLayout {
  /** One square per piece, top to bottom. */
  tiles: Rect[];
  /** The palette strip under the outfit. */
  palette: Rect;
  /** Baselines for the title and the footer. */
  titleY: number;
  footerY: number;
}

/** Where everything goes on the card: three squares stacked in the middle. */
export function shareCardLayout(width = CARD_WIDTH, height = CARD_HEIGHT): CardLayout {
  const margin = Math.round(width * 0.08);
  const titleY = margin + 64;
  const gap = 24;
  const top = titleY + 56;
  const paletteH = 18;
  const footerSpace = 120;
  // As big as fits: three squares and two gaps above the palette and footer.
  const size = Math.floor((height - top - footerSpace - paletteH - gap * 3) / 3);
  const x = Math.round((width - size) / 2);
  const tiles = [0, 1, 2].map((i) => ({ x, y: top + i * (size + gap), w: size, h: size }));
  const paletteY = top + 3 * size + 3 * gap;
  return {
    tiles,
    palette: { x, y: paletteY, w: size, h: paletteH },
    titleY,
    footerY: height - margin + 8,
  };
}

export interface ShareCardInput {
  /** Image URLs of the top, bottom and shoes (any may be missing). */
  images: (string | null)[];
  /** The pieces' main colours, as CSS colours. */
  palette: string[];
  /** e.g. "Tue, Oct 27". */
  dateLabel: string;
  /** The page accent, for the title. */
  accent: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Signed storage URLs allow cross-origin reads, which keeps the canvas
    // exportable.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${url}`));
    img.src = url;
  });
}

/** Fit an image inside a box, keeping its proportions. */
function contain(img: HTMLImageElement, box: Rect, pad: number): Rect {
  const w = box.w - pad * 2;
  const h = box.h - pad * 2;
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  return { x: box.x + (box.w - dw) / 2, y: box.y + (box.h - dh) / 2, w: dw, h: dh };
}

/** Draw the card and return it as a PNG. */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  const layout = shareCardLayout();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = input.accent;
  ctx.font = '700 64px system-ui, sans-serif';
  ctx.fillText("Today's fit", CARD_WIDTH / 2, layout.titleY);

  const images = await Promise.all(
    input.images.map((url) => (url ? loadImage(url).catch(() => null) : null)),
  );
  layout.tiles.forEach((tile, i) => {
    ctx.fillStyle = '#f4f2f1';
    ctx.beginPath();
    ctx.roundRect(tile.x, tile.y, tile.w, tile.h, 28);
    ctx.fill();
    const img = images[i];
    if (img) {
      const r = contain(img, tile, 28);
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
    }
  });

  const { palette } = layout;
  const segment = (palette.w - (input.palette.length - 1) * 10) / Math.max(1, input.palette.length);
  input.palette.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(palette.x + i * (segment + 10), palette.y, segment, palette.h, palette.h / 2);
    ctx.fill();
  });

  ctx.fillStyle = '#6e5459';
  ctx.font = '500 30px ui-monospace, monospace';
  ctx.fillText(`${input.dateLabel.toUpperCase()} · FITFINDER`, CARD_WIDTH / 2, layout.footerY);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png'),
  );
}

/**
 * Share the card where the device can share files (phones), else download
 * it. Returns how it was delivered.
 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: "Today's fit" });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
