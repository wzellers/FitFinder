// Color utilities — thin wrappers around the canonical data in constants.ts

import { colorMap, colorNameMap } from '@/lib/constants';

/** Returns CSS background-color style for a given color name */
export function getColorStyle(color: string): { backgroundColor: string } {
  // Accept display names too ("Navy Blue"), which Stats passes in.
  return { backgroundColor: colorMap[color] || colorMap[color.toLowerCase()] || color };
}

/** Returns display name for a color value */
export function getColorName(color: string): string {
  if (!color) return 'None';
  const lower = color.toLowerCase();
  return (
    colorNameMap[lower] ?? colorNameMap[color] ?? color.charAt(0).toUpperCase() + color.slice(1)
  );
}

/** Returns appropriate text color (black / white) for contrast on a bg color */
export function getContrastTextColor(backgroundColor: string): string {
  const hex = (colorMap[backgroundColor] || backgroundColor).replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#000000';
  // Relative luminance (WCAG); dark text on light colours, white on dark.
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return lum > 0.4 ? '#000000' : '#ffffff';
}
