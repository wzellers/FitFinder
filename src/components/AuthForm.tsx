"use client";

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
// Removed import Squares from './Squares';

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
        console.log('User from signup:', data.user);
        
        // Use the user from the signup response directly
        const user = data.user;
        
        if (!user) {
          console.error('No user in signup response');
          alert('Account created but user data is missing. Please try logging in.');
          return;
        }

        console.log('User found:', user.id, user.email);
        console.log('Attempting to create profile...');

        // Create profile record (only with columns that exist)
        const profileData = {
          id: user.id,
          username: user.email,
          zip_code: null,
          preferences: {}
        };

        console.log('Profile data to insert:', profileData);

        const { data: profileInsertData, error: profileError } = await supabase
          .from('profiles')
          .insert([profileData])
          .select();

        console.log('Profile insert result:', { profileInsertData, profileError });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          alert(`Account created but profile setup failed: ${profileError.message}`);
        } else {
          console.log('Profile created successfully for user:', user.id);
          console.log('Profile data inserted:', profileInsertData);
          alert('Account created successfully! Check your email for a confirmation link.');
        }
      } catch (error) {
        console.error('Signup error:', error);
        alert('An error occurred during signup. Please try again.');
      }
    } else {
      try {
        console.log('Starting signin process...');
        const { data, error } = await signIn(email, password);
        if (error) {
          console.error('SignIn error:', error);
          alert(error.message);
          return;
        }

        console.log('SignIn successful, data:', data);
        
        // Check if user has a profile, create one if not
        if (data.user) {
          console.log('Checking if profile exists for user:', data.user.id);
          
          const { data: existingProfile, error: profileCheckError } = await supabase
            .from('profiles')
            .select('id, username')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profileCheckError) {
            console.error('Error checking profile:', profileCheckError);
          }

          if (!existingProfile) {
            console.log('No profile found, creating one...');
            
            const profileData = {
              id: data.user.id,
              username: data.user.email,
              zip_code: null,
              preferences: {}
            };

            console.log('Profile data to insert:', profileData);

            const { data: profileInsertData, error: profileError } = await supabase
              .from('profiles')
              .insert([profileData])
              .select();

            if (profileError) {
              console.error('Error creating profile:', profileError);
            } else {
              console.log('Profile created successfully for existing user:', data.user.id);
              console.log('Profile data inserted:', profileInsertData);
            }
          } else {
            console.log('Profile already exists for user:', data.user.id);
            
            // Check if the existing profile has a NULL username and update it
            if (existingProfile.username === null) {
              console.log('Updating NULL username to email...');
              
              const { data: updateData, error: updateError } = await supabase
                .from('profiles')
                .update({ username: data.user.email })
                .eq('id', data.user.id)
                .select();

              if (updateError) {
                console.error('Error updating username:', updateError);
              } else {
                console.log('Username updated successfully:', updateData);
              }
            } else {
              console.log('Profile already has username:', existingProfile.username);
            }
          }
        }
      } catch (error) {
        console.error('Signin error:', error);
        alert('An error occurred during signin. Please try again.');
      }
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
            type="text"
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