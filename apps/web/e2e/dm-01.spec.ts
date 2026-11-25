import { expect, test } from '@playwright/test';
import type { DemoSession } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person im Browser. /demo/als/<Person> startet die Sitzung
// ohne Zitadel; nach dem Neuladen trägt jede Anfrage das Token der Demo-Sitzung, und die App öffnet
// die Startseite der Person. Die Sitzung gilt nur in diesem Tab.

test.use({ locale: 'de-DE', colorScheme: 'light' });

const session: DemoSession = {
  accessToken: 'demo-e2e-token',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  person: {
    id: 'jan-luka',
    name: 'Jan-Luka',
    orgId: '550e8400-e29b-41d4-a716-446655440001',
    orgName: 'Nordwind Antriebe',
    orgRole: 'member',
    buyer: true,
  },
};

test('Demo-Sitzung: ohne Zitadel angemeldet, jede Anfrage mit dem Token der Demo-Sitzung', async ({
  page,
  context,
}) => {
  await signIn(page, { locale: 'de' });
  await page.route('**/api/demo/sitzung', (route) => route.fulfill({ json: session }));
  const tokens: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/me') {
      tokens.push(request.headers().authorization ?? '');
    }
  });
  await page.goto('/demo/als/jan-luka');
  await expect(page).not.toHaveURL(/\/demo\/als\//);
  await expect.poll(() => tokens.length).toBeGreaterThan(0);
  expect(new Set(tokens)).toEqual(new Set(['Bearer demo-e2e-token']));
  // Ein neuer Tab hat keine Demo-Sitzung
  const other = await context.newPage();
  await other.goto('/heute');
  expect(
    await other.evaluate(() => window.sessionStorage.getItem('reziproq.demo-sitzung')),
  ).toBeNull();
});
