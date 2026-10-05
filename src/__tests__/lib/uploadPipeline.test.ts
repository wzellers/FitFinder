import { describe, it, expect, vi, beforeEach } from 'vitest';

// uploadPipeline imports the supabase client at module load; stub it out.
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();
const mockRowInsertSelect = vi.fn();
const mockRowInsert = vi.fn((_rows: Array<Record<string, unknown>>) => ({
  select: mockRowInsertSelect,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        remove: mockRemove,
      })),
    },
    from: vi.fn(() => ({
      insert: mockRowInsert,
    })),
  },
}));

import { runWithConcurrency, uploadItem, prepareImageForUpload } from '@/lib/uploadPipeline';

describe('runWithConcurrency', () => {
  it('runs every item and preserves result order', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await runWithConcurrency(items, 2, async (n) => n * 10);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it('never exceeds the concurrency limit', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let active = 0;
    let maxActive = 0;

    await runWithConcurrency(items, 3, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return null;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('passes the index to the worker', async () => {
    const items = ['a', 'b', 'c'];
    const results = await runWithConcurrency(items, 2, async (item, index) => `${item}${index}`);
    expect(results).toEqual(['a0', 'b1', 'c2']);
  });

  it('handles an empty list without invoking the worker', async () => {
    const worker = vi.fn();
    const results = await runWithConcurrency([], 3, worker);
    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it('caps runners at the item count when limit exceeds it', async () => {
    const items = [1, 2];
    const results = await runWithConcurrency(items, 10, async (n) => n + 1);
    expect(results).toEqual([2, 3]);
  });
});

describe('uploadItem', () => {
  const base = 'https://proj.supabase.co/storage/v1/object/public/clothing-images/';

  beforeEach(() => {
    mockUpload.mockReset().mockResolvedValue({ error: null });
    let n = 0;
    mockGetPublicUrl.mockReset().mockImplementation(() => ({
      data: { publicUrl: `${base}u1/file-${n++}.png` },
    }));
    mockRowInsertSelect.mockReset().mockResolvedValue({ error: null });
    mockRowInsert.mockClear();
  });

  const baseInput = {
    userId: 'u1',
    blob: new Blob(['img'], { type: 'image/png' }),
    type: 'T-Shirt',
    colors: ['blue'],
    isDirty: false,
  };

  it('uploads the image once and inserts a clothing_items row', async () => {
    await uploadItem(baseInput);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    const row = mockRowInsert.mock.calls[0][0][0];
    // The bucket is private, so the row stores the storage path, not a URL.
    expect(row.image_url).toBe(mockUpload.mock.calls[0][0]);
    expect(row.image_url).toMatch(/^u1\/.+\.png$/);
    expect(row.type).toBe('T-Shirt');
    expect(row.colors).toEqual(['blue']);
    expect(row.user_id).toBe('u1');
    expect(row.is_dirty).toBe(false);
  });

  it('does not write an original_image_url column', async () => {
    await uploadItem(baseInput);
    const row = mockRowInsert.mock.calls[0][0][0];
    expect('original_image_url' in row).toBe(false);
  });

  it('throws when the insert fails', async () => {
    mockRowInsertSelect.mockResolvedValue({ error: { message: 'insert failed' } });
    await expect(uploadItem(baseInput)).rejects.toBeTruthy();
  });
});

describe('prepareImageForUpload', () => {
  it('passes PNGs through untouched', async () => {
    const png = new Blob(['img'], { type: 'image/png' });
    expect(await prepareImageForUpload(png)).toBe(png);
  });

  it('rejects with a readable message when the browser cannot decode the photo', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode')));
    const heic = new Blob(['img'], { type: 'image/heic' });
    await expect(prepareImageForUpload(heic)).rejects.toThrow(/format/);
    vi.unstubAllGlobals();
  });
});

describe('uploadItem cleanup', () => {
  it('removes the uploaded image when the row insert fails', async () => {
    mockUpload.mockReset().mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReset().mockReturnValue({
      data: {
        publicUrl: 'https://proj.supabase.co/storage/v1/object/public/clothing-images/u1/a.png',
      },
    });
    mockRemove.mockReset().mockResolvedValue({ error: null });
    mockRowInsertSelect.mockReset().mockResolvedValue({ error: { message: 'insert failed' } });

    await expect(
      uploadItem({
        userId: 'u1',
        blob: new Blob(['img'], { type: 'image/png' }),
        type: 'T-Shirt',
        colors: ['blue'],
        isDirty: false,
      }),
    ).rejects.toBeTruthy();
    expect(mockRemove).toHaveBeenCalledWith([mockUpload.mock.calls[0][0]]);
  });
});
