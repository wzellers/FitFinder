import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSendDueEmails = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() => vi.fn(() => ({ fake: 'db' })));
vi.mock('@/lib/dailyEmail/sender', () => ({ sendDueEmails: mockSendDueEmails }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

import { POST } from '@/app/api/email/send-due/route';

const SECRET = 'test-cron-secret';
const req = (auth?: string) =>
  new NextRequest('https://fitfinder.example/api/email/send-due', {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('APP_URL', '');
  mockSendDueEmails.mockReset();
  mockSendDueEmails.mockResolvedValue({ optedIn: 1, due: 1, sent: 1, failed: 0 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/api/email/send-due', () => {
  it('rejects callers without the cron secret', async () => {
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req('Bearer wrong-secret'))).status).toBe(401);
    expect((await POST(req(SECRET))).status).toBe(401);
    expect(mockSendDueEmails).not.toHaveBeenCalled();
  });

  it('refuses to run when not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await POST(req(`Bearer ${SECRET}`))).status).toBe(500);
    expect(mockSendDueEmails).not.toHaveBeenCalled();
  });

  it('sends due emails with the service-role client and returns the summary', async () => {
    const res = await POST(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ optedIn: 1, due: 1, sent: 1, failed: 0 });
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'service-role',
      expect.anything(),
    );
    const deps = mockSendDueEmails.mock.calls[0][0];
    expect(deps.db).toEqual({ fake: 'db' });
    expect(deps.appUrl).toBe('https://fitfinder.example');
    expect(typeof deps.sendEmail).toBe('function');
  });

  it('prefers APP_URL for links', async () => {
    vi.stubEnv('APP_URL', 'https://fitfinder.app/');
    await POST(req(`Bearer ${SECRET}`));
    expect(mockSendDueEmails.mock.calls[0][0].appUrl).toBe('https://fitfinder.app');
  });

  it('reports a failed run', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSendDueEmails.mockRejectedValue(new Error('profiles: down'));
    expect((await POST(req(`Bearer ${SECRET}`))).status).toBe(500);
  });
});
