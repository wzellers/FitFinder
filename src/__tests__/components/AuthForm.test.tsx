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
    loading: false,
    signUp: mockSignUp,
    signIn: mockSignIn,
    signOut: vi.fn(),
  });
});

describe('AuthForm', () => {
  it('renders sign-in form by default', () => {
    renderWithProviders(<AuthForm />);
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
  });

  it('toggles to sign-up form', () => {
    renderWithProviders(<AuthForm />);
    fireEvent.click(screen.getByText('New here? Create an account'));
    expect(screen.getByText('Create your account')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
  });

  it('toggles back to sign-in', () => {
    renderWithProviders(<AuthForm />);
    fireEvent.click(screen.getByText('New here? Create an account'));
    fireEvent.click(screen.getByText('Have an account? Log in'));
    expect(screen.getByText('Welcome back')).toBeTruthy();
  });

  it('calls signIn on submit in sign-in mode', async () => {
    mockSignIn.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    renderWithProviders(<AuthForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('user@test.com', 'pass1234'));
  });

  it('calls signUp on submit in sign-up mode', async () => {
    mockSignUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    renderWithProviders(<AuthForm />);
    fireEvent.click(screen.getByText('New here? Create an account'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'newpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(mockSignUp).toHaveBeenCalledWith('new@test.com', 'newpass'));
  });

  it('shows the sign-in error inline', async () => {
    mockSignIn.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid credentials' } });
    renderWithProviders(<AuthForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@x.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeTruthy());
  });

  it('disables button while loading', async () => {
    let resolveSignIn: (v: unknown) => void;
    mockSignIn.mockReturnValueOnce(
      new Promise((r) => {
        resolveSignIn = r;
      }),
    );
    renderWithProviders(<AuthForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@x.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Logging in…')).toBeTruthy();
    const btn = screen.getByText('Logging in…').closest('button');
    expect(btn?.disabled).toBe(true);
    resolveSignIn!({ data: { user: null, session: null }, error: null });
  });

  it('explains wrong credentials in plain language', async () => {
    mockSignIn.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    renderWithProviders(<AuthForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@x.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/don't match/);
  });
});
