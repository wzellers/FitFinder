// Crop an image to a rectangle and return a PNG Blob.
//
// Used by ImageCropper during the upload review stage, where the source is a
// same-origin blob: URL created from the selected file.

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
export async function getCroppedBlob(imageSrc: string, areaPercent: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const naturalW = image.naturalWidth || image.width;
  const naturalH = image.naturalHeight || image.height;

  // Convert the percentage rectangle into image-pixel coordinates. These may be
  // negative or larger than the image when the user zoomed out (padding).
  const sx = (areaPercent.x / 100) * naturalW;
  const sy = (areaPercent.y / 100) * naturalH;
  const sw = (areaPercent.width / 100) * naturalW;
  const sh = (areaPercent.height / 100) * naturalH;

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
  ctx.drawImage(image, -sx, -sy, naturalW, naturalH);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas is empty'))),
      'image/png',
    );
  });
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
