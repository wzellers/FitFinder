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
  PRIOR_PRECISION,
  HALF_LIFE_DAYS,
  fadeTo,
  forgetReward,
  learnFromSkip,
  SAVED_OUTFIT_REWARD,
  type BanditModel,
  type FeatureVector,
} from '@/lib/banditModel';
import { FEATURE_NAMES, FEATURE_WEIGHTS } from '@/lib/outfitScoring';

function feats(overrides: Partial<FeatureVector> = {}): FeatureVector {
  return { color: 0.5, variety: 0.5, rating: 0.5, ...overrides };
}

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLOR_ONLY = feats({ color: 1, variety: 0, rating: 0 });
const D = FEATURE_NAMES.length + 1;

describe('banditModel', () => {
  describe('cold start', () => {
    it('is centred on FEATURE_WEIGHTS with zero bias and a diagonal prior', () => {
      const m = defaultModel();
      for (const name of FEATURE_NAMES) {
        expect(m.params.weights[name]).toBe(FEATURE_WEIGHTS[name]);
      }
      expect(m.params.bias).toBe(0);
      expect(m.meta).toEqual({ version: MODEL_VERSION, updates: 0 });
      for (let i = 0; i < D; i++) {
        for (let j = 0; j < D; j++) {
          expect(m.posterior.precision[i][j]).toBe(i === j ? PRIOR_PRECISION : 0);
        }
      }
    });

    it('expected score equals the deterministic weighted score', () => {
      const f = feats({ color: 1, variety: 1, rating: 0.5 });
      const expected =
        FEATURE_WEIGHTS.color * 1 + FEATURE_WEIGHTS.variety * 1 + FEATURE_WEIGHTS.rating * 0.5;
      expect(predict(defaultModel().params, f)).toBeCloseTo(expected, 6);
    });
  });

  describe('normalizeModel', () => {
    it('returns the cold-start model for null/undefined', () => {
      expect(normalizeModel(null)).toEqual(defaultModel());
      expect(normalizeModel(undefined)).toEqual(defaultModel());
    });

    it('fills missing weights from defaults and ignores non-finite values', () => {
      const m = normalizeModel({
        params: { weights: { color: 0.9 } as never, bias: Infinity },
      });
      expect(m.params.weights.color).toBe(0.9);
      expect(m.params.weights.variety).toBe(FEATURE_WEIGHTS.variety);
      expect(m.params.bias).toBe(0);
    });

    it('gives a model without a valid posterior a prior centred on its weights', () => {
      const m = normalizeModel({
        params: { weights: { ...FEATURE_WEIGHTS, color: 0.9 }, bias: 0.1 },
        posterior: { precision: [[1]], target: [1] },
      });
      expect(m.posterior.precision[0][0]).toBe(PRIOR_PRECISION);
      expect(m.posterior.target[0]).toBeCloseTo(PRIOR_PRECISION * 0.9, 10);
      expect(m.posterior.target[D - 1]).toBeCloseTo(PRIOR_PRECISION * 0.1, 10);
    });
  });

  describe('predict / rawScore', () => {
    it('predict clamps to [0, 1]', () => {
      const all = feats({ color: 1, variety: 1, rating: 1 });
      const big = {
        weights: { color: 5, variety: 5, rating: 5 },
        bias: 5,
      };
      const small = {
        weights: { color: -5, variety: -5, rating: -5 },
        bias: -5,
      };
      expect(predict(big, all)).toBe(1);
      expect(predict(small, all)).toBe(0);
    });

    it('rawScore is unclamped and includes bias', () => {
      const params = {
        weights: { color: 1, variety: 0, rating: 0 },
        bias: 0.3,
      };
      expect(rawScore(params, feats({ color: 2 }))).toBeCloseTo(2.3, 6);
    });
  });

  describe('computeReward', () => {
    it('maps 1 → 0, 10 → 1, midpoint near 0.5, and clamps', () => {
      expect(computeReward(1)).toBe(0);
      expect(computeReward(10)).toBe(1);
      expect(computeReward(5.5)).toBeCloseTo(0.5, 6);
      expect(computeReward(0)).toBe(0);
      expect(computeReward(11)).toBe(1);
    });

    it('SAVED_OUTFIT_REWARD is a mild positive in (0.5, 1)', () => {
      expect(SAVED_OUTFIT_REWARD).toBeGreaterThan(0.5);
      expect(SAVED_OUTFIT_REWARD).toBeLessThan(1);
    });
  });

  describe('updateWeights (Bayesian)', () => {
    it('does not mutate the input model and counts updates', () => {
      const m = defaultModel();
      const before = JSON.parse(JSON.stringify(m));
      const m1 = updateWeights(m, feats(), 1);
      expect(m).toEqual(before);
      expect(m1.meta.updates).toBe(1);
      expect(updateWeights(m1, feats(), 1).meta.updates).toBe(2);
    });

    it('a high reward raises the active feature and the prediction', () => {
      const m = updateWeights(defaultModel(), COLOR_ONLY, 1);
      expect(predict(m.params, COLOR_ONLY)).toBeGreaterThan(
        predict(defaultModel().params, COLOR_ONLY),
      );
      expect(m.params.weights.color).toBeGreaterThan(FEATURE_WEIGHTS.color);
    });

    it('a low reward lowers the prediction', () => {
      const m = updateWeights(defaultModel(), COLOR_ONLY, 0);
      expect(predict(m.params, COLOR_ONLY)).toBeLessThan(
        predict(defaultModel().params, COLOR_ONLY),
      );
    });

    it('repeated rewards converge to the reward', () => {
      const f = feats({ color: 1, variety: 1, rating: 1 });
      let m = defaultModel();
      for (let i = 0; i < 20; i++) m = updateWeights(m, f, 0.9);
      expect(Math.abs(predict(m.params, f) - 0.9)).toBeLessThan(0.01);
    });

    it('grows certainty only for features that were present', () => {
      const m = updateWeights(defaultModel(), COLOR_ONLY, 1);
      const colorIdx = FEATURE_NAMES.indexOf('color');
      const varietyIdx = FEATURE_NAMES.indexOf('variety');
      expect(m.posterior.precision[colorIdx][colorIdx]).toBeGreaterThan(PRIOR_PRECISION);
      expect(m.posterior.precision[varietyIdx][varietyIdx]).toBe(PRIOR_PRECISION);
      expect(m.params.weights.variety).toBeCloseTo(FEATURE_WEIGHTS.variety, 10);
    });

    it('learns which feature a user cares about from mixed outfits', () => {
      // A user who rates by color alone: liked colors → 9, otherwise → 3.
      const r = rng(1);
      let m = defaultModel();
      for (let i = 0; i < 40; i++) {
        const f = feats({ color: r() < 0.5 ? 1 : 0.25, variety: r(), rating: r() });
        m = updateWeights(m, f, computeReward(f.color === 1 ? 9 : 3));
      }
      expect(m.params.weights.color).toBeGreaterThan(0.6);
      for (const name of ['variety', 'rating'] as const) {
        expect(Math.abs(m.params.weights[name])).toBeLessThan(0.15);
      }
    });
  });

  describe('fading old ratings', () => {
    const DAY0 = '2026-01-01';
    const after = (days: number) =>
      new Date(Date.parse(DAY0) + days * 86_400_000).toISOString().slice(0, 10);
    const colorIdx = FEATURE_NAMES.indexOf('color');
    const learnedPart = (m: BanditModel) =>
      m.posterior.precision[colorIdx][colorIdx] - PRIOR_PRECISION;

    it('halves what a rating contributed after one half-life', () => {
      const m = updateWeights(defaultModel(), COLOR_ONLY, 1, { today: DAY0 });
      const faded = fadeTo(m, after(HALF_LIFE_DAYS));
      expect(learnedPart(faded)).toBeCloseTo(learnedPart(m) / 2, 8);
      // …and the estimate drifts back toward the cold start.
      expect(faded.params.weights.color).toBeLessThan(m.params.weights.color);
      expect(faded.params.weights.color).toBeGreaterThan(FEATURE_WEIGHTS.color);
    });

    it('counts a rating for an older wear less', () => {
      const fresh = updateWeights(defaultModel(), COLOR_ONLY, 1, { today: DAY0 });
      const old = updateWeights(defaultModel(), COLOR_ONLY, 1, {
        on: DAY0,
        today: after(HALF_LIFE_DAYS),
      });
      expect(learnedPart(old)).toBeCloseTo(learnedPart(fresh) / 2, 8);
    });

    it('undoes a faded rating exactly', () => {
      const base = updateWeights(defaultModel(), feats({ variety: 1 }), 0.4, { today: DAY0 });
      const learned = updateWeights(base, COLOR_ONLY, 0.9, { on: DAY0, today: DAY0 });
      // 60 days later the rating is changed: undo what is left of it.
      const undone = forgetReward(learned, COLOR_ONLY, 0.9, { on: DAY0, today: after(60) });
      const expected = fadeTo(base, after(60));
      undone.posterior.precision.forEach((row, i) =>
        row.forEach((v, j) => expect(v).toBeCloseTo(expected.posterior.precision[i][j], 8)),
      );
      undone.posterior.target.forEach((v, i) =>
        expect(v).toBeCloseTo(expected.posterior.target[i], 8),
      );
    });

    it("doesn't fade a belief without a date, or into the past", () => {
      const m = updateWeights(defaultModel(), COLOR_ONLY, 1, { today: after(10) });
      expect(fadeTo(m, DAY0).posterior.precision).toEqual(m.posterior.precision);
      const undated = { ...m, posterior: { ...m.posterior, asOf: undefined } };
      expect(fadeTo(undated, after(500)).posterior.precision).toEqual(m.posterior.precision);
    });
  });

  describe('learning from skips', () => {
    it('lowers the skipped outfit a little, less than a low rating, and is not counted', () => {
      const f = feats({ color: 1, variety: 1, rating: 1 });
      const m = defaultModel();
      const skipped = learnFromSkip(m, f);
      const rated = updateWeights(m, f, computeReward(2));
      expect(predict(skipped.params, f)).toBeLessThan(predict(m.params, f));
      expect(predict(skipped.params, f)).toBeGreaterThan(predict(rated.params, f));
      expect(skipped.meta.updates).toBe(0);
      expect(rated.meta.updates).toBe(1);
    });

    it('counts as a fraction of a rating with the same reward', () => {
      const f = feats({ color: 1, variety: 0, rating: 0 });
      const m = defaultModel();
      const skip = learnFromSkip(m, f, {}, { reward: 0.1, weight: 1 });
      const full = updateWeights(m, f, 0.1);
      expect(skip.params.weights.color).toBeCloseTo(full.params.weights.color, 10);
      const quarter = learnFromSkip(m, f, {}, { reward: 0.1, weight: 0.25 });
      expect(quarter.params.weights.color).toBeGreaterThan(full.params.weights.color);
    });
  });

  describe('selectOutfits (Thompson sampling)', () => {
    const candidates = [
      { candidate: 'low', features: feats({ color: 0, variety: 0, rating: 0 }) },
      { candidate: 'mid', features: feats() },
      { candidate: 'high', features: feats({ color: 1, variety: 1, rating: 1 }) },
    ];

    it('returns up to `count` distinct candidates, tagged with the expected score', () => {
      const m = defaultModel();
      const out = selectOutfits(candidates, m, { count: 2, rng: rng(3) });
      expect(out).toHaveLength(2);
      expect(new Set(out.map((o) => o.candidate)).size).toBe(2);
      for (const o of out) expect(o.score).toBeCloseTo(predict(m.params, o.features), 10);
    });

    it('is deterministic given a seeded rng', () => {
      const a = selectOutfits(candidates, defaultModel(), { count: 3, rng: rng(7) });
      const b = selectOutfits(candidates, defaultModel(), { count: 3, rng: rng(7) });
      expect(a.map((o) => o.candidate)).toEqual(b.map((o) => o.candidate));
    });

    it('explores while unsure, then settles on the best once confident', () => {
      const draws = (m: BanditModel) => {
        const r = rng(11);
        return Array.from(
          { length: 200 },
          () => selectOutfits(candidates, m, { count: 1, rng: r })[0].candidate,
        );
      };
      // Fresh model: sampling sometimes ranks a weaker outfit first.
      const fresh = draws(defaultModel());
      expect(fresh.filter((c) => c !== 'high').length).toBeGreaterThan(5);

      // After many ratings that agree, it almost always picks the best.
      let m = defaultModel();
      const r = rng(5);
      for (let i = 0; i < 60; i++) {
        const c = candidates[Math.floor(r() * 3)];
        m = updateWeights(
          m,
          c.features,
          c.candidate === 'high' ? 0.9 : c.candidate === 'mid' ? 0.5 : 0.1,
        );
      }
      const confident = draws(m);
      expect(confident.filter((c) => c === 'high').length).toBeGreaterThan(195);
    });

    it('breaks ties at random, not by candidate order', () => {
      // Identical features score identically under any sampled weights.
      const tied = ['a', 'b', 'c', 'd'].map((c) => ({ candidate: c, features: feats() }));
      const r = rng(13);
      const picks = Array.from(
        { length: 200 },
        () => selectOutfits(tied, defaultModel(), { count: 1, rng: r })[0].candidate,
      );
      for (const c of ['a', 'b', 'c', 'd']) {
        expect(picks.filter((p) => p === c).length).toBeGreaterThan(25);
      }
    });
  });

  describe('serialization', () => {
    it('round-trips weights, posterior and meta', () => {
      let m = defaultModel();
      m = updateWeights(m, feats({ color: 1 }), 1);
      m = updateWeights(m, feats({ variety: 1 }), 0);
      const restored = deserializeModel(serializeModel(m));
      expect(restored.params.weights).toEqual(m.params.weights);
      expect(restored.params.bias).toBeCloseTo(m.params.bias, 10);
      expect(restored.posterior).toEqual(m.posterior);
      expect(restored.meta).toEqual(m.meta);
    });

    it('stores the posterior mean as plain weights, with the bias under __bias', () => {
      const s = serializeModel(defaultModel());
      expect(s.weights.__bias).toBe(0);
      for (const name of FEATURE_NAMES) expect(s.weights[name]).toBe(FEATURE_WEIGHTS[name]);
      expect(s.feature_meta.version).toBe(MODEL_VERSION);
      expect(s.feature_meta.posterior?.precision).toHaveLength(D);
    });

    it('falls back to cold start for empty rows', () => {
      expect(deserializeModel(null)).toEqual(defaultModel());
      expect(deserializeModel({})).toEqual(defaultModel());
    });

    it('converts a version-2 posterior by dropping weather and occasion', () => {
      // A v2 belief over [color, weather, variety, occasion, rating, bias] with
      // correlations, so marginalizing differs from just slicing the matrix.
      const precision = [
        [8, 1, 0.5, 0, 0.2, 1],
        [1, 6, 0.3, 0.4, 0, 0.5],
        [0.5, 0.3, 7, 0, 0.6, 0.8],
        [0, 0.4, 0, 5, 0.1, 0.3],
        [0.2, 0, 0.6, 0.1, 9, 0.7],
        [1, 0.5, 0.8, 0.3, 0.7, 10],
      ];
      const target = [3, 1, 2, 0.5, 1.5, 2];
      const m = deserializeModel({
        weights: { color: 0.4, variety: 0.2, rating: 0.1, __bias: 0.05 },
        feature_meta: { version: 2, updates: 12, posterior: { precision, target } },
      });
      expect(m.meta).toEqual({ version: MODEL_VERSION, updates: 12 });
      expect(m.posterior.precision).toHaveLength(D);

      // The kept weights' mean and covariance are unchanged by the conversion.
      const inv = (a: number[][]) => {
        // Gauss–Jordan, fine for a test.
        const n = a.length;
        const m2 = a.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
        for (let c = 0; c < n; c++) {
          const piv = m2[c][c];
          for (let j = 0; j < 2 * n; j++) m2[c][j] /= piv;
          for (let r = 0; r < n; r++) {
            if (r === c) continue;
            const f = m2[r][c];
            for (let j = 0; j < 2 * n; j++) m2[r][j] -= f * m2[c][j];
          }
        }
        return m2.map((row) => row.slice(n));
      };
      const fullCov = inv(precision);
      const fullMean = fullCov.map((row) => row.reduce((s, v, i) => s + v * target[i], 0));
      const keep = [0, 2, 4, 5]; // color, variety, rating, bias
      const newCov = inv(m.posterior.precision);
      const newMean = newCov.map((row) =>
        row.reduce((s, v, i) => s + v * m.posterior.target[i], 0),
      );
      keep.forEach((k, i) => {
        expect(newMean[i]).toBeCloseTo(fullMean[k], 8);
        keep.forEach((l, j) => expect(newCov[i][j]).toBeCloseTo(fullCov[k][l], 8));
      });
    });

    it('carries a version-1 row’s learned weights into the prior', () => {
      const legacy = {
        weights: { color: 0.8, __bias: 0.1 },
        feature_meta: { version: 1, updates: 30 },
      };
      const m = deserializeModel(legacy);
      expect(m.params.weights.color).toBe(0.8);
      expect(m.params.weights.variety).toBe(FEATURE_WEIGHTS.variety);
      expect(m.params.bias).toBe(0.1);
      expect(m.meta).toEqual({ version: MODEL_VERSION, updates: 30 });
      // Prior centred on the learned weights: its mean reproduces them.
      expect(m.posterior.target[FEATURE_NAMES.indexOf('color')]).toBeCloseTo(
        PRIOR_PRECISION * 0.8,
        10,
      );
      // And it keeps learning from there.
      const next = updateWeights(m, COLOR_ONLY, 1);
      expect(next.params.weights.color).toBeGreaterThan(0.8);
    });
  });
});
