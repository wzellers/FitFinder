import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeasonalBackdrop, SeasonalSky } from '@/components/ui/SeasonalDecor';
import { SEASONAL_THEMES } from '@/lib/seasons';

describe('SeasonalBackdrop', () => {
  it('draws something for every theme, as decoration only', () => {
    for (const { theme } of SEASONAL_THEMES) {
      const { container, unmount } = render(<SeasonalBackdrop theme={theme} night />);
      const sky = render(<SeasonalSky theme={theme} night sun />);
      const backdrop = screen.getByTestId('seasonal-backdrop');
      expect(backdrop.getAttribute('aria-hidden')).toBe('true');
      expect(backdrop.className).toContain('pointer-events-none');
      const drawn =
        container.querySelectorAll('span, svg, div').length -
        1 +
        sky.container.querySelectorAll('span, svg, div').length -
        1;
      expect(drawn, theme).toBeGreaterThan(0);
      unmount();
      sky.unmount();
    }
  });

  it.each([
    ['fall', 'seasonal-leaf-pile'],
    ['thanksgiving', 'seasonal-harvest'],
    ['spring', 'seasonal-flowers'],
    ['easter', 'seasonal-eggs'],
    ['earthday', 'seasonal-vine'],
    ['backtoschool', 'seasonal-plane'],
    ['halloween', 'seasonal-jack-o-lanterns'],
    ['christmas', 'seasonal-tree'],
    ['hanukkah', 'seasonal-menorah'],
  ] as const)('%s shows %s', (theme, testId) => {
    render(<SeasonalBackdrop theme={theme} />);
    expect(screen.getAllByTestId(testId).length).toBeGreaterThan(0);
  });

  it('lights one more Hanukkah candle each night, plus the helper candle', () => {
    const { unmount } = render(<SeasonalBackdrop theme="hanukkah" hanukkahNight={1} />);
    expect(screen.getAllByTestId('menorah-flame')).toHaveLength(2);
    unmount();
    render(<SeasonalBackdrop theme="hanukkah" hanukkahNight={8} />);
    expect(screen.getAllByTestId('menorah-flame')).toHaveLength(9);
  });

  it('saves fireflies and Fourth of July fireworks for the night', () => {
    const { container, unmount } = render(<SeasonalBackdrop theme="summer" />);
    expect(container.querySelectorAll('.sz-firefly')).toHaveLength(0);
    unmount();
    const night = render(<SeasonalBackdrop theme="summer" night />);
    expect(night.container.querySelectorAll('.sz-firefly').length).toBeGreaterThan(10);
    night.unmount();
    const day = render(<SeasonalBackdrop theme="july4" />);
    expect(screen.queryAllByTestId('seasonal-firework')).toHaveLength(0);
    day.unmount();
    render(<SeasonalBackdrop theme="july4" night />);
    expect(screen.getAllByTestId('seasonal-firework').length).toBeGreaterThan(0);
  });
});

describe('SeasonalSky', () => {
  it.each([
    ['christmas', 'seasonal-lights'],
    ['july4', 'seasonal-bunting'],
    ['lunarnewyear', 'seasonal-lantern'],
    ['stpatricks', 'seasonal-rainbow'],
    ['halloween', 'seasonal-bat'],
    ['winter', 'seasonal-icicles'],
  ] as const)('%s hangs %s above the banner', (theme, testId) => {
    render(<SeasonalSky theme={theme} />);
    expect(screen.getAllByTestId(testId).length).toBeGreaterThan(0);
  });

  it('gives the summer sun sunglasses, only when the sun is out', () => {
    const { unmount } = render(<SeasonalSky theme="summer" />);
    expect(screen.queryByTestId('seasonal-sunglasses')).toBeNull();
    unmount();
    render(<SeasonalSky theme="summer" sun />);
    expect(screen.getByTestId('seasonal-sunglasses')).toBeTruthy();
  });
});
