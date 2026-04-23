import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthForm from '@/components/AuthForm';
import { renderWithProviders } from '../utils/renderWithProviders';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

import { useAuth } from '@/hooks/useAuth';

const mockSignUp = vi.fn();
const mockSignIn = vi.fn();

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    signUp: mockSignUp,
    signIn: mockSignIn,
    signOut: vi.fn(),
  });
});

describe('AuthForm', () => {
  it('renders sign-in form by default', () => {
    renderWithProviders(<AuthForm />);
    expect(screen.getByText('Welcome Back')).toBeTruthy();
    expect(screen.getByText('Log In')).toBeTruthy();
  });

  it('toggles to sign-up form', () => {
    renderWithProviders(<AuthForm />);
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    expect(screen.getByText('Create Account')).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('toggles back to sign-in', () => {
    renderWithProviders(<AuthForm />);
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.click(screen.getByText('Already have an account? Log in'));
    expect(screen.getByText('Welcome Back')).toBeTruthy();
  });

  it('calls signIn on submit in sign-in mode', async () => {
    mockSignIn.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    renderWithProviders(<AuthForm />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByText('Log In'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('user@test.com', 'pass1234'));
  });

  it('calls signUp on submit in sign-up mode', async () => {
    mockSignUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    renderWithProviders(<AuthForm />);
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'newpass' } });
    fireEvent.click(screen.getByText('Sign Up'));
    await waitFor(() => expect(mockSignUp).toHaveBeenCalledWith('new@test.com', 'newpass'));
  });

  it('shows error toast on sign-in failure', async () => {
    mockSignIn.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid credentials' } });
    renderWithProviders(<AuthForm />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'x@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Log In'));
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeTruthy());
  });

  it('disables button while loading', async () => {
    let resolveSignIn: (v: unknown) => void;
    mockSignIn.mockReturnValueOnce(new Promise((r) => { resolveSignIn = r; }));
    renderWithProviders(<AuthForm />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'x@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByText('Log In'));
    expect(screen.getByText('Please wait...')).toBeTruthy();
    const btn = screen.getByText('Please wait...').closest('button');
    expect(btn?.disabled).toBe(true);
    resolveSignIn!({ data: { user: null, session: null }, error: null });
  });
});
