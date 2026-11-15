import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const roundId = '550e8400-e29b-41d4-a716-446655440010';
const unit = { id: '550e8400-e29b-41d4-a716-446655440013', name: 'Antrieb' };
const group = { id: '550e8400-e29b-41d4-a716-446655440014', name: 'Stahl' };
const names = ['Alpha GmbH', 'Beta AG', 'Gamma Werkzeugbau KG'];
const supplierIds = names.map((_, index) => `550e8400-e29b-41d4-a716-44665544002${index}`);

const detail = {
  id: roundId,
  name: 'Segmentierung 2026',
  dueDate: '2099-12-31',
  status: 'open',
  modelVersion: 1,
  total: 6,
  submitted: 2,
  canManage: true,
  suppliers: names.map((name, index) => ({
    relationshipId: supplierIds[index],
    name,
    total: 2,
    submitted: index === 0 ? 2 : 0,
    canNominate: true,
    businessUnits: [unit],
    materialGroups: [group],
    assignments: ['purchasing', 'quality'].map((fn, position) => ({
      id: `550e8400-e29b-41d4-a716-4466554400${index}${position}`,
      businessUnit: unit,
      materialGroup: group,
      function: fn,
      rater: { id: 'u-1', name: 'Anna Schmidt' },
      status: index === 0 ? 'submitted' : 'open',
    })),
  })),
};

test.use({ locale: 'de-DE' });

async function mock(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Beispiel-OEM' },
        supportView: false,
        orgRole: 'admin',
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: true,
          viewSuppliers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'organisation.sehen',
          'runden.sehen',
          'runden.verwalten',
          'runden.nachnominieren',
        ],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/rounds', (route) =>
    route.fulfill({
      json: {
        rounds: [
          { ...detail, suppliers: undefined, canManage: undefined },
          {
            ...detail,
            id: '550e8400-e29b-41d4-a716-446655440099',
            name: 'Entwurf Herbst',
            status: 'draft',
            modelVersion: null,
            suppliers: undefined,
            canManage: undefined,
          },
        ],
      },
    }),
  );
  await page.route(`**/api/rounds/${roundId}`, (route) => route.fulfill({ json: detail }));
  await page.route(`**/api/rounds/${roundId}/candidates`, (route) =>
    route.fulfill({
      json: {
        candidates: names.map((name, index) => ({
          relationshipId: supplierIds[index],
          name,
          businessUnits: [unit],
          materialGroups: [group],
          selected: index === 0,
        })),
      },
    }),
  );
}

async function shoot(page: Page, testInfo: import('@playwright/test').TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Es gibt nur ein helles Thema (Designsprache).
    for (const colorScheme of ['light'] as const) {
      await page.emulateMedia({ colorScheme });
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .map((element) => `${element.tagName.toLowerCase()}.${String(element.className)}`)
          .slice(-12),
      );
      expect(overflowing).toEqual([]);
      const path = testInfo.outputPath(`${name}-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`${name}-${colorScheme}-${width}`, {
        path,
        contentType: 'image/png',
      });
    }
  }
}

test('SEG-03 zeigt Liste, Runde und Lieferantenwahl in Hell und Dunkel ohne Überlauf', async ({
  page,
}, testInfo) => {
  await mock(page);

  await page.goto('/portfolio/runden');
  await expect(page.locator('#inhalt h1')).toHaveText('Bewertungsrunden');
  await expect(page.getByText('2 von 6 abgegeben').first()).toBeVisible();
  await shoot(page, testInfo, 'runden-liste');

  await page.goto(`/portfolio/runden/${roundId}`);
  await expect(page.getByRole('link', { name: 'Nachnominieren' })).toBeVisible();
  await shoot(page, testInfo, 'runde');

  await page.route(`**/api/rounds/${roundId}`, (route) =>
    route.fulfill({ json: { ...detail, status: 'draft', modelVersion: null } }),
  );
  await page.goto(`/portfolio/runden/${roundId}/lieferanten`);
  await expect(page.getByText('Schritt 2 von 4')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Gamma Werkzeugbau KG wählen' })).toBeVisible();
  await shoot(page, testInfo, 'lieferantenwahl');
});
