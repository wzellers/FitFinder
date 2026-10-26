// Runs learners through simulated users' days and measures how good the shown
// outfits were.
//
// Every learner sees the same users, closets, weather, occasions and rating
// noise (common random numbers), so differences come from the learner, not luck.

import { computeReward } from '@/lib/banditModel';
import type { LearnerSpec } from './learners';
import {
  candidatesFor,
  makeCloset,
  makeDays,
  makeLikedCombos,
  mulberry32,
  rate,
  simDate,
  trueUtility,
  type Population,
  type WearRecord,
} from './world';

export interface Window {
  label: string;
  from: number; // 1-based rating number, inclusive
  to: number;
}

export const WINDOWS: Window[] = [
  { label: 'ratings 1–7', from: 1, to: 7 },
  { label: '8–30', from: 8, to: 30 },
  { label: '31–90', from: 31, to: 90 },
];

export interface Stat {
  mean: number;
  /** Half-width of the 95% confidence interval across users. */
  ci: number;
}

export interface LearnerResult {
  name: string;
  /** Normalized regret per window: 0 = always the day's best outfit,
   * 1 = no better than a random candidate. */
  regret: Stat[];
  /** Share of days the shown outfit was in the day's true top 10%. */
  top10: Stat[];
}

export interface RunOptions {
  users: number;
  days: number;
  seed: number;
  /** Reporting windows (default WINDOWS). */
  windows?: Window[];
}

function stat(values: number[]): Stat {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, n - 1));
  return { mean, ci: (1.96 * sd) / Math.sqrt(n) };
}

export function runBenchmark(
  population: Population,
  learners: LearnerSpec[],
  { users, days, seed, windows = WINDOWS }: RunOptions,
): LearnerResult[] {
  const perLearner = learners.map(() => ({
    regret: windows.map(() => [] as number[]),
    top10: windows.map(() => [] as number[]),
  }));

  for (let u = 0; u < users; u++) {
    const worldRng = mulberry32(seed * 100_003 + u);
    const closet = makeCloset(worldRng);
    const liked = makeLikedCombos(worldRng, closet);
    const dayList = makeDays(worldRng, days);
    const user = population.makeUser(worldRng, closet);

    learners.forEach((spec, li) => {
      const learner = spec.make();
      const policyRng = mulberry32(seed * 7_919 + u * 31 + 1);
      const history: WearRecord[] = [];
      const regret: number[] = [];
      const top: number[] = [];

      for (let d = 0; d < days; d++) {
        const cands = candidatesFor(closet, liked, dayList[d], d, history);
        if (cands.length < 2) continue;
        const drifted = d >= days / 2;
        const utils = cands.map((c) =>
          trueUtility(user, c.features, c, dayList[d].weather, drifted),
        );
        const best = Math.max(...utils);
        const avg = utils.reduce((s, v) => s + v, 0) / utils.length;

        // Same outfits in the same order, ranked on drawn item ratings.
        const choices = spec.exploreItems
          ? candidatesFor(closet, liked, dayList[d], d, history, policyRng, spec.itemSpread)
          : cands;
        const i = learner.choose(choices, policyRng, simDate(d));
        const gap = best - avg;
        regret.push(gap > 1e-9 ? (best - utils[i]) / gap : 0);
        const better = utils.filter((v) => v > utils[i]).length;
        top.push(better / utils.length < 0.1 ? 1 : 0);

        // Same noise for every learner on the same user and day.
        const rating = rate(utils[i], user.noise, mulberry32(seed * 104_729 + u * 1_000 + d));
        learner.learn(cands[i].features, computeReward(rating), simDate(d));
        const c = cands[i];
        history.push({ day: d, top: c.top.id, bottom: c.bottom.id, shoes: c.shoes.id, rating });
      }

      windows.forEach((w, wi) => {
        const r = regret.slice(w.from - 1, w.to);
        const t = top.slice(w.from - 1, w.to);
        if (r.length) {
          perLearner[li].regret[wi].push(r.reduce((s, v) => s + v, 0) / r.length);
          perLearner[li].top10[wi].push(t.reduce((s, v) => s + v, 0) / t.length);
        }
      });
    });
  }

  return learners.map((spec, li) => ({
    name: spec.name,
    regret: perLearner[li].regret.map(stat),
    top10: perLearner[li].top10.map(stat),
  }));
}

/** A results table in Markdown. */
export function formatTable(results: LearnerResult[], windows: Window[] = WINDOWS): string {
  const last = windows.length - 1;
  const head = `| Learner | ${windows.map((w) => `Regret, ${w.label}`).join(' | ')} | Top-10% picks, ${windows[last].label} |`;
  const sep = `|${'---|'.repeat(windows.length + 2)}`;
  const rows = results.map(
    (r) =>
      `| ${r.name} | ${r.regret.map((s) => `${s.mean.toFixed(2)} ± ${s.ci.toFixed(2)}`).join(' | ')} | ${(r.top10[last].mean * 100).toFixed(0)}% |`,
  );
  return [head, sep, ...rows].join('\n');
}
