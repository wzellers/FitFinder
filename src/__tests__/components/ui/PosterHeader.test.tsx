import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PosterHeader from '@/components/ui/PosterHeader';

describe('PosterHeader', () => {
  for (const compact of [false, true]) {
    it(`shows the title, readout and actions${compact ? ' in its compact form' : ''}`, () => {
      render(
        <PosterHeader
          compact={compact}
          title="Today's fit"
          script="get dressed"
          readout="{ 5 clean items }"
          actions={<button>Saved (0)</button>}
        />,
      );
      expect(screen.getByRole('heading', { name: "Today's fit", level: 2 })).toBeTruthy();
      expect(screen.getByText('{ 5 clean items }')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Saved (0)' })).toBeTruthy();
      // The script word is decoration, hidden from screen readers.
      expect(screen.getByText('get dressed').getAttribute('aria-hidden')).toBe('true');
    });
  }

  it('is a slim single row when compact', () => {
    const { container } = render(<PosterHeader compact title="Today's fit" />);
    const header = container.querySelector('header')!;
    expect(header.className).toMatch(/\bpy-4\b/);
    expect(header.className).not.toMatch(/\bpt-8\b/);
  });
});
