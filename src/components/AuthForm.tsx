'use client';

import React, { useId, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

/** Turn Supabase auth errors into plain guidance. */
function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match. Check them and try again.";
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email first — check your inbox for the link we sent.';
  }
  if (/already registered/i.test(message)) {
    return 'An account with this email already exists. Log in instead.';
  }
  return message;
}

export default function AuthForm() {
  const { signUp, signIn } = useAuth();
  const { showToast } = useToast();
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { data, error } = await signUp(email, password);
        if (error) {
          setError(friendlyAuthError(error.message));
          return;
        }

        const newUser = data.user;
        if (!newUser || !data.session) {
          showToast('Check your inbox — we sent a link to confirm your account.', 'info', 6000);
          return;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            { id: newUser.id, username: newUser.email, zip_code: null },
            { onConflict: 'id' },
          );
        if (profileError) {
          showToast(
            "Account created, but we couldn't finish setting up your profile. Your ZIP code can be added in Settings.",
            'warning',
          );
        } else {
          showToast('Account created. Welcome to FitFinder!', 'success');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(friendlyAuthError(error.message));
          return;
        }
      }
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel w-full max-w-sm px-7 pt-9 pb-8">
      <h2 className="text-2xl mb-1">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        {isSignUp ? 'Start tagging your closet.' : 'Log in to see your closet.'}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-email`} className="text-sm font-semibold">
            Email
          </label>
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="min-h-[44px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-password`} className="text-sm font-semibold">
            Password
          </label>
          <input
            id={`${id}-password`}
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            minLength={isSignUp ? 6 : undefined}
            aria-describedby={isSignUp ? `${id}-password-hint` : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="min-h-[44px]"
          />
          {isSignUp && (
            <span id={`${id}-password-hint`} className="text-xs text-[var(--text-secondary)]">
              At least 6 characters.
            </span>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
          {loading
            ? isSignUp
              ? 'Creating account…'
              : 'Logging in…'
            : isSignUp
              ? 'Create account'
              : 'Log in'}
        </button>

        <div className="divider my-1" />

        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          className="min-h-[44px] text-sm font-semibold text-[var(--carbon)] hover:underline"
        >
          {isSignUp ? 'Have an account? Log in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  );
}
