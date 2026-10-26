// Contextual bandit: per-user Bayesian linear model over the five outfit
// features, choosing outfits by Thompson sampling.
//
// Each user's model is a Gaussian belief about their weights (one per feature
// in `FEATURE_NAMES`, plus a bias). It starts centred on the fixed
// `FEATURE_WEIGHTS` from `outfitScoring.ts`, so before any rating the expected
// score equals the deterministic scorer's. Every rating narrows the belief
// (Bayesian linear regression), and every outfit choice samples weights from
// it (Thompson sampling): the model explores only as much as it is still
// unsure, feature by feature. docs/BANDIT_BENCHMARK.md compares this with the
// earlier gradient-step, ε-greedy learner.
//
// Pure logic only: no Supabase, no React. Persistence and UI wiring live with
// the callers.

import { FEATURE_NAMES, FEATURE_WEIGHTS } from '@/lib/outfitScoring';
import type { FeatureName } from '@/lib/outfitScoring';

// ============================================================================
// TYPES
// ============================================================================

export type FeatureVector = Record<FeatureName, number>;

export interface BanditWeights {
  /** One weight per feature, in `FEATURE_NAMES`. */
  weights: Record<FeatureName, number>;
  /** Intercept term, learned alongside the feature weights. */
  bias: number;
}

export interface ModelMeta {
  /** Schema version, so stored models can be migrated. */
  version: number;
  /** Number of ratings (and saves) learned from. */
  updates: number;
}

/**
 * The belief about a user's weights, in information form over
 * [...FEATURE_NAMES, bias]: precision matrix A and vector b, with
 * mean A⁻¹b and covariance A⁻¹.
 */
export interface Posterior {
  precision: number[][];
  target: number[];
  /** Date (YYYY-MM-DD) the belief is current as of; older ratings have
   * faded by then. Missing on models saved before fading existed. */
  asOf?: string;
}

export interface BanditModel {
  /** Posterior mean: the model's best estimate of the weights. */
  params: BanditWeights;
  posterior: Posterior;
  meta: ModelMeta;
}

/**
 * 3: features are color, variety and rating (weather and occasion became
 *    filters only). 2: Bayesian posterior over five features.
 * 1: gradient-step weights only.
 */
export const MODEL_VERSION = 3;

/** Feature order of version-2 posteriors, for converting them. */
const V2_FEATURES = ['color', 'weather', 'variety', 'occasion', 'rating'] as const;

/**
 * How firmly the prior holds the cold-start (or previously learned) weights:
 * weights start with standard deviation 1/√3 ≈ 0.58. Tuned with the bandit
 * benchmark, which found 3 the best balance of first-week and long-run picks.
 */
export const PRIOR_PRECISION = 3;

/** Assumed rating noise, in reward units (one rating point ≈ 0.11). */
export const RATING_NOISE = 0.1;

/**
 * Old ratings fade: a rating's weight halves every HALF_LIFE_DAYS after the
 * day the outfit was worn (or rated, for outfits rated without wearing), and
 * the belief drifts back toward the cold start. Lets the model follow a
 * changing taste. In the bandit benchmark (180 days), fading never hurt stable
 * users and helped drifting and inconsistent ones; 30 days scored best there,
 * but the simulation rates daily, so 60 keeps more memory for real users who
 * rate less often.
 */
export const HALF_LIFE_DAYS = 60;

const DAY_MS = 86_400_000;
/** Today's date, YYYY-MM-DD (UTC; a day's offset doesn't matter at this scale). */
export const todayDate = () => new Date().toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / DAY_MS;
const fade = (days: number, halfLife = HALF_LIFE_DAYS) =>
  Math.pow(0.5, Math.max(0, days) / halfLife);

const D = FEATURE_NAMES.length + 1; // features + bias

// ============================================================================
// SMALL LINEAR ALGEBRA (6×6, so plain arrays are plenty)
// ============================================================================

const toX = (f: FeatureVector): number[] => [...FEATURE_NAMES.map((n) => f[n]), 1];

/** Lower-triangular Cholesky factor L of a symmetric positive-definite matrix. */
function cholesky(a: number[][]): number[][] {
  const L = a.map(() => new Array<number>(D).fill(0));
  for (let i = 0; i < D; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
  }
  return L;
}

/** Solve Lᵀx = y. */
function backSolve(L: number[][], y: number[]): number[] {
  const x = new Array<number>(D).fill(0);
  for (let i = D - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < D; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

/** Solve (LLᵀ)x = b. */
function solve(L: number[][], b: number[]): number[] {
  const y = new Array<number>(D).fill(0);
  for (let i = 0; i < D; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
    y[i] = s / L[i][i];
  }
  return backSolve(L, y);
}

function toVector(p: BanditWeights): number[] {
  return [...FEATURE_NAMES.map((n) => p.weights[n]), p.bias];
}

function fromVector(v: number[]): BanditWeights {
  const weights = {} as Record<FeatureName, number>;
  FEATURE_NAMES.forEach((n, i) => (weights[n] = v[i]));
  return { weights, bias: v[D - 1] };
}

/** A prior centred on `mean`, with `PRIOR_PRECISION` on every weight. */
function priorAround(mean: BanditWeights): Posterior {
  const m = toVector(mean);
  return {
    precision: m.map((_, i) => m.map((__, j) => (i === j ? PRIOR_PRECISION : 0))),
    target: m.map((v) => PRIOR_PRECISION * v),
  };
}

/** Inverse of a symmetric positive-definite matrix of any size. */
function inverse(a: number[][]): number[][] {
  const n = a.length;
  const L = a.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
  }
  const inv = a.map(() => new Array<number>(n).fill(0));
  for (let c = 0; c < n; c++) {
    const y = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = i === c ? 1 : 0;
      for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
      y[i] = s / L[i][i];
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let k = i + 1; k < n; k++) s -= L[k][i] * inv[k][c];
      inv[i][c] = s / L[i][i];
    }
  }
  return inv;
}

/**
 * Convert a version-2 posterior (five features + bias) to the current
 * features by marginalizing out weather and occasion: keep exactly what was
 * known about the remaining weights, as if the dropped ones were never in the
 * model.
 */
function fromV2Posterior(p: Posterior): Posterior | null {
  const n = V2_FEATURES.length + 1;
  if (!isValidPosterior(p, n)) return null;
  const keep = [...FEATURE_NAMES.map((f) => V2_FEATURES.indexOf(f)), n - 1];
  const cov = inverse(p.precision);
  const fullMean = solveAny(p.precision, p.target);
  const subCov = keep.map((i) => keep.map((j) => cov[i][j]));
  const precision = inverse(subCov);
  const mean = keep.map((i) => fullMean[i]);
  return { precision, target: precision.map((row) => dot(row, mean)) };
}

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

/** Solve Ax = b for a symmetric positive-definite A of any size. */
function solveAny(a: number[][], b: number[]): number[] {
  const inv = inverse(a);
  return inv.map((row) => dot(row, b));
}

function isValidPosterior(p: unknown, size: number = D): p is Posterior {
  if (!p || typeof p !== 'object') return false;
  const { precision, target } = p as Posterior;
  const finite = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  return (
    Array.isArray(target) &&
    target.length === size &&
    target.every(finite) &&
    Array.isArray(precision) &&
    precision.length === size &&
    precision.every((row) => Array.isArray(row) && row.length === size && row.every(finite)) &&
    precision.every((row, i) => row[i] > 0)
  );
}

// ============================================================================
// COLD START
// ============================================================================

/**
 * Cold-start model: centred on the deterministic scorer's `FEATURE_WEIGHTS`
 * with zero bias, so the expected score equals the fixed scorer's.
 */
export function defaultModel(): BanditModel {
  const weights = {} as Record<FeatureName, number>;
  for (const name of FEATURE_NAMES) weights[name] = FEATURE_WEIGHTS[name];
  const params = { weights, bias: 0 };
  return { params, posterior: priorAround(params), meta: { version: MODEL_VERSION, updates: 0 } };
}

/**
 * Normalize a loaded model: missing or invalid weights fall back to the
 * cold-start defaults, and a model without a (valid) posterior gets a prior
 * centred on its weights. That is how version-1 models, which only stored
 * gradient-step weights, carry what they learned into the Bayesian model.
 */
export function normalizeModel(
  loaded: (Partial<Omit<BanditModel, 'posterior'>> & { posterior?: unknown }) | null | undefined,
): BanditModel {
  const base = defaultModel();
  if (!loaded || !loaded.params) return base;
  const weights = { ...base.params.weights };
  for (const name of FEATURE_NAMES) {
    const v = loaded.params.weights?.[name];
    if (typeof v === 'number' && Number.isFinite(v)) weights[name] = v;
  }
  const bias =
    typeof loaded.params.bias === 'number' && Number.isFinite(loaded.params.bias)
      ? loaded.params.bias
      : base.params.bias;
  const params = { weights, bias };
  return {
    params,
    posterior: isValidPosterior(loaded.posterior)
      ? loaded.posterior
      : (fromV2Posterior(loaded.posterior as Posterior) ?? priorAround(params)),
    meta: { version: MODEL_VERSION, updates: loaded.meta?.updates ?? 0 },
  };
}

// ============================================================================
// PERSISTENCE (pure (de)serialization; Supabase calls live in the callers)
// ============================================================================

/** Shape of the `outfit_model_weights` row's JSON columns. */
export interface SerializedModel {
  /** Posterior-mean weights plus the bias (under `__bias`). Readers that only
   * need the best estimate (e.g. the daily email) use just this. */
  weights: Record<string, number>;
  feature_meta: ModelMeta & { posterior?: Posterior };
}

/** Convert a model to the JSON stored in `outfit_model_weights`. */
export function serializeModel(model: BanditModel): SerializedModel {
  return {
    weights: { ...model.params.weights, __bias: model.params.bias },
    feature_meta: { ...model.meta, posterior: model.posterior },
  };
}

/**
 * Rebuild a model from a stored row. Missing or invalid fields fall back to
 * cold-start defaults; a version-1 row (no posterior) becomes a prior centred
 * on its learned weights.
 */
export function deserializeModel(row: Partial<SerializedModel> | null | undefined): BanditModel {
  if (!row || !row.weights) return defaultModel();
  const { __bias, ...featureWeights } = row.weights;
  return normalizeModel({
    params: {
      weights: featureWeights as Record<FeatureName, number>,
      bias: typeof __bias === 'number' ? __bias : 0,
    },
    posterior: row.feature_meta?.posterior,
    meta: row.feature_meta,
  });
}

// ============================================================================
// PREDICTION
// ============================================================================

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Raw linear prediction (bias + w·features), unclamped. */
export function rawScore(params: BanditWeights, features: FeatureVector): number {
  let sum = params.bias;
  for (const name of FEATURE_NAMES) sum += params.weights[name] * features[name];
  return sum;
}

/** Expected reward in [0, 1] for an outfit's feature vector. */
export function predict(params: BanditWeights, features: FeatureVector): number {
  return clamp01(rawScore(params, features));
}

// ============================================================================
// REWARD
// ============================================================================

/** Map a 1–10 outfit rating to a reward in [0, 1]. */
export function computeReward(rating: number): number {
  const r = (rating - 1) / 9; // 1 → 0, 10 → 1
  return clamp01(r);
}

/** Mild positive reward for an outfit the user explicitly saved. */
export const SAVED_OUTFIT_REWARD = 0.7;

// ============================================================================
// LEARNING (Bayesian linear regression)
// ============================================================================

/**
 * Learn from one observed reward for an outfit:
 *   A ← A + xxᵀ/σ²,  b ← b + x·reward/σ²,  weights ← A⁻¹b.
 * Returns a NEW model (does not mutate the input) with `meta.updates`
 * incremented. Features with value 0 leave their weights' certainty unchanged.
 */
/** When an observation happened, and what "today" is (both YYYY-MM-DD). */
export interface ObservationDates {
  /** Day the outfit was worn (or rated, if not worn). Default: today. */
  on?: string;
  /** Default: the real date. Tests and the benchmark pass a simulated one. */
  today?: string;
  /** Override HALF_LIFE_DAYS (the benchmark uses this to tune it). */
  halfLifeDays?: number;
}

/**
 * Fade the belief to `today`: what earlier ratings contributed shrinks by
 * one half per HALF_LIFE_DAYS since the belief's `asOf`, back toward the cold
 * start. A belief without `asOf` is taken as current.
 */
export function fadeTo(
  model: BanditModel,
  today: string = todayDate(),
  halfLifeDays: number = HALF_LIFE_DAYS,
): BanditModel {
  const { asOf } = model.posterior;
  const days = asOf ? daysBetween(asOf, today) : 0;
  if (days <= 0) return { ...model, posterior: { ...model.posterior, asOf: asOf ?? today } };
  const g = fade(days, halfLifeDays);
  const prior = defaultModel().posterior;
  const precision = model.posterior.precision.map((row, i) =>
    row.map((v, j) => prior.precision[i][j] + g * (v - prior.precision[i][j])),
  );
  const target = model.posterior.target.map((v, i) => prior.target[i] + g * (v - prior.target[i]));
  return {
    params: fromVector(solve(cholesky(precision), target)),
    posterior: { precision, target, asOf: today },
    meta: model.meta,
  };
}

/**
 * Learn from one observed reward for an outfit, faded by how long ago it was
 * worn:  A ← A + w·xxᵀ/σ²,  b ← b + w·x·reward/σ²,  weights ← A⁻¹b,
 * with w = ½^(age/HALF_LIFE_DAYS). Returns a NEW model with `meta.updates`
 * incremented. Features with value 0 leave their weights' certainty unchanged.
 */
export function updateWeights(
  model: BanditModel,
  features: FeatureVector,
  reward: number,
  dates: ObservationDates = {},
): BanditModel {
  return applyObservation(model, features, reward, +1, dates);
}

/**
 * Undo an earlier `updateWeights(model, features, reward, { on })` exactly,
 * whatever has faded since, e.g. when a rating is changed or its wear deleted.
 * Only call it with features, a reward and a date the model really learned.
 */
export function forgetReward(
  model: BanditModel,
  features: FeatureVector,
  reward: number,
  dates: ObservationDates = {},
): BanditModel {
  return applyObservation(model, features, reward, -1, dates);
}

function applyObservation(
  model: BanditModel,
  features: FeatureVector,
  reward: number,
  sign: 1 | -1,
  { on, today = todayDate(), halfLifeDays = HALF_LIFE_DAYS }: ObservationDates,
): BanditModel {
  const current = fadeTo(model, today, halfLifeDays);
  const w = sign * fade(on ? daysBetween(on, today) : 0, halfLifeDays);
  const x = toX(features);
  const s2 = RATING_NOISE * RATING_NOISE;
  const precision = current.posterior.precision.map((row, i) =>
    row.map((v, j) => v + (w * x[i] * x[j]) / s2),
  );
  const target = current.posterior.target.map((v, i) => v + (w * x[i] * reward) / s2);
  const mean = solve(cholesky(precision), target);
  return {
    params: fromVector(mean),
    posterior: { precision, target, asOf: today },
    meta: { version: MODEL_VERSION, updates: Math.max(0, model.meta.updates + sign) },
  };
}

// ============================================================================
// SELECTION (Thompson sampling)
// ============================================================================

export interface ScoredCandidate<T> {
  candidate: T;
  features: FeatureVector;
  /** Expected reward under the posterior mean, in [0, 1]. */
  score: number;
}

/** Standard normal sample (Box–Muller). */
function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/**
 * Thompson sampling: draw one set of weights from the user's posterior and
 * rank every candidate by it. The first result is the outfit to show; the rest
 * are runners-up. Each call draws afresh, so repeated calls offer different
 * good outfits, more varied while the model is unsure and settling as it
 * learns.
 *
 * `rng` is injectable (defaults to `Math.random`) so tests are deterministic.
 */
export function selectOutfits<T>(
  candidates: { candidate: T; features: FeatureVector }[],
  model: BanditModel,
  options: { count?: number; rng?: () => number; today?: string; halfLifeDays?: number } = {},
): ScoredCandidate<T>[] {
  const { count = 5, rng = Math.random } = options;
  // Fade to today first: a model that hasn't learned in a while is less sure.
  model = fadeTo(model, options.today ?? todayDate(), options.halfLifeDays);
  // w = mean + L⁻ᵀz has covariance A⁻¹ when A = LLᵀ.
  const L = cholesky(model.posterior.precision);
  const noise = backSolve(
    L,
    Array.from({ length: D }, () => gaussian(rng)),
  );
  const mean = toVector(model.params);
  const sampled = fromVector(mean.map((m, i) => m + noise[i]));

  return candidates
    .map((c) => ({
      candidate: c.candidate,
      features: c.features,
      score: predict(model.params, c.features),
      sampledScore: rawScore(sampled, c.features),
      // Outfits often share features exactly (no color preferences, nothing
      // rated or worn yet), so break ties at random, not by closet order.
      tieBreak: rng(),
    }))
    .sort((a, b) => b.sampledScore - a.sampledScore || a.tieBreak - b.tieBreak)
    .slice(0, count)
    .map(({ sampledScore: _sampledScore, tieBreak: _tieBreak, ...rest }) => rest);
}
