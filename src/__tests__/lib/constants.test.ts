import { describe, it, expect } from 'vitest';
import {
  colorPalette,
  colorMap,
  colorNameMap,
  typeToSection,
  clothingTypes,
  sectionNames,
  occasionRules,
  occasions,
} from '@/lib/constants';

describe('colorPalette', () => {
  it('has exactly 16 items', () => {
    expect(colorPalette).toHaveLength(16);
  });

  it('all palette entries exist in colorMap', () => {
    for (const color of colorPalette) {
      expect(colorMap).toHaveProperty(color);
    }
  });

  it('all palette entries exist in colorNameMap', () => {
    for (const color of colorPalette) {
      expect(colorNameMap).toHaveProperty(color);
    }
  });
});

describe('typeToSection', () => {
  it('has 16 entries', () => {
    expect(Object.keys(typeToSection)).toHaveLength(16);
  });

  it('all values are valid section names', () => {
    const validSections = new Set(sectionNames);
    for (const section of Object.values(typeToSection)) {
      expect(validSections.has(section)).toBe(true);
    }
  });
});

describe('clothingTypes', () => {
  it('Tops has 9 types (including former outerwear)', () => {
    expect(clothingTypes.Tops).toHaveLength(9);
  });

  it('Bottoms has 6 types', () => {
    expect(clothingTypes.Bottoms).toHaveLength(6);
  });

  it('Shoes has 1 type', () => {
    expect(clothingTypes.Shoes).toHaveLength(1);
  });

  it('has 3 sections (no Outerwear)', () => {
    expect(sectionNames).toHaveLength(3);
    expect(sectionNames).not.toContain('Outerwear');
  });

  it('all types in clothingTypes exist in typeToSection', () => {
    for (const types of Object.values(clothingTypes)) {
      for (const type of types) {
        expect(typeToSection).toHaveProperty(type);
      }
    }
  });
});

describe('occasionRules', () => {
  it('has exactly 4 occasions', () => {
    expect(Object.keys(occasionRules)).toHaveLength(4);
  });

  it('occasions list has 4 items', () => {
    expect(occasions).toHaveLength(4);
  });

  it('Work excludes T-Shirt from tops', () => {
    expect(occasionRules.Work.tops).not.toContain('T-Shirt');
  });

  it('Work excludes Tank Top from tops', () => {
    expect(occasionRules.Work.tops).not.toContain('Tank Top');
  });

  it('Casual includes Jacket and Sweatshirt in tops', () => {
    expect(occasionRules.Casual.tops).toContain('Jacket');
    expect(occasionRules.Casual.tops).toContain('Sweatshirt');
  });
});
