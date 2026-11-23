import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Browsertests zu docs/specs/QBR-01.md, Teil a: Termin-Liste, Termin-Seite und Bearbeiten.

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

const rel = '0190a0a0-0000-7000-8000-000000000001';
const mid = '0190a0a0-0000-7000-8000-000000000099';
const uuid = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const summary = {
  id: mid,
  type: 'quarterly_review',
  title: 'Quartalsreview Q1 2027',
  startsAt: '2027-03-15T09:00:00.000Z',
  durationMinutes: 60,
  location: 'Werk Nord, Raum Elbe',
  status: 'planned',
  ownerSide: 'buyer',
};
const detail = {
  meeting: {
    ...summary,
    protocol:
      'Liefertreue im Quartal bei 97 %. Die Zusatzschicht im Februar hat den Rückstand abgebaut.',
    createdByName: 'Lena Berger',
  },
  participants: [
    { id: uuid(1), side: 'buyer', own: true, name: 'Lena Berger' },
    { id: uuid(2), side: 'buyer', own: true, name: 'Tom Krüger' },
  ],
  agenda: [
    {
      id: uuid(3),
      side: 'buyer',
      own: true,
      title: 'Rückblick auf das Quartal',
      detail: null,
      position: 1,
    },
    {
      id: uuid(4),
      side: 'buyer',
      own: true,
      title: 'Kennzahlen und Scorecard',
      detail: null,
      position: 2,
    },
    { id: uuid(5), side: 'buyer', own: true, title: 'Offene Maßnahmen', detail: null, position: 3 },
    {
      id: uuid(6),
      side: 'supplier',
      own: false,
      title: 'Neue Kapazitäten für 2027',
      detail: null,
      position: 1,
    },
  ],
  decisions: [
    {
      id: uuid(7),
      side: 'buyer',
      own: true,
      text: 'Kapazitätsplanung bis Ende April abstimmen',
      position: 1,
    },
    {
      id: uuid(8),
      side: 'supplier',
      own: false,
      text: 'Angebot für eine Zusatzschicht bis 15. April',
      position: 1,
    },
  ],
  note: 'Preisdruck aus dem Einkauf ansprechen, aber erst nach den Kennzahlen.',
  canEditMeeting: true,
  canContribute: true,
  live: { sections: [], frozenAt: null },
  canClose: false,
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
      json: {
        actions: ['organisation.sehen', 'lieferanten.sehen', 'termine.sehen', 'termine.bearbeiten'],
      },
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
    route.fulfill({ json: { head: { segment: null, sro: null, nextMeeting: null }, metrics: [] } }),
  );
  await page.route(`**/api/suppliers/${rel}/termine`, (route) =>
    route.fulfill({
      json: {
        upcoming: [summary],
        past: [
          {
            ...summary,
            id: uuid(90),
            title: 'Strategiedialog 2026',
            type: 'strategy_dialogue',
            startsAt: '2026-10-02T13:00:00.000Z',
            durationMinutes: 60,
            status: 'held',
            ownerSide: 'supplier',
            location: null,
          },
        ],
        canCreate: true,
        formats: [],
      },
    }),
  );
  await page.route(`**/api/suppliers/${rel}/termine/${mid}`, (route) =>
    route.fulfill({ json: detail }),
  );
}

/** Kein Element ragt über den Rand; Screenshots hell und dunkel, 1440 und 390 Pixel breit. */
async function shoot(page: Page, testInfo: TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Es gibt nur ein helles Thema (Designsprache).
    for (const colorScheme of ['light'] as const) {
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

test('QBR-01a Termine beim Käufer', async ({ page }, testInfo) => {
  await mockBuyer(page);
  await page.goto(`/lieferanten/${rel}/umsetzung/termine`);
  await expect(page.locator('#inhalt h1')).toHaveText('Termine');
  await shoot(page, testInfo, 'qbr-01a-liste');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: /Quartalsreview Q1 2027/ }).click();
  await expect(page.locator('#inhalt h1')).toHaveText('Quartalsreview Q1 2027');
  await shoot(page, testInfo, 'qbr-01a-termin');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Agenda: Bearbeiten' }).click();
  await expect(page.locator('#inhalt h1')).toHaveText('Agenda bearbeiten');
  await shoot(page, testInfo, 'qbr-01a-agenda');
});
