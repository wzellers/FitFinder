// Color utilities — thin wrappers around the canonical data in constants.ts

import { colorMap, colorNameMap, lightColors } from '@/lib/constants';

export type { ColorName } from '@/lib/constants';
export { colorPalette, colorMap, colorNameMap } from '@/lib/constants';

/** Returns CSS background-color style for a given color name */
export function getColorStyle(color: string): { backgroundColor: string } {
  return { backgroundColor: colorMap[color] || color };
}

/** Returns hex value for a given color name */
export function getColorHex(color: string): string {
  return colorMap[color] || color;
}

/** Returns display name for a color value */
export function getColorName(color: string): string {
  if (!color) return 'None';
  const lower = color.toLowerCase();
  return colorNameMap[lower] ?? colorNameMap[color] ?? (color.charAt(0).toUpperCase() + color.slice(1));
}

/** Returns appropriate text color (black / white) for contrast on a bg color */
export function getContrastTextColor(backgroundColor: string): string {
  const hex = colorMap[backgroundColor] || backgroundColor;
  return lightColors.includes(hex) ? '#000000' : '#ffffff';
}
