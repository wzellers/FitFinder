// Crop an image to a rectangle and return a PNG Blob.
//
// Used by ImageCropper when adding an item (a blob: URL of the chosen file)
// and when re-cropping one (a signed, CORS-enabled storage URL). Supports a
// tilt (rotation in degrees).

import type { Area } from 'react-easy-crop';

/**
 * Crop `imageSrc` to a rectangle expressed as a percentage of the image
 * (react-easy-crop's `croppedArea`) and return a PNG Blob.
 *
 * The percentage rectangle can extend past the image edges (negative x/y or
 * width/height beyond 100%) when the user has zoomed out — those areas are
 * rendered as transparent padding so the saved image matches exactly what the
 * crop frame showed ("fit whole image in frame"). Output is PNG to match the
 * rest of the upload pipeline (and preserve any transparency).
 */
export async function getCroppedBlob(
  imageSrc: string,
  areaPercent: Area,
  rotation = 0,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const naturalW = image.naturalWidth || image.width;
  const naturalH = image.naturalHeight || image.height;

  // With a tilt, react-easy-crop measures the crop against the rotated
  // image's bounding box, so draw the image rotated into a box that size.
  const box = rotatedSize(naturalW, naturalH, rotation);
  const source =
    rotation % 360 === 0 ? image : drawRotated(image, naturalW, naturalH, rotation, box);

  // Convert the percentage rectangle into pixel coordinates. These may be
  // negative or larger than the image when the user zoomed out (padding).
  const sx = (areaPercent.x / 100) * box.width;
  const sy = (areaPercent.y / 100) * box.height;
  const sw = (areaPercent.width / 100) * box.width;
  const sh = (areaPercent.height / 100) * box.height;

  // Canvas is the full crop-frame region (including any padding), so the output
  // reflects what the user saw in the frame.
  const outW = Math.max(1, Math.round(sw));
  const outH = Math.max(1, Math.round(sh));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // drawImage with the source rect positioned at (-sx, -sy) paints the image at
  // the correct spot inside the frame; areas outside the image stay transparent.
  ctx.drawImage(source, -sx, -sy, box.width, box.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas is empty'))),
      'image/png',
    );
  });
}

/** The size of the box a `width` × `height` image fills once rotated by
 * `degrees` (its bounding box). */
export function rotatedSize(width: number, height: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: Math.round(width * cos + height * sin),
    height: Math.round(width * sin + height * cos),
  };
}

/** The image drawn rotated about its centre, on a canvas of its bounding box
 * (corners outside the image stay transparent). */
function drawRotated(
  image: HTMLImageElement,
  width: number,
  height: number,
  degrees: number,
  box: { width: number; height: number },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');
  ctx.translate(box.width / 2, box.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed so a remote (Supabase) image can be read back off the canvas.
    // Harmless for blob:/data: URLs.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
