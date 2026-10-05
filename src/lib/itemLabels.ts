import { getColorName } from '@/lib/colorUtils';
import type { ClothingItem } from '@/lib/types';

/** A stable four-digit "ticket number" derived from an id (or several ids joined). */
export function ticketNumber(id: string): string {
  // FNV-1a over the whole string, so joined ids don't just echo the first one.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return String((h >>> 0) % 10000).padStart(4, '0');
}

/** "Red T-Shirt" / "Navy blue and white Polo" — an item's accessible name. */
export function describeItem(item: ClothingItem): string {
  const colors = item.colors.map((c) => getColorName(c).toLowerCase());
  const colorText = colors.length ? colors.join(' and ') + ' ' : '';
  const sentence = `${colorText}${item.type}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
