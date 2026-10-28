import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

// Stable, as the real useAuth keeps it (a new object per render reloads data).
const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

function makeChainable(result = { data: [] as unknown[], error: null }) {
  const obj: Record<string, unknown> = { ...result };
  const methods = ['eq', 'gte', 'lte', 'order', 'limit', 'not', 'is', 'in'];
  methods.forEach((m) => {
    obj[m] = vi.fn(() => Promise.resolve(result));
  });
  obj['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return obj;
}

const mockFrom = vi.hoisted(() =>
  vi.fn(() => ({
    select: vi.fn(() => makeChainable()),
  })),
);

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: mockFrom },
}));

import WardrobeStats from '@/components/WardrobeStats';

beforeEach(() => {
  mockFrom.mockReset();
  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => makeChainable()),
  }));
});

function makeNeverChainable() {
  // Returns a chainable object where every method returns itself,
  // and awaiting it (via .then) never resolves — so loading stays true.
  const obj: Record<string, unknown> = {};
  const chainMethods = [
    'eq',
    'gte',
    'lte',
    'order',
    'limit',
    'not',
    'is',
    'in',
    'neq',
    'maybeSingle',
    'single',
  ];
  chainMethods.forEach((m) => {
    obj[m] = vi.fn(() => obj);
  });
  // Make thenable but never-resolving
  obj['then'] = (_resolve: unknown) => new Promise(() => {});
  return obj;
}

describe('WardrobeStats', () => {
  it('shows loading skeleton initially', () => {
    // Override with never-resolving chainable so loading state stays true
    mockFrom.mockReturnValue({
      select: vi.fn(() => makeNeverChainable()),
    });
    const { container } = renderWithProviders(<WardrobeStats />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the summary after loading', async () => {
    renderWithProviders(<WardrobeStats />);
    await waitFor(
      () => {
        expect(screen.getByText('Summary')).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('shows time period toggle buttons', async () => {
    renderWithProviders(<WardrobeStats />);
    await waitFor(
      () => {
        expect(screen.getByText('Week')).toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(screen.getByRole('button', { name: 'Month' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('All time')).toBeTruthy();
  });

  it('switches period in place, without going back to skeletons', async () => {
    const { container } = renderWithProviders(<WardrobeStats />);
    await screen.findByText('Summary');
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
  });

  it('shows highlights and the new insight cards', async () => {
    renderWithProviders(<WardrobeStats />);
    const highlights = await screen.findByRole('region', { name: 'Highlights' });
    for (const label of ['Streak', 'Go-to pairing', 'Busiest day', 'Repeats']) {
      expect(highlights.textContent).toContain(label);
    }
    expect(screen.getByRole('heading', { name: 'Days you dress up' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What you wear' })).toBeTruthy();
  });

  it('lets you choose which cards show, and remembers it', async () => {
    localStorage.clear();
    const { unmount } = renderWithProviders(<WardrobeStats />);
    fireEvent.click(await screen.findByRole('button', { name: 'Customize' }));
    const picker = screen.getByRole('region', { name: 'Cards to show' });
    fireEvent.click(within(picker).getByRole('button', { name: 'Colors' }));
    expect(screen.queryByRole('heading', { name: 'Colors' })).toBeNull();
    fireEvent.click(within(picker).getByRole('button', { name: 'Highlights' }));
    expect(screen.queryByRole('region', { name: 'Highlights' })).toBeNull();

    unmount();
    renderWithProviders(<WardrobeStats />);
    await screen.findByText('Summary');
    expect(screen.queryByRole('heading', { name: 'Colors' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Most worn' })).toBeTruthy();
  });
});
