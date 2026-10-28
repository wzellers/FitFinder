import { describe, it, expect } from 'vitest';
import { categoryUse, favoritePairing, rewearRate, wearStreak, weekdayCounts } from '@/lib/stats';
import { makeBottom, makeShoes, makeTop } from '../factories/clothingItem';

const wear = (worn_date: string, top_id = 't1', bottom_id = 'b1', shoes_id = 's1') => ({
  worn_date,
  top_id,
  bottom_id,
  shoes_id,
});

describe('wearStreak', () => {
  it('counts days in a row up to today', () => {
    const wears = [wear('2026-10-25'), wear('2026-10-26'), wear('2026-10-27'), wear('2026-10-20')];
    expect(wearStreak(wears, '2026-10-27')).toBe(3);
  });

  it("isn't broken just because today isn't logged yet", () => {
    expect(wearStreak([wear('2026-10-25'), wear('2026-10-26')], '2026-10-27')).toBe(2);
  });

  it('is zero after a missed day', () => {
    expect(wearStreak([wear('2026-10-24')], '2026-10-27')).toBe(0);
    expect(wearStreak([], '2026-10-27')).toBe(0);
  });

  it('crosses month ends', () => {
    expect(wearStreak([wear('2026-10-31'), wear('2026-11-01')], '2026-11-01')).toBe(2);
  });
});

describe('weekdayCounts', () => {
  it('counts outfits per weekday, Sunday first', () => {
    // 2026-10-25 is a Sunday, 2026-10-27 a Tuesday.
    expect(weekdayCounts([wear('2026-10-25'), wear('2026-10-27'), wear('2026-11-03')])).toEqual([
      1, 0, 2, 0, 0, 0, 0,
    ]);
  });
});

describe('favoritePairing', () => {
  const items = [
    makeTop({ id: 't1', colors: ['navy blue'] }),
    makeTop({ id: 't2', colors: ['white'] }),
    makeBottom({ id: 'b1', colors: ['beige'] }),
    makeShoes({ id: 's1', colors: ['white'] }),
  ];

  it('finds the top/bottom colour pairing worn most', () => {
    const wears = [wear('2026-10-01'), wear('2026-10-02'), wear('2026-10-03', 't2')];
    expect(favoritePairing(wears, items)).toEqual({ top: 'navy blue', bottom: 'beige', count: 2 });
  });

  it('is null with nothing worn', () => {
    expect(favoritePairing([], items)).toBeNull();
  });
});

describe('categoryUse', () => {
  it('counts the pieces of each category worn at least once', () => {
    const items = [
      makeTop({ id: 't1' }),
      makeTop({ id: 't2' }),
      makeBottom({ id: 'b1' }),
      makeShoes({ id: 's1' }),
    ];
    expect(categoryUse(items, [wear('2026-10-01')])).toEqual([
      { section: 'Tops', worn: 1, total: 2 },
      { section: 'Bottoms', worn: 1, total: 1 },
      { section: 'Shoes', worn: 1, total: 1 },
    ]);
  });
});

describe('rewearRate', () => {
  it('is the share of outfits that repeat an earlier one exactly', () => {
    const wears = [
      wear('2026-10-01'),
      wear('2026-10-02'),
      wear('2026-10-03', 't2'),
      wear('2026-10-04'),
    ];
    expect(rewearRate(wears)).toBe(0.5);
    expect(rewearRate([])).toBe(0);
  });
});
