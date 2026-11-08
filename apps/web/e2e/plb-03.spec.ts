import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Browsertests zu docs/specs/PLB-03.md: Spielregeln einer Beziehung ansehen und bearbeiten.

test.use({ locale: 'de-DE' });

const rel = '0190a0a0-0000-7000-8000-000000000001';
const uuid = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const text = (de: string) => ({ de, en: de });
const proposal = [
  {
    catalogItemId: uuid(1),
    kind: 'right',
    group: 'cost',
    title: text('Gemeinsame Kostenworkshops'),
    description: text('Beide Seiten suchen regelmäßig gemeinsam nach Einsparungen.'),
    cadence: null,
    level: null,
  },
  {
    catalogItemId: uuid(2),
    kind: 'obligation',
    group: 'cost',
    title: text('Jährliches Produktivitätsangebot'),
    description: text('Der Lieferant macht jedes Jahr ein konkretes Angebot.'),
    cadence: null,
    level: null,
  },
  {
    catalogItemId: uuid(3),
    kind: 'right',
    group: 'protection',
    title: text('Längerer Bedarfsausblick'),
    description: text('Vorschau auf den Bedarf über einen längeren Zeitraum.'),
    cadence: null,
    level: null,
  },
  {
    catalogItemId: uuid(4),
    kind: 'obligation',
    group: 'protection',
    title: text('Verbindliche Kapazitätszusage'),
    description: text('Der Lieferant sichert die benötigte Kapazität zu.'),
    cadence: null,
    level: null,
  },
  {
    catalogItemId: uuid(5),
    kind: 'format',
    group: null,
    title: text('Quartalsreview'),
    description: text('Leistung, Maßnahmen und Risiken gemeinsam bewerten.'),
    cadence: 'quarterly',
    level: 'management',
  },
  {
    catalogItemId: uuid(6),
    kind: 'format',
    group: null,
    title: text('Innovationstag'),
    description: text('Der Lieferant zeigt neue Technologien.'),
    cadence: 'annual',
    level: 'operational',
  },
];
const target = { impactLevel: 2, qualityLevel: 2, typeName: 'Entwicklungspartner' };
const current = {
  id: uuid(50),
  version: 2,
  status: 'draft',
  visibility: 'internal',
  target,
  items: [
    ...proposal
      .filter((item) => item.catalogItemId !== uuid(6))
      .map((item, index) => ({ ...item, id: uuid(60 + index), origin: 'catalog', reason: null })),
    {
      id: uuid(70),
      catalogItemId: null,
      origin: 'custom',
      kind: 'format',
      group: null,
      title: text('Werksbesuch'),
      description: text('Einmal im Jahr vor Ort.'),
      cadence: 'annual',
      level: null,
      reason: 'Wichtig für die Qualität der Serienteile.',
    },
  ],
  removed: [{ item: proposal[5], reason: 'Der Lieferant hat keine eigene Entwicklung.' }],
  approvedBy: null,
  approvedAt: null,
};

async function mockBuyer(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Lena Berger',
        firstName: 'Lena',
        email: 'lena@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        orgRole: 'admin',
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: true,
          viewSuppliers: true,
          viewCustomers: false,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: { actions: ['organisation.sehen', 'lieferanten.sehen', 'spielregeln.festlegen'] },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/suppliers/${rel}`, (route) =>
    route.fulfill({
      json: {
        relationshipId: rel,
        name: 'Rheintal Elektronik GmbH (Demo)',
        organizationName: 'Rheintal Elektronik GmbH (Demo)',
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: 'L-10001',
        notes: null,
        status: 'active',
        createdAt: '2026-10-01T08:00:00Z',
        endedAt: null,
        spend: [],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
  await page.route(`**/api/suppliers/${rel}/overview`, (route) =>
    route.fulfill({
      json: {
        head: { segment: null, sro: { userId: 'lena', name: 'Lena Berger' }, nextMeeting: null },
        metrics: [],
      },
    }),
  );
  await page.route(`**/api/suppliers/${rel}/spielregeln`, (route) =>
    route.fulfill({ json: { current, target, targetChanged: true, canManage: true } }),
  );
  await page.route(`**/api/suppliers/${rel}/spielregeln/vorschlag*`, (route) =>
    route.fulfill({ json: { target, items: proposal } }),
  );
}

/** Kein Element ragt über den Rand; Screenshots hell und dunkel, 1440 und 390 Pixel breit. */
async function shoot(page: Page, testInfo: TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      // Farbübergänge der Kacheln abwarten, sonst zeigt der Screenshot Zwischenfarben.
      await page.waitForTimeout(300);
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .map((element) => `${element.tagName.toLowerCase()}.${String(element.className)}`)
          .slice(-12),
      );
      expect(overflowing).toEqual([]);
      const path = testInfo.outputPath(`${name}-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`${name}-${colorScheme}-${width}`, { path, contentType: 'image/png' });
    }
  }
}

test('PLB-03 Spielregeln einer Beziehung ansehen und bearbeiten', async ({ page }, testInfo) => {
  await mockBuyer(page);
  await page.goto(`/lieferanten/${rel}/beziehung/spielregeln`);
  await expect(page.locator('#inhalt h1')).toHaveText('Spielregeln');
  await expect(page.getByText('Der Soll-Typ hat sich geändert.')).toBeVisible();
  await expect(page.getByText('Werksbesuch')).toBeVisible();
  await shoot(page, testInfo, 'plb-03-spielregeln');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Bearbeiten' }).click();
  await expect(page.locator('#inhalt h1')).toHaveText('Spielregeln bearbeiten');
  await expect(page.getByLabel('Interne Begründung: Innovationstag')).toHaveValue(
    'Der Lieferant hat keine eigene Entwicklung.',
  );
  await shoot(page, testInfo, 'plb-03-bearbeiten');
});
