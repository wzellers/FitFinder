import { describe, it, expect } from 'vitest';
import { rotatedSize } from '@/lib/imageCrop';

describe('rotatedSize', () => {
  it('is the image itself without a tilt', () => {
    expect(rotatedSize(400, 300, 0)).toEqual({ width: 400, height: 300 });
  });

  it('swaps the sides for a quarter turn', () => {
    expect(rotatedSize(400, 300, 90)).toEqual({ width: 300, height: 400 });
    expect(rotatedSize(400, 300, -270)).toEqual({ width: 300, height: 400 });
  });

  it('grows to hold the corners of a tilted image', () => {
    // A square tilted 45° needs a box √2 times as wide.
    expect(rotatedSize(100, 100, 45)).toEqual({ width: 141, height: 141 });
    const tilted = rotatedSize(400, 300, 10);
    expect(tilted.width).toBeGreaterThan(400);
    expect(tilted.height).toBeGreaterThan(300);
    // Tilting either way needs the same box.
    expect(rotatedSize(400, 300, -10)).toEqual(tilted);
  });
});
