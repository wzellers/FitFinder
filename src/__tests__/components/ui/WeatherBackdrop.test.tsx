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

  it('places every particle on screen', () => {
    // Positions are percentages of the screen; anything far outside is lost.
    const scenes = [
      { scene: 'rainy', night: false },
      { scene: 'cloudy', night: false },
      { scene: 'snowy', night: false },
      { scene: 'sunny', night: true },
    ] as const;
    for (const { scene, night } of scenes) {
      const { container, unmount } = render(
        <WeatherBackdrop scene={scene} night={night} storm={false} />,
      );
      const spans = container.querySelectorAll<HTMLElement>('span');
      expect(spans.length).toBeGreaterThan(0);
      for (const el of spans) {
        for (const prop of ['left', 'top', 'bottom'] as const) {
          const v = el.style[prop];
          if (!v.endsWith('%')) continue;
          const n = parseFloat(v);
          expect(n, `${scene} ${prop} ${v}`).toBeGreaterThanOrEqual(-10);
          expect(n, `${scene} ${prop} ${v}`).toBeLessThanOrEqual(110);
        }
      }
      unmount();
    }
  });
});
