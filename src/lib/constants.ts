// Centralized constants — single source of truth for the entire app

import type { ClothingSection } from '@/lib/types';

// ============================================================================
// COLOR SYSTEM
// ============================================================================

export const colorPalette = [
  'white', 'gray', 'black', 'beige',
  'light blue', 'blue', 'navy blue', 'denim',
  'light green', 'dark green', 'brown', 'yellow',
  'orange', 'red', 'pink', 'purple',
] as const;

export type ColorName = (typeof colorPalette)[number];

/** Color name → hex value */
export const colorMap: Record<string, string> = {
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
  purple: '#800080',
};

/** Hex/name → display name */
export const colorNameMap: Record<string, string> = {
  '#000000': 'Black',   black: 'Black',
  '#ffffff': 'White',   white: 'White',
  '#808080': 'Gray',    gray: 'Gray',
  '#f5f5dc': 'Beige',   beige: 'Beige',
  '#87ceeb': 'Light Blue', 'light blue': 'Light Blue',
  '#0000ff': 'Blue',    blue: 'Blue',
  '#000080': 'Navy Blue', 'navy blue': 'Navy Blue',
  '#191970': 'Denim',   denim: 'Denim',
  '#90ee90': 'Light Green', 'light green': 'Light Green',
  '#006400': 'Dark Green', 'dark green': 'Dark Green',
  '#7B3F00': 'Brown',   '#7b3f00': 'Brown', brown: 'Brown',
  '#ffff00': 'Yellow',  yellow: 'Yellow',
  '#ffa500': 'Orange',  orange: 'Orange',
  '#ff0000': 'Red',     red: 'Red',
  '#ffc0cb': 'Pink',    pink: 'Pink',
  '#800080': 'Purple',  purple: 'Purple',
};

/** Colors that should use dark text for readability */
export const lightColors = ['#ffffff', '#f5f5dc', '#87ceeb', '#90ee90', '#ffff00', '#ffc0cb'];

// ============================================================================
// CLOTHING CATEGORIES
// ============================================================================

/** Maps every clothing type → its section */
export const typeToSection: Record<string, ClothingSection> = {
  'T-Shirt': 'Tops',
  'Long Sleeve Shirt': 'Tops',
  'Polo': 'Tops',
  'Tank Top': 'Tops',
  'Button-Up Shirt': 'Tops',
  'Hoodie': 'Tops',
  'Jacket': 'Outerwear',
  'Sweatshirt': 'Outerwear',
  'Crewneck': 'Outerwear',
  'Sweater': 'Outerwear',
  'Jeans': 'Bottoms',
  'Pants': 'Bottoms',
  'Shorts': 'Bottoms',
  'Sweats': 'Bottoms',
  'Skirt': 'Bottoms',
  'Leggings': 'Bottoms',
  'Shoes': 'Shoes',
};

/** Available clothing types grouped by section */
export const clothingTypes: Record<ClothingSection, string[]> = {
  Tops: ['T-Shirt', 'Long Sleeve Shirt', 'Polo', 'Tank Top', 'Button-Up Shirt', 'Hoodie'],
  Bottoms: ['Jeans', 'Pants', 'Shorts', 'Sweats', 'Skirt', 'Leggings'],
  Outerwear: ['Jacket', 'Sweatshirt', 'Crewneck', 'Sweater'],
  Shoes: ['Shoes'],
};

/** Section names in display order */
export const sectionNames: ClothingSection[] = ['Tops', 'Bottoms', 'Outerwear', 'Shoes'];

// ============================================================================
// OCCASION RULES (for smart outfit generation)
// ============================================================================

export type Occasion = 'Casual' | 'Work' | 'Date' | 'Active';

export const occasions: Occasion[] = ['Casual', 'Work', 'Date', 'Active'];

/** Which clothing types are appropriate per occasion */
export const occasionRules: Record<Occasion, { tops: string[]; bottoms: string[]; outerwear: string[]; shoes: string[] }> = {
  Casual: {
    tops: ['T-Shirt', 'Long Sleeve Shirt', 'Polo', 'Tank Top', 'Hoodie'],
    bottoms: ['Jeans', 'Pants', 'Shorts', 'Sweats', 'Leggings'],
    outerwear: ['Jacket', 'Sweatshirt', 'Crewneck', 'Sweater'],
    shoes: ['Shoes'],
  },
  Work: {
    tops: ['Long Sleeve Shirt', 'Polo', 'Button-Up Shirt'],
    bottoms: ['Jeans', 'Pants', 'Skirt'],
    outerwear: ['Sweater', 'Crewneck'],
    shoes: ['Shoes'],
  },
  Date: {
    tops: ['Long Sleeve Shirt', 'Polo', 'Button-Up Shirt'],
    bottoms: ['Jeans', 'Pants', 'Skirt'],
    outerwear: ['Jacket', 'Sweater'],
    shoes: ['Shoes'],
  },
  Active: {
    tops: ['T-Shirt', 'Tank Top', 'Hoodie'],
    bottoms: ['Shorts', 'Sweats', 'Leggings'],
    outerwear: ['Sweatshirt', 'Jacket'],
    shoes: ['Shoes'],
  },
};
