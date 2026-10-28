import { describe, it, expect } from 'vitest';
import { findLookalike } from '@/lib/lookalike';

const closet = [
  { id: 'a', type: 'Button-Up Shirt', colors: ['navy blue', 'white'] },
  { id: 'b', type: 'T-Shirt', colors: ['red'] },
];

describe('findLookalike', () => {
  it('finds an item with the same type and main colour', () => {
    expect(findLookalike('Button-Up Shirt', 'navy blue', closet)?.id).toBe('a');
  });

  it('ignores a match on type or colour alone, or a second colour', () => {
    expect(findLookalike('Button-Up Shirt', 'red', closet)).toBeUndefined();
    expect(findLookalike('Hoodie', 'navy blue', closet)).toBeUndefined();
    expect(findLookalike('Button-Up Shirt', 'white', closet)).toBeUndefined();
  });

  it('says nothing until the type and colour are known', () => {
    expect(findLookalike('', 'red', closet)).toBeUndefined();
    expect(findLookalike('T-Shirt', null, closet)).toBeUndefined();
  });
});
