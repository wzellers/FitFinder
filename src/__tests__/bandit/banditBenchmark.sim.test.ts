/**
 * Bandit benchmark: compares ways of learning a user's outfit taste, in a
 * simulated world built from the app's real scoring code. Method and findings:
 * docs/BANDIT_BENCHMARK.md.
 *
 * - `npm run test` runs a small smoke version, so the harness keeps working.
 * - `npm run bench:bandit` runs the full benchmark (~5 minutes) and rewrites
 *   docs/bandit-benchmark-results.md.
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { FEATURE_NAMES, FEATURE_WEIGHTS, type FeatureName } from '@/lib/outfitScoring';
import {
  legacyGradient,
  linUcb,
  production,
  randomPick,
  thompson,
  type LearnerSpec,
  type Weights,
} from './learners';
import { formatTable, runBenchmark, WINDOWS, type LearnerResult } from './run';
import { POPULATIONS } from './world';

const FULL = process.env.BANDIT_BENCH === '1';

/** The main comparison: today's app, simple fixes to it, and Bayesian learners. */
const MAIN: LearnerSpec[] = [
  { name: 'random pick (floor)', make: randomPick },
  { name: 'no learning (cold-start weights)', make: () => legacyGradient({ frozen: true }) },
  {
    name: 'legacy gradient (ε 0.15, lr 0.1, random of top 5; the app before v2)',
    make: () => legacyGradient(),
  },
  {
    name: 'legacy gradient, show the best, ε decays',
    make: () => legacyGradient({ showAmongTop: 1, decayEpsilon: true }),
  },
  { name: '**production** (Thompson sampling, λ 3, σ 0.1)', make: () => production() },
  { name: 'LinUCB (α 0.5)', make: () => linUcb({ priorPrecision: 3, noise: 0.1, alpha: 0.5 }) },
];

function sweeps(): Array<{ title: string; note: string; learners: LearnerSpec[] }> {
  const uniform = Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0.2])) as Weights;
  const heavy = (f: FeatureName): Weights =>
    Object.fromEntries(FEATURE_NAMES.map((n) => [n, n === f ? 0.6 : 0.1])) as Weights;
  const starts: Array<[string, Weights]> = [
    ['current defaults (0.30/0.25/0.20/0.15/0.10)', { ...FEATURE_WEIGHTS }],
    ['uniform 0.2', uniform],
    ...FEATURE_NAMES.map((f): [string, Weights] => [`${f}-heavy (0.6)`, heavy(f)]),
    ['all zero', Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0])) as Weights],
  ];
  return [
    {
      title: 'Learning rate (legacy gradient, show the best, ε decays)',
      note: 'How big a step each rating takes.',
      learners: [0.05, 0.1, 0.2, 0.4].map((lr) => ({
        name: `lr ${lr}`,
        make: () => legacyGradient({ showAmongTop: 1, decayEpsilon: true, learningRate: lr }),
      })),
    },
    {
      title: 'Exploration rate (legacy gradient, show the best, lr 0.1)',
      note: 'How often a random outfit is shown instead of the best guess.',
      learners: [0, 0.05, 0.15, 0.3].map((eps) => ({
        name: `ε ${eps}`,
        make: () => legacyGradient({ showAmongTop: 1, epsilon: eps }),
      })),
    },
    {
      title: 'Thompson sampling: prior strength λ and assumed rating noise σ',
      note: 'λ is how firmly it trusts the cold-start weights; σ how noisy it assumes ratings are.',
      learners: [1, 3, 10, 30].flatMap((lambda) =>
        [0.1, 0.2].map((noise) => ({
          name: `λ ${lambda}, σ ${noise}`,
          make: () => thompson({ priorPrecision: lambda, noise }),
        })),
      ),
    },
    {
      title: 'LinUCB optimism α',
      note: 'How strongly it favours outfits it is unsure about.',
      learners: [0.25, 0.5, 1, 2].map((alpha) => ({
        name: `α ${alpha}`,
        make: () => linUcb({ alpha }),
      })),
    },
    {
      title: 'Cold-start weights (Thompson sampling)',
      note: 'Which starting weights give the best first weeks.',
      learners: starts.map(([name, start]) => ({ name, make: () => thompson({ start }) })),
    },
    {
      title: 'Cold-start weights (legacy gradient)',
      note: 'The same, for the learner the app used before.',
      learners: starts.map(([name, start]) => ({ name, make: () => legacyGradient({ start }) })),
    },
    {
      title: 'Feature importance (production, one feature hidden)',
      note: 'Regret rises most when a useful feature is removed.',
      learners: [
        { name: 'all features', make: () => production() },
        ...FEATURE_NAMES.map((f) => ({
          name: `without ${f}`,
          make: () => production({ ignore: [f] }),
        })),
      ],
    },
  ];
}

describe('bandit benchmark (smoke)', () => {
  it('runs every learner and the random floor sits near 1', () => {
    const results = runBenchmark(POPULATIONS[0], MAIN, { users: 12, days: 40, seed: 1 });
    expect(results).toHaveLength(MAIN.length);
    for (const r of results) {
      for (const s of r.regret.slice(0, 2)) {
        expect(Number.isFinite(s.mean)).toBe(true);
        expect(s.mean).toBeGreaterThanOrEqual(0);
      }
    }
    // Normalization check: picking at random scores about 1.
    expect(results[0].regret[1].mean).toBeGreaterThan(0.8);
    expect(results[0].regret[1].mean).toBeLessThan(1.2);
  });
});

describe.runIf(FULL)('bandit benchmark (full)', () => {
  it('writes docs/bandit-benchmark-results.md', () => {
    const opts = { users: 200, days: 90, seed: 2026 };
    const out: string[] = [
      '# Bandit benchmark results',
      '',
      'Generated by `npm run bench:bandit`; see `docs/BANDIT_BENCHMARK.md` for the method.',
      `${opts.users} simulated users per scenario, ${opts.days} days (one rating a day), seed ${opts.seed}.`,
      'Regret: 0 = always the day’s best outfit, 1 = no better than a random pick (mean ± 95% CI).',
      '',
      '## Main comparison',
    ];
    const log = (s: string) => {
      out.push(s);
      console.log(s);
    };
    for (const pop of POPULATIONS) {
      log(`\n### Scenario: ${pop.name}\n\n${pop.description}.\n`);
      log(formatTable(runBenchmark(pop, MAIN, opts)));
    }
    log('\n## Sweeps (scenario: typical)');
    for (const sweep of sweeps()) {
      const results: LearnerResult[] = runBenchmark(POPULATIONS[0], sweep.learners, opts);
      log(`\n### ${sweep.title}\n\n${sweep.note}\n`);
      log(formatTable(results));
    }
    out.push(
      '',
      `Windows: ${WINDOWS.map((w) => `${w.label} = ratings ${w.from}–${w.to}`).join('; ')}.`,
      '',
    );
    fs.writeFileSync(
      path.resolve(__dirname, '../../../docs/bandit-benchmark-results.md'),
      out.join('\n'),
    );
  }, 3_600_000);
});
