import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { imagePathFromUrl } from '@/lib/clothingImages';

describe('imagePathFromUrl', () => {
  it('extracts the path from a public URL', () => {
    expect(
      imagePathFromUrl(
        'https://x.supabase.co/storage/v1/object/public/clothing-images/u1/123-abc.png',
      ),
    ).toBe('u1/123-abc.png');
  });

  it('extracts the path from a signed URL and drops the token', () => {
    expect(
      imagePathFromUrl(
        'https://x.supabase.co/storage/v1/object/sign/clothing-images/u1/a.png?token=t',
      ),
    ).toBe('u1/a.png');
  });

  it('accepts a bare path', () => {
    expect(imagePathFromUrl('u1/a.png')).toBe('u1/a.png');
  });

  it('returns null for unrelated URLs and empty values', () => {
    expect(imagePathFromUrl('https://example.com/a.png')).toBeNull();
    expect(imagePathFromUrl(null)).toBeNull();
  });
});

describe('getClothingImageUrl', () => {
  it('batches requests in the same tick into one createSignedUrls call and caches them', async () => {
    vi.resetModules();
    const createSignedUrls = vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })),
      error: null,
    }));
    vi.doMock('@/lib/supabaseClient', () => ({
      supabase: { storage: { from: () => ({ createSignedUrls }) } },
    }));
    const mod = await import('@/lib/clothingImages');

    const [a, b] = await Promise.all([
      mod.getClothingImageUrl('u1/a.png'),
      mod.getClothingImageUrl(
        'https://x.supabase.co/storage/v1/object/public/clothing-images/u1/b.png',
      ),
    ]);
    expect(a).toBe('https://signed/u1/a.png');
    expect(b).toBe('https://signed/u1/b.png');
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls.mock.calls[0][0]).toEqual(['u1/a.png', 'u1/b.png']);

    expect(mod.getCachedClothingImageUrl('u1/a.png')).toBe('https://signed/u1/a.png');
    await mod.getClothingImageUrl('u1/a.png');
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });
});
