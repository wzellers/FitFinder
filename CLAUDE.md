# FitFinder: notes for Claude

Next.js 15 (App Router) + React 19 + Tailwind + Supabase, deployed on Vercel.
See `README.md` for setup and `docs/ARCHITECTURE.md` for how it fits together.

## Every change ships with tests

A feature or fix isn't done until tests cover it, in the same PR:

- **Logic** (`src/lib`, API routes): Vitest unit tests in `src/__tests__/lib` or
  `src/__tests__/api`.
- **UI** (`src/components`): a component test in `src/__tests__/components` for
  its states and interactions.
- **Anything a user can do** (a new screen, button, flow or setting): an
  end-to-end test in `src/__tests__/e2e`, written against what the user sees
  (`getByRole` / `getByLabel`, not CSS classes). Extend the spec for that area,
  or add one. Seed data through `helpers/db.ts`, use the shared `test` from
  `helpers/test.ts`, and assert the result persists (reload, or read the row).
- **Bug fixes**: first a test that fails because of the bug, then the fix.

When a change removes or renames something a test relies on, update the test in
the same PR rather than deleting it.

## Before every commit

```bash
npx prettier --check . && npx tsc --noEmit && npm run lint && npx vitest run
```

and, for anything user-facing, `npm run test:e2e` (needs `.env.e2e`; see README →
End-to-end tests). CI runs all of these on every PR, and `main` requires them to
pass.

## Ground rules

- Don't change the database (migrations, data, settings) unless the user says
  so. Schema changes go in a new numbered file in `supabase/migrations/`.
- Never print or paste secrets. Check whether an env var is set, not its value.
- Work on a branch, one logical change per commit. PRs use the merge-commit
  method with auto-merge on.
