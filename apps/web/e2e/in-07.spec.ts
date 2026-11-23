import { expect, test } from '@playwright/test';
import type { ApiKeys, Integrations } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// IN-07: Schlüssel der Import-API unter Anbindungen auf Telefonbreite und am Schreibtisch, ohne
// seitliches Scrollen; nach dem Erzeugen steht der Schlüssel einmal im Klartext.

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const overview: Integrations = {
  connectors: [
    {
      key: 'import_api',
      group: 'purchasing',
      stage: 1,
      parts: ['spend', 'suppliers'],
      personal: false,
      provider: 'fake',
      connection: {
        id: uuid(10),
        scope: 'org',
        status: 'active',
        parts: ['spend', 'suppliers'],
        connectedByName: 'Lena Berger',
        connectedAt: '2026-11-18T08:00:00Z',
        hookPath: null,
        inboundAddress: null,
        allowedDomains: [],
        lastJob: {
          status: 'done',
          itemsIn: 120,
          itemsOk: 118,
          itemsFailed: 2,
          finishedAt: '2026-11-23T05:00:00Z',
        },
      },
    },
  ],
  events: [],
  issue: { kind: 'failed_items', connectorKey: 'import_api', count: 2 },
};
const keys: ApiKeys = {
  keys: [
    {
      id: uuid(20),
      name: 'ERP-Middleware',
      prefix: 'rzq_ab12cd34',
      scopes: ['supplier', 'spend'],
      createdByName: 'Lena Berger',
      createdAt: '2026-11-20T08:00:00Z',
      lastUsedAt: '2026-11-23T05:00:00Z',
      revokedAt: null,
    },
  ],
  lastDelivery: {
    batchId: uuid(30),
    createdAt: '2026-11-23T05:00:00Z',
    status: 'committed',
    rowsTotal: 120,
    rowsError: 2,
  },
};

for (const width of [390, 1440]) {
  test(`Schlüssel der Import-API ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/einstellungen/anbindungen', (route) =>
      route.fulfill({ json: overview }),
    );
    await page.route('**/api/einstellungen/anbindungen/schluessel', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 201,
            json: { ...keys, secret: 'rzq_9f8e7d6c_Q2xhdWRlLWlzdC1laW4tVGVzdC1TY2hsw7xzc2Vs' },
          })
        : route.fulfill({ json: keys }),
    );
    await page.goto('/einstellungen/anbindungen');
    const row = page.getByRole('listitem').filter({ hasText: 'Import-API' }).first();
    await row.getByRole('button', { name: 'Verwalten' }).click();
    await expect(row.getByRole('heading', { name: 'API-Schlüssel' })).toBeVisible();
    await row.getByLabel('Name').fill('SAP PI');
    await row.getByRole('button', { name: 'Schlüssel erzeugen' }).click();
    await expect(row.getByText('Neuer Schlüssel, nur jetzt sichtbar')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.IN07_SHOTS) {
      await page.screenshot({
        path: `${process.env.IN07_SHOTS}/schluessel-${width}.png`,
        fullPage: true,
      });
    }
  });
}
