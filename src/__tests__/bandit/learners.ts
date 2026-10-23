// Learning strategies for the bandit benchmark, behind one interface.
//
// "production" uses the app's real code (defaultModel, selectOutfits,
// updateWeights) and its real policy: show a random one of selectOutfits' top 5.
// The Bayesian learners (Thompson sampling, LinUCB) are candidates for
// replacing it; they live here until the benchmark says they are worth it.

import {
  defaultModel,
  selectOutfits,
  updateWeights,
  type BanditModel,
  type FeatureVector,
} from '@/lib/banditModel';
import { FEATURE_NAMES, FEATURE_WEIGHTS, type FeatureName } from '@/lib/outfitScoring';
import { gaussian, type Rng } from './world';

export interface Learner {
  /** Index of the outfit to show, among today's candidates. */
  choose(candidates: { features: FeatureVector }[], rng: Rng): number;
  /** Learn from the shown outfit's features and the reward from its rating. */
  learn(features: FeatureVector, reward: number): void;
}

export interface LearnerSpec {
  name: string;
  make: () => Learner;
}

export type Weights = Record<FeatureName, number>;

export interface LearnerOptions {
  /** Cold-start weights (default: the app's FEATURE_WEIGHTS). */
  start?: Weights;
  /** Features hidden from the learner (always read as 0), for ablation. */
  ignore?: FeatureName[];
}

const DEFAULT_START: Weights = { ...FEATURE_WEIGHTS };

function mask(f: FeatureVector, ignore: FeatureName[] = []): FeatureVector {
  if (ignore.length === 0) return f;
  const out = { ...f };
  for (const n of ignore) out[n] = 0;
  return out;
}

function modelFrom(start: Weights): BanditModel {
  const m = defaultModel();
  return { ...m, params: { ...m.params, weights: { ...start } } };
}

// ---------------------------------------------------------------------------
// Gradient-step learners (the app's model)
// ---------------------------------------------------------------------------

export function production(
  opts: LearnerOptions & {
    learningRate?: number;
    epsilon?: number;
    /** Show a random one of the top N (the app uses 5); 1 = always the best. */
    showAmongTop?: number;
    /** Divide ε by √(ratings + 1), exploring less as the model learns. */
    decayEpsilon?: boolean;
    /** No learning: the cold-start scorer forever. */
    frozen?: boolean;
  } = {},
): Learner {
  let model = modelFrom(opts.start ?? DEFAULT_START);
  let n = 0;
  const lr = opts.learningRate ?? 0.1;
  const eps = opts.epsilon ?? 0.15;
  const topN = opts.showAmongTop ?? 5;
  return {
    choose(cands, rng) {
      const epsilon = opts.decayEpsilon ? eps / Math.sqrt(n + 1) : eps;
      const indexed = cands.map((c, i) => ({
        candidate: i,
        features: mask(c.features, opts.ignore),
      }));
      const top = selectOutfits(indexed, model.params, { epsilon, count: topN, rng });
      return top[Math.floor(rng() * top.length)].candidate;
    },
    learn(features, reward) {
      n++;
      if (!opts.frozen) model = updateWeights(model, mask(features, opts.ignore), reward, lr);
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
