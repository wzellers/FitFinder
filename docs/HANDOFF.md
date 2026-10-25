# Handoff: current state of FitFinder

The living status doc. `CLAUDE.md` imports it, so every Claude Code session
starts from here. It describes how things are **now**; history lives in git.
Update it in the same PR as any change that makes it wrong (see `CLAUDE.md`).
Never put secret values or personal account details here: the repo is public.

**Last updated:** 2026-10-25 (rate outfits without wearing)

## What's live

Production is `main`, deployed by Vercel on every push.

Node 22 is required (`engines` in package.json; CI uses it too): supabase-js 2.118
needs Node's built-in WebSocket, so clients fail to start on Node 20.

- **App:** the burgundy/sky redesign (pill nav, poster headers, slot-reel
  outfits). Closet, outfit generator (weather and occasion filter; a per-user Bayesian bandit ranks on color, variety and rating, by Thompson sampling, `MODEL_VERSION` 3),
  calendar, stats, settings (weather, occasions, colors, email), onboarding,
  rating prompt.
- **Clothing detection:** Claude Haiku 4.5 through the Anthropic API
  (`/api/detect-clothing`, signed-in users only). Amazon Bedrock was tried and
  removed. Don't reintroduce it unless asked.
- **Weather:** OpenWeatherMap through `/api/weather` (server-side key).
- **Photos:** private `clothing-images` bucket, loaded through signed URLs.
  `clothing_items.image_url` holds the storage path.
- **Daily outfit email:** a Supabase `pg_cron` job (`send-daily-emails`, every
  15 min) calls `POST /api/email/send-due` with `CRON_SECRET`; the route sends
  through Resend. The URL and secret are in Supabase Vault (`daily_email_url`,
  `daily_email_cron_secret`). The earlier AWS (CDK/Lambda/SES) version was
  removed.

## Infrastructure

- **Supabase:** project `tbpxmszuuuuvastknqpw`, free plan. Migrations
  `001`–`021` are all applied. Vault holds the two daily-email secrets.
- **Vercel env vars (production):** `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`,
  `OPENWEATHERMAP_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
  `CRON_SECRET`. Optional: `EMAIL_FROM`, `APP_URL`.
- **Resend:** no verified domain yet, so mail comes from `onboarding@resend.dev`
  and only reaches the Resend account owner's address.
- **GitHub:** `main` is protected. It requires the **Lint, typecheck & test** and
  **End-to-end tests** checks, and blocks force pushes and deletion. Auto-merge
  is allowed; PRs use the merge-commit method with auto-merge on.
- **Actions secrets:** `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`,
  `OPENWEATHERMAP_API_KEY`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.

## Tests

- **Vitest:** 324 unit/component tests (`npm run test`).
- **Playwright:** 43 end-to-end tests (`npm run test:e2e`), desktop and Pixel 7.
  They run against the real Supabase project, Claude and OpenWeatherMap, using
  a dedicated test account that every run wipes and re-seeds. Locally they need
  `.env.e2e` (git-ignored, see README). In CI they use the Actions secrets and a
  production build; runs are serialized.
- Don't use the test account in a browser for anything real: every CI run wipes
  its data, and the sign-out test ends all of its sessions.
- Claude can't run the end-to-end suite itself (it signs in with a password),
  so the user runs `npm run test:e2e` and Claude reads the terminal output.

## Decisions to keep

- Database changes (migrations, data, settings) only with the user's explicit
  OK.
- Claude's permission settings currently block database writes through the
  Supabase tools (even inside a rolled-back transaction). The user runs
  migrations in the Supabase SQL Editor; Claude prepares the file and verifies
  the result with read-only queries afterwards.
- Ignore two Supabase warnings that need a paid plan: leaked password
  protection, and the Postgres upgrade.
- Expected advisor warnings: `unsubscribe_daily_email` is callable by
  anon/authenticated as `SECURITY DEFINER`. The random token is the
  authorization, and it can only turn the email off.
- Sign-out uses Supabase's default global scope (ends every session), which
  is why the E2E sign-out test runs last.

## Open items

- **Bandit upgrade:** steps 1–3 are done (benchmark, Thompson sampling,
  learning from the worn outfit's real features and Calendar ratings);
  weather and occasion are filters only (`MODEL_VERSION` 3); old ratings fade
  with a 60-day half-life; outfits can be rated without wearing them (Outfits
  tab, `outfit_ratings`, counted like worn ratings). A rating-heavy cold start
  looked better for weeks 2–4 in the benchmark; worth trying. Ratings from
  before step 3 aren't retro-trained.
- Verify a domain in Resend and set `EMAIL_FROM` to email users other than the
  owner.
- Nothing automatically checks that a PR _adds_ tests; the rule lives in
  `CLAUDE.md` and `CONTRIBUTING.md`.
- An orphaned photo from deleted test data remains in storage (harmless,
  private).
- Next.js warns about multiple lockfiles when run from a git worktree.
  Harmless.
