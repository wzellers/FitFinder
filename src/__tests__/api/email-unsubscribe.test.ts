import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockRpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: mockRpc } }));

import { GET, POST } from '@/app/api/email/unsubscribe/route';

const TOKEN = '3f1c2b9a-6d4e-4f1a-9b2c-8e7d6c5b4a39';
const req = (method: string, token = TOKEN) =>
  new NextRequest(`http://localhost/api/email/unsubscribe?token=${encodeURIComponent(token)}`, {
    method,
  });

beforeEach(() => {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: true, error: null });
});

describe('/api/email/unsubscribe', () => {
  it('asks for confirmation on GET without unsubscribing', async () => {
    const res = await GET(req('GET'));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="post"');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('uses the warm neutral colours, not an outfit', async () => {
    const html = await (await GET(req('GET'))).text();
    expect(html).toContain('background:#faf6f0');
    expect(html).toContain('background:#7a5a45;color:#ffffff');
    expect(html).not.toContain('#5c1a26');
  });

  it('unsubscribes on POST', async () => {
    const res = await POST(req('POST'));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("You're unsubscribed");
    expect(mockRpc).toHaveBeenCalledWith('unsubscribe_daily_email', { token: TOKEN });
  });

  it('rejects malformed tokens', async () => {
    const res = await POST(req('POST', '"><script>'));
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain('<script>');
    expect((await GET(req('GET', 'nope'))).status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('reports a database error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    expect((await POST(req('POST'))).status).toBe(500);
  });
});
