import { describe, it, expect } from 'vitest';
import {
  clothingWeatherRules,
  isClothingAppropriateForWeather,
  getUserClothingWeatherRules,
} from '@/lib/weatherApi';
import type { TemperatureCategory } from '@/lib/weatherApi';

describe('clothingWeatherRules', () => {
  it('has 15 entries', () => {
    expect(Object.keys(clothingWeatherRules)).toHaveLength(15);
  });

  it('Tank Top is blocked in cold and cool', () => {
    expect(clothingWeatherRules['Tank Top'].blockedIn).toContain('cold');
    expect(clothingWeatherRules['Tank Top'].blockedIn).toContain('cool');
  });

  it('Jacket is blocked in hot', () => {
    expect(clothingWeatherRules['Jacket'].blockedIn).toContain('hot');
  });

  it('Jeans is not blocked anywhere', () => {
    expect(clothingWeatherRules['Jeans'].blockedIn).toHaveLength(0);
  });

  it('Tank Top is suggested in hot', () => {
    expect(clothingWeatherRules['Tank Top'].suggestedIn).toContain('hot');
  });
});

describe('isClothingAppropriateForWeather', () => {
  it('returns false for blocked item', () => {
    expect(isClothingAppropriateForWeather('Tank Top', 'cold')).toBe(false);
    expect(isClothingAppropriateForWeather('Jacket', 'hot')).toBe(false);
  });

  it('returns true for non-blocked item', () => {
    expect(isClothingAppropriateForWeather('Tank Top', 'hot')).toBe(true);
    expect(isClothingAppropriateForWeather('Jeans', 'cold')).toBe(true);
  });

  it('returns true for unknown clothing type', () => {
    expect(isClothingAppropriateForWeather('Unknown Item', 'cold')).toBe(true);
  });
});

describe('getUserClothingWeatherRules', () => {
  it('returns defaults when passed null', () => {
    const result = getUserClothingWeatherRules(null);
    expect(result).toEqual(clothingWeatherRules);
  });

  it('returns defaults when passed undefined', () => {
    const result = getUserClothingWeatherRules(undefined);
    expect(result).toEqual(clothingWeatherRules);
  });

  it('merges user overrides with defaults', () => {
    const override = {
      'T-Shirt': { blockedIn: ['cold', 'cool'] as TemperatureCategory[], suggestedIn: ['hot'] as TemperatureCategory[] },
    };
    const result = getUserClothingWeatherRules(override);
    expect(result['T-Shirt'].blockedIn).toContain('cool');
    // Other defaults still present
    expect(result['Jeans']).toEqual(clothingWeatherRules['Jeans']);
  });

  it('partial override does not erase other defaults', () => {
    const override = { 'Shorts': { blockedIn: [] as TemperatureCategory[], suggestedIn: ['hot', 'warm', 'cool'] as TemperatureCategory[] } };
    const result = getUserClothingWeatherRules(override);
    expect(result['Tank Top']).toEqual(clothingWeatherRules['Tank Top']);
  });
});

describe('dead code removal', () => {
  it('isClothingSuggestedForWeather is NOT exported from types', async () => {
    const mod = await import('@/lib/types');
    expect((mod as Record<string, unknown>).isClothingSuggestedForWeather).toBeUndefined();
  });
});
