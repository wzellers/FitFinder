import { describe, expect, it } from 'vitest';
import { checkTestsAdded, isAppCode, isTest } from '../../../scripts/checkTestsAdded.mjs';

describe('checkTestsAdded', () => {
  it('fails app code changed without a test', () => {
    const result = checkTestsAdded(['src/lib/outfitScoring.ts', 'docs/HANDOFF.md']);
    expect(result.ok).toBe(false);
    expect(result.appCode).toEqual(['src/lib/outfitScoring.ts']);
  });

  it('passes app code changed with a test', () => {
    expect(
      checkTestsAdded(['src/components/Closet.tsx', 'src/__tests__/components/Closet.test.tsx']).ok,
    ).toBe(true);
  });

  it('counts end-to-end specs and test helpers as tests', () => {
    expect(isTest('src/__tests__/e2e/outfits.spec.ts')).toBe(true);
    expect(isTest('src/__tests__/e2e/helpers/db.ts')).toBe(true);
    expect(checkTestsAdded(['src/app/page.tsx', 'src/__tests__/e2e/helpers/db.ts']).ok).toBe(true);
  });

  it('passes PRs that change no app code', () => {
    expect(
      checkTestsAdded([
        'docs/HANDOFF.md',
        'README.md',
        '.github/workflows/ci.yml',
        'package.json',
        'supabase/migrations/023_example.sql',
        'scripts/measureVision.mjs',
      ]).ok,
    ).toBe(true);
    expect(checkTestsAdded([]).ok).toBe(true);
  });

  it("doesn't count type declarations, styles or Markdown under src as app code", () => {
    expect(isAppCode('src/types/global.d.ts')).toBe(false);
    expect(isAppCode('src/app/globals.css')).toBe(false);
    expect(isAppCode('src/lib/README.md')).toBe(false);
    expect(isAppCode('src/app/api/weather/route.ts')).toBe(true);
  });
});
