import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeatherBackdrop, { WeatherSky } from '@/components/ui/WeatherBackdrop';

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

  it('makes a clear night starry, with bright stars and shooting stars', () => {
    render(<WeatherBackdrop scene="sunny" night storm={false} />);
    expect(count('wx-star')).toBeGreaterThanOrEqual(60);
    expect(count('wx-star-bright')).toBeGreaterThan(5);
    expect(count('wx-shooting')).toBeGreaterThan(0);
  });

  it('makes a storm darker than rain, with heavier rain and lightning bolts', () => {
    const { unmount } = render(<WeatherBackdrop scene="rainy" night={false} storm={false} />);
    const rain = count('wx-drop');
    expect(screen.queryByTestId('weather-bolt')).toBeNull();
    unmount();
    render(<WeatherBackdrop scene="rainy" night={false} storm />);
    expect(count('wx-sky-storm')).toBe(1);
    expect(count('wx-drop')).toBeGreaterThan(rain);
    expect(screen.getAllByTestId('weather-bolt').length).toBe(2);
  });

  it('snows light-blue crystals onto a snowbank with a snowman', () => {
    render(<WeatherBackdrop scene="snowy" night={false} storm={false} />);
    expect(count('wx-crystal')).toBeGreaterThan(10);
    expect(count('wx-snowbank')).toBe(1);
    expect(screen.getByTestId('weather-snowman')).toBeTruthy();
  });

  it('adds a Christmas tree at Christmas, whatever the weather', () => {
    const { unmount } = render(
      <WeatherBackdrop scene="cloudy" night={false} storm={false} season="christmas" />,
    );
    expect(screen.getByTestId('weather-tree')).toBeTruthy();
    unmount();
    render(<WeatherBackdrop scene="cloudy" night={false} storm={false} />);
    expect(screen.queryByTestId('weather-tree')).toBeNull();
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

describe('WeatherSky', () => {
  const cloudClasses = () => screen.getAllByTestId('weather-cloud').map((c) => c.className);

  it('puts the sun and white clouds above the banner on a sunny day', () => {
    render(<WeatherSky scene="sunny" night={false} storm={false} />);
    expect(screen.getByTestId('weather-sun')).toBeTruthy();
    expect(cloudClasses().every((c) => c === 'wx-puff')).toBe(true);
  });

  it('shows the moon at night, and no sun', () => {
    render(<WeatherSky scene="sunny" night storm={false} />);
    expect(screen.getByTestId('weather-moon')).toBeTruthy();
    expect(screen.queryByTestId('weather-sun')).toBeNull();
  });

  it('colours its clouds for rain, storms and snow', () => {
    const { unmount } = render(<WeatherSky scene="rainy" night={false} storm={false} />);
    expect(cloudClasses().every((c) => c.includes('wx-puff-rain'))).toBe(true);
    unmount();
    const r = render(<WeatherSky scene="rainy" night={false} storm />);
    expect(cloudClasses().every((c) => c.includes('wx-puff-storm'))).toBe(true);
    expect(screen.getByTestId('weather-sky').className).toContain('wx-strip-storm');
    r.unmount();
    render(<WeatherSky scene="snowy" night={false} storm={false} />);
    expect(cloudClasses().every((c) => c.includes('wx-puff-snow'))).toBe(true);
  });

  it('hangs Christmas lights at Christmas', () => {
    render(<WeatherSky scene="sunny" night={false} storm={false} season="christmas" />);
    const lights = screen.getByTestId('weather-lights');
    expect(lights.querySelectorAll('.wx-bulb').length).toBeGreaterThan(10);
  });
});
