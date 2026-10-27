import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeatherBackdrop from '@/components/ui/WeatherBackdrop';

const backdrop = () => screen.getByTestId('weather-backdrop');
const count = (cls: string) => backdrop().querySelectorAll(`.${cls}`).length;

describe('WeatherBackdrop', () => {
  it('shows a sun glow on a clear day', () => {
    render(<WeatherBackdrop scene="sunny" night={false} storm={false} />);
    expect(backdrop().dataset.scene).toBe('sunny');
    expect(count('wx-sun')).toBe(1);
    expect(count('wx-star')).toBe(0);
  });

  it('shows stars instead on a clear night', () => {
    render(<WeatherBackdrop scene="sunny" night storm={false} />);
    expect(backdrop().dataset.scene).toBe('night');
    expect(count('wx-sun')).toBe(0);
    expect(count('wx-star')).toBeGreaterThan(10);
  });

  it('drifts clouds, drops rain and falls snow', () => {
    const { unmount } = render(<WeatherBackdrop scene="cloudy" night={false} storm={false} />);
    expect(count('wx-cloud')).toBeGreaterThan(0);
    unmount();
    const r = render(<WeatherBackdrop scene="rainy" night={false} storm={false} />);
    expect(count('wx-drop')).toBeGreaterThan(20);
    expect(screen.queryByTestId('weather-flash')).toBeNull();
    r.unmount();
    render(<WeatherBackdrop scene="snowy" night={false} storm={false} />);
    expect(count('wx-flake')).toBeGreaterThan(20);
  });

  it('flashes now and then in a thunderstorm', () => {
    render(<WeatherBackdrop scene="rainy" night={false} storm />);
    expect(screen.getByTestId('weather-flash')).toBeTruthy();
  });

  it('is decoration, hidden from screen readers and clicks', () => {
    render(<WeatherBackdrop scene="snowy" night={false} storm={false} />);
    expect(backdrop().getAttribute('aria-hidden')).toBe('true');
    expect(backdrop().className).toContain('pointer-events-none');
  });

  it('lays particles out the same way on every render', () => {
    const { container: a } = render(<WeatherBackdrop scene="rainy" night={false} storm={false} />);
    const { container: b } = render(<WeatherBackdrop scene="rainy" night={false} storm={false} />);
    expect(a.innerHTML).toBe(b.innerHTML);
  });

  it('tints the sky for the weather, so it reads even behind the cards', () => {
    const { unmount } = render(<WeatherBackdrop scene="cloudy" night={false} storm={false} />);
    expect(count('wx-sky-cloudy')).toBe(1);
    unmount();
    render(<WeatherBackdrop scene="sunny" night storm={false} />);
    expect(count('wx-sky-night')).toBe(1);
  });
});
