import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock localStorage globally
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

// Browser-only mocks; skipped in files that opt into `@vitest-environment node`
// (e.g. server code whose SDKs refuse to run in a browser-like environment).
const isBrowserEnv = typeof window !== 'undefined';

if (isBrowserEnv) {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
}

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'blob:mock-url'),
});

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
});

// jsdom doesn't implement canvas.toBlob; stub it for crop-related code.
if (isBrowserEnv && !HTMLCanvasElement.prototype.toBlob) {
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['x'], { type: 'image/png' }));
  };
}

afterEach(() => {
  if (isBrowserEnv) cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorageMock.clear();
});
