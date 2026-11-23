import { expect, test } from '@playwright/test';
import type { Integrations } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// IN-01: Einstellungen › Anbindungen auf Telefonbreite und am Schreibtisch, hell und dunkel, ohne
// seitliches Scrollen; Verwalten klappt in der Zeile auf.

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const connection = (n: number, parts: string[], failed = 0) => ({
  id: uuid(n),
  scope: 'org' as const,
  status: 'active' as const,
  parts,
  connectedByName: 'Lena Berger',
  connectedAt: '2026-11-18T08:00:00Z',
  hookPath: '/api/anbindungen/eingang/Jx3kq9VwB2nT7sLpR4mYc8dHfA1uZ6eG',
  lastJob: {
    status: 'done' as const,
    itemsIn: 3,
    itemsOk: 3 - failed,
    itemsFailed: failed,
    finishedAt: '2026-11-23T05:00:00Z',
  },
});
const overview: Integrations = {
  connectors: [
    {
      key: 'microsoft365',
      group: 'workplace',
      stage: 1,
      parts: ['login', 'calendar', 'outlook', 'teams', 'transcripts'],
      personal: true,
      provider: 'fake',
      connection: connection(10, ['login', 'calendar', 'outlook']),
    },
    {
      key: 'inbound_mail',
      group: 'workplace',
      stage: 1,
      parts: ['meetings', 'notes'],
      personal: false,
      provider: 'fake',
      connection: connection(11, ['meetings', 'notes'], 1),
    },
    {
      key: 'google_workspace',
      group: 'workplace',
      stage: 1,
      parts: ['login', 'calendar', 'meet', 'drive'],
      personal: true,
      provider: 'fake',
      connection: null,
    },
    { key: 'slack', group: 'workplace', stage: 2, parts: ['hints'], personal: false, provider: 'fake', connection: null },
    { key: 'zoom', group: 'workplace', stage: 2, parts: ['transcripts'], personal: false, provider: 'fake', connection: null },
    {
      key: 'import_api',
      group: 'purchasing',
      stage: 1,
      parts: ['spend', 'suppliers'],
      personal: false,
      provider: 'fake',
      connection: null,
    },
    { key: 'files', group: 'purchasing', stage: 1, parts: ['upload'], personal: false, provider: 'fake', connection: null },
    { key: 'sap_s4', group: 'purchasing', stage: 2, parts: ['orders'], personal: false, provider: 'fake', connection: null },
  ],
  events: [
    { id: uuid(20), connectorKey: 'inbound_mail', kind: 'note', status: 'failed', reason: 'beziehung_fehlt', createdAt: '2026-11-23T05:00:00Z' },
    { id: uuid(21), connectorKey: 'inbound_mail', kind: 'note', status: 'applied', reason: null, createdAt: '2026-11-23T05:00:00Z' },
    { id: uuid(22), connectorKey: 'inbound_mail', kind: 'webhook', status: 'rejected', reason: 'signatur_falsch', createdAt: '2026-11-22T17:10:00Z' },
    { id: uuid(23), connectorKey: 'microsoft365', kind: 'token_refresh', status: 'applied', reason: null, createdAt: '2026-11-20T05:00:00Z' },
  ],
  issue: { kind: 'failed_items', connectorKey: 'inbound_mail', count: 1 },
};

for (const width of [390, 1440]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`Anbindungen ohne seitliches Scrollen (${width}, ${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      await signIn(page, { locale: 'de' });
      await page.route('**/api/einstellungen/anbindungen', (route) =>
        route.fulfill({ json: overview }),
      );
      await page.goto('/einstellungen/anbindungen');
      await expect(page.getByRole('heading', { level: 1, name: 'Anbindungen' })).toBeVisible();
      await expect(page.getByText('1 Element aus Eingangsadresse mit Fehler')).toBeVisible();
      const row = page.getByRole('listitem').filter({ hasText: 'Eingangsadresse' }).first();
      await row.getByRole('button', { name: 'Verwalten' }).click();
      await expect(row.getByText('Adresse für eingehende Daten')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBe(0);
      if (process.env.IN01_SHOTS) {
        await page.screenshot({
          path: `${process.env.IN01_SHOTS}/anbindungen-${width}-${scheme}.png`,
          fullPage: true,
        });
      }
    });
  }
}
