# FitFinder: notes for Claude

Next.js 15 (App Router) + React 19 + Tailwind + Supabase, deployed on Vercel.
See `README.md` for setup and `docs/ARCHITECTURE.md` for how it fits together.

## Start here: the handoff

The current state of the project (what's live, infrastructure, tests, decisions,
open items) is in `docs/HANDOFF.md`, imported below so every session starts up
to date. Trust it over memory or older notes, and check the code when they
disagree.

@docs/HANDOFF.md

## Keep the handoff current

`docs/HANDOFF.md` must always describe the project as it is right now:

- Update it **in the same PR** as any change that makes it wrong: a new
  feature, a removed one, a migration applied, an env var or secret added,
  infrastructure or CI changed, a decision made, an open item done or found.
- Before finishing a session, re-read it and fix anything this session changed,
  including work that's still unmerged or waiting on the user.
- Keep it short and current: replace outdated lines rather than appending a
  log, delete open items once they're done, and bump **Last updated**.
- Never put secret values, passwords or personal account details in it; the
  repo is public. Names of env vars and secrets are fine.

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

This applies to every future change, in every session: don't consider a
feature done, or open its PR, until its tests exist and pass.

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
