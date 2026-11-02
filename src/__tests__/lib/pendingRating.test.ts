import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findPendingRating } from '@/lib/pendingRating';

// A query builder that records its filters and returns the table's rows
// that match them.
function fakeDb(tables: Record<string, Record<string, unknown>[]>) {
  const from = (table: string) => {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    const b: Record<string, unknown> = {
      select: () => b,
      limit: () => b,
      eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), b),
      is: (col: string, v: unknown) => (filters.push((r) => (r[col] ?? null) === v), b),
      gte: (col: string, v: string) => (filters.push((r) => String(r[col]) >= v), b),
      then: (resolve: (v: unknown) => unknown) =>
        resolve({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r))) }),
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

const wear = {
  id: 'w1',
  user_id: 'u1',
  worn_date: '2026-11-01',
  top_id: 't',
  bottom_id: 'b',
  shoes_id: 's',
  rating: null,
  occasion: 'Work',
};

describe('findPendingRating', () => {
  it("asks about yesterday's unrated outfit", async () => {
    const pending = await findPendingRating(fakeDb({ outfit_wears: [wear] }), 'u1', '2026-11-01');
    expect(pending).toEqual({
      wear_id: 'w1',
      worn_date: '2026-11-01',
      occasion: 'Work',
      outfit_items: { top_id: 't', bottom_id: 'b', shoes_id: 's' },
    });
  });

  it('asks nothing once the day is rated (e.g. in the Calendar)', async () => {
    const db = fakeDb({ outfit_wears: [{ ...wear, rating: 7 }] });
    expect(await findPendingRating(db, 'u1', '2026-11-01')).toBeNull();
  });

  it('asks nothing when the same outfit was rated on the Outfits tab since', async () => {
    const rated = { user_id: 'u1', top_id: 't', bottom_id: 'b', shoes_id: 's' };
    const db = fakeDb({
      outfit_wears: [wear],
      outfit_ratings: [{ ...rated, id: 'r1', rated_on: '2026-11-01' }],
    });
    expect(await findPendingRating(db, 'u1', '2026-11-01')).toBeNull();
  });

  it('still asks when the outfit was only rated before it was worn, or a different one was', async () => {
    const db = fakeDb({
      outfit_wears: [wear],
      outfit_ratings: [
        {
          id: 'old',
          user_id: 'u1',
          top_id: 't',
          bottom_id: 'b',
          shoes_id: 's',
          rated_on: '2026-10-20',
        },
        {
          id: 'other',
          user_id: 'u1',
          top_id: 't',
          bottom_id: 'x',
          shoes_id: 's',
          rated_on: '2026-11-01',
        },
      ],
    });
    expect((await findPendingRating(db, 'u1', '2026-11-01'))?.wear_id).toBe('w1');
  });
});
