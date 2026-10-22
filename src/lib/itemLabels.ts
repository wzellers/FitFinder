import { getColorName } from '@/lib/colorUtils';
import type { ClothingItem } from '@/lib/types';

/** "Red T-Shirt" / "Navy blue and white Polo" — an item's accessible name. */
export function describeItem(item: ClothingItem): string {
  const colors = item.colors.map((c) => getColorName(c).toLowerCase());
  const colorText = colors.length ? colors.join(' and ') + ' ' : '';
  const sentence = `${colorText}${item.type}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
