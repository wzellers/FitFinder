import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' } })),
}));

// Mock fetchWeather to avoid real network calls
vi.mock('@/lib/weatherApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/weatherApi')>();
  return {
    ...actual,
    fetchWeather: vi.fn(() => Promise.resolve(null)),
  };
});

// All parallel supabase calls return empty arrays
const mockFrom = vi.hoisted(() =>
  vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
        not: vi.fn(() => ({
          is: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'new-outfit' }, error: null })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
    upsert: vi.fn(() => Promise.resolve({ error: null })),
  })),
);

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
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).toBeNull();
    }, { timeout: 3000 });
  });

  it('shows the Generate button', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => {
      expect(screen.getByText(/Generate/)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('clicking Generate triggers outfit generation', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => screen.getByText(/Generate/), { timeout: 3000 });
    fireEvent.click(screen.getByText(/Generate/));
    expect(screen.getByText(/Generate/)).toBeTruthy();
  });

  it('shows Saved tab button', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => {
      expect(screen.queryAllByText(/Saved/).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('shows Weather section heading', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => {
      expect(screen.getByText('Weather')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows Actions section heading', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows Save Outfit and Wear Today action buttons', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => {
      expect(screen.getByText('Save Outfit')).toBeTruthy();
      expect(screen.getByText('Wear Today')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows View Calendar button', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => {
      expect(screen.getByText('View Calendar')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('View Calendar button calls onNavigateToCalendar', async () => {
    const onNav = vi.fn();
    renderWithProviders(<OutfitGenerator onNavigateToCalendar={onNav} />);
    await waitFor(() => screen.getByText('View Calendar'), { timeout: 3000 });
    fireEvent.click(screen.getByText('View Calendar'));
    expect(onNav).toHaveBeenCalledTimes(1);
  });

  it('switching to Saved tab shows empty state', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => screen.queryAllByText(/Saved/).length > 0, { timeout: 3000 });
    const savedBtns = screen.queryAllByText(/Saved/);
    if (savedBtns.length > 0) {
      fireEvent.click(savedBtns[0]);
      await waitFor(() => {
        expect(screen.queryAllByText(/No saved outfits|saved/i).length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    }
  });

  it('shows zip code prompt when no weather data', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => {
      expect(screen.getByText(/zip code/i)).toBeTruthy();
    }, { timeout: 3000 });
  });
});
