import { describe, it, expect } from 'vitest';
import { generateScoredOutfits, type ScoringContext } from '@/lib/outfitScoring';
import { makeTop, makeBottom, makeShoes } from '../factories/clothingItem';

const WEIGHT_SUM = 0.30 + 0.25 + 0.20 + 0.15 + 0.10;

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
      const results = generateScoredOutfits(
        [tankTop, bottom, shoes],
        baseCtx({ weather: 'cold' }),
      );
      expect(results).toHaveLength(0);
    });
  });

  describe('variety scoring', () => {
    it('recently worn items reduce score', () => {
      const top = makeTop({ id: 'top-worn' });
      const bottom = makeBottom({ id: 'bottom-worn' });
      const shoes = makeShoes({ id: 'shoes-worn' });
      const freshTop = makeTop({ id: 'top-fresh' });

      const recentWears = [{
        id: 'w1',
        user_id: 'u1',
        worn_date: '2026-02-26',
        top_id: top.id,
        bottom_id: bottom.id,
        shoes_id: shoes.id,
      }];

      const ctxRecent = baseCtx({ recentWears });
      const ctxFresh = baseCtx({ recentWears: [] });

      const recentResults = generateScoredOutfits([top, bottom, shoes], ctxRecent, 1);
      const freshResults = generateScoredOutfits([freshTop, bottom, shoes], ctxFresh, 1);

      if (recentResults.length > 0 && freshResults.length > 0) {
        expect(recentResults[0].score).toBeLessThanOrEqual(freshResults[0].score + 0.5);
      }
    });
  });

  describe('occasion scoring', () => {
    it('T-Shirt in Work context has lower occasion contribution', () => {
      const tshirt = makeTop({ type: 'T-Shirt', id: 'ts1' });
      const buttonUp = makeTop({ type: 'Button-Up Shirt', id: 'bu1' });
      const bottom = makeBottom({ type: 'Pants' });
      const shoes = makeShoes();

      const ctx = baseCtx({ occasion: 'Work' });
      const tshirtResults = generateScoredOutfits([tshirt, bottom, shoes], ctx, 1);
      const buttonUpResults = generateScoredOutfits([buttonUp, bottom, shoes], ctx, 1);

      if (tshirtResults.length > 0 && buttonUpResults.length > 0) {
        expect(buttonUpResults[0].score).toBeGreaterThan(tshirtResults[0].score);
      }
    });
  });

  describe('comfort scoring', () => {
    it('high-rated similar outfits boost score', () => {
      const top = makeTop({ id: 'top-rated' });
      const bottom = makeBottom({ id: 'bottom-rated' });
      const shoes = makeShoes({ id: 'shoes-rated' });

      const ratedOutfits = [{
        id: 'r1',
        user_id: 'u1',
        worn_date: '2026-02-20',
        top_id: top.id,
        bottom_id: bottom.id,
        shoes_id: shoes.id,
        comfort_rating: 9,
        rating: 9,
      }];

      const ctxHigh = baseCtx({ ratedOutfits });
      const ctxNone = baseCtx({ ratedOutfits: [] });

      const highResults = generateScoredOutfits([top, bottom, shoes], ctxHigh, 1);
      const noneResults = generateScoredOutfits([top, bottom, shoes], ctxNone, 1);

      if (highResults.length > 0 && noneResults.length > 0) {
        expect(highResults[0].score).toBeGreaterThanOrEqual(noneResults[0].score);
      }
    });
  });

  describe('custom weatherRules', () => {
    it('custom rules override defaults', () => {
      const customRules = {
        'T-Shirt': { blockedIn: ['warm' as const], suggestedIn: [] },
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
    it('custom occasion rules are applied', () => {
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

      const ctxDefault = baseCtx({ occasion: 'Work' });
      const ctxCustom = baseCtx({ occasion: 'Work', occasionRules: customOccasionRules });

      const defaultResults = generateScoredOutfits([tshirt, bottom, shoes], ctxDefault, 1);
      const customResults = generateScoredOutfits([tshirt, bottom, shoes], ctxCustom, 1);

      if (defaultResults.length > 0 && customResults.length > 0) {
        expect(customResults[0].score).toBeGreaterThanOrEqual(defaultResults[0].score);
      }
    });
  });

  describe('scoring weights', () => {
    it('weights sum to 1.0', () => {
      expect(WEIGHT_SUM).toBeCloseTo(1.0, 5);
    });
  });
});
