import { describe, it, expect } from 'vitest';
import { mergeRatedOutfits, type OutfitRatingRow } from '@/lib/ratedOutfits';
import type { OutfitWear } from '@/lib/types';

const wear = (id: string, worn_date: string, rating?: number): OutfitWear => ({
  id,
  user_id: 'u1',
  top_id: 't1',
  bottom_id: 'b1',
  shoes_id: 's1',
  worn_date,
  rating,
});
const browsed = (id: string, rated_on: string, rating: number): OutfitRatingRow => ({
  id,
  user_id: 'u1',
  top_id: 't2',
  bottom_id: 'b2',
  shoes_id: 's2',
  rating,
  rated_on,
});

describe('mergeRatedOutfits', () => {
  it('combines worn and browsing ratings, newest first, as wear rows', () => {
    const merged = mergeRatedOutfits(
      [wear('w1', '2026-03-01', 7), wear('w2', '2026-03-05', 4)],
      [browsed('r1', '2026-03-03', 9)],
    );
    expect(merged.map((m) => m.id)).toEqual(['w2', 'rating-r1', 'w1']);
    expect(merged[1]).toMatchObject({
      top_id: 't2',
      bottom_id: 'b2',
      shoes_id: 's2',
      rating: 9,
      worn_date: '2026-03-03',
    });
  });

  it('drops unrated wears and keeps only the most recent `limit`', () => {
    const merged = mergeRatedOutfits(
      [wear('w1', '2026-03-01'), wear('w2', '2026-03-02', 5)],
      [browsed('r1', '2026-03-04', 8), browsed('r2', '2026-03-03', 6)],
      2,
    );
    expect(merged.map((m) => m.id)).toEqual(['rating-r1', 'rating-r2']);
  });
});
