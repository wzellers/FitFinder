// Verify the caller of an API route is a signed-in FitFinder user.
//
// The browser sends its Supabase access token as `Authorization: Bearer <jwt>`.
// getClaims() verifies the token (locally for asymmetric keys, otherwise via
// the Auth server), so a forged or expired token is rejected.

import { createClient } from '@supabase/supabase-js';

export async function getRequestUserId(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await supabase.auth.getClaims(match[1]);
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub;
  } catch {
    // Malformed tokens throw instead of returning an error.
    return null;
  }
}
