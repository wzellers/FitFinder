// Shared color utilities used across the application for consistent color handling

// Color palette available for clothing items and color preferences
export const colorPalette = [
  'white', 'gray', 'black', 'beige',
  'light blue', 'blue', 'navy blue', 'denim',
  'light green', 'dark green', 'brown', 'yellow',
  'orange', 'red', 'pink', 'purple'
] as const;

export type ColorName = typeof colorPalette[number];

// Maps color names to their hex values for rendering
const colorMap: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  gray: '#808080',
  beige: '#f5f5dc',
  'light blue': '#87ceeb',
  blue: '#0000ff',
  'navy blue': '#000080',
  denim: '#191970',
  'light green': '#90ee90',
  'dark green': '#006400',
  brown: '#7B3F00',
  yellow: '#ffff00',
  orange: '#ffa500',
  red: '#ff0000',
  pink: '#ffc0cb',
  purple: '#800080'
};

// Maps color values (names or hex) to display names
const colorNameMap: Record<string, string> = {
  '#000000': 'Black',
  'black': 'Black',
  '#ffffff': 'White',
  'white': 'White',
  '#808080': 'Gray',
  'gray': 'Gray',
  '#f5f5dc': 'Beige',
  'beige': 'Beige',
  '#87ceeb': 'Light Blue',
  'light blue': 'Light Blue',
  '#0000ff': 'Blue',
  'blue': 'Blue',
  '#000080': 'Navy Blue',
  'navy blue': 'Navy Blue',
  '#191970': 'Denim',
  'denim': 'Denim',
  '#90ee90': 'Light Green',
  'light green': 'Light Green',
  '#006400': 'Dark Green',
  'dark green': 'Dark Green',
  '#7B3F00': 'Brown',
  '#7b3f00': 'Brown',
  'brown': 'Brown',
  '#ffff00': 'Yellow',
  'yellow': 'Yellow',
  '#ffa500': 'Orange',
  'orange': 'Orange',
  '#ff0000': 'Red',
  'red': 'Red',
  '#ffc0cb': 'Pink',
  'pink': 'Pink',
  '#800080': 'Purple',
  'purple': 'Purple',
};

// Returns CSS background color style for a given color name
export function getColorStyle(color: string): { backgroundColor: string } {
  return { backgroundColor: colorMap[color] || color };
}

// Returns hex value for a given color name
export function getColorHex(color: string): string {
  return colorMap[color] || color;
}

// Returns display name for a color value
export function getColorName(color: string): string {
  if (!color) return 'None';
  const lowerColor = color.toLowerCase();
  if (colorNameMap[lowerColor]) return colorNameMap[lowerColor];
  if (colorNameMap[color]) return colorNameMap[color];
  return color.charAt(0).toUpperCase() + color.slice(1);
}

// Colors that should use dark text for contrast
const lightColors = ['#ffffff', '#f5f5dc', '#87ceeb', '#90ee90', '#ffff00', '#ffc0cb'];

// Returns appropriate text color for a given background color
export function getContrastTextColor(backgroundColor: string): string {
  const hex = colorMap[backgroundColor] || backgroundColor;
  return lightColors.includes(hex) ? '#000000' : '#ffffff';
}
