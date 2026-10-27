import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
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
});
