import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' } })),
}));

const mockCalendarFn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockCalendarFn,
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'wear-1' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

import OutfitCalendar from '@/components/OutfitCalendar';

beforeEach(() => {
  mockCalendarFn.mockReturnValue({
    eq: vi.fn(() => ({
      gte: vi.fn(() => ({
        lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  });
});

describe('OutfitCalendar', () => {
  it('renders the calendar month view', async () => {
    renderWithProviders(<OutfitCalendar />);
    await waitFor(() => {
      // Should show day headers
      const dayHeaders = screen.queryAllByText(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/);
      expect(dayHeaders.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('shows loading skeleton initially', () => {
    mockCalendarFn.mockReturnValue({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => new Promise(() => {})),
        })),
        order: vi.fn(() => new Promise(() => {})),
      })),
    });
    const { container } = renderWithProviders(<OutfitCalendar />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders navigation arrows', async () => {
    renderWithProviders(<OutfitCalendar />);
    await waitFor(() => {
      const navBtns = document.querySelectorAll('.btn-ghost');
      expect(navBtns.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('navigates to previous month when clicking prev button', async () => {
    renderWithProviders(<OutfitCalendar />);
    await waitFor(() => screen.queryAllByText(/Sun|Mon/), { timeout: 3000 });

    // Get current month text
    const monthTexts = document.querySelectorAll('[class*="font-semibold"]');
    const prevBtn = document.querySelectorAll('.btn-ghost')[0];
    if (prevBtn && monthTexts.length > 0) {
      const before = monthTexts[0].textContent;
      fireEvent.click(prevBtn);
      await waitFor(() => {
        const after = document.querySelectorAll('[class*="font-semibold"]')[0]?.textContent;
        expect(after).not.toBe(before);
      });
    }
  });
});
