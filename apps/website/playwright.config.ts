import { defineConfig, devices } from '@playwright/test';

// WEB-01: die gebaute, vorgerenderte Website, so wie sie ausgeliefert wird
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5181' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm exec vite preview --outDir dist/client --port 5181 --strictPort',
    url: 'http://localhost:5181',
    timeout: 300_000,
    reuseExistingServer: false,
  },
});
