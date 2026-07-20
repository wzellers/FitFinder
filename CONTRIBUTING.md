# Contributing to FitFinder

Thanks for your interest in improving FitFinder! This guide covers how to get a
local environment running, the day-to-day development workflow, and the
conventions the codebase follows.

## Getting set up

See the [Getting Started](README.md#getting-started) section of the README for
the full setup (Node.js 18+, environment variables, Supabase migrations, and a
`clothing-images` storage bucket). In short:

```bash
git clone https://github.com/wzellers/FitFinder.git
cd FitFinder
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

The app runs at http://localhost:3000.

## Development workflow

1. **Create a branch** off `main`:

   ```bash
   git checkout -b feature/short-description
   ```

   Use a short, descriptive name (`feature/…`, `fix/…`, or `chore/…`).

2. **Make your change.** Keep pull requests focused — one logical change per PR is
   much easier to review than a large mixed one.

3. **Run the checks locally** before pushing. These are the same checks CI runs:

   ```bash
   npm run format:check   # Prettier formatting
   npm run lint           # ESLint (next/core-web-vitals + TypeScript rules)
   npm run typecheck      # TypeScript, strict mode
   npm run test           # Vitest unit + component tests
   ```

   To auto-fix formatting and lint issues:

   ```bash
   npm run format         # rewrite files with Prettier
   npm run lint:fix       # apply ESLint autofixes
   ```

   For UI-affecting changes, also run the end-to-end suite:

   ```bash
   npm run test:e2e
   ```

4. **Open a pull request** against `main`. Fill in the PR template describing what
   changed and why, and note anything a reviewer should watch out for (e.g. a new
   migration that must be run manually).

## Database changes

The SQL files in [`supabase/migrations/`](supabase/migrations/) are the source of
truth for the schema. If your change needs a schema update:

- Add a **new** migration file with the next number in sequence
  (e.g. `012_add_something.sql`). Never edit an existing migration — they are
  treated as immutable history.
- Follow the existing per-user Row-Level-Security pattern (see
  `001_outfit_wears.sql`).
- Call out in your PR that the migration must be run in the Supabase SQL editor.

## Coding conventions

- **TypeScript, strict mode.** Avoid `any`; prefer the shared interfaces in
  `src/lib/types.ts`.
- **Imports** use the `@/` alias for anything under `src/`
  (e.g. `import { supabase } from '@/lib/supabaseClient'`).
- **Keep `src/lib` modules pure and focused.** Business logic (scoring, the bandit,
  weather rules) lives in `src/lib` with no React or Supabase coupling where
  possible, which keeps it easy to unit-test. UI wiring stays in components.
- **Constants** (clothing types, colors, occasion rules) live in
  `src/lib/constants.ts` — the single source of truth. Don't duplicate them.
- **Tests** live in `src/__tests__/`, mirroring the source tree
  (`lib/`, `components/`, `hooks/`, `api/`, with `e2e/` for Playwright specs).
  Add or update tests alongside your change. New `src/lib` logic should ship with
  unit tests.

## Tests and coverage

- Unit/component tests run on `jsdom` via Vitest; Supabase and hooks are mocked
  (`src/__tests__/mocks/`), and fixtures live in `src/__tests__/factories/`.
- Coverage thresholds are enforced in `vitest.config.ts`. If you add logic to a
  module with a high threshold (e.g. `outfitScoring.ts`, `weatherApi.ts`), keep it
  covered.
- The `*.sim.test.ts` files are **measurement experiments** that print statistics
  (e.g. bandit convergence). They run as part of the normal suite and also assert a
  loose bound, so keep them green if you touch the learning model.

## Reporting bugs and requesting features

Please open an issue using the templates in
[`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE). Include repro steps for bugs
and the motivating use case for feature requests.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
