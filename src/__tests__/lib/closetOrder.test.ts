import { describe, it, expect } from 'vitest';
import { moveItem, positionUpdates, sortForCloset } from '@/lib/closetOrder';

const piece = (
  id: string,
  position: number | null,
  is_dirty = false,
  created_at = '2026-01-01',
) => ({
  id,
  position,
  is_dirty,
  created_at,
});

describe('sortForCloset', () => {
  it("follows the user's order", () => {
    const items = [piece('a', 3), piece('b', 1), piece('c', 2)];
    expect(sortForCloset(items).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('puts dirty pieces at the end, whatever their position', () => {
    const items = [piece('a', 1, true), piece('b', 2), piece('c', 3)];
    expect(sortForCloset(items).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('puts pieces never placed after placed ones, oldest first', () => {
    const items = [
      piece('new', null, false, '2026-03-01'),
      piece('old', null, false, '2026-01-01'),
      piece('placed', 5),
    ];
    expect(sortForCloset(items).map((i) => i.id)).toEqual(['placed', 'old', 'new']);
  });

  it("doesn't change the list it's given", () => {
    const items = [piece('a', 2), piece('b', 1)];
    sortForCloset(items);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('moveItem', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('moves a piece forward or back to where another is', () => {
    expect(moveItem(items, 'a', 'c').map((i) => i.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(items, 'd', 'b').map((i) => i.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('leaves the order alone for a drop in place or an unknown piece', () => {
    expect(moveItem(items, 'b', 'b')).toBe(items);
    expect(moveItem(items, 'x', 'b')).toBe(items);
  });
});

describe('positionUpdates', () => {
  it('numbers the pieces in order, saving only what changed', () => {
    const ordered = [piece('a', 1), piece('c', 3), piece('b', 2), piece('d', null)];
    expect(positionUpdates(ordered)).toEqual([
      { id: 'c', position: 2 },
      { id: 'b', position: 3 },
      { id: 'd', position: 4 },
    ]);
  });
});
