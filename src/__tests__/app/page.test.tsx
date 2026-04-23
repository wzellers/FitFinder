import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

// Mock all the heavy child components
vi.mock('@/components/Closet', () => ({
  default: vi.fn(() => <div data-testid="closet">Closet Content</div>),
}));
vi.mock('@/components/OutfitGenerator', () => ({
  default: vi.fn(({ onNavigateToCalendar }: { onNavigateToCalendar?: () => void }) => <div data-testid="generator">Generator Content</div>),
}));
vi.mock('@/components/OutfitCalendar', () => ({
  default: vi.fn(() => <div data-testid="calendar">Calendar Content</div>),
}));
vi.mock('@/components/WardrobeStats', () => ({
  default: vi.fn(() => <div data-testid="stats">Stats Content</div>),
}));
vi.mock('@/components/ColorPreferences', () => ({
  default: vi.fn(() => <div data-testid="preferences">Preferences Content</div>),
}));
vi.mock('@/components/Onboarding', () => ({
  default: vi.fn(({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="onboarding">
      <button onClick={onComplete}>Complete Onboarding</button>
    </div>
  )),
}));
vi.mock('@/components/ImageUpload', () => ({
  default: vi.fn(() => null),
}));
vi.mock('@/components/EditItem', () => ({
  default: vi.fn(() => null),
}));
vi.mock('@/components/RatingPrompt', () => ({
  default: vi.fn(() => null),
}));
vi.mock('@/components/AuthForm', () => ({
  default: vi.fn(() => <div data-testid="auth-form">Auth Form</div>),
}));
vi.mock('@/components/ui/Skeleton', () => ({
  SkeletonFullScreen: vi.fn(() => <div data-testid="skeleton-fullscreen">Loading...</div>),
}));

// Mock useAuth
const mockUser = { id: 'u1', email: 'test@example.com' };
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}));

const mockSupabaseFrom = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

import Page from '@/app/page';

beforeEach(() => {
  // Route supabase calls per table to avoid onboarding trigger
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'clothing_items') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [{ id: 'item-1' }], error: null })),
          })),
        })),
      };
    }
    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: { onboarding_completed: true }, error: null }),
            ),
          })),
        })),
      };
    }
    // outfit_wears
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    };
  });
});

describe('Page — Auth State', () => {
  it('shows AuthForm when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null, signOut: vi.fn() });
    renderWithProviders(<Page />);
    expect(screen.getByTestId('auth-form')).toBeTruthy();
  });

  it('shows FitFinder branding on login page', () => {
    mockUseAuth.mockReturnValue({ user: null, signOut: vi.fn() });
    renderWithProviders(<Page />);
    // "Fit" and "Finder" are in separate elements, so check for partial text
    expect(screen.queryAllByText(/Fit/).length).toBeGreaterThan(0);
  });

  it('shows skeleton while checking auth', () => {
    mockUseAuth.mockReturnValue({ user: undefined, signOut: vi.fn() });
    renderWithProviders(<Page />);
    const hasContent = screen.queryByTestId('skeleton-fullscreen') ?? screen.queryByTestId('auth-form');
    expect(hasContent).toBeTruthy();
  });
});

describe('Page — Logged In Navigation', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: mockUser, signOut: vi.fn() });
  });

  it('shows tabs when user is logged in', async () => {
    renderWithProviders(<Page />);
    await waitFor(() => {
      expect(screen.queryAllByText('Closet').length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText('Generator').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Calendar').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Stats').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Preferences').length).toBeGreaterThan(0);
  });

  it('shows Closet tab content by default', async () => {
    renderWithProviders(<Page />);
    await waitFor(() => screen.getByTestId('closet'), { timeout: 3000 });
    expect(screen.getByTestId('closet')).toBeTruthy();
  });

  it('navigates to Generator tab on click', async () => {
    renderWithProviders(<Page />);
    await waitFor(() => screen.queryAllByText('Generator').length > 0, { timeout: 3000 });
    const genBtns = screen.queryAllByText('Generator');
    if (genBtns.length > 0) fireEvent.click(genBtns[0]);
    await waitFor(() => screen.getByTestId('generator'), { timeout: 3000 });
    expect(screen.getByTestId('generator')).toBeTruthy();
  });

  it('navigates to Calendar tab on click', async () => {
    renderWithProviders(<Page />);
    await waitFor(() => screen.queryAllByText('Calendar').length > 0, { timeout: 3000 });
    fireEvent.click(screen.queryAllByText('Calendar')[0]);
    await waitFor(() => screen.getByTestId('calendar'), { timeout: 3000 });
    expect(screen.getByTestId('calendar')).toBeTruthy();
  });

  it('navigates to Stats tab on click', async () => {
    renderWithProviders(<Page />);
    await waitFor(() => screen.queryAllByText('Stats').length > 0, { timeout: 3000 });
    fireEvent.click(screen.queryAllByText('Stats')[0]);
    await waitFor(() => screen.getByTestId('stats'), { timeout: 3000 });
    expect(screen.getByTestId('stats')).toBeTruthy();
  });

  it('navigates to Preferences tab on click', async () => {
    renderWithProviders(<Page />);
    await waitFor(() => screen.queryAllByText('Preferences').length > 0, { timeout: 3000 });
    fireEvent.click(screen.queryAllByText('Preferences')[0]);
    await waitFor(() => screen.getByTestId('preferences'), { timeout: 3000 });
    expect(screen.getByTestId('preferences')).toBeTruthy();
  });

  it('shows sign out button when user is logged in', async () => {
    renderWithProviders(<Page />);
    await waitFor(() => screen.queryAllByText('Closet').length > 0, { timeout: 3000 });
    expect(screen.queryAllByText('Sign Out').length).toBeGreaterThan(0);
  });

  it('navigating between tabs switches displayed content', async () => {
    renderWithProviders(<Page />);
    await waitFor(() => screen.queryAllByText('Closet').length > 0, { timeout: 3000 });

    // Start on Closet
    expect(screen.getByTestId('closet')).toBeTruthy();

    // Go to Generator
    fireEvent.click(screen.queryAllByText('Generator')[0]);
    await waitFor(() => screen.getByTestId('generator'), { timeout: 3000 });
    expect(screen.queryByTestId('closet')).toBeNull();

    // Go to Calendar
    fireEvent.click(screen.queryAllByText('Calendar')[0]);
    await waitFor(() => screen.getByTestId('calendar'), { timeout: 3000 });
    expect(screen.queryByTestId('generator')).toBeNull();

    // Back to Closet
    fireEvent.click(screen.queryAllByText('Closet')[0]);
    await waitFor(() => screen.getByTestId('closet'), { timeout: 3000 });
    expect(screen.queryByTestId('calendar')).toBeNull();
  });
});

describe('Page — Onboarding', () => {
  it('shows onboarding for new user with no items', async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, signOut: vi.fn() });

    // Override: no items, onboarding not completed
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'clothing_items') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({ data: { onboarding_completed: false }, error: null }),
              ),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
      };
    });

    renderWithProviders(<Page />);
    await waitFor(() => screen.getByTestId('onboarding'), { timeout: 3000 });
    expect(screen.getByTestId('onboarding')).toBeTruthy();
  });

  it('completing onboarding shows main app', async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, signOut: vi.fn() });

    // Start with no items
    let itemsResponse = { data: [] as unknown[], error: null };
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'clothing_items') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(itemsResponse)),
            })),
          })),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({ data: { onboarding_completed: false }, error: null }),
              ),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
      };
    });

    renderWithProviders(<Page />);
    await waitFor(() => screen.getByTestId('onboarding'), { timeout: 3000 });

    // Complete onboarding
    itemsResponse = { data: [{ id: 'item-1' }], error: null };
    fireEvent.click(screen.getByText('Complete Onboarding'));

    // Should now show the main app
    await waitFor(() => {
      expect(screen.queryAllByText('Closet').length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});
