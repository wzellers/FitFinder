import { describe, it, expect } from 'vitest';
import {
  defaultModel,
  normalizeModel,
  predict,
  rawScore,
  computeReward,
  updateWeights,
  selectOutfits,
  serializeModel,
  deserializeModel,
  MODEL_VERSION,
  SAVED_OUTFIT_REWARD,
  type FeatureVector,
} from '@/lib/banditModel';
import { FEATURE_NAMES, FEATURE_WEIGHTS } from '@/lib/outfitScoring';

function feats(overrides: Partial<FeatureVector> = {}): FeatureVector {
  return { color: 0.5, weather: 0.5, variety: 0.5, occasion: 0.5, rating: 0.5, ...overrides };
}

/** Deterministic RNG that yields a fixed queue of values, then repeats the last. */
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i++;
    return v;
  };
}

describe('banditModel', () => {
  describe('cold start', () => {
    it('defaultModel seeds weights from FEATURE_WEIGHTS with zero bias', () => {
      const m = defaultModel();
      for (const name of FEATURE_NAMES) {
        expect(m.params.weights[name]).toBe(FEATURE_WEIGHTS[name]);
      }
      expect(m.params.bias).toBe(0);
      expect(m.meta.version).toBe(MODEL_VERSION);
      expect(m.meta.updates).toBe(0);
    });

    it('cold-start prediction equals the deterministic weighted score', () => {
      const m = defaultModel();
      const f = feats({ color: 1, weather: 0.5, variety: 1, occasion: 0, rating: 0.5 });
      const expected =
        FEATURE_WEIGHTS.color * 1 +
        FEATURE_WEIGHTS.weather * 0.5 +
        FEATURE_WEIGHTS.variety * 1 +
        FEATURE_WEIGHTS.occasion * 0 +
        FEATURE_WEIGHTS.rating * 0.5;
      expect(predict(m.params, f)).toBeCloseTo(expected, 6);
    });
  });

  describe('normalizeModel', () => {
    it('returns cold-start model for null/undefined', () => {
      expect(normalizeModel(null)).toEqual(defaultModel());
      expect(normalizeModel(undefined)).toEqual(defaultModel());
    });

    it('fills missing feature weights from defaults', () => {
      const partial = {
        params: { weights: { color: 0.9 } as Record<string, number>, bias: 0.2 },
      } as Parameters<typeof normalizeModel>[0];
      const m = normalizeModel(partial);
      expect(m.params.weights.color).toBe(0.9);
      expect(m.params.weights.weather).toBe(FEATURE_WEIGHTS.weather);
      expect(m.params.bias).toBe(0.2);
    });

    it('ignores non-finite stored values', () => {
      const partial = {
        params: { weights: { color: NaN } as Record<string, number>, bias: Infinity },
      } as Parameters<typeof normalizeModel>[0];
      const m = normalizeModel(partial);
      expect(m.params.weights.color).toBe(FEATURE_WEIGHTS.color);
      expect(m.params.bias).toBe(0);
    });
  });

  describe('predict / rawScore', () => {
    it('predict clamps to [0, 1]', () => {
      const big = { weights: { color: 5, weather: 5, variety: 5, occasion: 5, rating: 5 }, bias: 5 };
      const small = { weights: { color: -5, weather: -5, variety: -5, occasion: -5, rating: -5 }, bias: -5 };
      expect(predict(big, feats({ color: 1, weather: 1, variety: 1, occasion: 1, rating: 1 }))).toBe(1);
      expect(predict(small, feats({ color: 1, weather: 1, variety: 1, occasion: 1, rating: 1 }))).toBe(0);
    });

    it('rawScore is unclamped and includes bias', () => {
      const params = { weights: { color: 1, weather: 0, variety: 0, occasion: 0, rating: 0 }, bias: 0.3 };
      expect(rawScore(params, feats({ color: 2 }))).toBeCloseTo(2.3, 6);
    });
  });

  describe('computeReward', () => {
    it('maps 1 → 0, 10 → 1, midpoint near 0.5', () => {
      expect(computeReward(1)).toBe(0);
      expect(computeReward(10)).toBe(1);
      expect(computeReward(5.5)).toBeCloseTo(0.5, 6);
    });

    it('clamps out-of-range ratings', () => {
      expect(computeReward(0)).toBe(0);
      expect(computeReward(11)).toBe(1);
    });

    it('SAVED_OUTFIT_REWARD is a mild positive in (0.5, 1)', () => {
      expect(SAVED_OUTFIT_REWARD).toBeGreaterThan(0.5);
      expect(SAVED_OUTFIT_REWARD).toBeLessThan(1);
    });
  });

  describe('updateWeights', () => {
    it('does not mutate the input model', () => {
      const m = defaultModel();
      const before = JSON.parse(JSON.stringify(m));
      updateWeights(m, feats(), 1);
      expect(m).toEqual(before);
    });

    it('increments the update counter', () => {
      const m = updateWeights(defaultModel(), feats(), 1);
      expect(m.meta.updates).toBe(1);
      const m2 = updateWeights(m, feats(), 1);
      expect(m2.meta.updates).toBe(2);
    });

    it('moves prediction toward a high reward for the active feature', () => {
      // Only the color feature is active; a high reward should raise its weight.
      const f = feats({ color: 1, weather: 0, variety: 0, occasion: 0, rating: 0 });
      let m = defaultModel();
      const before = predict(m.params, f);
      m = updateWeights(m, f, 1, 0.1);
      const after = predict(m.params, f);
      expect(after).toBeGreaterThan(before);
      expect(m.params.weights.color).toBeGreaterThan(FEATURE_WEIGHTS.color);
    });

    it('moves prediction toward a low reward', () => {
      const f = feats({ color: 1, weather: 0, variety: 0, occasion: 0, rating: 0 });
      let m = defaultModel();
      const before = predict(m.params, f);
      m = updateWeights(m, f, 0, 0.1);
      const after = predict(m.params, f);
      expect(after).toBeLessThan(before);
    });

    it('repeated updates converge toward the reward (monotonic error shrink)', () => {
      const f = feats({ color: 1, weather: 1, variety: 1, occasion: 1, rating: 1 });
      const target = 0.9;
      let m = defaultModel();
      let prevErr = Math.abs(target - predict(m.params, f));
      for (let i = 0; i < 50; i++) {
        m = updateWeights(m, f, target, 0.1);
        const err = Math.abs(target - predict(m.params, f));
        expect(err).toBeLessThanOrEqual(prevErr + 1e-9);
        prevErr = err;
      }
      expect(prevErr).toBeLessThan(0.05);
    });

    it('zero-valued features only move the bias, not their weights', () => {
      const f = feats({ color: 0, weather: 0, variety: 0, occasion: 0, rating: 0 });
      const m = updateWeights(defaultModel(), f, 1, 0.1);
      for (const name of FEATURE_NAMES) {
        expect(m.params.weights[name]).toBe(FEATURE_WEIGHTS[name]);
      }
      expect(m.params.bias).toBeGreaterThan(0);
    });
  });

  describe('selectOutfits (ε-greedy)', () => {
    const candidates = [
      { candidate: 'low', features: feats({ color: 0, weather: 0, variety: 0, occasion: 0, rating: 0 }) },
      { candidate: 'mid', features: feats() },
      { candidate: 'high', features: feats({ color: 1, weather: 1, variety: 1, occasion: 1, rating: 1 }) },
    ];

    it('exploits (rng above ε) → highest predicted reward first', () => {
      const params = defaultModel().params;
      const out = selectOutfits(candidates, params, { epsilon: 0.15, count: 3, rng: seededRng([0.9]) });
      expect(out.map((o) => o.candidate)).toEqual(['high', 'mid', 'low']);
      expect(out[0].score).toBeGreaterThanOrEqual(out[1].score);
    });

    it('explores (rng below ε) → order differs from pure exploit', () => {
      const params = defaultModel().params;
      // First rng() < ε triggers explore; subsequent values drive the shuffle.
      const out = selectOutfits(candidates, params, {
        epsilon: 0.5,
        count: 3,
        rng: seededRng([0.1, 0.99, 0.0, 0.5]),
      });
      expect(out).toHaveLength(3);
      expect(new Set(out.map((o) => o.candidate)).size).toBe(3); // all distinct
    });

    it('respects count', () => {
      const params = defaultModel().params;
      const out = selectOutfits(candidates, params, { epsilon: 0, count: 2, rng: seededRng([0.9]) });
      expect(out).toHaveLength(2);
    });

    it('tags each result with its predicted score', () => {
      const params = defaultModel().params;
      const out = selectOutfits(candidates, params, { epsilon: 0, count: 3, rng: seededRng([0.9]) });
      for (const o of out) {
        expect(o.score).toBeCloseTo(predict(params, o.features), 6);
      }
    });

    it('is deterministic given a seeded rng', () => {
      const params = defaultModel().params;
      const a = selectOutfits(candidates, params, { epsilon: 0.3, count: 3, rng: seededRng([0.1, 0.4, 0.2, 0.8]) });
      const b = selectOutfits(candidates, params, { epsilon: 0.3, count: 3, rng: seededRng([0.1, 0.4, 0.2, 0.8]) });
      expect(a.map((o) => o.candidate)).toEqual(b.map((o) => o.candidate));
    });
  });

  describe('serialization', () => {
    it('round-trips a model through serialize → deserialize', () => {
      let m = defaultModel();
      m = updateWeights(m, feats({ color: 1 }), 1, 0.1);
      m = updateWeights(m, feats({ weather: 1 }), 0, 0.1);
      const restored = deserializeModel(serializeModel(m));
      expect(restored.params.weights).toEqual(m.params.weights);
      expect(restored.params.bias).toBeCloseTo(m.params.bias, 10);
      expect(restored.meta.updates).toBe(m.meta.updates);
      expect(restored.meta.version).toBe(m.meta.version);
    });

    it('serialize folds the bias under __bias', () => {
      const s = serializeModel(defaultModel());
      expect(s.weights.__bias).toBe(0);
      for (const name of FEATURE_NAMES) expect(s.weights[name]).toBe(FEATURE_WEIGHTS[name]);
    });

    it('deserialize falls back to cold start for empty/null rows', () => {
      expect(deserializeModel(null)).toEqual(defaultModel());
      expect(deserializeModel({})).toEqual(defaultModel());
      expect(deserializeModel({ weights: {} } as Parameters<typeof deserializeModel>[0])).not.toBeNull();
    });

    it('deserialize backfills missing features from a legacy row', () => {
      const legacy = { weights: { color: 0.8, __bias: 0.1 }, feature_meta: { version: MODEL_VERSION, updates: 3 } };
      const m = deserializeModel(legacy);
      expect(m.params.weights.color).toBe(0.8);
      expect(m.params.weights.weather).toBe(FEATURE_WEIGHTS.weather);
      expect(m.params.bias).toBe(0.1);
      expect(m.meta.updates).toBe(3);
    });
  });

  describe('learning end-to-end', () => {
    it('after rewarding high-color outfits, color weight grows relative to others', () => {
      let m = defaultModel();
      const goodColor = feats({ color: 1, weather: 0.5, variety: 0.5, occasion: 0.5, rating: 0.5 });
      for (let i = 0; i < 30; i++) m = updateWeights(m, goodColor, 1, 0.05);
      expect(m.params.weights.color).toBeGreaterThan(FEATURE_WEIGHTS.color);
    });
  });
});
