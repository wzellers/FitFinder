"use client";

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';

export default function AuthForm() {
  const { signUp, signIn, signOut, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignUp) {
      try {
        console.log('Starting signup process...');
        const { data, error } = await signUp(email, password);
        if (error) {
          console.error('SignUp error:', error);
          alert(error.message);
          return;
        }

        console.log('SignUp successful, data:', data);

        const newUser = data.user;
        if (!newUser) {
          console.error('No user in signup response');
          alert('Account created. Please check your email to confirm, then log in.');
          return;
        }

        // If your auth settings create a session on signup, upsert the profile now.
        // If not (email confirmation required), wait until the user logs in.
        if (data.session) {
          const { error: upsertErr } = await supabase
            .from('profiles')
            .upsert(
              { id: newUser.id, username: newUser.email, zip_code: null },
              { onConflict: 'id' }
            );

          if (upsertErr) {
            console.error('Profile upsert failed:', upsertErr);
            alert(`Account created but profile setup failed: ${upsertErr.message}`);
          } else {
            alert('Account created! You are signed in.');
          }
        } else {
          alert('Account created! Check your email for the confirmation link, then log in.');
        }
      } catch (err) {
        console.error('Signup error:', err);
        alert('An error occurred during signup. Please try again.');
      }
      return;
    }

    // ----- LOGIN PATH -----
    try {
      console.log('Starting signin process...');
      const { data, error } = await signIn(email, password);
      if (error) {
        console.error('SignIn error:', error);
        alert(error.message);
        return;
      }

      console.log('SignIn successful, data:', data);

      if (data.user) {
        const uid = data.user.id;

        // Create or update the profile row. This satisfies RLS because id === auth.uid().
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert(
            { id: uid, username: data.user.email, zip_code: null },
            { onConflict: 'id' }
          );

        if (upsertErr) {
          console.error('Profile upsert failed:', upsertErr);
        } else {
          console.log('Profile ensured for user:', uid);
        }
      }
    } catch (err) {
      console.error('Signin error:', err);
      alert('An error occurred during signin. Please try again.');
    }
  };

  if (user) {
    return (
      <div>
        <p>Signed in as: {user.email}</p>
        <button onClick={() => signOut()}>Sign Out</button>
      </div>
    );
  }

  return (
    <div className="auth-form bg-transparent">
      <h2>{isSignUp ? "Sign Up" : "Log In"}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ maxWidth: 350, width: '100%' }}
          />
          <input
            type="password"                 // ← mask the password
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ maxWidth: 350, width: '100%' }}
          />
        </div>
        <div className="button-container">
          <button type="button" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Log In" : "Sign Up"}
          </button>
          <button type="submit">
            {isSignUp ? "Sign Up" : "Log In"}
          </button>
        </div>
      </form>
    </div>
  );
}