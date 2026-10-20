// Deliver the daily email through Resend's HTTP API.
//
// A plain fetch rather than Resend's SDK: one endpoint, and the sender already
// builds the subject, HTML, text and headers.

import type { OutgoingEmail } from '@/lib/dailyEmail/sender';

const RESEND_URL = 'https://api.resend.com/emails';

/** Resend's test sender; it can only email the Resend account's own address. */
export const RESEND_TEST_FROM = 'FitFinder <onboarding@resend.dev>';

export function resendSender(
  apiKey: string,
  from: string,
  fetchImpl: typeof fetch = fetch,
): (email: OutgoingEmail) => Promise<void> {
  return async ({ to, subject, html, text, headers }) => {
    const res = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, text, headers }),
    });
    if (!res.ok) {
      // Resend's error body is { name, message }; never includes the address.
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(`Resend ${res.status}: ${body?.message ?? res.statusText}`);
    }
  };
}
