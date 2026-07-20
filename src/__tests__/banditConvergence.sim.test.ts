/**
 * Bandit convergence simulation (measurement tool — NOT app code, NOT a real test).
 *
 * Purpose: produce a defensible, reproducible "converges within ~N ratings" figure
 * for the contextual bandit in `src/lib/banditModel.ts`. It imports the ACTUAL
 * production functions (`defaultModel`, `updateWeights`, `predict`, `selectOutfits`)
 * so the number reflects real learning behavior, not a re-implementation.
 *
 * Run:  npx vitest run scripts/banditConvergence.sim.ts
 *
 * Methodology
 * -----------
 * - A synthetic "user" has a fixed hidden preference vector over the 5 features
 *   (color, weather, variety, occasion, rating). Their reward for an outfit is the
 *   dot product of that preference with the outfit's feature vector (+ small noise),
 *   squashed to [0,1]. This is the ground-truth reward the bandit is trying to learn.
 * - Each "round" the bandit uses ε-greedy `selectOutfits` to pick one outfit from a
 *   fresh pool of random candidates, observes the user's noisy reward, and applies
 *   one online `updateWeights` step (lr = 0.05, the production default).
 * - "Converged" = on a fixed held-out evaluation set, the model's RANKING of outfits
 *   agrees with the ground-truth ranking (top-5 overlap >= 4 of 5) AND the mean
 *   predicted-vs-true reward error stays below tolerance, sustained for a window of
 *   rounds. We use ranking agreement rather than exact top-1 because the app's job is
 *   to surface good outfits (a ranked list), not to identify one single best outfit;
 *   near-tied candidates make exact top-1 needlessly brittle.
 * - We report the median convergence round across many independent simulated users
 *   (different random preferences + candidate pools) so the figure isn't a fluke.
 */

import { describe, it } from 'vitest';
import {
  defaultModel,
  updateWeights,
  predict,
  selectOutfits,
  DEFAULT_LEARNING_RATE,
  DEFAULT_EPSILON,
  type BanditModel,
  type FeatureVector,
} from '@/lib/banditModel';
import { FEATURE_NAMES, type FeatureName } from '@/lib/outfitScoring';

// ---- deterministic RNG (mulberry32) so results are reproducible ----
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function randomFeatureVector(rng: () => number): FeatureVector {
  const fv = {} as FeatureVector;
  for (const name of FEATURE_NAMES) fv[name] = rng(); // each feature in [0,1]
  return fv;
}

/** A hidden user preference: non-negative weights over features, summing to 1. */
function randomPreference(rng: () => number): Record<FeatureName, number> {
  const raw = FEATURE_NAMES.map(() => rng());
  const total = raw.reduce((s, v) => s + v, 0) || 1;
  const pref = {} as Record<FeatureName, number>;
  FEATURE_NAMES.forEach((name, i) => (pref[name] = raw[i] / total));
  return pref;
}

/** Ground-truth reward the synthetic user gives an outfit (noisy). */
function trueReward(
  pref: Record<FeatureName, number>,
  fv: FeatureVector,
  noise: number,
  rng: () => number,
): number {
  let dot = 0;
  for (const name of FEATURE_NAMES) dot += pref[name] * fv[name];
  const jitter = (rng() - 0.5) * 2 * noise; // ±noise
  return clamp01(dot + jitter);
}

function trueRewardClean(pref: Record<FeatureName, number>, fv: FeatureVector): number {
  let dot = 0;
  for (const name of FEATURE_NAMES) dot += pref[name] * fv[name];
  return clamp01(dot);
}

interface SimConfig {
  poolSize: number; // candidates presented each round
  evalSize: number; // fixed held-out set for convergence check
  noise: number; // reward noise amplitude
  maxRounds: number; // ratings budget
  tolerance: number; // mean abs error threshold on eval set
  topK: number; // ranking overlap window
  minOverlap: number; // required overlap of top-K (out of topK)
  stableWindow: number; // consecutive rounds meeting both criteria
  learningRate: number;
  epsilon: number;
}

/** Count how many of the model's top-K held-out picks are in the true top-K. */
function topKOverlap(
  modelScores: { i: number; s: number }[],
  trueTopSet: Set<number>,
  k: number,
): number {
  const top = [...modelScores].sort((a, b) => b.s - a.s).slice(0, k);
  let hit = 0;
  for (const { i } of top) if (trueTopSet.has(i)) hit++;
  return hit;
}

/** Simulate one user; return the round index at which the model converged (or null). */
function simulateUser(seed: number, cfg: SimConfig): number | null {
  const rng = mulberry32(seed);
  const pref = randomPreference(rng);

  // Fixed held-out evaluation set + its ground-truth top-K set.
  const evalSet = Array.from({ length: cfg.evalSize }, () => randomFeatureVector(rng));
  const trueTopSet = new Set(
    evalSet
      .map((fv, i) => ({ i, r: trueRewardClean(pref, fv) }))
      .sort((a, b) => b.r - a.r)
      .slice(0, cfg.topK)
      .map((x) => x.i),
  );

  let model: BanditModel = defaultModel();
  let stable = 0;

  for (let round = 1; round <= cfg.maxRounds; round++) {
    // Present a fresh pool; bandit selects one via ε-greedy (production selector).
    const pool = Array.from({ length: cfg.poolSize }, () => ({
      candidate: null,
      features: randomFeatureVector(rng),
    }));
    const [chosen] = selectOutfits(pool, model.params, {
      epsilon: cfg.epsilon,
      count: 1,
      rng,
    });
    const reward = trueReward(pref, chosen.features, cfg.noise, rng);
    model = updateWeights(model, chosen.features, reward, cfg.learningRate);

    // Convergence check on the held-out set.
    let absErr = 0;
    const modelScores = evalSet.map((fv, i) => {
      const p = predict(model.params, fv);
      absErr += Math.abs(p - trueRewardClean(pref, fv));
      return { i, s: p };
    });
    const meanErr = absErr / cfg.evalSize;
    const overlap = topKOverlap(modelScores, trueTopSet, cfg.topK);

    if (meanErr <= cfg.tolerance && overlap >= cfg.minOverlap) {
      stable++;
      if (stable >= cfg.stableWindow) return round - cfg.stableWindow + 1;
    } else {
      stable = 0;
    }
  }
  return null;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(nums: number[], p: number): number {
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

describe('bandit convergence measurement', () => {
  it('reports how many ratings until per-user weights converge', () => {
    const cfg: SimConfig = {
      poolSize: 12,
      evalSize: 30,
      noise: 0.05,
      maxRounds: 400,
      tolerance: 0.08,
      topK: 5,
      minOverlap: 4, // >= 4 of the true top-5 present in the model's top-5
      stableWindow: 10,
      learningRate: DEFAULT_LEARNING_RATE, // 0.05 (production)
      epsilon: DEFAULT_EPSILON, // 0.15 (production)
    };

    const NUM_USERS = 500;
    const results: number[] = [];
    let nonConverged = 0;

    for (let u = 0; u < NUM_USERS; u++) {
      const r = simulateUser(1000 + u, cfg);
      if (r === null) nonConverged++;
      else results.push(r);
    }

    const out = [
      '',
      '================ BANDIT CONVERGENCE SIMULATION ================',
      `Model: online linear contextual bandit (src/lib/banditModel.ts)`,
      `Params: lr=${cfg.learningRate}, epsilon=${cfg.epsilon}, ${FEATURE_NAMES.length} features`,
      `Users simulated: ${NUM_USERS}  |  converged: ${results.length}  |  did not converge within ${cfg.maxRounds}: ${nonConverged}`,
      `Convergence criterion: mean |pred-true| <= ${cfg.tolerance} AND >=${cfg.minOverlap}/${cfg.topK} top-${cfg.topK} ranking overlap`,
      `                       held for ${cfg.stableWindow} consecutive ratings on a ${cfg.evalSize}-outfit held-out set`,
      `Reward noise: +/-${cfg.noise}`,
      '--------------------------------------------------------------',
      `  Ratings to converge  ->  median: ${median(results)}`,
      `                           p25:    ${percentile(results, 25)}`,
      `                           p75:    ${percentile(results, 75)}`,
      `                           p90:    ${percentile(results, 90)}`,
      `                           min:    ${Math.min(...results)}   max: ${Math.max(...results)}`,
      '--------------------------------------------------------------',
      `  Cumulative % of users converged by N ratings:`,
      ...[10, 20, 30, 50, 75, 100].map((n) => {
        const frac = results.filter((r) => r <= n).length / NUM_USERS;
        return `     <= ${String(n).padStart(3)} ratings:  ${(frac * 100).toFixed(0)}%`;
      }),
      '==============================================================',
      '',
    ].join('\n');

    // eslint-disable-next-line no-console
    console.log(out);
  });
});
