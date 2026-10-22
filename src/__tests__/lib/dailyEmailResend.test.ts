import { describe, it, expect, vi } from 'vitest';
import { resendSender } from '@/lib/dailyEmail/resend';

const email = {
  to: 'me@example.com',
  subject: "Today's outfit",
  html: '<p>hi</p>',
  text: 'hi',
  headers: { 'List-Unsubscribe': '<https://x/unsub>' },
};

describe('resendSender', () => {
  it('posts the email to Resend', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    await resendSender('re_key', 'FitFinder <a@b.c>', fetchImpl)(email);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    expect(JSON.parse(init.body)).toEqual({ from: 'FitFinder <a@b.c>', ...email });
  });

  it("throws with Resend's message on failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response('{"name":"validation_error","message":"bad from"}', { status: 422 }),
      );
    await expect(resendSender('re_key', 'x', fetchImpl)(email)).rejects.toThrow(
      'Resend 422: bad from',
    );
  });
});
