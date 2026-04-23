import { vi } from 'vitest';

// Chainable query builder mock
function makeBuilder(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gte', 'lte', 'in', 'is', 'not',
    'limit', 'order', 'filter', 'match',
  ];
  chainMethods.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  // Terminal methods
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  // Make the builder itself thenable (bare await)
  builder.then = vi.fn((resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve));
  builder.catch = vi.fn((reject: (v: unknown) => unknown) => Promise.resolve(result).catch(reject));
  return builder;
}

// Configures what .from() resolves with
let _fromResult: { data: unknown; error: unknown } = { data: [], error: null };
let _fromSequence: Array<{ data: unknown; error: unknown }> | null = null;
let _fromCallCount = 0;

export function mockFromTable(result: { data: unknown; error: unknown }) {
  _fromResult = result;
  _fromSequence = null;
  _fromCallCount = 0;
}

export function mockFromTableSequence(results: Array<{ data: unknown; error: unknown }>) {
  _fromSequence = results;
  _fromCallCount = 0;
}

export const mockSupabase = {
  from: vi.fn((_table: string) => {
    let result: { data: unknown; error: unknown };
    if (_fromSequence) {
      result = _fromSequence[_fromCallCount % _fromSequence.length];
      _fromCallCount++;
    } else {
      result = _fromResult;
    }
    return makeBuilder(result);
  }),
  auth: {
    getSession: vi.fn(() =>
      Promise.resolve({ data: { session: null }, error: null }),
    ),
    onAuthStateChange: vi.fn((_cb: unknown) => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signUp: vi.fn(() =>
      Promise.resolve({ data: { user: null, session: null }, error: null }),
    ),
    signInWithPassword: vi.fn(() =>
      Promise.resolve({ data: { user: null, session: null }, error: null }),
    ),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: { path: 'test/path.jpg' }, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://storage.example.com/test/path.jpg' } })),
    })),
  },
};
