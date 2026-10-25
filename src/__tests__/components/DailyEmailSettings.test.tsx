import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

// Stable, as the real useAuth keeps it (a new object per render reloads data).
const mockUser = vi.hoisted(() => ({ id: 'u1', email: 'me@example.com' }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) })),
      update: mockUpdate,
    })),
  },
}));

import DailyEmailSettings from '@/components/DailyEmailSettings';

beforeEach(() => {
  mockUpdate.mockReset();
  mockUpdate.mockReturnValue({ eq: vi.fn(() => Promise.resolve({ error: null })) });
  mockMaybeSingle.mockResolvedValue({
    data: {
      zip_code: '10001',
      daily_email_enabled: false,
      daily_email_time: '06:45:00',
      timezone: 'America/Chicago',
    },
    error: null,
  });
});

describe('DailyEmailSettings', () => {
  it('loads the saved time and zone', async () => {
    renderWithProviders(<DailyEmailSettings />);
    expect(await screen.findByLabelText('Time')).toHaveValue('06:45');
    expect(screen.getByLabelText('Time zone')).toHaveValue('America/Chicago');
    expect(screen.getByText(/Sent to me@example.com/)).toBeInTheDocument();
  });

  it('turns the email on with the chosen time and zone', async () => {
    renderWithProviders(<DailyEmailSettings />);
    const toggle = await screen.findByRole('switch', { name: 'Send me the daily email' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        daily_email_enabled: true,
        daily_email_time: '06:45',
        timezone: 'America/Chicago',
      }),
    );
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  it('reverts the switch when saving fails', async () => {
    mockUpdate.mockReturnValue({ eq: vi.fn(() => Promise.resolve({ error: { message: 'x' } })) });
    renderWithProviders(<DailyEmailSettings />);
    const toggle = await screen.findByRole('switch');
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
  });

  it('explains when the server is not set up yet', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { code: '42703' } });
    renderWithProviders(<DailyEmailSettings />);
    expect(await screen.findByText(/isn.t available yet/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
