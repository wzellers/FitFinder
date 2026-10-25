# FitFinder

> A smart wardrobe app that learns what you like to wear.

Upload your clothing, set color preferences, and get intelligent outfit suggestions
based on weather, occasion, color harmony, and what you've worn recently. FitFinder
uses Claude Vision to auto-tag each photo and a lightweight, on-device learning model
that adapts to your ratings over time — no ML backend required.

Built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Supabase.

- **Getting started:** jump to [Getting Started](#getting-started)
- **How it works:** see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Contributing:** see [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Features

### Closet Management

- Upload clothing photos organized into Tops, Bottoms, and Shoes
- **Automatic type and color detection** — Claude Vision classifies each uploaded
  photo, and background removal runs on-device so items appear cleanly cut out.
  Detected type and colors are pre-filled and remain editable.
- Track laundry status (clean/dirty) — dirty items are excluded from generation
- Edit an item's type, colors, and laundry status, or delete it anytime

### Smart Outfit Generation

- **Filters first:** only items allowed for today's weather (your local
  forecast and your Settings) and the chosen occasion (Casual, Work, Date,
  Active) are considered. Weather and occasion don't affect ranking.
- **Then ranks** the remaining outfits on three features, with cold-start
  weights:
  - **Color harmony** (50%) — favors your liked color combinations
  - **Variety** (33%) — avoids items worn in the last 14 days
  - **Rating** (17%) — favors pieces from your higher-rated past outfits
- **Learns from your feedback**: a per-user Bayesian contextual bandit learns
  your weights from your ratings (the daily prompt or the Calendar, using the
  outfit as it was the day you wore it) and saved outfits, and picks outfits by
  Thompson sampling, exploring only where it is still unsure. It runs in the
  browser and persists per user in Supabase; before any rating it reproduces
  the fixed-weight scorer (cold start). Old ratings gently fade (60-day
  half-life), so it follows your taste as it changes.
- Keep individual pieces and regenerate around them, or pick a piece by hand
- Save outfits for later or log one as today's wear

### Outfit Calendar

- Visual monthly calendar showing what you wore each day
- Log outfits by picking individual items or loading a saved outfit
- Edit or delete past entries

### Wardrobe Stats

- Item counts by category, clean vs. in the wash, outfits logged, share of the
  closet worn, days between repeats, and average rating
- Most worn and least worn items, color distribution, and best-rated outfits
- Filter by week, month, or all time

### Settings

- **Weather:** your ZIP code, temperature ranges, and which clothing types
  suit each range
- **Occasions:** which clothing types count for Casual, Work, Date and Active
- **Colors:** a library of liked top/bottom color combinations
- **Email:** the daily outfit email (below)

### Daily Outfit Email

- Opt in from Settings → Email and choose a send time in your own time zone
- Each morning: an outfit picked for the day's forecast high (the learning
  model's best pick, weather rules applied), plus clean items you haven't worn
  this week
- One email per day at most; one-click unsubscribe from the email itself
- A Supabase `pg_cron` job calls the app every 15 minutes, and the app sends
  through [Resend](https://resend.com). See
  [Daily outfit email setup](#daily-outfit-email-setup).

### Onboarding

- Guided 3-step setup for new users (ZIP code, first items, finish)
- A prompt to rate yesterday's outfit, which feeds the learning model

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, TypeScript (strict mode), Tailwind CSS 3
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Clothing detection**: Claude Haiku 4.5 vision (`@anthropic-ai/sdk`) via a
  server route; background removal with `@imgly/background-removal`; cropping
  with `react-easy-crop`
- **Icons**: Lucide React
- **Weather**: OpenWeatherMap API
- **Daily email**: Supabase `pg_cron` + `pg_net`, Resend
- **Testing**: Vitest + Testing Library (unit/component), Playwright (e2e)

## Getting Started

### Prerequisites

- Node.js 22 (supabase-js needs its built-in WebSocket)
- npm
- A Supabase project

### Setup

1. Clone the repo

   ```bash
   git clone https://github.com/wzellers/FitFinder.git
   cd FitFinder
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Create a `.env.local` file (see `.env.example` for the full list)

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENWEATHERMAP_API_KEY=your_openweathermap_key
   # Server-side; used by the /api/detect-clothing route for auto-detection
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

4. Set up the Supabase database. Run the migrations in `supabase/migrations/` in
   order (001, 002, …) using the Supabase SQL Editor. They create and evolve the
   full schema:

   - `clothing_items` — wardrobe items (type, colors, photo path, laundry status)
   - `saved_outfits` — saved outfit combinations
   - `outfit_wears` — daily wear log with ratings and occasion
   - `color_preferences` — liked color combinations
   - `weather_preferences`, `occasion_preferences` — per-user rule overrides
   - `profiles` — ZIP code, onboarding state, daily email settings
   - `outfit_model_weights` — persisted per-user contextual-bandit weights

   Before running them, create a `clothing-images` storage bucket in Supabase.
   The migrations make it private and add per-user access policies; the app
   loads photos through short-lived signed URLs.

5. Run the dev server

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

### Daily outfit email setup

Optional. Without it, the Settings → Email tab still saves preferences, but
nothing is sent.

1. Apply migrations `017_daily_email.sql` and `018_daily_email_cron.sql`. 018
   turns on the `pg_cron` and `pg_net` extensions and schedules a job that
   calls `POST /api/email/send-due` every 15 minutes.
2. Create a [Resend](https://resend.com) account and an API key with sending
   access. Until you verify a domain in Resend, mail comes from
   `onboarding@resend.dev` and can only go to your Resend account's own
   address. After verifying one, set `EMAIL_FROM` to send to anyone.
3. Make a random secret for the cron job: `openssl rand -hex 32`.
4. In Vercel → Project → Settings → Environment Variables, add these
   (server-only; never prefix them with `NEXT_PUBLIC_`), then redeploy:

   ```env
   SUPABASE_SERVICE_ROLE_KEY=...  # Supabase → Project Settings → API keys
   RESEND_API_KEY=...
   CRON_SECRET=...                # the secret from step 3
   # optional:
   # EMAIL_FROM=FitFinder <daily@your-domain.com>
   # APP_URL=https://your-domain.com  (links in the email; defaults to the called URL)
   ```

5. In the Supabase SQL Editor, store the route URL and the same secret in
   Vault, where the cron job reads them:

   ```sql
   select vault.create_secret('https://<your-app>/api/email/send-due', 'daily_email_url');
   select vault.create_secret('<the secret from step 3>', 'daily_email_cron_secret');
   ```

To test, turn the email on in Settings → Email with the time a few minutes
ahead; it arrives on the next run after that time. To send again the same
day, clear the claim in the SQL Editor:
`update profiles set daily_email_last_sent = null where id = '<your user id>';`.
Recent runs are in `cron.job_run_details`, and the route's responses (a
`{ optedIn, due, sent, failed }` summary) in `net._http_response`.

## Project Structure

```
src/
  app/
    page.tsx              # The whole signed-in app: tabs, modals, rating prompt
    layout.tsx            # Root layout: fonts, ToastProvider
    icon.svg              # Favicon
    api/
      detect-clothing/    # Claude Vision type/color detection (signed-in users)
      weather/            # OpenWeatherMap proxy, keeps the key server-side
      email/send-due/     # Sends due daily emails (called by pg_cron)
      email/unsubscribe/  # Unsubscribe link target (no sign-in)
  components/
    AuthForm.tsx          # Log in / create account
    Closet.tsx            # Wardrobe by section, filters, laundry
    ImageUpload.tsx       # Add items: detect, crop, remove background, upload
    EditItem.tsx          # Edit or delete an item
    OutfitGenerator.tsx   # Generate, keep, pick, save and wear outfits
    OutfitCalendar.tsx    # Monthly wear log
    WardrobeStats.tsx     # Stats by week / month / all time
    ColorPreferences.tsx  # Settings: weather, occasions, colors, email
    ColorCombinationModal.tsx
    DailyEmailSettings.tsx
    Onboarding.tsx        # First-run setup
    RatingPrompt.tsx      # Rate yesterday's outfit
    OutfitTheme.tsx       # Restyles the app from today's outfit colors
    ToastProvider.tsx
    ui/                   # Primitives: Modal, ConfirmDialog, PillNav,
                          # PosterHeader, ClothingImage, SlotReel, Skeleton, ...
  hooks/useAuth.ts        # Supabase auth state
  lib/
    outfitScoring.ts      # Feature vector and fixed-weight scorer
    banditModel.ts        # Contextual-bandit learning model
    uploadPipeline.ts     # Detection, image prep and upload orchestration
    imageColor.ts         # Local dominant-color detection
    imageCrop.ts          # Crop to a PNG blob
    clothingImages.ts     # Storage paths and batched signed URLs
    weatherApi.ts         # Client weather fetch, caching, weather rules
    weatherProvider.ts    # Server-side OpenWeatherMap calls
    occasionRules.ts      # Per-occasion clothing-type rules
    dailyEmail/           # Daily email: schedule, digest, render, sender, Resend
    serverAuth.ts         # Verify the signed-in user in API routes
    supabaseClient.ts     # Lazy browser Supabase client
    supabaseResult.ts     # Throw on Supabase errors
    colorUtils.ts, itemLabels.ts, outfitTheme.ts, dates.ts
    constants.ts          # Clothing types, palette, occasions (single source)
    types.ts              # Shared interfaces
  styles/globals.css      # Tailwind layers, CSS variables, component classes
  __tests__/              # Mirrors src/: lib, components, api, hooks, app, plus
                          # e2e/ (Playwright specs, fixtures, helpers)
supabase/migrations/      # Numbered SQL migrations (schema source of truth)
scripts/measureVision.mjs # Detection latency/accuracy measurement
docs/                     # HANDOFF.md (current state), ARCHITECTURE.md
```

## Scripts

- `npm run dev` — start development server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — run ESLint
- `npm run lint:fix` — run ESLint and apply autofixes
- `npm run format` — format the codebase with Prettier
- `npm run format:check` — verify formatting without writing
- `npm run typecheck` — type-check with `tsc --noEmit`
- `npm run test` — run unit/component tests (Vitest)
- `npm run test:watch` — run Vitest in watch mode
- `npm run test:coverage` — run tests with a coverage report
- `npm run test:e2e` — run end-to-end tests (Playwright)
- `npm run bench:bandit` — run the full bandit benchmark (~10 min); see
  `docs/BANDIT_BENCHMARK.md`
- `npm run test:e2e:ui` — run Playwright tests in UI mode

### End-to-end tests

The Playwright suite drives the real app in a browser (desktop and a phone),
against the real Supabase project, Claude and OpenWeatherMap. A green run means
sign-in, the closet (with private photos), outfit generation, the calendar,
stats, settings, onboarding, the rating prompt, the daily email settings and
unsubscribe, and the server routes all work. Any error the page logs fails the
test that caused it.

1. Create a **dedicated** account in the app with an email you don't use for
   FitFinder. Every run deletes and re-seeds that account's closet, so never
   use a real account.
2. Put its details in `.env.e2e` (git-ignored). The last line confirms the
   wipe; the suite refuses to run without it:

   ```env
   E2E_TEST_EMAIL=second-address@example.com
   E2E_TEST_PASSWORD=...
   E2E_WIPES_THIS_ACCOUNT=yes
   ```

3. Make sure `.env.local` has working `ANTHROPIC_API_KEY` and
   `OPENWEATHERMAP_API_KEY` values, then run `npm run test:e2e`. It starts a
   dev server on port 3100.

To test a deployed site instead, set `E2E_BASE_URL=https://your-app` (no dev
server is started). Each run makes one small Claude call (well under a cent).

CI runs the suite on every pull request and push to `main` (the "End-to-end
tests" job), against a production build, with the test account and API keys
from the repository's Actions secrets.

### Measurement tools

Reproducible experiments used during development:

- `src/__tests__/banditConvergence.sim.test.ts` — simulates synthetic users to
  measure how quickly the learning model converges to a user's true preferences.
  It prints a convergence histogram and runs as part of `npm run test`; run it
  alone with `npx vitest run src/__tests__/banditConvergence.sim.test.ts`.
- `src/__tests__/bandit/` — the bandit benchmark: simulated users with realistic
  closets and weather compare ways of learning taste (`npm run bench:bandit`).
  Method and findings in [`docs/BANDIT_BENCHMARK.md`](docs/BANDIT_BENCHMARK.md).
- `scripts/measureVision.mjs` — measures the Claude Vision clothing-detection
  route on your own photos (latency, plus accuracy if you add labels). It
  signs in with the `.env.e2e` account; see the file's header.

## Documentation

- [`docs/HANDOFF.md`](docs/HANDOFF.md) — the current state of the project: what's live,
  infrastructure, tests, decisions and open items. Kept up to date with every PR.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the outfit scorer, the
  contextual-bandit learning loop, the upload pipeline, and the data model fit together.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local setup, branch/PR workflow, and coding conventions.

## License

Released under the [MIT License](LICENSE).
