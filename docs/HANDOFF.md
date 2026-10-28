# Handoff: current state of FitFinder

The living status doc. `CLAUDE.md` imports it, so every Claude Code session
starts from here. It describes how things are **now**; history lives in git.
Update it in the same PR as any change that makes it wrong (see `CLAUDE.md`).
Never put secret values or personal account details here: the repo is public.

**Last updated:** 2026-10-28 (fog & slate neutral theme, weather fixes)

## What's live

Production is `main`, deployed by Vercel on every push.

Node 22 is required (`engines` in package.json; CI uses it too): supabase-js 2.118
needs Node's built-in WebSocket, so clients fail to start on Node 20.

- **App:** pill nav, poster headers, slot-reel outfits. Fog & slate
  (cool grey-white page, misty blue-grey surfaces, slate ink and accent)
  until an outfit is generated; then the whole app takes its colours (`themeFromOutfit`): the
  banner is the top's colour with the bottom's for its title and cutout and a
  touch of the shoes'; the accent (buttons, links, selected states, nav,
  rating glow) is the top's colour, or the bottom's when the top is white,
  deepened to stay readable. Shared UI: `ModalHeader` for dialogs,
  `Dropdown` instead of native selects, `SettingsCard`, `.toggle-pill`. The
  clock is 12-hour; clicking it switches to 24-hour.
- **Settings:** sections in a tab bar across the top; weather rules as
  Cold/Cool/Warm/Hot chips per type; occasions edited one at a time; colour
  pairings from two swatch rows.
- **Stats:** highlights (streak, go-to pairing, busiest day, repeats),
  weekday and category-use charts (`lib/stats.ts`); Customize chooses which
  cards show (kept in `localStorage`).
- **Daily email:** coloured from the outfit it recommends; the unsubscribe
  page uses the neutral colours. Closet, outfit generator (weather and occasion filter; a per-user
  Bayesian bandit ranks on color, variety and rating, by Thompson sampling,
  `MODEL_VERSION` 3), calendar, stats, settings (weather, occasions, colors,
  email), onboarding, rating prompt.
- **Outfits screen:** a slim header; the outfit centred as a vertical stack
  (top, bottom, shoes) with Try another under it; occasion and weather to its
  left; Save, Wear today, Share and rating to its right (below it on phones).
  A rated outfit stays on screen with its rating until Try another.
  Reels spin top to bottom; one piece can be swapped with its arrows or a
  sideways swipe, sliding the way the user pointed. The screen takes today's
  outfit colours (a background wash, the button accent and a palette strip;
  registered CSS properties fade between outfits) and shows the weather
  behind it (`WeatherBackdrop`: a sky tint plus sun or stars, clouds, rain
  or snow, seen through the screen's frosted cards). Coming back to the tab
  re-reads the ZIP code and weather settings. Pointing at a rating warms the
  outfit's glow; Wear today stamps the pieces into a calendar tile; Share
  draws a PNG card (`lib/shareCard.ts`), shared on phones and downloaded on
  desktop.
- **Adding clothes:** drop photos on the Closet screen or paste them; a scan
  line runs while Claude analyses each, results show as chips, backgrounds
  are removed automatically (a remembered switch turns it off; a slider
  compares with the original), a lookalike note warns about likely
  duplicates, and new pieces get a short highlight in the grid. Opening a
  closet item morphs its photo into the edit dialog (View Transitions).
- **Clothing detection:** Claude Haiku 4.5 through the Anthropic API
  (`/api/detect-clothing`, signed-in users only). Amazon Bedrock was tried and
  removed. Don't reintroduce it unless asked.
- **Weather:** OpenWeatherMap through `/api/weather` (server-side key).
- **Photos:** private `clothing-images` bucket, loaded through signed URLs.
  `clothing_items.image_url` holds the storage path.
- **Daily outfit email:** a Supabase `pg_cron` job (`send-daily-emails`, every
  15 min) calls `POST /api/email/send-due` with `CRON_SECRET`; the route sends
  through Resend. The URL and secret are in Supabase Vault (`daily_email_url`,
  `daily_email_cron_secret`). The URL must be the app's primary domain
  (`https://fitfinder.website/api/email/send-due`): the `vercel.app` address
  redirects there, and the redirect drops the secret, so the route rejects
  the call with a 401. Each run's reply is in `net._http_response`. The
  earlier AWS (CDK/Lambda/SES) version was removed.

## Infrastructure

- **Supabase:** project `tbpxmszuuuuvastknqpw`, free plan. Migrations
  `001`–`022` are all applied. Vault holds the two daily-email secrets.
- **Vercel env vars (production):** `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`,
  `OPENWEATHERMAP_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
  `CRON_SECRET`, `EMAIL_FROM`, `APP_URL` (`https://fitfinder.website`, used
  for links in the email).
- **Domain:** `fitfinder.website`, bought through Vercel and on Vercel DNS.
  It's the app's primary domain; `fit-finder-blush.vercel.app` and `www`
  redirect to it.
- **Resend:** `mail.fitfinder.website` is verified (DKIM and SPF records on
  Vercel DNS), and `EMAIL_FROM` sends from it, so the daily email reaches any
  user.
- **GitHub:** `main` is protected. It requires the **Lint, typecheck & test** and
  **End-to-end tests** checks, and blocks force pushes and deletion. Auto-merge
  is allowed; PRs use the merge-commit method with auto-merge on. The
  **Lint, typecheck & test** check also fails a PR that changes code under
  `src/` without changing a test (`scripts/checkTestsAdded.mjs`); the
  `no-tests-needed` label skips that step.
- **Actions secrets:** `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`,
  `OPENWEATHERMAP_API_KEY`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.

## Tests

- **Vitest:** 480 unit/component tests (`npm run test`).
- **Playwright:** 52 end-to-end tests (`npm run test:e2e`), desktop and Pixel 7.
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
  tab, `outfit_ratings`, counted like worn ratings); the rating feature is per
  item and picking explores untried pieces, the generator doesn't repeat an
  outfit until all have been shown, and ties break at random (the daily email
  rotates ties by date); cold-start weights are rating-heavy (color / variety
  / rating 0.25 / 0.25 / 0.5); "Try another" is learned as a weak negative.
  Four ratings from before step 3 were never learned; checked 2026-10-27 and
  not worth replaying (only one has all three pieces, and it's from April, so
  fading would leave it about a tenth of a rating's weight).
- **Measuring recommendations:** the generator logs every outfit it shows
  and what happened (`outfit_impressions`). After a few weeks of real use, run
  `select * from recommendation_quality order by user_id, week;` in the SQL
  Editor: if learning works, skip rate falls and ratings rise over the weeks.
