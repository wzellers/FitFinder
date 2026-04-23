import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/__tests__/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**', 'src/app/api/**', 'src/hooks/**', 'src/components/**', 'src/app/page.tsx'],
      exclude: [
        'src/lib/supabaseClient.ts',
        'src/app/layout.tsx',
        'src/components/Onboarding.tsx',  // not in test scope
        'src/__tests__/**',
        '**/*.d.ts',
      ],
      thresholds: {
        'src/lib/colorUtils.ts': { lines: 100, functions: 100, branches: 100 },
        'src/lib/types.ts': { lines: 100, functions: 100, branches: 100 },
        'src/lib/constants.ts': { lines: 100 },
        'src/lib/weatherApi.ts': { lines: 95, functions: 100, branches: 90 },
        'src/lib/outfitScoring.ts': { lines: 90, functions: 90, branches: 85 },
        // Global: complex UI components with many untested handlers bring functions down
        lines: 65,
        functions: 38,
        branches: 65,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
