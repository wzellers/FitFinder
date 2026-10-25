# FitFinder Architecture

This document explains how FitFinder is put together: the overall shape of the
app, the two systems that make it interesting (the **upload pipeline** and the
**outfit learning model**), and the data model behind them. It's aimed at anyone
reading the code for the first time.

## Overview

FitFinder is a **Next.js 15 (App Router)** application. Almost all logic runs in
the browser; the server code is a few API routes: clothing detection with
Claude Vision, a weather proxy, and the [daily outfit email](#daily-outfit-email). State is stored in **Supabase** (Postgres + Auth +
Storage), and there is **no separate ML backend** — the learning model is a few
numbers that live in a Supabase row and are updated client-side.

```
Browser (React 19)                           Supabase
┌─────────────────────────────┐              ┌──────────────────────────┐
│ app/page.tsx (tabbed app)   │◀── auth ────▶│ Auth                     │
│  ├─ Closet                  │              │ Postgres (RLS per user)  │
│  ├─ OutfitGenerator ────────┼── read ─────▶│  clothing_items          │
│  ├─ OutfitCalendar          │── write ────▶│  saved_outfits           │
│  ├─ WardrobeStats           │              │  outfit_wears            │
│  └─ Settings                │              │  *_preferences, profiles │
│     (ColorPreferences.tsx)  │              │  outfit_model_weights    │
│ lib/ (pure logic)           │── signed ───▶│ Storage (private)        │
│  outfitScoring, banditModel │    URLs      │  clothing-images         │
│  uploadPipeline, weatherApi │              └──────────────────────────┘
└──────────────┬──────────────┘
               │ fetch (Bearer: user's access token)
               ▼
   app/api/detect-clothing ──▶ Claude Haiku 4.5 vision
   app/api/weather         ──▶ OpenWeatherMap
```

The daily email runs separately, server to server; see
[Daily outfit email](#daily-outfit-email).

### Layout at a glance

| Directory             | Responsibility                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app`             | `page.tsx` is the whole app (tabbed, no client routing); `api/` holds the four server routes.        |
| `src/components`      | React UI. `components/ui/` holds primitives (modal, dialogs, nav, image, skeletons).                 |
| `src/hooks`           | React hooks — currently `useAuth` around Supabase auth state.                                        |
| `src/lib`             | Framework-free business logic: scoring, the bandit, weather, upload orchestration, constants, types. |
| `src/styles`          | Tailwind directives, CSS variables, and component classes.                                           |
| `supabase/migrations` | Ordered, immutable SQL migrations — the schema source of truth.                                      |

The `src/lib` modules are deliberately small and free of React/Supabase coupling
where possible, so the interesting logic can be unit-tested in isolation.

## The upload pipeline

Adding an item should feel like "pick a photo, glance, confirm." The pipeline in
`src/lib/uploadPipeline.ts` and `src/components/ImageUpload.tsx` makes that happen:

1. **Select.** The user picks one or many photos. Each becomes an in-memory
   _draft_ with its own preview, form fields, and status.
2. **Auto-detect** (`detectItem`). For each draft, two things run:
   - **Type** — the image is POSTed to `/api/detect-clothing`, which asks Claude
     Vision to classify it into one of the known clothing types and pick a
     primary (and optional secondary) color from the fixed palette.
   - **Color** — a local canvas pass (`imageColor.ts`) samples pixels, skips
     transparent/near-white background, and returns the top one or two palette
     colors by coverage.
     Detection runs with a small concurrency limit (`runWithConcurrency`) to respect
     Claude rate limits. The image itself is **never modified** by detection.
3. **Review & correct.** The user sees the pre-filled type and colors and can
   override any of them. A single photo gets a detailed view; several photos get a
   compact review grid.
4. **Remove background (optional).** A one-click step runs
   `@imgly/background-removal` on-device. The model's output is uploaded
   **untouched** — no thresholding or reframing — which keeps the soft,
   anti-aliased edge clean. (An earlier auto-framing approach was dropped because
   thresholding roughened edges.)
5. **Upload** (`uploadItem`). `prepareImageForUpload` keeps small PNGs (cropped
   or background-removed) as they are and scales everything else down to WebP,
   which also converts formats Storage would reject. The file goes to the
   private `clothing-images` bucket under `<userId>/`, and a row with that path
   is written to `clothing_items`. Photos are shown through short-lived signed
   URLs, batched per render (`clothingImages.ts`). Batches upload with the same
   concurrency helper and report per-item success/failure so partial failures can
   be retried.

## Outfit generation and learning

This is the heart of the app. It has two layers that share one feature
definition, so the "learning" version is a drop-in replacement for the fixed one.

### 1. The feature vector

Every candidate outfit is `{ top, bottom, shoes }`. `buildCandidates()` in
`src/lib/outfitScoring.ts` first **filters**: items blocked in today's weather
(from the user's weather rules) and, when an occasion is chosen, items whose
type doesn't suit it are removed. Weather and occasion play no further part.
Each remaining outfit becomes three numbers, each in `[0, 1]`:

| Feature     | Meaning                                                 |
| ----------- | ------------------------------------------------------- |
| **color**   | How well the colors match the user's liked combinations |
| **variety** | Penalizes items worn in the last 14 days                |
| **rating**  | Boost from the user's higher-rated past outfits         |

`buildCandidates()` is the shared entry point used by both the fixed scorer and
the bandit.

### 2. Fixed scorer (cold start)

The score is a weighted sum with fixed `FEATURE_WEIGHTS`
(`0.50 / 0.33 / 0.17`, summing to 1.0). Generation scores every valid
`top × bottom × shoes` combination, sorts descending, and samples among the top
results so repeated "generate" clicks stay fresh while favoring good outfits.
Locked slots constrain the candidate pool before scoring.

### 3. Contextual bandit (learning)

`src/lib/banditModel.ts` replaces the fixed weights with **learned** ones, per
user, behind the same interface:

- **Model.** A linear model (one weight per feature plus a bias:
  `score = w · features + bias`, clamped to `[0, 1]`), held as a **Bayesian
  belief**: a Gaussian over the four weights, stored as a precision matrix `A`
  and vector `b` (mean `A⁻¹b`, covariance `A⁻¹`).
- **Cold start.** `defaultModel()` centres the belief on the fixed
  `FEATURE_WEIGHTS` with prior precision 3, so before any rating the expected
  score reproduces the fixed scorer. New users get sensible behavior immediately.
- **Learning.** When the user rates an outfit, `computeReward()` maps the 1–10
  rating to `[0, 1]` and `updateWeights()` does an exact Bayesian update
  (`A += xxᵀ/σ²`, `b += x·reward/σ²`, assumed rating noise σ = 0.1). Saving an
  outfit contributes a mild positive reward. Updates are immutable (they return
  a new model), and `forgetReward()` undoes one exactly.
- **Fading.** Old ratings fade with a 60-day half-life (`HALF_LIFE_DAYS`),
  counted from the day the outfit was worn: the belief drifts back toward the
  cold start (`fadeTo()`), so the model follows a changing taste, and a model
  that hasn't learned in a while becomes less sure and explores again.
  `selectOutfits()` fades to today before sampling. Undoing a rating removes
  exactly what is left of it.
- **What it learns from** (`src/lib/outfitLearning.ts`). "Wear today" stores the
  outfit's feature vector on its `outfit_wears` row (`features`, with the item
  ids it describes), so a later rating trains on the outfit as it was that day.
  Wears logged in the Calendar get features rebuilt as of their date from the
  wear history.
  `syncWearLearning` runs after the rating prompt and every Calendar save: it
  undoes what the row's `learned_rating` taught the model and learns the
  current rating, so edits never double-count; `forgetWearLearning` runs before
  a Calendar delete.
- **Selection (Thompson sampling).** `selectOutfits()` samples one set of
  weights from the belief and ranks every candidate by it; the generator shows
  the top pick. While the model is unsure, samples vary and it explores; as
  ratings narrow the belief, it settles on the user's best outfits. Each
  "Try another" draws a new sample. The RNG is injectable so tests are
  deterministic.
- **Persistence.** `outfit_model_weights` holds one row per user: `weights` is
  the posterior mean (enough for readers like the daily email, which takes the
  best expected outfit) and `feature_meta` carries the posterior and version.
  Older rows are converted on load, so nobody's learning resets: version-1
  (gradient-step) weights become a prior centred on them, and version-2
  beliefs, which also covered weather and occasion, have those two
  marginalized out.

The settings (prior precision 3, noise 0.1) and the choice of Thompson
sampling over ε-greedy come from the bandit benchmark
([`BANDIT_BENCHMARK.md`](BANDIT_BENCHMARK.md)), which simulates users with
realistic closets and weather through the app's real scoring code.

Why linear? It trains on tiny amounts of data, runs instantly in the browser, and
is interpretable — you can point at exactly why an outfit scored well. A richer
model could later slot in behind the same `predict` / `updateWeights` interface.

### The learning loop, end to end

```
generate ──▶ selectOutfits (Thompson) ──▶ user wears & rates (1–10)
   ▲                                              │
   │                                              ▼
   └──── load belief ◀── outfit_model_weights ◀── updateWeights(reward)
```

**Measuring convergence.** `src/__tests__/banditConvergence.sim.test.ts` simulates
hundreds of synthetic users with random true preferences and reports how many
ratings it takes the model to converge. It uses the production `banditModel`
functions, so it doubles as a living spec for the learning behavior — it prints a
convergence histogram and also asserts the model learns within a bound. It runs as
part of the normal Vitest suite.

## Data model

Schema lives in [`supabase/migrations/`](../supabase/migrations) as numbered SQL
files applied in order. Each is immutable; changes are made by adding a new file.

| Table                  | Purpose                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `clothing_items`       | Wardrobe items: type, colors (primary at index 0), photo path, laundry status                                    |
| `saved_outfits`        | Saved `{ top, bottom, shoes }` combinations, optionally named                                                    |
| `outfit_wears`         | Daily wear log (one per day): rating (1–10), occasion, and what the model learned (`features`, `learned_rating`) |
| `color_preferences`    | Liked color combinations                                                                                         |
| `weather_preferences`  | The user's temperature ranges and per-type weather rules                                                         |
| `occasion_preferences` | Which clothing types suit each occasion                                                                          |
| `profiles`             | ZIP code, onboarding state, and daily email settings                                                             |
| `outfit_model_weights` | Per-user learned bandit weights + metadata                                                                       |

Photos live in the private `clothing-images` Storage bucket, one folder per
user, readable only by their owner.

All per-user tables use the same Row-Level-Security pattern established in
`001_outfit_wears.sql`, so a user can only read and write their own rows.

## Notable implementation details

- **Lazy Supabase client** (`src/lib/supabaseClient.ts`). The client is created on
  first use behind a `Proxy`, not at import time. This prevents Next.js build-time
  prerendering (e.g. on Vercel) from trying to initialize Supabase before env vars
  are available, while callers still `import { supabase }` normally.
- **Single API surface for detection.** `/api/detect-clothing` is the only
  place a model is called and the only place the Anthropic key is used,
  keeping the secret off the client. It requires a signed-in user.
- **Constants as one source of truth.** Clothing types, sections, color palette,
  and occasion rules all live in `src/lib/constants.ts`; the detection route
  validates Claude's output against these same lists.

## Daily outfit email

The one piece of FitFinder that runs without the browser. Every 15 minutes a
Supabase `pg_cron` job (migration 018) uses `pg_net` to call the app:

```
pg_cron (15 min) ─▶ POST /api/email/send-due ─▶ Supabase (service-role key)
                    (Bearer CRON_SECRET)      ─▶ OpenWeatherMap (daily forecast)
                                              ─▶ Resend ─▶ user's inbox
```

The job reads the route's URL and secret from Supabase Vault, so neither is in
the repo. The route rejects any caller without `CRON_SECRET`, then runs the
logic in `src/lib/dailyEmail/`:

- **`schedule.ts`.** A user is due once their local send time
  (`profiles.daily_email_time` in `profiles.timezone`) has passed, at most
  once per local day, within a two-hour catch-up window.
- **`digest.ts`.** Picks the outfit: the bandit's exploit-only best pick for the
  forecast high, filtered by the same weather rules as the generator. Also
  lists up to six clean items not worn in the last week.
- **`render.ts`.** HTML (tables and inline styles, for email clients) plus plain
  text.
- **`resend.ts`.** Delivers through Resend's HTTP API.
- **`sender.ts`.** For each due user, claims the day with a conditional update
  on `daily_email_last_sent` before sending, so overlapping runs can't
  double-send. If the send fails, it releases the claim. Errors are isolated
  per user, and logs carry user ids only. Images use signed URLs that last
  7 days.

Unsubscribe links carry a random per-user `email_unsubscribe_token`.
`/api/email/unsubscribe` calls the `SECURITY DEFINER` function
`unsubscribe_daily_email(token)`, which can only turn the email off. A GET
shows a confirmation button, because mail scanners follow links. A POST
unsubscribes, which also serves RFC 8058 one-click unsubscribe. Setup steps
are in the README under "Daily outfit email setup".

## External services

| Service                 | Used for                               | Where                                       |
| ----------------------- | -------------------------------------- | ------------------------------------------- |
| Supabase                | Auth, Postgres, Storage                | `lib/supabaseClient.ts`, hooks, components  |
| Anthropic Claude Vision | Clothing type/color detection          | `app/api/detect-clothing/route.ts`          |
| OpenWeatherMap          | Current weather and the daily forecast | `app/api/weather`, `lib/weatherProvider.ts` |
| Resend                  | Delivering the daily email             | `lib/dailyEmail/resend.ts`                  |
