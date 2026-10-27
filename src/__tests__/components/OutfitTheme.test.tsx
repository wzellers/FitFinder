import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutfitThemeProvider, useOutfitTheme } from '@/components/OutfitTheme';

function Picker() {
  const { setPairing } = useOutfitTheme();
  return (
    <>
      <button onClick={() => setPairing(['white', 'navy blue'])}>Theme</button>
      <button onClick={() => setPairing(null)}>Reset</button>
    </>
  );
}

const vars = (c: HTMLElement) => (c.firstElementChild as HTMLElement).style;

describe('OutfitThemeProvider', () => {
  it("exposes today's outfit colours and a readable accent as CSS variables", () => {
    const { container } = render(
      <OutfitThemeProvider>
        <Picker />
      </OutfitThemeProvider>,
    );
    expect(vars(container).getPropertyValue('--outfit-top')).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    const style = vars(container);
    expect(style.getPropertyValue('--outfit-top').toLowerCase()).toBe('#fafaf7');
    expect(style.getPropertyValue('--outfit-bottom').toLowerCase()).toBe('#1f2a4a');
    // White doesn't read on the white page, so the accent is the navy.
    expect(style.getPropertyValue('--outfit-accent').toLowerCase()).toBe('#1f2a4a');
    expect(style.getPropertyValue('--outfit-accent-ink').toLowerCase()).toBe('#ffffff');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(vars(container).getPropertyValue('--outfit-accent')).toBe('');
  });
});
