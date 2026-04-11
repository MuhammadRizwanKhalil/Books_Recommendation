import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testMatch: ['./api/**/*.test.ts'],
    timeout: 15000,
    reporters: ['verbose'],
  },
});
