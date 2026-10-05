/**
 * Bandit convergence simulation — a measurement of the online learning rule,
 * with guard-rail assertions so it fails if learning regresses.
 *
 * Purpose: a reproducible, defensible description of how the contextual bandit
 * in `src/lib/banditModel.ts` learns a user's taste. It imports the ACTUAL
 * production functions (`defaultModel`, `updateWeights`, `predict`,
 * `selectOutfits`) so the numbers reflect real learning behaviour, not a
 * re-implementation.
 *
 * Run:  npx vitest run src/__tests__/banditConvergence.sim.test.ts
 *
 * Methodology (Monte Carlo over synthetic users)
 * ----------------------------------------------
 * - Each synthetic user has a hidden preference over the 5 features (color,
 *   weather, variety, occasion, rating): 5 uniform draws normalised to sum to 1.
 *   Their reward for an outfit is preference · features (+ uniform noise ±0.05),
 *   clamped to [0,1]. Features are i.i.d. uniform in [0,1] — idealised, not
 *   built from real closet items — and the reward is exactly linear, so the
 *   model class can represent every user (a best case for the learner).
 * - Every user starts from the production cold-start weights. Each round the
 *   bandit picks one of 12 fresh random candidates with ε-greedy `selectOutfits`
 *   (ε = 0.15), observes the noisy reward and applies one `updateWeights` step
 *   (lr = 0.1, the production default). Each round is one rating; every user
 *   gives 400 ratings.
 * - "Converged" = on a fixed 30-outfit held-out set, mean |predicted − true|
 *   reward <= 0.08 AND >= 4 of the model's top 5 are in the true top 5, held for
 *   10 consecutive ratings. Ranking agreement is used because the app surfaces a
 *   ranked list, not one single best outfit.
 * - Many users already satisfy that criterion with the cold-start weights alone
 *   (their taste is close to the defaults). They are reported separately, so the
 *   headline figure is "ratings to converge for users who actually had to learn".
 * - A learning curve (error, top-5 agreement, and distance between learned and
 *   hidden weights at fixed rating counts) shows the convergence directly.
 * - The primary batch is 500 users (seeds 1000–1499); two further independent
 *   batches check that the figures are stable rather than a seed artefact, and
 *   a fourth batch with 4× the reward noise (±0.2) checks that the learning
 *   rate doesn't chase noise.
 */

import { describe, it, expect } from 'vitest';
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

const CHECKPOINTS = [0, 25, 50, 100, 200, 400] as const;

interface Snapshot {
  meanErr: number; // mean |predicted − true| reward on the held-out set
  overlap: number; // model top-K ∩ true top-K
  weightGap: number; // mean |learned weight − hidden preference| per feature
}

interface UserResult {
  /** Meets the convergence criterion with the cold-start weights, before any rating. */
  satisfiedAtStart: boolean;
  /** First rating of the stable window that met the criterion, or null. */
  convergedAt: number | null;
  checkpoints: Map<number, Snapshot>;
}

/** Simulate one user for the full rating budget, recording convergence and a learning curve. */
function simulateUser(seed: number, cfg: SimConfig): UserResult {
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

  const snapshot = (model: BanditModel): Snapshot => {
    let absErr = 0;
    const scores = evalSet.map((fv, i) => {
      const p = predict(model.params, fv);
      absErr += Math.abs(p - trueRewardClean(pref, fv));
      return { i, s: p };
    });
    let gap = 0;
    for (const name of FEATURE_NAMES) gap += Math.abs(model.params.weights[name] - pref[name]);
    return {
      meanErr: absErr / cfg.evalSize,
      overlap: topKOverlap(scores, trueTopSet, cfg.topK),
      weightGap: gap / FEATURE_NAMES.length,
    };
  };
  const meets = (s: Snapshot) => s.meanErr <= cfg.tolerance && s.overlap >= cfg.minOverlap;

  let model: BanditModel = defaultModel();
  const start = snapshot(model);
  const checkpoints = new Map<number, Snapshot>([[0, start]]);
  let stable = 0;
  let convergedAt: number | null = null;

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

    const snap = snapshot(model);
    if ((CHECKPOINTS as readonly number[]).includes(round)) checkpoints.set(round, snap);
    if (convergedAt === null) {
      if (meets(snap)) {
        stable++;
        if (stable >= cfg.stableWindow) convergedAt = round - cfg.stableWindow + 1;
      } else {
        stable = 0;
      }
    }
  }
  return { satisfiedAtStart: meets(start), convergedAt, checkpoints };
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

const pctOf = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;

interface BatchSummary {
  users: number;
  satisfiedAtStart: number;
  learners: number;
  learnersConverged: number;
  learnerRounds: number[];
  allConverged: number;
  curve: Map<number, { err: number; top5: number; gap: number }>;
}

function runBatch(seedBase: number, users: number, cfg: SimConfig): BatchSummary {
  const results = Array.from({ length: users }, (_, u) => simulateUser(seedBase + u, cfg));
  const learners = results.filter((r) => !r.satisfiedAtStart);
  const learnerRounds = learners.filter((r) => r.convergedAt !== null).map((r) => r.convergedAt!);
  const curve = new Map<number, { err: number; top5: number; gap: number }>();
  for (const c of CHECKPOINTS) {
    const snaps = results.map((r) => r.checkpoints.get(c)!);
    curve.set(c, {
      err: median(snaps.map((s) => s.meanErr)),
      top5: snaps.filter((s) => s.overlap >= cfg.minOverlap).length / users,
      gap: median(snaps.map((s) => s.weightGap)),
    });
  }
  return {
    users,
    satisfiedAtStart: results.length - learners.length,
    learners: learners.length,
    learnersConverged: learnerRounds.length,
    learnerRounds,
    allConverged: results.filter((r) => r.convergedAt !== null).length,
    curve,
  };
}

describe('bandit convergence simulation', () => {
  const cfg: SimConfig = {
    poolSize: 12,
    evalSize: 30,
    noise: 0.05,
    maxRounds: 400,
    tolerance: 0.08,
    topK: 5,
    minOverlap: 4, // >= 4 of the true top-5 present in the model's top-5
    stableWindow: 10,
    learningRate: DEFAULT_LEARNING_RATE, // 0.1 (production)
    epsilon: DEFAULT_EPSILON, // 0.15 (production)
  };
  const NUM_USERS = 500;

  it("learns simulated users' rankings, reported per cohort with a learning curve", () => {
    const main = runBatch(1000, NUM_USERS, cfg);
    const others = [50_000, 90_000].map((seed) => runBatch(seed, NUM_USERS, cfg));
    // Robustness: real ratings are noisier than ±0.05, so rerun with 4× the noise.
    const noisy = runBatch(1000, NUM_USERS, { ...cfg, noise: 0.2 });
    const lr = main.learnerRounds;

    const out = [
      '',
      '================ BANDIT CONVERGENCE SIMULATION ================',
      `Model: online linear contextual bandit (src/lib/banditModel.ts)`,
      `Params: lr=${cfg.learningRate}, epsilon=${cfg.epsilon}, ${FEATURE_NAMES.length} features, ${cfg.maxRounds} ratings per user`,
      `Converged: mean |pred-true| <= ${cfg.tolerance} AND >= ${cfg.minOverlap}/${cfg.topK} top-${cfg.topK} overlap,`,
      `           held for ${cfg.stableWindow} consecutive ratings on a ${cfg.evalSize}-outfit held-out set`,
      `Reward noise: +/-${cfg.noise}   Users: ${NUM_USERS} synthetic (seeds 1000-${1000 + NUM_USERS - 1})`,
      '--------------------------------------------------------------',
      `Already matched at cold start (no learning needed): ${main.satisfiedAtStart} (${pctOf(main.satisfiedAtStart, NUM_USERS)})`,
      `Had to learn: ${main.learners}  ->  converged within ${cfg.maxRounds}: ${main.learnersConverged} (${pctOf(main.learnersConverged, main.learners)})`,
      `  Ratings to converge (users who had to learn):`,
      `     median ${median(lr)}   p25 ${percentile(lr, 25)}   p75 ${percentile(lr, 75)}   p90 ${percentile(lr, 90)}   max ${Math.max(...lr)}`,
      `All users converged within ${cfg.maxRounds}: ${main.allConverged} / ${NUM_USERS} (${pctOf(main.allConverged, NUM_USERS)})`,
      '--------------------------------------------------------------',
      `Learning curve (all ${NUM_USERS} users)`,
      `  ratings   median error   top-5 agreement (>=${cfg.minOverlap}/5)   median weight gap`,
      ...CHECKPOINTS.map((c) => {
        const p = main.curve.get(c)!;
        return `  ${String(c).padStart(7)}   ${p.err.toFixed(3).padStart(12)}   ${(p.top5 * 100).toFixed(1).padStart(23)}%   ${p.gap.toFixed(3).padStart(17)}`;
      }),
      '--------------------------------------------------------------',
      `Stability across independent batches (seeds 1000 / 50000 / 90000):`,
      `  learners' median ratings: ${[main, ...others].map((b) => median(b.learnerRounds)).join(' / ')}`,
      `  all users converged:      ${[main, ...others].map((b) => pctOf(b.allConverged, b.users)).join(' / ')}`,
      `  top-5 agreement at ${cfg.maxRounds}:  ${[main, ...others].map((b) => `${(b.curve.get(cfg.maxRounds)!.top5 * 100).toFixed(1)}%`).join(' / ')}`,
      `Noisier ratings (+/-0.2, seeds 1000-${1000 + NUM_USERS - 1}):`,
      `  learners' median ratings ${median(noisy.learnerRounds)}  |  all users converged ${pctOf(noisy.allConverged, noisy.users)}  |  top-5 agreement at ${cfg.maxRounds}: ${(noisy.curve.get(cfg.maxRounds)!.top5 * 100).toFixed(1)}%`,
      '==============================================================',
      '',
    ].join('\n');
    console.log(out);

    // Guard rails: fail if the learning rule regresses.
    for (const b of [main, ...others]) {
      const start = b.curve.get(0)!;
      const end = b.curve.get(cfg.maxRounds)!;
      expect(b.allConverged / b.users).toBeGreaterThanOrEqual(0.9);
      expect(b.learnersConverged / b.learners).toBeGreaterThanOrEqual(0.85);
      expect(end.err).toBeLessThan(start.err * 0.5);
      expect(end.gap).toBeLessThan(start.gap * 0.5);
      expect(end.top5).toBeGreaterThanOrEqual(0.9);
    }
    // The learning rate must stay stable when ratings are noisy.
    expect(noisy.allConverged / noisy.users).toBeGreaterThanOrEqual(0.9);
    expect(noisy.curve.get(cfg.maxRounds)!.top5).toBeGreaterThanOrEqual(0.9);
  });
});
