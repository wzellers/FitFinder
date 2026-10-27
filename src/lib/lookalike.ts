// "Looks like your navy Oxford shirt": a gentle duplicate check when adding
// an item, by type and main colour (photos aren't compared).

import type { ClothingItem } from '@/lib/types';

type Comparable = Pick<ClothingItem, 'id' | 'type' | 'colors'>;

/** An item already in the closet with the same type and main colour, if any. */
export function findLookalike<T extends Comparable>(
  type: string,
  mainColor: string | null,
  closet: T[],
): T | undefined {
  if (!type || !mainColor) return undefined;
  return closet.find((item) => item.type === type && item.colors[0] === mainColor);
}
