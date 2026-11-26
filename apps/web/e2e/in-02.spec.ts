import { expect, test } from '@playwright/test';
import type { Integrations, SsoOverview } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// IN-02: Anmeldung über das Firmenkonto unter Anbindungen › Microsoft 365 auf Telefonbreite und
// am Schreibtisch, ohne seitliches Scrollen; DNS-Eintrag bricht um.

const overview: Integrations = {
  connectors: [
    {
      key: 'microsoft365',
      group: 'workplace',
      stage: 1,
      parts: ['login', 'calendar', 'outlook', 'teams', 'transcripts'],
      personal: true,
      provider: 'fake',
      connection: {
        id: '0190a0a0-0000-7000-8000-000000000010',
        scope: 'org',
        status: 'active',
        parts: ['login', 'calendar'],
        connectedByName: 'Lena Berger',
        connectedAt: '2026-11-18T08:00:00Z',
        hookPath: null,
        inboundAddress: null,
        allowedDomains: [],
        lastJob: null,
      },
    },
  ],
  events: [],
  issue: null,
};
const sso: SsoOverview = {
  entra: {
    provider: 'entra',
    tenantId: '8f2c1d4e-5a6b-47c8-9d0e-1f2a3b4c5d6e',
    hostedDomain: null,
    domains: [
      {
        domain: 'hollmann-antriebe.de',
        recordName: '_zitadel-challenge.hollmann-antriebe.de',
        recordValue: 'f3a9c27e5b1d4e8f9a0b6c2d7e1f4a5b',
        verifiedAt: '2026-11-20T08:00:00Z',
      },
      {
        domain: 'hollmann-service.at',
        recordName: '_zitadel-challenge.hollmann-service.at',
        recordValue: '0c4d8e2f6a1b5c9d3e7f2a6b0c4d8e1f',
        verifiedAt: null,
      },
    ],
    defaultRole: 'viewer',
    passwordLoginAllowed: false,
    status: 'active',
  },
  google: null,
};

for (const width of [390, 1440]) {
  test(`Anmeldung über das Firmenkonto ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/einstellungen/anbindungen', (route) =>
      route.fulfill({ json: overview }),
    );
    await page.route('**/api/einstellungen/anbindungen/anmeldung', (route) =>
      route.fulfill({ json: sso }),
    );
    await page.goto('/einstellungen/anbindungen');
    const row = page.getByRole('listitem').filter({ hasText: 'Microsoft 365' }).first();
    await row.getByRole('button', { name: 'Verwalten' }).click();
    await expect(row.getByText('hollmann-service.at', { exact: true })).toBeVisible();
    await expect(
      row.getByRole('switch', { name: 'Nur noch über Microsoft anmelden' }),
    ).toBeChecked();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.IN02_SHOTS) {
      await page.screenshot({
        path: `${process.env.IN02_SHOTS}/anmeldung-${width}.png`,
        fullPage: true,
      });
    }
  });
}
