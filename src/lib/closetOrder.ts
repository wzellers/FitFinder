// The order of pieces within each clothing type in the closet: the user's
// own order (set by dragging), with dirty pieces always at the end.

import type { ClothingItem } from '@/lib/types';

type Ordered = Pick<ClothingItem, 'id' | 'is_dirty' | 'position' | 'created_at'>;

/** Clean pieces first, then dirty; each in the user's order, pieces never
 * placed after placed ones, oldest first. */
export function sortForCloset<T extends Ordered>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.is_dirty !== b.is_dirty) return a.is_dirty ? 1 : -1;
    const pa = a.position ?? Number.POSITIVE_INFINITY;
    const pb = b.position ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    const ca = a.created_at ?? '';
    const cb = b.created_at ?? '';
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** `items` with the one at `fromId` moved to where `toId` is. */
export function moveItem<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
  const from = items.findIndex((i) => i.id === fromId);
  const to = items.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** The positions to save so `ordered` keeps its order: 1, 2, 3… for each
 * piece, listing only those whose position changes. */
export function positionUpdates<T extends Pick<ClothingItem, 'id' | 'position'>>(
  ordered: T[],
): { id: string; position: number }[] {
  return ordered
    .map((item, i) => ({ id: item.id, position: i + 1, was: item.position }))
    .filter((u) => u.was !== u.position)
    .map(({ id, position }) => ({ id, position }));
}

/**
 * The pieces offered when logging a day's outfit in the Calendar: every piece
 * of the section, dirty ones included (what you wore is often in the wash
 * now), clean first and each in the closet's order.
 */
export function piecesForLogging<T extends Ordered & { type: string }>(
  items: T[],
  inSection: (item: T) => boolean,
): T[] {
  return sortForCloset(items.filter(inSection));
}
