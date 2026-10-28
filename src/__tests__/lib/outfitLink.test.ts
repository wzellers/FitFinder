import { describe, it, expect } from 'vitest';
import { outfitLink, parseOutfitLink } from '@/lib/outfitLink';

describe('outfitLink', () => {
  const outfit = { top: { id: 't-1' }, bottom: { id: 'b-2' }, shoes: { id: 's-3' } };

  it("puts the outfit's pieces in the app link", () => {
    expect(outfitLink('https://fitfinder.website', outfit)).toBe(
      'https://fitfinder.website/?top=t-1&bottom=b-2&shoes=s-3',
    );
  });

  it('reads the outfit back from the link', () => {
    const url = new URL(outfitLink('https://fitfinder.website', outfit));
    expect(parseOutfitLink(url.search)).toEqual({
      top_id: 't-1',
      bottom_id: 'b-2',
      shoes_id: 's-3',
    });
  });

  it('ignores links without a whole outfit', () => {
    expect(parseOutfitLink('')).toBeNull();
    expect(parseOutfitLink('?top=t-1&bottom=b-2')).toBeNull();
  });
});
