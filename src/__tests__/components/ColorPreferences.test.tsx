import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
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

  it('shows the colour pairing section when Colors is chosen', async () => {
    renderWithProviders(<ColorPreferences />);
    fireEvent.click(await screen.findByRole('button', { name: 'Colors' }));
    expect(await screen.findByText('Add a colour pairing you like')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Top color' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Bottom color' })).toBeTruthy();
  });

  it('lays the sections out as tabs across the top', async () => {
    renderWithProviders(<ColorPreferences />);
    const nav = await screen.findByRole('navigation', { name: 'Preference sections' });
    const names = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent);
    expect(names).toEqual(['Weather', 'Occasions', 'Colors', 'Email']);
    expect(screen.getByRole('button', { name: 'Weather' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('edits an occasion by picking it, then toggling pieces', async () => {
    renderWithProviders(<ColorPreferences />);
    fireEvent.click(await screen.findByRole('button', { name: 'Occasions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Work' }));
    const jeans = screen.getByRole('button', { name: 'Jeans for Work' });
    const before = jeans.getAttribute('aria-pressed');
    fireEvent.click(jeans);
    expect(jeans.getAttribute('aria-pressed')).not.toBe(before);
  });

  it('sets weather rules with tappable chips', async () => {
    renderWithProviders(<ColorPreferences />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add a clothing type: Add a clothing type…' }),
    );
    fireEvent.click(screen.getByRole('option', { name: 'Shorts' }));
    const cold = screen.getByRole('button', { name: 'Shorts in cold weather' });
    const before = cold.getAttribute('aria-pressed');
    fireEvent.click(cold);
    expect(cold.getAttribute('aria-pressed')).not.toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Stop customizing Shorts' }));
    expect(screen.queryByRole('button', { name: 'Shorts in cold weather' })).toBeNull();
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
    fireEvent.click(await screen.findByRole('button', { name: 'Colors' }));
    const top = await screen.findByRole('group', { name: 'Top color' });
    fireEvent.click(within(top).getByRole('button', { name: 'Navy Blue' }));
    const bottom = screen.getByRole('group', { name: 'Bottom color' });
    fireEvent.click(within(bottom).getByRole('button', { name: 'Beige' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to liked' }));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    // Exactly these keys: dropped columns (e.g. disliked_combinations) must not
    // come back, or saving fails.
    expect(mockUpsert.mock.calls[0][0]).toEqual({
      user_id: 'u1',
      liked_combinations: [{ topColor: 'navy blue', bottomColor: 'beige' }],
    });
  });
});
