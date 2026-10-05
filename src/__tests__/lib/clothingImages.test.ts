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
