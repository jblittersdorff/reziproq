import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '@site': fileURLToPath(new URL('./src', import.meta.url)),
      '@': fileURLToPath(new URL('../web/src', import.meta.url)),
    },
  },
  test: {
    name: 'website',
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
  },
});
