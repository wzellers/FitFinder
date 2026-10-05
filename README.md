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

- Candidates are filtered by weather, then scored by a linear model over five
  features whose cold-start weights are:
  - **Color harmony** (30%) — favors your liked color combinations
  - **Weather** (25%) — filters by temperature using your local forecast
  - **Variety** (20%) — avoids items worn in the last 14 days
  - **Occasion** (15%) — matches clothing types to Casual, Work, Date, or Active
  - **Rating** (10%) — favors pieces from your higher-rated past outfits
- **Learns from your feedback**: a client-side contextual bandit updates the
  feature weights online from your ratings and wear history using ε-greedy
  explore/exploit. Learned weights persist per user in Supabase; before any
  rating it reproduces the fixed-weight scorer (cold start).
- Lock individual pieces and regenerate around them
- Cycle through the top scored results
- Save outfits for later or log them as today's wear

### Outfit Calendar

- Visual monthly calendar showing what you wore each day
- Log outfits by picking individual items or loading a saved outfit
- Edit or delete past entries

### Wardrobe Stats

- Overview of total items, wear count, clean/dirty breakdown
- Category distribution bars
- Most worn and neglected items
- Color distribution across your wardrobe
- Average outfit rating and top-rated outfits
- Filter stats by week, month, or all time

### Color Preferences

- Set your zip code for weather-aware outfit suggestions
- Build a library of liked color combinations
- Visual color pairing interface with your actual wardrobe colors

### Onboarding

- Guided 3-step setup for new users (zip code, first items, finish)
- Rating prompt for yesterday's outfit on each visit

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, TypeScript (strict mode), Tailwind CSS 3
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Clothing detection**: Claude Haiku 4.5 vision via a server route, served
  either by the Anthropic API (`@anthropic-ai/sdk`) or Amazon Bedrock
  (`@anthropic-ai/bedrock-sdk`, SigV4-signed, IAM-scoped); background removal
  with `@imgly/background-removal`; cropping with `react-easy-crop`
- **Icons**: Lucide React
- **Weather**: OpenWeatherMap API
- **Testing**: Vitest + Testing Library (unit/component), Playwright (e2e)

## Getting Started

### Prerequisites

- Node.js 18+
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

   To run detection on Amazon Bedrock instead, see
   [Clothing detection on Amazon Bedrock](#clothing-detection-on-amazon-bedrock).

4. Set up the Supabase database. Run the migrations in `supabase/migrations/` in
   order (001, 002, …) using the Supabase SQL Editor. They create and evolve the
   full schema:

   - `clothing_items` — wardrobe items (type, colors, image, laundry status)
   - `saved_outfits` — saved outfit combinations
   - `color_preferences` — liked color combinations per user
   - `outfit_wears` — daily wear log with ratings and occasion
   - `profiles` — zip code and onboarding state
   - `outfit_model_weights` — persisted per-user contextual-bandit weights

   Then create a private `clothing-images` storage bucket in Supabase; the
   migrations add its per-user access policies, and the app loads photos
   through short-lived signed URLs.

5. Run the dev server

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

### Clothing detection on Amazon Bedrock

The `/api/detect-clothing` route calls Claude Haiku 4.5 through
`src/lib/claudeClient.ts`, which picks the provider from the environment. The
default is the Anthropic API (`ANTHROPIC_API_KEY`). To serve it from Amazon
Bedrock instead:

1. Make sure the AWS account can use Anthropic models: it must be on a paid
   plan (the Free plan can't use third-party Marketplace models), and the
   one-time Anthropic use-case form in the Bedrock console must be submitted.
   A quick check is sending a message to Claude Haiku 4.5 in the Bedrock
   Playground in your region.
2. Create an IAM user (or a role, if you federate Vercel into AWS) with an
   access key and only this permission. Bedrock authorizes Claude requests
   against the account's default Bedrock project, not the model:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "bedrock-mantle:CreateInference",
         "Resource": "arn:aws:bedrock-mantle:<region>:<account-id>:project/default"
       }
     ]
   }
   ```

3. Set these environment variables (in `.env.local`, and in Vercel's project
   settings for production). Vercel reserves the standard `AWS_*` names, so the
   app reads `BEDROCK_AWS_*` instead:

   ```env
   CLAUDE_PROVIDER=bedrock
   BEDROCK_AWS_REGION=us-east-1
   BEDROCK_AWS_ACCESS_KEY_ID=...
   BEDROCK_AWS_SECRET_ACCESS_KEY=...
   # optional: BEDROCK_AWS_SESSION_TOKEN for temporary credentials,
   # BEDROCK_MODEL_ID to use a different model (default anthropic.claude-haiku-4-5)
   ```

   Locally you can leave the key variables unset; the SDK then uses your
   standard AWS credentials (`~/.aws`, SSO, `AWS_PROFILE`).

Requests are SigV4-signed to `bedrock-mantle.{region}.api.aws` and show up in
CloudWatch and CloudTrail. Remove `CLAUDE_PROVIDER` to switch back.

## Project Structure

```
src/
  app/
    api/detect-clothing/route.ts # Server route: Claude Vision type/color detection
    layout.tsx          # Root layout with custom fonts and ToastProvider
    page.tsx            # Main page with tab navigation and modal management
  components/
    AuthForm.tsx        # Login / signup form
    Closet.tsx          # Wardrobe grid with section filters
    ColorPreferences.tsx # Color combo builder + zip code settings
    ColorCombinationModal.tsx # Modal for editing color pairings
    EditItem.tsx        # Edit item type, colors, and laundry status
    ImageUpload.tsx     # Upload new items (detect, crop, background removal)
    Onboarding.tsx      # New user guided setup
    OutfitCalendar.tsx  # Monthly calendar with outfit logging
    OutfitGenerator.tsx # Outfit generation + saved outfits
    RatingPrompt.tsx    # Rate yesterday's outfit modal
    ToastProvider.tsx   # Toast notification system
    WardrobeStats.tsx   # Wardrobe analytics dashboard
    ui/ConfirmDialog.tsx # Reusable confirm/cancel dialog
    ui/ImageCropper.tsx  # Crop UI used during upload review
    ui/Skeleton.tsx      # Loading skeleton components
  hooks/
    useAuth.ts          # Supabase auth state hook
  lib/
    banditModel.ts      # Contextual-bandit online learning model
    colorUtils.ts       # Color display helpers
    constants.ts        # Shared constants (types, palettes, occasion rules)
    imageColor.ts       # Local dominant-color detection
    imageCrop.ts        # Crop an image region to a PNG blob
    occasionRules.ts    # Per-occasion clothing-type rules
    outfitScoring.ts    # Weighted outfit scoring engine (bandit cold-start priors)
    supabaseClient.ts   # Supabase client instance
    types.ts            # TypeScript interfaces and weather rules
    uploadPipeline.ts   # Detect + background-removal + upload orchestration
    weatherApi.ts       # OpenWeatherMap integration with caching
  styles/
    globals.css         # Tailwind directives + CSS custom properties + component classes
  __tests__/            # Vitest unit/component tests and Playwright e2e specs
supabase/migrations/    # Ordered SQL migrations (schema source of truth)
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
- `npm run test:e2e:ui` — run Playwright tests in UI mode

### Measurement tools

Reproducible experiments used during development:

- `src/__tests__/banditConvergence.sim.test.ts` — simulates synthetic users to
  measure how quickly the learning model converges to a user's true preferences.
  It prints a convergence histogram and runs as part of `npm run test`; run it
  alone with `npx vitest run src/__tests__/banditConvergence.sim.test.ts`.
- `scripts/measureVision.mjs` — measures the Claude Vision clothing-detection
  route against sample images.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the outfit scorer, the
  contextual-bandit learning loop, the upload pipeline, and the data model fit together.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local setup, branch/PR workflow, and coding conventions.

## License

Released under the [MIT License](LICENSE).
