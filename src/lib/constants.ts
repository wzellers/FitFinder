// Centralized constants — single source of truth for the entire app

import type { ClothingSection } from '@/lib/types';

// ============================================================================
// COLOR SYSTEM
// ============================================================================

export const colorPalette = [
  'white',
  'gray',
  'black',
  'beige',
  'light blue',
  'blue',
  'navy blue',
  'denim',
  'light green',
  'dark green',
  'brown',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
] as const;

/** Color name → hex value */
// Swatch colours tuned to look like fabric rather than pure screen colours.
export const colorMap: Record<string, string> = {
  black: '#1c1c1e',
  white: '#fafaf7',
  gray: '#8e8e8c',
  beige: '#ddd0b5',
  'light blue': '#9fc9e6',
  blue: '#2f5fb3',
  'navy blue': '#1f2a4a',
  denim: '#4a6a91',
  'light green': '#a9d3a0',
  'dark green': '#2e5339',
  brown: '#6b4428',
  yellow: '#f2cf4a',
  orange: '#e9853a',
  red: '#b8262f',
  pink: '#f1b5c4',
  purple: '#5f3b78',
};

/** Hex/name → display name */
export const colorNameMap: Record<string, string> = {
  '#000000': 'Black',
  black: 'Black',
  '#ffffff': 'White',
  white: 'White',
  '#808080': 'Gray',
  gray: 'Gray',
  '#f5f5dc': 'Beige',
  beige: 'Beige',
  '#87ceeb': 'Light Blue',
  'light blue': 'Light Blue',
  '#0000ff': 'Blue',
  blue: 'Blue',
  '#000080': 'Navy Blue',
  'navy blue': 'Navy Blue',
  '#191970': 'Denim',
  denim: 'Denim',
  '#90ee90': 'Light Green',
  'light green': 'Light Green',
  '#006400': 'Dark Green',
  'dark green': 'Dark Green',
  '#7B3F00': 'Brown',
  '#7b3f00': 'Brown',
  brown: 'Brown',
  '#ffff00': 'Yellow',
  yellow: 'Yellow',
  '#ffa500': 'Orange',
  orange: 'Orange',
  '#ff0000': 'Red',
  red: 'Red',
  '#ffc0cb': 'Pink',
  pink: 'Pink',
  '#800080': 'Purple',
  purple: 'Purple',
};

/** Colors that should use dark text for readability */
export const lightColors = ['#fafaf7', '#ddd0b5', '#9fc9e6', '#a9d3a0', '#f2cf4a', '#f1b5c4', '#8e8e8c'];

// ============================================================================
// CLOTHING CATEGORIES
// ============================================================================

/** Maps every clothing type → its section */
export const typeToSection: Record<string, ClothingSection> = {
  'T-Shirt': 'Tops',
  'Long Sleeve Shirt': 'Tops',
  Polo: 'Tops',
  'Tank Top': 'Tops',
  'Button-Up Shirt': 'Tops',
  Jacket: 'Tops',
  Sweatshirt: 'Tops',
  Crewneck: 'Tops',
  Sweater: 'Tops',
  Jeans: 'Bottoms',
  Pants: 'Bottoms',
  Shorts: 'Bottoms',
  Sweats: 'Bottoms',
  Skirt: 'Bottoms',
  Leggings: 'Bottoms',
  Shoes: 'Shoes',
};

/** Available clothing types grouped by section */
export const clothingTypes: Record<ClothingSection, string[]> = {
  Tops: [
    'T-Shirt',
    'Long Sleeve Shirt',
    'Polo',
    'Tank Top',
    'Button-Up Shirt',
    'Jacket',
    'Sweatshirt',
    'Crewneck',
    'Sweater',
  ],
  Bottoms: ['Jeans', 'Pants', 'Shorts', 'Sweats', 'Skirt', 'Leggings'],
  Shoes: ['Shoes'],
};

/** Section names in display order */
export const sectionNames: ClothingSection[] = ['Tops', 'Bottoms', 'Shoes'];

// ============================================================================
// OCCASION RULES (for smart outfit generation)
// ============================================================================

export type Occasion = 'Casual' | 'Work' | 'Date' | 'Active';

export const occasions: Occasion[] = ['Casual', 'Work', 'Date', 'Active'];

/** Which clothing types are appropriate per occasion */
export const occasionRules: Record<
  Occasion,
  { tops: string[]; bottoms: string[]; shoes: string[] }
> = {
  Casual: {
    tops: [
      'T-Shirt',
      'Long Sleeve Shirt',
      'Polo',
      'Tank Top',
      'Jacket',
      'Sweatshirt',
      'Crewneck',
      'Sweater',
    ],
    bottoms: ['Jeans', 'Pants', 'Shorts', 'Sweats', 'Leggings'],
    shoes: ['Shoes'],
  },
  Work: {
    tops: ['Long Sleeve Shirt', 'Polo', 'Button-Up Shirt', 'Sweater', 'Crewneck'],
    bottoms: ['Jeans', 'Pants', 'Skirt'],
    shoes: ['Shoes'],
  },
  Date: {
    tops: ['Long Sleeve Shirt', 'Polo', 'Button-Up Shirt', 'Jacket', 'Sweater'],
    bottoms: ['Jeans', 'Pants', 'Skirt'],
    shoes: ['Shoes'],
  },
  Active: {
    tops: ['T-Shirt', 'Tank Top', 'Sweatshirt', 'Jacket'],
    bottoms: ['Shorts', 'Sweats', 'Leggings'],
    shoes: ['Shoes'],
  },
};
