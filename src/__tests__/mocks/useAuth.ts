import { vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

export const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
} as User;

export const mockUseAuth = {
  user: mockUser,
  signUp: vi.fn(() => Promise.resolve({ data: { user: mockUser, session: null }, error: null })),
  signIn: vi.fn(() => Promise.resolve({ data: { user: mockUser, session: { user: mockUser } }, error: null })),
  signOut: vi.fn(() => Promise.resolve({ error: null })),
};
