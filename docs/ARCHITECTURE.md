# FitFinder Architecture

This document explains how FitFinder is put together: the overall shape of the
app, the two systems that make it interesting (the **upload pipeline** and the
**outfit learning model**), and the data model behind them. It's aimed at anyone
reading the code for the first time.

## Overview

FitFinder is a **Next.js 15 (App Router)** application. Almost all logic runs in
the browser; the only server code is a single API route that proxies clothing
photos to Claude Vision. State is stored in **Supabase** (Postgres + Auth +
Storage), and there is **no separate ML backend** — the learning model is a few
numbers that live in a Supabase row and are updated client-side.

```
Browser (React 19)                         Supabase
┌───────────────────────────┐              ┌─────────────────────┐
│ app/page.tsx (dashboard)  │◀── auth ────▶│ Auth                │
│  ├─ Closet                │              │                     │
│  ├─ OutfitGenerator ──────┼── read ─────▶│ Postgres            │
│  ├─ OutfitCalendar        │── write ────▶│  clothing_items     │
│  ├─ WardrobeStats         │              │  saved_outfits      │
│  └─ ColorPreferences      │              │  outfit_wears       │
│                           │              │  color_preferences  │
│ lib/ (pure logic)         │              │  profiles           │
│  outfitScoring, banditModel│              │  outfit_model_weights│
│  weatherApi, uploadPipeline│              │ Storage             │
└───────────┬───────────────┘              │  clothing-images    │
            │                              └─────────────────────┘
            │ POST /api/detect-clothing
            ▼
   app/api/detect-clothing (server) ──▶ Anthropic Claude Vision
```

### Layout at a glance

| Directory             | Responsibility                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app`             | Routes and the single API route. `page.tsx` is the whole dashboard (tabbed, no client routing).      |
| `src/components`      | React UI. `components/ui/` holds reusable primitives (dialogs, cropper, skeletons).                  |
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
5. **Upload** (`uploadItem`). The final blob goes to the `clothing-images` Storage
   bucket and a row is written to `clothing_items`. Batches upload with the same
   concurrency helper and report per-item success/failure so partial failures can
   be retried.

## Outfit generation and learning

This is the heart of the app. It has two layers that share one feature
definition, so the "learning" version is a drop-in replacement for the fixed one.

### 1. The feature vector

Every candidate outfit is `{ top, bottom, shoes }`. `src/lib/outfitScoring.ts`
turns a candidate into five numbers, each in `[0, 1]`:

| Feature      | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| **color**    | How well the colors match the user's liked combinations               |
| **weather**  | Fit with the local temperature forecast (via OpenWeatherMap)          |
| **variety**  | Penalizes items worn in the last 14 days                              |
| **occasion** | Match against per-occasion type rules (Casual / Work / Date / Active) |
| **rating**   | Boost from the user's higher-rated past outfits                       |

Candidates are first weather-filtered, then featurized. `buildCandidates()` is the
shared entry point used by both the fixed scorer and the bandit.

### 2. Fixed scorer (cold start)

The score is a weighted sum with fixed `FEATURE_WEIGHTS`
(`0.30 / 0.25 / 0.20 / 0.15 / 0.10`, summing to 1.0). Generation scores every valid
`top × bottom × shoes` combination, sorts descending, and samples among the top
results so repeated "generate" clicks stay fresh while favoring good outfits.
Locked slots constrain the candidate pool before scoring.

### 3. Contextual bandit (learning)

`src/lib/banditModel.ts` replaces the fixed weights with **learned** ones, per
user, behind the same interface:

- **Model.** A linear model — one weight per feature plus a bias:
  `score = w · features + bias`, clamped to `[0, 1]`.
- **Cold start.** `defaultModel()` seeds the weights from the same fixed
  `FEATURE_WEIGHTS`, so before any rating the bandit's `predict` exactly reproduces
  the fixed scorer. New users get sensible behavior immediately.
- **Selection.** `selectOutfits()` uses **ε-greedy** explore/exploit (default
  ε = 0.15): usually surface the highest-scoring outfits, occasionally explore.
  The RNG is injectable so tests are deterministic.
- **Learning.** When the user rates an outfit, `computeReward()` maps the 1–10
  rating to `[0, 1]` and `updateWeights()` applies one online gradient step
  (`w += lr · (reward − predicted) · feature`, default lr = 0.05). Saving an
  outfit contributes a mild positive reward. Updates are immutable (they return a
  new model) and increment an update counter for diagnostics.
- **Persistence.** The model serializes to a compact JSON blob (six numbers plus
  metadata) stored in `outfit_model_weights`, one row per user. Legacy or empty
  rows fall back to cold start.

Why linear? It trains on tiny amounts of data, runs instantly in the browser, and
is interpretable — you can point at exactly why an outfit scored well. A richer
model could later slot in behind the same `predict` / `updateWeights` interface.

### The learning loop, end to end

```
generate ──▶ selectOutfits (ε-greedy) ──▶ user wears & rates (1–10)
   ▲                                              │
   │                                              ▼
   └──── load weights ◀── outfit_model_weights ◀── updateWeights(reward)
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

| Table                  | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `clothing_items`       | Wardrobe items: type, colors (primary at index 0), image URL, laundry status |
| `saved_outfits`        | Saved `{ top, bottom, shoes }` combinations, optionally named                |
| `outfit_wears`         | Daily wear log with rating (1–10) and occasion                               |
| `color_preferences`    | Liked color combinations and the user's zip code                             |
| `profiles`             | Onboarding state and user metadata                                           |
| `outfit_model_weights` | Per-user learned bandit weights + metadata                                   |

All per-user tables use the same Row-Level-Security pattern established in
`001_outfit_wears.sql`, so a user can only read and write their own rows.

## Notable implementation details

- **Lazy Supabase client** (`src/lib/supabaseClient.ts`). The client is created on
  first use behind a `Proxy`, not at import time. This prevents Next.js build-time
  prerendering (e.g. on Vercel) from trying to initialize Supabase before env vars
  are available, while callers still `import { supabase }` normally.
- **Single API surface for detection.** `/api/detect-clothing` is the only
  server-side code and the only place the Anthropic key is used, keeping the secret
  off the client.
- **Constants as one source of truth.** Clothing types, sections, color palette,
  and occasion rules all live in `src/lib/constants.ts`; the detection route
  validates Claude's output against these same lists.

## External services

| Service                 | Used for                                     | Where                                      |
| ----------------------- | -------------------------------------------- | ------------------------------------------ |
| Supabase                | Auth, Postgres, Storage                      | `lib/supabaseClient.ts`, hooks, components |
| Anthropic Claude Vision | Clothing type/color detection                | `app/api/detect-clothing/route.ts`         |
| OpenWeatherMap          | Temperature forecast for the weather feature | `lib/weatherApi.ts`                        |
