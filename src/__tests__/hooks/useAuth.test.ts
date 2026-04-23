import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

// Mock supabaseClient
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import { supabase } from '@/lib/supabaseClient';

const mockUser = {
  id: 'user-123',
  email: 'user@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
};

let authStateCallback: ((event: string, session: unknown) => void) | null = null;
const unsubscribeMock = vi.fn();

beforeEach(() => {
  authStateCallback = null;
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: null },
    error: null,
  } as unknown as ReturnType<typeof supabase.auth.getSession>);

  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
    authStateCallback = cb as typeof authStateCallback;
    return { data: { subscription: { unsubscribe: unsubscribeMock } } } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>;
  });
});

describe('useAuth', () => {
  it('initial user is null', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {});
    expect(result.current.user).toBeNull();
  });

  it('sets user after getSession resolves with session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { user: mockUser } },
      error: null,
    } as unknown as ReturnType<typeof supabase.auth.getSession>);

    const { result } = renderHook(() => useAuth());
    await act(async () => {});
    expect(result.current.user).toEqual(mockUser);
  });

  it('sets up onAuthStateChange subscription on mount', () => {
    renderHook(() => useAuth());
    expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useAuth());
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('updates user when auth state changes', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {});

    expect(result.current.user).toBeNull();

    await act(async () => {
      authStateCallback?.('SIGNED_IN', { user: mockUser });
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('clears user when signed out', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { user: mockUser } },
      error: null,
    } as unknown as ReturnType<typeof supabase.auth.getSession>);

    const { result } = renderHook(() => useAuth());
    await act(async () => {});
    expect(result.current.user).toEqual(mockUser);

    await act(async () => {
      authStateCallback?.('SIGNED_OUT', null);
    });

    expect(result.current.user).toBeNull();
  });

  it('signUp calls supabase.auth.signUp', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: mockUser, session: null },
      error: null,
    } as unknown as ReturnType<typeof supabase.auth.signUp>);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp('test@example.com', 'password123');
    });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('signIn calls supabase.auth.signInWithPassword', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: mockUser, session: null },
      error: null,
    } as unknown as ReturnType<typeof supabase.auth.signInWithPassword>);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn('test@example.com', 'password123');
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('signOut calls supabase.auth.signOut', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
