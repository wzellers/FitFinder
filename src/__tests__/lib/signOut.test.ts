// Regression: signing out must clear the local session even when the server
// says the session is already gone (403 session_not_found), e.g. after the
// account was signed out everywhere from another device. Older auth-js
// returned an error and kept the user signed in, so the button did nothing.

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = 'https://project.supabase.co';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const accessToken = [
  b64({ alg: 'HS256', typ: 'JWT' }),
  b64({ sub: 'user-1', session_id: 'gone', role: 'authenticated', exp: now + 3600 }),
  'sig',
].join('.');
const user = { id: 'user-1', aud: 'authenticated', email: 'a@b.c' };

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

// The auth server: /user works (token still valid), /logout says the session
// no longer exists.
const fakeAuthServer: typeof fetch = async (input) => {
  const url = String(input instanceof Request ? input.url : input);
  const json = (status: number, body: object) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  if (url.includes('/auth/v1/user')) return json(200, user);
  if (url.includes('/auth/v1/logout')) {
    return json(403, { code: 403, error_code: 'session_not_found', msg: 'Session not found' });
  }
  return json(404, {});
};

describe('signOut when the server already ended the session', () => {
  it('still signs out locally', async () => {
    const supabase = createClient(URL, 'anon-key', {
      global: { fetch: fakeAuthServer },
      auth: { storage: memoryStorage(), autoRefreshToken: false, detectSessionInUrl: false },
    });
    const set = await supabase.auth.setSession({ access_token: accessToken, refresh_token: 'r' });
    expect(set.error).toBeNull();
    expect((await supabase.auth.getSession()).data.session).not.toBeNull();

    const events: string[] = [];
    supabase.auth.onAuthStateChange((event) => events.push(event));
    await supabase.auth.signOut();

    expect((await supabase.auth.getSession()).data.session).toBeNull();
    expect(events).toContain('SIGNED_OUT');
  });
});
