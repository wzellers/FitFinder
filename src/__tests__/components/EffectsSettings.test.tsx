import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockUpdateResult = vi.hoisted(() => ({ error: null as unknown }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) })),
      update: mockUpdate,
    })),
  },
}));

import EffectsSettings from '@/components/EffectsSettings';

beforeEach(() => {
  mockUpdateResult.error = null;
  mockUpdate.mockReset();
  mockUpdate.mockReturnValue({ eq: vi.fn(() => Promise.resolve(mockUpdateResult)) });
  mockMaybeSingle.mockResolvedValue({
    data: { weather_effects: true, seasonal_themes: false },
    error: null,
  });
});

describe('EffectsSettings', () => {
  it('shows each effect as saved', async () => {
    renderWithProviders(<EffectsSettings />);
    const weather = await screen.findByRole('switch', { name: 'Weather effects' });
    await waitFor(() => expect(weather).not.toBeDisabled());
    expect(weather).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Seasonal themes' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('starts both on when nothing is saved yet', async () => {
    mockMaybeSingle.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<EffectsSettings />);
    const seasonal = await screen.findByRole('switch', { name: 'Seasonal themes' });
    await waitFor(() => expect(seasonal).not.toBeDisabled());
    expect(seasonal).toHaveAttribute('aria-checked', 'true');
  });

  it('saves a switch to the profile when it is flipped', async () => {
    renderWithProviders(<EffectsSettings />);
    const weather = await screen.findByRole('switch', { name: 'Weather effects' });
    await waitFor(() => expect(weather).not.toBeDisabled());
    fireEvent.click(weather);
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ weather_effects: false }));
    expect(weather).toHaveAttribute('aria-checked', 'false');
  });

  it("flips back and says so when it can't save", async () => {
    mockUpdateResult.error = { message: 'nope' };
    renderWithProviders(<EffectsSettings />);
    const seasonal = await screen.findByRole('switch', { name: 'Seasonal themes' });
    await waitFor(() => expect(seasonal).not.toBeDisabled());
    fireEvent.click(seasonal);
    expect(await screen.findByText("Couldn't save that setting. Try again.")).toBeTruthy();
    expect(seasonal).toHaveAttribute('aria-checked', 'false');
  });
});
