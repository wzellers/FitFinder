import { describe, it, expect, vi } from 'vitest';

// uploadPipeline imports the supabase client at module load; stub it out.
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    storage: { from: vi.fn() },
    from: vi.fn(),
  },
}));

import { runWithConcurrency } from '@/lib/uploadPipeline';

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
