import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    testTimeout: 30000,
    hookTimeout: 60000,
    coverage: {
      include: [
        'lib/money.ts',
        'lib/validation.ts',
        'features/checkout/pricing.ts',
        'features/catalogue/filter.ts',
        'features/orders/status.ts',
      ],
    },
  },
});
