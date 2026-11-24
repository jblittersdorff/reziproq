import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Drei Viertel der Kerne statt der Hälfte: Die Tests spielen API und Zitadel im Browser nach und
  // brauchen keine Datenbank, also kaum etwas außer Rechenzeit.
  ...(process.env.CI ? {} : { workers: '75%' }),
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
  // Gebaut und mit vite preview ausgeliefert: Der Entwicklungsserver übersetzt jede Route beim
  // ersten Aufruf und lief beim Rundgang über alle Routen auf dem CI-Rechner aus dem Speicher.
  webServer: {
    command:
      'pnpm exec vite build --outDir dist/e2e --emptyOutDir --logLevel warn && pnpm exec vite preview --outDir dist/e2e --port 5174 --strictPort',
    timeout: 300_000,
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    env: {
      // Der Bau braucht mehr als den Standard-Speicher von Node.
      NODE_OPTIONS: '--max-old-space-size=4096',
      ZITADEL_ISSUER: 'https://zitadel.test',
      ZITADEL_CLIENT_ID: 'web-client',
    },
  },
});
