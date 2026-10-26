import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

// Stable, as the real useAuth keeps it (a new object per render reloads data).
const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMaybeSingle,
          eq: vi.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'new' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      upsert: mockUpsert,
    })),
  },
}));

import ColorPreferences from '@/components/ColorPreferences';

beforeEach(() => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockReset();
  mockUpsert.mockReturnValue(
    Object.assign(Promise.resolve({ error: null }), {
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'pref' }, error: null })),
      })),
    }),
  );
});

describe('ColorPreferences', () => {
  it('renders without crashing', async () => {
    renderWithProviders(<ColorPreferences />);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/Weather|Colors/).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('shows temperature threshold inputs', async () => {
    renderWithProviders(<ColorPreferences />);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/Cold|Cool|Warm/).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('has Colors and Weather section tabs', async () => {
    renderWithProviders(<ColorPreferences />);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/Colors|Weather/).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('shows color combination section when Colors tab is clicked', async () => {
    renderWithProviders(<ColorPreferences />);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/Colors/).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
    fireEvent.click(screen.queryAllByText(/Colors/)[0]);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/Add Color Combination/).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('weather section defaults to no custom rules', async () => {
    renderWithProviders(<ColorPreferences />);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/No custom weather rules set/).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('saves a liked combination with only the columns that exist', async () => {
    renderWithProviders(<ColorPreferences />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Colors' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Top Color' }));
    fireEvent.click(screen.getByRole('button', { name: 'navy blue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bottom Color' }));
    fireEvent.click(screen.getByRole('button', { name: 'beige' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Liked' }));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    // Exactly these keys: dropped columns (e.g. disliked_combinations) must not
    // come back, or saving fails.
    expect(mockUpsert.mock.calls[0][0]).toEqual({
      user_id: 'u1',
      liked_combinations: [{ topColor: 'navy blue', bottomColor: 'beige' }],
    });
  });
});
