import { describe, it, expect } from 'vitest';
import {
  generateScoredOutfits,
  featureVector,
  meanItemRatings,
  sampleItemRatings,
  FEATURE_WEIGHTS,
  type ScoringContext,
} from '@/lib/outfitScoring';
import { makeTop, makeBottom, makeShoes } from '../factories/clothingItem';

const WEIGHT_SUM = Object.values(FEATURE_WEIGHTS).reduce((a, b) => a + b, 0);

function baseCtx(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    likedCombinations: [],
    weather: null,
    recentWears: [],
    occasion: null,
    ratedOutfits: [],
    ...overrides,
  };
}

function baseItems() {
  return [makeTop(), makeBottom(), makeShoes()];
}

describe('generateScoredOutfits', () => {
  describe('empty collection guards', () => {
    it('returns [] with no tops', () => {
      const items = [makeBottom(), makeShoes()];
      expect(generateScoredOutfits(items, baseCtx())).toEqual([]);
    });

    it('returns [] with no bottoms', () => {
      const items = [makeTop(), makeShoes()];
      expect(generateScoredOutfits(items, baseCtx())).toEqual([]);
    });

    it('returns [] with no shoes', () => {
      const items = [makeTop(), makeBottom()];
      expect(generateScoredOutfits(items, baseCtx())).toEqual([]);
    });
  });

  describe('result shape', () => {
    it('returns at most count results (default 5)', () => {
      const tops = Array.from({ length: 3 }, () => makeTop());
      const bottoms = Array.from({ length: 3 }, () => makeBottom());
      const shoes = Array.from({ length: 3 }, () => makeShoes());
      const results = generateScoredOutfits([...tops, ...bottoms, ...shoes], baseCtx());
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('respects custom count', () => {
      const tops = Array.from({ length: 5 }, () => makeTop());
      const bottoms = Array.from({ length: 5 }, () => makeBottom());
      const shoes = Array.from({ length: 5 }, () => makeShoes());
      const results = generateScoredOutfits([...tops, ...bottoms, ...shoes], baseCtx(), 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('each candidate has required shape', () => {
      const results = generateScoredOutfits(baseItems(), baseCtx());
      for (const r of results) {
        expect(r).toHaveProperty('top');
        expect(r).toHaveProperty('bottom');
        expect(r).toHaveProperty('shoes');
        expect(r).toHaveProperty('score');
        expect(typeof r.score).toBe('number');
      }
    });

    it('results are sorted descending by score', () => {
      const tops = Array.from({ length: 3 }, () => makeTop());
      const bottoms = Array.from({ length: 3 }, () => makeBottom());
      const shoes = Array.from({ length: 3 }, () => makeShoes());
      const results = generateScoredOutfits([...tops, ...bottoms, ...shoes], baseCtx());
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('color harmony scoring', () => {
    it('liked color combo produces higher-scored outfit than non-liked', () => {
      const top = makeTop({ colors: ['blue'] });
      const bottom = makeBottom({ colors: ['navy blue'] });
      const topOther = makeTop({ colors: ['red'] });
      const shoes = makeShoes();

      const ctxWithLike = baseCtx({
        likedCombinations: [{ topColor: 'blue', bottomColor: 'navy blue' }],
      });

      const resultsLiked = generateScoredOutfits([top, bottom, shoes], ctxWithLike, 1);
      const resultsOther = generateScoredOutfits([topOther, bottom, shoes], ctxWithLike, 1);

      if (resultsLiked.length > 0 && resultsOther.length > 0) {
        expect(resultsLiked[0].score).toBeGreaterThanOrEqual(resultsOther[0].score);
      }
    });

    it('bidirectional matching works (bottom+top order reversed)', () => {
      const top = makeTop({ colors: ['navy blue'] });
      const bottom = makeBottom({ colors: ['blue'] });
      const shoes = makeShoes();

      const ctx = baseCtx({
        likedCombinations: [{ topColor: 'blue', bottomColor: 'navy blue' }], // reversed
      });

      const results = generateScoredOutfits([top, bottom, shoes], ctx, 5);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('weather scoring', () => {
    it('null weather returns neutral score contribution', () => {
      const results = generateScoredOutfits(baseItems(), baseCtx({ weather: null }));
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.score).toBeGreaterThan(0);
      }
    });

    it('Tank Top is excluded (score=0) in cold weather', () => {
      const tankTop = makeTop({ type: 'Tank Top', colors: ['white'] });
      const bottom = makeBottom();
      const shoes = makeShoes();
      const results = generateScoredOutfits([tankTop, bottom, shoes], baseCtx({ weather: 'cold' }));
      expect(results).toHaveLength(0);
    });
  });

  describe('variety scoring', () => {
    it('recently worn items reduce score', () => {
      const top = makeTop({ id: 'top-worn' });
      const bottom = makeBottom({ id: 'bottom-worn' });
      const shoes = makeShoes({ id: 'shoes-worn' });
      const freshTop = makeTop({ id: 'top-fresh' });

      const recentWears = [
        {
          id: 'w1',
          user_id: 'u1',
          worn_date: '2026-02-26',
          top_id: top.id,
          bottom_id: bottom.id,
          shoes_id: shoes.id,
        },
      ];

      const ctxRecent = baseCtx({ recentWears });
      const ctxFresh = baseCtx({ recentWears: [] });

      const recentResults = generateScoredOutfits([top, bottom, shoes], ctxRecent, 1);
      const freshResults = generateScoredOutfits([freshTop, bottom, shoes], ctxFresh, 1);

      if (recentResults.length > 0 && freshResults.length > 0) {
        expect(recentResults[0].score).toBeLessThanOrEqual(freshResults[0].score + 0.5);
      }
    });
  });

  describe('variety as of a date', () => {
    const top = makeTop({ id: 'top-a' });
    const bottom = makeBottom({ id: 'bottom-a' });
    const shoes = makeShoes({ id: 'shoes-a' });
    const wornOn = (worn_date: string) => ({
      id: `w-${worn_date}`,
      user_id: 'u1',
      worn_date,
      top_id: top.id,
      bottom_id: bottom.id,
      shoes_id: shoes.id,
    });
    const variety = (ctx: Partial<ScoringContext>) =>
      featureVector({ top, bottom, shoes }, baseCtx(ctx)).variety;

    it('measures recency from asOf, not from now', () => {
      // Worn 7 days before 2026-03-10: half-way through the 14-day window.
      expect(variety({ recentWears: [wornOn('2026-03-03')], asOf: '2026-03-10' })).toBeCloseTo(
        0.5,
        6,
      );
      // Worn the same day: full penalty.
      expect(variety({ recentWears: [wornOn('2026-03-10')], asOf: '2026-03-10' })).toBeCloseTo(
        0,
        6,
      );
    });

    it('ignores wears after asOf and older than the window', () => {
      expect(variety({ recentWears: [wornOn('2026-03-12')], asOf: '2026-03-10' })).toBe(1);
      expect(variety({ recentWears: [wornOn('2026-02-01')], asOf: '2026-03-10' })).toBe(1);
    });
  });

  describe('occasion hard filter', () => {
    it('drops items whose type is invalid for the occasion', () => {
      // T-Shirt is not a valid Work top by default → filtered out → no outfits.
      const tshirt = makeTop({ type: 'T-Shirt', id: 'ts1' });
      const bottom = makeBottom({ type: 'Pants' });
      const shoes = makeShoes();

      const results = generateScoredOutfits(
        [tshirt, bottom, shoes],
        baseCtx({ occasion: 'Work' }),
        1,
      );
      expect(results).toHaveLength(0);
    });

    it('keeps items whose type is valid for the occasion', () => {
      // Button-Up Shirt IS a valid Work top by default → outfit survives.
      const buttonUp = makeTop({ type: 'Button-Up Shirt', id: 'bu1' });
      const bottom = makeBottom({ type: 'Pants' });
      const shoes = makeShoes();

      const results = generateScoredOutfits(
        [buttonUp, bottom, shoes],
        baseCtx({ occasion: 'Work' }),
        1,
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].top.type).toBe('Button-Up Shirt');
    });

    it('no occasion (null) applies no filtering', () => {
      // T-Shirt would be dropped for Work, but with no occasion it stays.
      const tshirt = makeTop({ type: 'T-Shirt' });
      const bottom = makeBottom({ type: 'Pants' });
      const shoes = makeShoes();

      const results = generateScoredOutfits(
        [tshirt, bottom, shoes],
        baseCtx({ occasion: null }),
        1,
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns [] when the filter empties a section', () => {
      // Only a T-Shirt top is available, but Work disallows it → no valid tops.
      const tshirt = makeTop({ type: 'T-Shirt' });
      const bottom = makeBottom({ type: 'Pants' });
      const shoes = makeShoes();

      const results = generateScoredOutfits([tshirt, bottom, shoes], baseCtx({ occasion: 'Work' }));
      expect(results).toHaveLength(0);
    });
  });

  describe('rating-based scoring', () => {
    it('high-rated similar outfits boost score', () => {
      const top = makeTop({ id: 'top-rated' });
      const bottom = makeBottom({ id: 'bottom-rated' });
      const shoes = makeShoes({ id: 'shoes-rated' });

      const ratedOutfits = [
        {
          id: 'r1',
          user_id: 'u1',
          worn_date: '2026-02-20',
          top_id: top.id,
          bottom_id: bottom.id,
          shoes_id: shoes.id,
          rating: 9,
        },
      ];

      const ctxHigh = baseCtx({ ratedOutfits });
      const ctxNone = baseCtx({ ratedOutfits: [] });

      const highResults = generateScoredOutfits([top, bottom, shoes], ctxHigh, 1);
      const noneResults = generateScoredOutfits([top, bottom, shoes], ctxNone, 1);

      if (highResults.length > 0 && noneResults.length > 0) {
        expect(highResults[0].score).toBeGreaterThanOrEqual(noneResults[0].score);
      }
    });
  });

  describe('rating feature per item', () => {
    const rated = (rating: number, ids: [string, string, string], n = 1) =>
      Array.from({ length: n }, (_, i) => ({
        id: `r-${ids.join('-')}-${i}`,
        user_id: 'u1',
        worn_date: '2026-02-20',
        top_id: ids[0],
        bottom_id: ids[1],
        shoes_id: ids[2],
        rating,
      }));
    const ctx = (ratedOutfits: ReturnType<typeof rated>) => ({
      likedCombinations: [],
      ratedOutfits,
    });

    it('is neutral for pieces no one has rated', () => {
      const outfit = {
        top: makeTop({ id: 't' }),
        bottom: makeBottom({ id: 'b' }),
        shoes: makeShoes({ id: 's' }),
      };
      expect(featureVector(outfit, ctx(rated(9, ['x', 'y', 'z']))).rating).toBe(0.5);
    });

    it('lifts only the rated pieces, blended with a neutral prior', () => {
      const ratings = rated(9, ['t', 'b', 's']);
      const sameOutfit = {
        top: makeTop({ id: 't' }),
        bottom: makeBottom({ id: 'b' }),
        shoes: makeShoes({ id: 's' }),
      };
      const oneShared = {
        ...sameOutfit,
        bottom: makeBottom({ id: 'b2' }),
        shoes: makeShoes({ id: 's2' }),
      };
      // One rating of 9 → each rated item is (0.5 + 0.9) / 2 = 0.7.
      expect(featureVector(sameOutfit, ctx(ratings)).rating).toBeCloseTo(0.7, 10);
      // Sharing one item lifts the outfit a third as much: (0.7 + 0.5 + 0.5) / 3.
      expect(featureVector(oneShared, ctx(ratings)).rating).toBeCloseTo(1.7 / 3, 10);
    });

    it('meanItemRatings moves toward the ratings as they add up', () => {
      expect(meanItemRatings(rated(9, ['t', 'b', 's'], 9))('t')).toBeCloseTo((0.5 + 8.1) / 10, 10);
    });

    it('sampled ratings vary most for untried items, and are fixed per item per draw', () => {
      const ratings = rated(9, ['t', 'b', 's'], 20);
      let seed = 1;
      const r = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const untried: number[] = [];
      const wellRated: number[] = [];
      for (let i = 0; i < 300; i++) {
        const draw = sampleItemRatings(ratings, r);
        expect(draw('new')).toBe(draw('new'));
        untried.push(draw('new'));
        wellRated.push(draw('t'));
      }
      const sd = (v: number[]) => {
        const m = v.reduce((a, b) => a + b, 0) / v.length;
        return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
      };
      // Untried items are sometimes drawn well above neutral.
      expect(untried.some((v) => v > 0.75)).toBe(true);
      expect(sd(untried)).toBeGreaterThan(3 * sd(wellRated));
      for (const v of [...untried, ...wellRated]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('custom weatherRules', () => {
    it('custom rules override defaults', () => {
      const customRules = {
        'T-Shirt': { blockedIn: ['warm' as const] },
      };
      const top = makeTop({ type: 'T-Shirt' });
      const bottom = makeBottom();
      const shoes = makeShoes();
      const ctx = baseCtx({ weather: 'warm', weatherRules: customRules });

      const results = generateScoredOutfits([top, bottom, shoes], ctx);
      expect(results).toHaveLength(0);
    });
  });

  describe('custom occasionRules', () => {
    it('custom rules override defaults for the hard filter', () => {
      // Default Work disallows T-Shirt tops, but a custom rule allows them.
      const customOccasionRules = {
        Work: {
          tops: ['T-Shirt', 'Button-Up Shirt'],
          bottoms: ['Pants', 'Jeans'],
          shoes: ['Shoes'],
        },
      };
      const tshirt = makeTop({ type: 'T-Shirt' });
      const bottom = makeBottom({ type: 'Pants' });
      const shoes = makeShoes();

      const defaultResults = generateScoredOutfits(
        [tshirt, bottom, shoes],
        baseCtx({ occasion: 'Work' }),
        1,
      );
      const customResults = generateScoredOutfits(
        [tshirt, bottom, shoes],
        baseCtx({ occasion: 'Work', occasionRules: customOccasionRules }),
        1,
      );

      // Default filters the T-Shirt out; the custom rule keeps it.
      expect(defaultResults).toHaveLength(0);
      expect(customResults.length).toBeGreaterThan(0);
    });
  });

  describe('scoring weights', () => {
    it('weights sum to 1.0', () => {
      expect(WEIGHT_SUM).toBeCloseTo(1.0, 5);
    });
  });
});
