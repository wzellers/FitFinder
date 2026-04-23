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

const VALID_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('POST /api/detect-clothing', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    const instance = new (Anthropic as unknown as { new(): { messages: { create: ReturnType<typeof vi.fn> } } })();
    mockCreate = instance.messages.create as ReturnType<typeof vi.fn>;
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
    const MockAnthropicClass = Anthropic as unknown as new (opts: unknown) => { messages: { create: ReturnType<typeof vi.fn> } };
    const mockInstance = new MockAnthropicClass({ apiKey: 'test' });
    mockInstance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"type": "T-Shirt", "color": "blue"}' }],
    });
    vi.mocked(Anthropic).mockImplementationOnce(() => mockInstance);

    const req = makeRequest({ image: VALID_IMAGE });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('T-Shirt');
    expect(body.color).toBe('blue');
  });

  it('returns {type: null, color: null} when Claude outputs invalid type/color', async () => {
    const MockAnthropicClass = Anthropic as unknown as new (opts: unknown) => { messages: { create: ReturnType<typeof vi.fn> } };
    const mockInstance = new MockAnthropicClass({ apiKey: 'test' });
    mockInstance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"type": "Dress", "color": "neon-purple"}' }],
    });
    vi.mocked(Anthropic).mockImplementationOnce(() => mockInstance);

    const req = makeRequest({ image: VALID_IMAGE });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBeNull();
    expect(body.color).toBeNull();
  });

  it('returns 500 when Claude response has no parseable JSON', async () => {
    const MockAnthropicClass = Anthropic as unknown as new (opts: unknown) => { messages: { create: ReturnType<typeof vi.fn> } };
    const mockInstance = new MockAnthropicClass({ apiKey: 'test' });
    mockInstance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I see a clothing item.' }],
    });
    vi.mocked(Anthropic).mockImplementationOnce(() => mockInstance);

    const req = makeRequest({ image: VALID_IMAGE });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('returns 500 when Anthropic SDK throws', async () => {
    const MockAnthropicClass = Anthropic as unknown as new (opts: unknown) => { messages: { create: ReturnType<typeof vi.fn> } };
    const mockInstance = new MockAnthropicClass({ apiKey: 'test' });
    mockInstance.messages.create.mockRejectedValueOnce(new Error('API error'));
    vi.mocked(Anthropic).mockImplementationOnce(() => mockInstance);

    const req = makeRequest({ image: VALID_IMAGE });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  // suppress unused var warning
  void mockCreate;
});
