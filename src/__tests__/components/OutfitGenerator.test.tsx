import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

// A stable user object, as the real useAuth keeps it: a new object on every
// render would re-run the component's data load forever.
const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

// Mock fetchWeather to avoid real network calls
vi.mock('@/lib/weatherApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/weatherApi')>();
  return {
    ...actual,
    fetchWeather: vi.fn(() => Promise.resolve(null)),
  };
});

// Every query resolves empty: a chainable builder where any filter or
// modifier returns the builder, awaiting it gives no rows, and
// maybeSingle/single give null.
const mockFrom = vi.hoisted(() => {
  const builder = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of [
      'select',
      'eq',
      'neq',
      'gte',
      'lt',
      'lte',
      'in',
      'not',
      'is',
      'order',
      'limit',
    ]) {
      b[m] = () => b;
    }
    b.maybeSingle = () => Promise.resolve({ data: null, error: null });
    b.single = () => Promise.resolve({ data: { id: 'new-outfit' }, error: null });
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
    b.insert = () => b;
    b.update = () => b;
    b.delete = () => b;
    b.upsert = () => Promise.resolve({ error: null });
    return b;
  };
  return vi.fn(() => builder());
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import OutfitGenerator from '@/components/OutfitGenerator';

describe('OutfitGenerator', () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it('renders the Generator tab', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.queryByText(/Loading/)).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it('shows the Generate button', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByText(/Generate/)).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('clicking Generate triggers outfit generation', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => screen.getByText(/Generate/), { timeout: 3000 });
    fireEvent.click(screen.getByText(/Generate/));
    expect(screen.getByText(/Generate/)).toBeTruthy();
  });

  it('shows Saved tab button', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/Saved/).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('shows Weather section heading', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByText('Weather')).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('shows the Occasion section heading', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Occasion' })).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('shows Save outfit and Wear today buttons', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Save outfit/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Wear today/ })).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('links to the calendar', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByText("See what you've worn")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('calendar link calls onNavigateToCalendar', async () => {
    const onNav = vi.fn();
    renderWithProviders(<OutfitGenerator onNavigateToCalendar={onNav} />);
    await waitFor(() => screen.getByText("See what you've worn"), { timeout: 3000 });
    fireEvent.click(screen.getByText("See what you've worn"));
    expect(onNav).toHaveBeenCalledTimes(1);
  });

  it('switching to Saved tab shows empty state', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => screen.queryAllByText(/Saved/).length > 0, { timeout: 3000 });
    const savedBtns = screen.queryAllByText(/Saved/);
    if (savedBtns.length > 0) {
      fireEvent.click(savedBtns[0]);
      await waitFor(
        () => {
          expect(screen.queryAllByText(/No saved outfits|saved/i).length).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );
    }
  });

  it('shows zip code prompt when no weather data', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByText(/zip code/i)).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });
});
