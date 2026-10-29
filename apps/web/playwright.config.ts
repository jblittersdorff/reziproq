import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Eigener Server mit erfundenen Zitadel-Werten; die Tests spielen Zitadel und API im Browser nach.
  // Gesetzte Umgebungsvariablen haben Vorrang vor der .env.
  webServer: {
    command: 'pnpm dev --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    env: {
      ZITADEL_ISSUER: 'https://zitadel.test',
      ZITADEL_CLIENT_ID: 'web-client',
    },
  },
});
