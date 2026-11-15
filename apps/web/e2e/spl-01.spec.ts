import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const relationshipId = '550e8400-e29b-41d4-a716-446655440091';
const supplierPath = `/lieferanten/${relationshipId}`;
const categories = [
  { key: 'cost', name: 'Kosten', position: 1, active: true },
  { key: 'quality', name: 'Qualität', position: 2, active: true },
  { key: 'technology', name: 'Technologie', position: 3, active: true },
  { key: 'supply', name: 'Versorgung', position: 4, active: true },
  { key: 'sustainability', name: 'Nachhaltigkeit', position: 5, active: true },
  { key: 'capacity', name: 'Kapazität', position: 6, active: true },
  { key: 'location', name: 'Standort', position: 7, active: true },
];

test.use({ locale: 'de-DE' });

async function setUp(page: Page) {
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
          'lieferanten.sehen',
          'lieferantenplan.bearbeiten',
          'stammdaten.verwalten',
          'organisation.sehen',
        ],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/suppliers/${relationshipId}`, (route) =>
    route.fulfill({
      json: {
        relationshipId,
        name: 'Rheintal Elektronik GmbH',
        organizationName: 'Rheintal Elektronik GmbH',
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: 'L-10001',
        notes: null,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        endedAt: null,
        spend: [],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
}

test('SPL-01 Lieferantenplan responsive und Ziele nach Kategorie', async ({ page }, testInfo) => {
  await setUp(page);
  await page.route(`**/api/suppliers/${relationshipId}/plan`, (route) =>
    route.fulfill({
      json: {
        plan: {
          id: '550e8400-e29b-41d4-a716-446655440092',
          relationshipId,
          cycleId: '550e8400-e29b-41d4-a716-446655440093',
          version: 1,
          status: 'draft',
          summary: 'Qualität und Versorgung gemeinsam verbessern.',
          createdAt: '2026-01-01T00:00:00.000Z',
          targetType: 'Strategischer Partner',
          sro: { userId: 'anna', name: 'Anna Schmidt' },
          objectives: [
            {
              id: '550e8400-e29b-41d4-a716-446655440094',
              categoryKey: 'quality',
              categoryName: 'Qualität',
              businessUnit: { id: 'bu-1', name: 'Einkauf' },
              materialGroup: null,
              text: 'Ausschussquote senken',
              owner: { userId: 'anna', name: 'Anna Schmidt' },
              targetYear: 2027,
              canEdit: true,
            },
          ],
          contributions: { done: 0, total: 0, items: [] },
          topics: [],
          canManage: true,
          approval: {
            round: 0,
            submittedAt: null,
            approvedAt: null,
            hasSponsor: true,
            decisions: [],
            hints: { openContributions: 0, noTopics: false },
            canSubmit: false,
            canDecide: false,
            canNewVersion: false,
          },
        },
        cycleId: '550e8400-e29b-41d4-a716-446655440093',
        categories,
        teamCandidates: [{ userId: 'anna', name: 'Anna Schmidt' }],
        canCreate: false,
      },
    }),
  );
  await page.route(`**/api/suppliers/${relationshipId}/zuordnung`, (route) =>
    route.fulfill({
      json: {
        businessUnits: [{ id: 'bu-1', name: 'Einkauf', code: 'E', active: true }],
        materialGroups: [],
        canEdit: false,
      },
    }),
  );

  await page.goto(`${supplierPath}/strategie/lieferantenplan`);
  await expect(page.getByRole('heading', { level: 1, name: 'Lieferantenplan' })).toBeVisible();
  await expect(page.getByText('Strategischer Partner')).toBeVisible();
  await expect(page.getByText('Ausschussquote senken')).toBeVisible();

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Es gibt nur ein helles Thema (Designsprache).
    for (const colorScheme of ['light'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.waitForTimeout(300);
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *:not(svg *)')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .map((element) => `${element.tagName.toLowerCase()}.${String(element.className)}`)
          .slice(-12),
      );
      expect(overflowing).toEqual([]);
      const path = testInfo.outputPath(`spl-01-plan-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`spl-01-plan-${colorScheme}-${width}`, {
        path,
        contentType: 'image/png',
      });
    }
  }
  await page.goto(`${supplierPath}/strategie/lieferantenplan/ziele/neu`);
  await expect(page.getByRole('heading', { level: 1, name: 'Ziel hinzufügen' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Kategorie' })).toBeVisible();
  await page.goto(`${supplierPath}/strategie/lieferantenplan/zusammenfassung/bearbeiten`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Zusammenfassung bearbeiten' }),
  ).toBeVisible();
});

test('SPL-01 Zielkategorien zeigen alle sieben Standards und führen zum Anlegen', async ({
  page,
}) => {
  await setUp(page);
  await page.route('**/api/objective-categories', (route) =>
    route.fulfill({ json: { categories } }),
  );

  await page.goto('/einstellungen/zielkategorien');
  await expect(page.getByRole('heading', { level: 1, name: 'Zielkategorien' })).toBeVisible();
  for (const category of categories) {
    await expect(page.getByRole('link', { name: category.name })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Kategorie hinzufügen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Neue Zielkategorie' })).toBeVisible();
});
