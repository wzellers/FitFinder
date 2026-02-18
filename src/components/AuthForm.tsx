"use client";

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

export default function AuthForm() {
  const { signUp, signIn } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await signUp(email, password);
        if (error) { showToast(error.message, 'error'); return; }

        const newUser = data.user;
        if (!newUser) {
          showToast('Account created — check your email to confirm, then log in.', 'info');
          return;
        }

        if (data.session) {
          await supabase
            .from('profiles')
            .upsert({ id: newUser.id, username: newUser.email, zip_code: null }, { onConflict: 'id' });
          showToast('Account created! You are signed in.', 'success');
        } else {
          showToast('Check your email for a confirmation link, then log in.', 'info');
        }
      } else {
        const { data, error } = await signIn(email, password);
        if (error) { showToast(error.message, 'error'); return; }

        if (data.user) {
          await supabase
            .from('profiles')
            .upsert({ id: data.user.id, username: data.user.email, zip_code: null }, { onConflict: 'id' });
        }
      }
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-8 w-full max-w-sm">
      <h2 className="text-xl font-semibold text-center mb-6 text-[var(--text)]">
        {isSignUp ? 'Create Account' : 'Welcome Back'}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Log In'}
        </button>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-[var(--accent)] hover:underline text-center"
        >
          {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </form>
    </div>
  );
}
