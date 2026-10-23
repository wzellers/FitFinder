# Bandit benchmark

How well does FitFinder learn what a user likes, and what would make it learn
faster? This benchmark answers that with simulated users, using the app's real
scoring code. Code: `src/__tests__/bandit/`. Full numbers:
[`bandit-benchmark-results.md`](bandit-benchmark-results.md) (regenerate with
`npm run bench:bandit`, about 5 minutes).

## Findings

From the run of 2026-10-23 (200 users per scenario, 90 days), after the app
switched to Thompson sampling (`MODEL_VERSION` 2). Regret: 0 = the day's best
outfit, 1 = no better than a random pick.

| Typical users                                  | Ratings 1–7 | 8–30 | 31–90 | Top-10% picks (31–90) |
| ---------------------------------------------- | ----------- | ---- | ----- | --------------------- |
| Random pick                                    | 1.00        | 1.00 | 1.00  | 11%                   |
| No learning (cold-start weights)               | 0.74        | 0.68 | 0.66  | 35%                   |
| Legacy gradient (the app before v2)            | 0.73        | 0.66 | 0.61  | 38%                   |
| Legacy gradient, show the best, ε decays       | 0.67        | 0.52 | 0.42  | 54%                   |
| **Production: Thompson sampling (λ 3, σ 0.1)** | 0.74        | 0.48 | 0.33  | 64%                   |
| LinUCB (α 0.5)                                 | 0.70        | 0.50 | 0.37  | 58%                   |

Regret after a month (ratings 31–90), legacy → production: typical **0.61 →
0.33**, item-driven **0.69 → 0.36**, drifting **0.63 → 0.38**, noisy **0.66 →
0.54**.

1. **The legacy learner barely learned:** 0.61 vs 0.67 with no learning at all.
   Showing a random one of its top 5, and ε-greedy exploration, held it back. In
   the exploration sweep ε 0 did best and ε 0.3 worst; daily changes in weather
   and occasion already vary what the user sees.
2. **Thompson sampling roughly halves regret** from the second week on, and is
   strongest for users who love specific pieces. It is why the app switched.
3. **The first week is hard for every learner** (0.67–0.74). Thompson sampling
   explores most at first, so it isn't better there; gains start in week two.
4. **Very noisy raters** (±3 points) are the one case where a tuned gradient
   learner (show the best, decaying ε) edges it (0.50 vs 0.54).
5. **Feature importance:** the **rating** feature (the app's memory of
   well-rated items) carries most of the learnable signal: hiding it takes
   production from 0.33 to 0.64, almost no learning. Color and variety are
   worth about 0.08 each, weather ≈0.01 once weather-blocked items are filtered
   out, and **occasion nothing** (it is constant within a day by design).
6. **Cold-start weights barely matter for Thompson sampling**, which adapts within
   a couple of weeks; they mattered for the legacy learner (a rating-heavy start
   helped most).

**Next:** the rating feature matters most, but ratings from the prompt are
learned from features rebuilt without weather or wear history, and Calendar
ratings aren't learned from at all. Fixing that (step 3) feeds the model
better data.

## Method

**The world is real; only the user is simulated.** Each simulated user gets:

- **A closet** of 6–14 tops, 4–8 bottoms and 2–4 pairs of shoes, with realistic
  types and colors (neutrals commoner), plus 0–4 liked color combinations.
- **90 days** starting on a random day of the year. The daily high follows a
  seasonal curve (≈35°F in January to ≈85°F in July) with noise, mapped to the
  app's temperature categories. Half the days have no occasion; the rest are
  mostly Work, sometimes Casual, Date or Active.
- **Candidates from the app's own code.** Each day, `buildCandidates` filters
  by weather and occasion and `featureVector` computes the five features,
  including variety and rating from the learner's own wear and rating history.

**Hidden taste.** A real person doesn't care about the app's features as such,
so the simulated user's true liking of an outfit is:

- a weighted mix of **color** (liked combinations), **weather fit** and
  **variety** (weights drawn at random per user), plus
- a hidden liking for **individual items** (most near zero, a few favourites).

The app's **rating** feature is not part of the taste: it is the app's proxy
for liked items, and helps only if it really picks them up. **Occasion** isn't
either: the app enforces it by filtering, so it is the same for every outfit
on a given day and can't change which outfit wins.

**Each day** the learner picks the outfit to show, the user rates it 1–10 (true
liking plus noise, rounded), and the learner learns from that rating, the same
one-rating-a-day loop as the app's rating prompt.

**Scenarios** (200 users each):

| Scenario    | Users                                                  |
| ----------- | ------------------------------------------------------ |
| typical     | Random tastes plus item favourites; ratings ±1 point   |
| item-driven | Care about specific pieces far more than general rules |
| noisy       | Typical tastes, inconsistent ratings (±3 points)       |
| drifting    | Taste changes completely halfway through the 90 days   |

**Measure: normalized regret** per day = (best outfit's true liking − shown
outfit's) ÷ (best − average candidate). **0** means the user got the day's best
outfit; **1** means no better than a random pick. Also reported: the share of
days the shown outfit was in the user's true top 10%. Every learner sees the
same users, closets, days and rating noise, so differences come from the
learner. Results are means over users with 95% confidence intervals, for
ratings 1–7 (the first week), 8–30 and 31–90.

**Learners compared:**

- **production**: the app today. `selectOutfits` with ε-greedy (ε 0.15), a
  random one of its top 5 shown, `updateWeights` with learning rate 0.1.
- simple fixes to it: always show the best guess; let ε decay as ratings come
  in; different learning and exploration rates.
- **Thompson sampling**: per-user Bayesian linear regression with a prior
  centred on the cold-start weights. It shows the best outfit under weights
  sampled from its current belief, so it explores only as much as it is still
  unsure, feature by feature.
- **LinUCB**: the same model, but shows the outfit with the highest optimistic
  estimate (mean + α × uncertainty).
- baselines: random picks (the floor), and the cold-start weights with no
  learning.

**Sweeps** (typical scenario): learning rate, exploration rate, Thompson
prior strength and assumed noise, LinUCB α, cold-start weights for both
learners, and feature importance (hide one feature at a time).

## Limits

- Taste is partly linear by construction, which suits linear learners. Item
  favourites and rating noise keep it from being trivially learnable, but real
  people are messier.
- One rating a day, always for the shown outfit. The app also learns from
  saved outfits, and could learn from more signals than it does.
- Closets are fixed for the 90 days; nothing gets dirty, bought or retired.
