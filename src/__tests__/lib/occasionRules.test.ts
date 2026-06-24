import { describe, it, expect } from 'vitest';
import { getUserOccasionRules } from '@/lib/occasionRules';
import { occasionRules as defaultOccasionRules } from '@/lib/constants';

describe('getUserOccasionRules', () => {
  it('returns the defaults when given null', () => {
    expect(getUserOccasionRules(null)).toBe(defaultOccasionRules);
  });

  it('returns the defaults when given undefined', () => {
    expect(getUserOccasionRules(undefined)).toBe(defaultOccasionRules);
  });

  it('merges user overrides over the defaults', () => {
    const userRules = {
      Work: { tops: ['T-Shirt'], bottoms: ['Shorts'], shoes: ['Shoes'] },
    };
    const merged = getUserOccasionRules(userRules);

    // Overridden occasion uses the user's rule.
    expect(merged.Work).toEqual(userRules.Work);
    // Untouched occasions fall back to defaults.
    expect(merged.Casual).toEqual(defaultOccasionRules.Casual);
  });

  it('does not mutate the defaults', () => {
    const before = JSON.stringify(defaultOccasionRules);
    getUserOccasionRules({ Work: { tops: [], bottoms: [], shoes: [] } });
    expect(JSON.stringify(defaultOccasionRules)).toBe(before);
  });
});
