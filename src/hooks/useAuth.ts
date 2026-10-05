import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  // True until the stored session has been read, so the UI can wait instead
  // of flashing the login form for a signed-in user.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Supabase emits several auth events on load (INITIAL_SESSION, SIGNED_IN,
    // TOKEN_REFRESHED), each with a new user object. Keep the existing object
    // while the user is the same, so effects keyed on `user` don't refetch.
    const applyUser = (next: User | null) =>
      setUser((prev) => (prev && next && prev.id === next.id ? prev : next));

    supabase.auth
      .getSession()
      .then(({ data }) => applyUser(data.session?.user ?? null))
      .finally(() => setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp = (email: string, password: string) => supabase.auth.signUp({ email, password });

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = () => supabase.auth.signOut();

  return { user, loading, signUp, signIn, signOut };
}
