// Learning strategies for the bandit benchmark, behind one interface.
//
// "production" runs the app's real code (defaultModel, selectOutfits,
// updateWeights). "legacyGradient" is the learner the app used before, kept for
// comparison. The thompson/linUcb implementations here take tunable priors, for
// the sweeps that chose production's settings.

import {
  defaultModel,
  learnFromSkip,
  selectOutfits,
  updateWeights,
  type FeatureVector,
} from '@/lib/banditModel';
import { FEATURE_NAMES, FEATURE_WEIGHTS, type FeatureName } from '@/lib/outfitScoring';
import { gaussian, type Rng } from './world';

export interface Learner {
  /** Index of the outfit to show, among today's candidates. `today` is the
   * simulated date (YYYY-MM-DD). */
  choose(candidates: { features: FeatureVector }[], rng: Rng, today: string): number;
  /** Learn from the shown outfit's features and the reward from its rating. */
  learn(features: FeatureVector, reward: number, today: string): void;
  /** The user skipped this outfit ("Try another"); optional. */
  skip?(features: FeatureVector, today: string): void;
}

export interface LearnerSpec {
  name: string;
  make: () => Learner;
  /** Choose among candidates scored with sampled item ratings (the app's
   * picking), still learning from the expected ones. */
  exploreItems?: boolean;
  /** Spread of the item-rating draws (default: the app's). */
  itemSpread?: number;
}

export type Weights = Record<FeatureName, number>;

export interface LearnerOptions {
  /** Cold-start weights (default: the app's FEATURE_WEIGHTS). */
  start?: Weights;
  /** Features hidden from the learner (always read as 0), for ablation. */
  ignore?: FeatureName[];
}

const DEFAULT_START: Weights = { ...FEATURE_WEIGHTS };
/** The app's own cold-start weights, before any sweep changes them. */
const APP_START: Weights = { ...FEATURE_WEIGHTS };

function setColdStart(w: Weights) {
  Object.assign(FEATURE_WEIGHTS as Weights, w);
}

function mask(f: FeatureVector, ignore: FeatureName[] = []): FeatureVector {
  if (ignore.length === 0) return f;
  const out = { ...f };
  for (const n of ignore) out[n] = 0;
  return out;
}

// ---------------------------------------------------------------------------
// Production: the app's current learner (banditModel.ts), unchanged
// ---------------------------------------------------------------------------

/** The app's real model and policy: Thompson sampling, show its top pick.
 * `coldStart` swaps the app's FEATURE_WEIGHTS for the run (the model's prior
 * and the belief it fades back to both read them); `runBenchmark` runs one
 * learner's days at a time, so each learner sees its own. */
export function production(
  opts: {
    ignore?: FeatureName[];
    halfLifeDays?: number;
    coldStart?: Weights;
    /** Learn from skips (default: the app's SKIP_REWARD / SKIP_WEIGHT); false
     * ignores them. */
    skips?: false | { reward?: number; weight?: number };
  } = {},
): Learner {
  if (opts.coldStart) setColdStart(opts.coldStart);
  else setColdStart(APP_START);
  let model = defaultModel();
  return {
    choose(cands, rng, today) {
      const indexed = cands.map((c, i) => ({
        candidate: i,
        features: mask(c.features, opts.ignore),
      }));
      return selectOutfits(indexed, model, {
        count: 1,
        rng,
        today,
        halfLifeDays: opts.halfLifeDays,
      })[0].candidate;
    },
    learn(features, reward, today) {
      model = updateWeights(model, mask(features, opts.ignore), reward, {
        on: today,
        today,
        halfLifeDays: opts.halfLifeDays,
      });
    },
    skip(features, today) {
      if (opts.skips === false) return;
      model = learnFromSkip(
        model,
        mask(features, opts.ignore),
        { on: today, today, halfLifeDays: opts.halfLifeDays },
        opts.skips,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Legacy: the gradient-step, ε-greedy learner the app used before
// (MODEL_VERSION 1), kept here for comparison
// ---------------------------------------------------------------------------

function predictWith(w: Weights, bias: number, f: FeatureVector): number {
  let s = bias;
  for (const n of FEATURE_NAMES) s += w[n] * f[n];
  return Math.min(1, Math.max(0, s));
}

export function legacyGradient(
  opts: LearnerOptions & {
    learningRate?: number;
    epsilon?: number;
    /** Show a random one of the top N (the app used 5); 1 = always the best. */
    showAmongTop?: number;
    /** Divide ε by √(ratings + 1), exploring less as the model learns. */
    decayEpsilon?: boolean;
    /** No learning: the cold-start scorer forever. */
    frozen?: boolean;
  } = {},
): Learner {
  const w: Weights = { ...(opts.start ?? DEFAULT_START) };
  let bias = 0;
  let n = 0;
  const lr = opts.learningRate ?? 0.1;
  const eps = opts.epsilon ?? 0.15;
  const topN = opts.showAmongTop ?? 5;
  return {
    choose(cands, rng) {
      const epsilon = opts.decayEpsilon ? eps / Math.sqrt(n + 1) : eps;
      const order = cands.map((c, i) => ({
        i,
        s: predictWith(w, bias, mask(c.features, opts.ignore)),
        r: rng(),
      }));
      if (rng() < epsilon) order.sort((a, b) => a.r - b.r);
      else order.sort((a, b) => b.s - a.s || a.r - b.r);
      const top = order.slice(0, topN);
      return top[Math.floor(rng() * top.length)].i;
    },
    learn(features, reward) {
      n++;
      if (opts.frozen) return;
      const f = mask(features, opts.ignore);
      const error = reward - predictWith(w, bias, f);
      for (const name of FEATURE_NAMES) w[name] += lr * error * f[name];
      bias += lr * error;
    },
  };
}

// ---------------------------------------------------------------------------
// Bayesian linear regression (Thompson sampling and LinUCB)
// ---------------------------------------------------------------------------

const D = FEATURE_NAMES.length + 1; // features + bias

function toX(f: FeatureVector, ignore?: FeatureName[]): number[] {
  const m = mask(f, ignore);
  return [...FEATURE_NAMES.map((n) => m[n]), 1];
}

/** Cholesky factor L (lower) of a symmetric positive-definite matrix. */
function cholesky(a: number[][]): number[][] {
  const L = a.map(() => new Array(D).fill(0));
  for (let i = 0; i < D; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
  }
  return L;
}

/** Solve L y = b (forward) then Lᵀ x = y (backward): x = A⁻¹ b. */
function solve(L: number[][], b: number[]): number[] {
  const y = new Array(D).fill(0);
  for (let i = 0; i < D; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
    y[i] = s / L[i][i];
  }
  return backSolve(L, y);
}

/** Solve Lᵀ x = y. */
function backSolve(L: number[][], y: number[]): number[] {
  const x = new Array(D).fill(0);
  for (let i = D - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < D; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

/**
 * Per-user Bayesian linear regression with a Gaussian prior centred on the
 * cold-start weights. Keeps the posterior precision A and vector b:
 *   A = λI + Σ xxᵀ/σ²,  b = λμ₀ + Σ x·r/σ²,  posterior mean = A⁻¹b.
 */
function posterior(opts: LearnerOptions & { priorPrecision?: number; noise?: number }) {
  const lambda = opts.priorPrecision ?? 10;
  const s2 = (opts.noise ?? 0.15) ** 2;
  const start = opts.start ?? DEFAULT_START;
  const mu0 = [...FEATURE_NAMES.map((n) => start[n]), 0];
  const A = Array.from({ length: D }, (_, i) =>
    Array.from({ length: D }, (_, j) => (i === j ? lambda : 0)),
  );
  const b = mu0.map((m) => lambda * m);
  return {
    add(x: number[], r: number) {
      for (let i = 0; i < D; i++) {
        b[i] += (x[i] * r) / s2;
        for (let j = 0; j < D; j++) A[i][j] += (x[i] * x[j]) / s2;
      }
    },
    factor: () => cholesky(A),
    b,
  };
}

/** Thompson sampling: sample weights from the posterior, show the best outfit
 * under that sample. Explores exactly as much as it is still unsure. */
export function thompson(
  opts: LearnerOptions & { priorPrecision?: number; noise?: number } = {},
): Learner {
  const post = posterior(opts);
  return {
    choose(cands, rng) {
      const L = post.factor();
      const mean = solve(L, post.b);
      // w = mean + L⁻ᵀz  has covariance A⁻¹.
      const w = backSolve(
        L,
        mean.map(() => gaussian(rng)),
      ).map((v, i) => v + mean[i]);
      let best = 0;
      let bestScore = -Infinity;
      cands.forEach((c, i) => {
        const s = dot(w, toX(c.features, opts.ignore)) + rng() * 1e-9;
        if (s > bestScore) [best, bestScore] = [i, s];
      });
      return best;
    },
    learn(features, reward) {
      post.add(toX(features, opts.ignore), reward);
    },
  };
}

/** LinUCB: show the outfit with the highest optimistic estimate,
 * mean + α·(posterior standard deviation). */
export function linUcb(
  opts: LearnerOptions & { priorPrecision?: number; noise?: number; alpha?: number } = {},
): Learner {
  const post = posterior(opts);
  const alpha = opts.alpha ?? 1;
  return {
    choose(cands, rng) {
      const L = post.factor();
      const mean = solve(L, post.b);
      let best = 0;
      let bestScore = -Infinity;
      cands.forEach((c, i) => {
        const x = toX(c.features, opts.ignore);
        const sd = Math.sqrt(Math.max(0, dot(x, solve(L, x))));
        const s = dot(mean, x) + alpha * sd + rng() * 1e-9;
        if (s > bestScore) [best, bestScore] = [i, s];
      });
      return best;
    },
    learn(features, reward) {
      post.add(toX(features, opts.ignore), reward);
    },
  };
}

/** Picks at random: the benchmark's floor (normalized regret ≈ 1). */
export function randomPick(): Learner {
  return {
    choose: (cands, rng) => Math.floor(rng() * cands.length),
    learn: () => {},
  };
}
