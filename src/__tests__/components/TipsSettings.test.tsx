import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import TipsSettings from '@/components/TipsSettings';
import { markTipsSeen, tipsSeen } from '@/lib/tips';

describe('TipsSettings', () => {
  it('brings the tips back on every screen', () => {
    markTipsSeen('closet');
    markTipsSeen('generator');
    renderWithProviders(<TipsSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Show tips again/ }));
    expect(tipsSeen().size).toBe(0);
    expect(screen.getByText(/Tips are back/)).toBeInTheDocument();
  });
});
