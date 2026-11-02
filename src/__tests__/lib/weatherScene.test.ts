import { describe, it, expect } from 'vitest';
import { seasonFor, weatherScene } from '@/lib/weatherScene';

describe('weatherScene', () => {
  it.each([
    ['01d', 'sunny'],
    ['02d', 'cloudy'],
    ['03n', 'cloudy'],
    ['04d', 'cloudy'],
    ['50d', 'cloudy'], // mist and fog
    ['09d', 'rainy'],
    ['10n', 'rainy'],
    ['11d', 'rainy'],
    ['13d', 'snowy'],
  ])('maps icon %s to %s', (icon, scene) => {
    expect(weatherScene(icon).scene).toBe(scene);
  });

  it('knows night from the icon, for stars instead of sun', () => {
    expect(weatherScene('01n')).toMatchObject({ scene: 'sunny', night: true });
    expect(weatherScene('01d').night).toBe(false);
  });

  it('marks thunderstorms', () => {
    expect(weatherScene('11d').storm).toBe(true);
    expect(weatherScene('10d').storm).toBe(false);
  });

  it('falls back to the condition text for an unknown icon', () => {
    expect(weatherScene('', 'Light rain').scene).toBe('rainy');
    expect(weatherScene('', 'Snow').scene).toBe('snowy');
    expect(weatherScene('', 'Clear').scene).toBe('sunny');
    expect(weatherScene('', 'Haze').scene).toBe('cloudy');
  });
});

describe('seasonFor', () => {
  it("is Christmas through December and on New Year's Day", () => {
    expect(seasonFor(new Date(2026, 11, 1))).toBe('christmas');
    expect(seasonFor(new Date(2026, 11, 31))).toBe('christmas');
    expect(seasonFor(new Date(2027, 0, 1))).toBe('christmas');
  });

  it('has no season touch the rest of the year', () => {
    expect(seasonFor(new Date(2027, 0, 2))).toBeNull();
    expect(seasonFor(new Date(2026, 10, 30))).toBeNull();
    expect(seasonFor(new Date(2026, 6, 4))).toBeNull();
  });
});
