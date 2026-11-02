import { describe, it, expect } from 'vitest';
import { weatherScene } from '@/lib/weatherScene';

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
