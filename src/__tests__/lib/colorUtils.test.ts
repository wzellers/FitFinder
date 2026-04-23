import { describe, it, expect } from 'vitest';
import {
  getColorStyle,
  getColorName,
  getContrastTextColor,
} from '@/lib/colorUtils';
import { colorPalette, colorMap, colorNameMap } from '@/lib/constants';

describe('getColorStyle', () => {
  it('returns backgroundColor hex for known color name', () => {
    expect(getColorStyle('blue')).toEqual({ backgroundColor: '#0000ff' });
  });

  it('passes through unknown color strings', () => {
    expect(getColorStyle('#abc123')).toEqual({ backgroundColor: '#abc123' });
  });

  it('passes through unknown color names', () => {
    expect(getColorStyle('magenta')).toEqual({ backgroundColor: 'magenta' });
  });
});

describe('getColorName', () => {
  it('returns "None" for empty string', () => {
    expect(getColorName('')).toBe('None');
  });

  it('looks up hex value', () => {
    expect(getColorName('#000000')).toBe('Black');
    expect(getColorName('#ffffff')).toBe('White');
  });

  it('looks up color name directly', () => {
    expect(getColorName('blue')).toBe('Blue');
    expect(getColorName('pink')).toBe('Pink');
  });

  it('is case-insensitive for hex lookup', () => {
    expect(getColorName('#7B3F00')).toBe('Brown');
    expect(getColorName('#7b3f00')).toBe('Brown');
  });

  it('capitalizes unknown inputs', () => {
    expect(getColorName('chartreuse')).toBe('Chartreuse');
  });
});

describe('getContrastTextColor', () => {
  it('returns black text for white background', () => {
    expect(getContrastTextColor('white')).toBe('#000000');
    expect(getContrastTextColor('#ffffff')).toBe('#000000');
  });

  it('returns black text for beige', () => {
    expect(getContrastTextColor('beige')).toBe('#000000');
  });

  it('returns black text for yellow', () => {
    expect(getContrastTextColor('yellow')).toBe('#000000');
  });

  it('returns black text for light blue', () => {
    expect(getContrastTextColor('light blue')).toBe('#000000');
  });

  it('returns black text for pink', () => {
    expect(getContrastTextColor('pink')).toBe('#000000');
  });

  it('returns white text for dark colors', () => {
    expect(getContrastTextColor('black')).toBe('#ffffff');
    expect(getContrastTextColor('navy blue')).toBe('#ffffff');
    expect(getContrastTextColor('blue')).toBe('#ffffff');
  });
});

describe('colorPalette round-trip', () => {
  it('every palette color has a colorMap hex and colorNameMap display name', () => {
    for (const color of colorPalette) {
      const hex = colorMap[color];
      expect(hex).toBeTruthy();
      const displayName = colorNameMap[color];
      expect(displayName).toBeTruthy();
    }
  });
});
