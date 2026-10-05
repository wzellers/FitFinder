import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Supabase emits several auth events on load (INITIAL_SESSION, SIGNED_IN,
    // TOKEN_REFRESHED), each with a new user object. Keep the existing object
    // while the user is the same, so effects keyed on `user` don't refetch.
    const applyUser = (next: User | null) =>
      setUser((prev) => (prev && next && prev.id === next.id ? prev : next));

    supabase.auth.getSession().then(({ data }) => {
      applyUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp = (email: string, password: string) => supabase.auth.signUp({ email, password });

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = () => supabase.auth.signOut();

  return { user, signUp, signIn, signOut };
}
