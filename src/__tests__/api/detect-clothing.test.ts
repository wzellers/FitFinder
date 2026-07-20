import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

// Import after mocking
import { POST } from '@/app/api/detect-clothing/route';
import Anthropic from '@anthropic-ai/sdk';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/detect-clothing', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** Build a mock Anthropic instance whose messages.create is a fresh vi.fn(). */
function mockAnthropicInstance(): { messages: { create: ReturnType<typeof vi.fn> } } {
  const instance = { messages: { create: vi.fn() } };
  vi.mocked(Anthropic).mockImplementationOnce(() => instance as unknown as Anthropic);
  return instance;
}

describe('POST /api/detect-clothing', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 500 when ANTHROPIC_API_KEY is not set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const req = makeRequest({ image: VALID_IMAGE });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('returns 400 when request body is missing image', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/image/i);
  });

  it('returns 400 when image is not a valid base64 data URL', async () => {
    const req = makeRequest({ image: 'not-a-data-url' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid image format/i);
  });

  it('returns {type, color} on successful Claude response', async () => {
    const instance = mockAnthropicInstance();
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"type": "T-Shirt", "color": "blue"}' }],
    });

    const req = makeRequest({ image: VALID_IMAGE });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('T-Shirt');
    expect(body.color).toBe('blue');
  });

  it('returns {type: null, color: null} when Claude outputs invalid type/color', async () => {
    const instance = mockAnthropicInstance();
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"type": "Dress", "color": "neon-purple"}' }],
    });

    const req = makeRequest({ image: VALID_IMAGE });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBeNull();
    expect(body.color).toBeNull();
  });

  it('returns 500 when Claude response has no parseable JSON', async () => {
    const instance = mockAnthropicInstance();
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I see a clothing item.' }],
    });

    const req = makeRequest({ image: VALID_IMAGE });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('returns 500 when Anthropic SDK throws', async () => {
    const instance = mockAnthropicInstance();
    instance.messages.create.mockRejectedValueOnce(new Error('API error'));

    const req = makeRequest({ image: VALID_IMAGE });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
