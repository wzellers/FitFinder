import { describe, it, expect, vi, beforeEach } from 'vitest';

// Records each call, and answers inserts with `insertResult`.
const calls = vi.hoisted(() => ({
  inserts: [] as unknown[],
  updates: [] as { values: unknown; id: unknown }[],
  insertResult: { data: { id: 'imp-1' } as unknown, error: null as unknown },
}));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      insert: (row: unknown) => {
        calls.inserts.push(row);
        return { select: () => ({ single: () => Promise.resolve(calls.insertResult) }) };
      },
      update: (values: unknown) => ({
        eq: (_col: string, id: unknown) => {
          calls.updates.push({ values, id });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

import { logImpression, recordOutcome } from '@/lib/impressions';

const OUTFIT = { top: { id: 't1' }, bottom: { id: 'b1' }, shoes: { id: 's1' } };

describe('impressions', () => {
  beforeEach(() => {
    calls.inserts.length = 0;
    calls.updates.length = 0;
    calls.insertResult = { data: { id: 'imp-1' }, error: null };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('logs the shown outfit with its predicted score and the model’s rating count', async () => {
    await expect(logImpression('u1', OUTFIT, 1.3, 4)).resolves.toBe('imp-1');
    expect(calls.inserts).toEqual([
      {
        user_id: 'u1',
        top_id: 't1',
        bottom_id: 'b1',
        shoes_id: 's1',
        predicted: 1, // clamped to 0–1
        model_ratings: 4,
      },
    ]);
  });

  it('resolves to null, without throwing, when logging fails', async () => {
    calls.insertResult = { data: null, error: { message: 'nope' } };
    await expect(logImpression('u1', OUTFIT, 0.5, 0)).resolves.toBeNull();
  });

  it('records an outcome once the pending id resolves', async () => {
    let resolve!: (id: string) => void;
    const pending = new Promise<string | null>((r) => (resolve = r));
    const done = recordOutcome(pending, 'rated', 8);
    expect(calls.updates).toHaveLength(0);
    resolve('imp-9');
    await done;
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].id).toBe('imp-9');
    expect(calls.updates[0].values).toMatchObject({ outcome: 'rated', rating: 8 });
  });

  it('skips the outcome when the impression was never saved', async () => {
    await recordOutcome(Promise.resolve(null), 'skipped');
    expect(calls.updates).toHaveLength(0);
  });
});
