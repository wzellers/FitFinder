import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutfitThemeProvider, useOutfitTheme } from '@/components/OutfitTheme';

function Picker() {
  const { setPairing } = useOutfitTheme();
  return (
    <>
      <button onClick={() => setPairing(['navy blue', 'beige', 'white'])}>Theme</button>
      <button onClick={() => setPairing(null)}>Reset</button>
    </>
  );
}

const themed = (c: HTMLElement) => c.firstElementChild as HTMLElement;

describe('OutfitThemeProvider', () => {
  it('is neutral until there is an outfit', () => {
    const { container } = render(
      <OutfitThemeProvider>
        <Picker />
      </OutfitThemeProvider>,
    );
    expect(themed(container).dataset.outfitTheme).toBe('neutral');
    expect(themed(container).style.getPropertyValue('--outfit-accent')).toBe('');
  });

  it('themes the app from the outfit: top main, bottom secondary, shoes third', () => {
    const { container } = render(
      <OutfitThemeProvider>
        <Picker />
      </OutfitThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    const el = themed(container);
    const v = (name: string) => el.style.getPropertyValue(name).toLowerCase();
    expect(el.dataset.outfitTheme).toBe('outfit');
    expect(v('--outfit-accent')).toBe('#1f2a4a'); // the navy top
    expect(v('--outfit-accent-ink')).toBe('#ffffff');
    expect(v('--outfit-glow')).toBe('#1f2a4a');
    expect(v('--poster-bg')).toBe('#1f2a4a');
    expect(v('--outfit-top')).toBe('#1f2a4a');
    expect(v('--outfit-shoes')).toBe('#fafaf7');
    expect(v('--outfit-bottom')).not.toBe('');
    // The colours fade rather than snap.
    expect(el.style.transition).toContain('--outfit-accent');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(themed(container).dataset.outfitTheme).toBe('neutral');
  });
});
