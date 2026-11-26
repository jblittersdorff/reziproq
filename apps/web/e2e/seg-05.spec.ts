import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const relationshipId = '550e8400-e29b-41d4-a716-446655440032';
const criteriaDefs = [
  ['impact', 'Spend-Anteil'],
  ['impact', 'Kritikalität'],
  ['quality', 'Vertrauen'],
  ['quality', 'Offenheit'],
];
const levels = ['niedrig', 'mittel', 'hoch'];
const types = [1, 2, 3].flatMap((impactLevel) =>
  [1, 2, 3].map((qualityLevel) => ({
    impactLevel,
    qualityLevel,
    name: `Typ ${levels[impactLevel - 1]}/${levels[qualityLevel - 1]}`,
    description: 'Beschreibung',
  })),
);
const outcome = (name: string, impact: number, quality: number) => ({
  impactScore: impact,
  qualityScore: quality,
  impactLevel: impact > 66 ? 3 : impact > 33 ? 2 : 1,
  qualityLevel: quality > 66 ? 3 : quality > 33 ? 2 : 1,
  typeName: name,
});
const unitNames = ['Antrieb', 'Karosserie', 'Elektronik', 'Fahrwerk', 'Interieur'];
const functions = ['quality', 'purchasing'];
// Zehn Bewertende, damit die Heatmap auch mit vielen Zeilen lesbar bleibt.
const rows = Array.from({ length: 10 }, (_, index) => ({
  assignmentId: `550e8400-e29b-41d4-a716-4466554400${String(10 + index)}`,
  businessUnit: {
    id: `550e8400-e29b-41d4-a716-4466554401${String(10 + (index % 5))}`,
    name: unitNames[index % 5],
  },
  materialGroup: { id: '550e8400-e29b-41d4-a716-446655440034', name: 'Stahl' },
  function: functions[index % 2],
  values: criteriaDefs.map((_, k) => ({
    criterionKey: `k${k}`,
    ist: 20 + ((index * 17 + k * 11) % 70),
    soll: 80,
    comment: k === 0 ? `Einschätzung ${index + 1}` : null,
  })),
  deviation: 40 - index * 3,
}));
const segmentation = {
  segmentation: {
    roundId: '550e8400-e29b-41d4-a716-446655440031',
    roundName: 'Segmentierung 2026',
    status: 'provisional',
    decision: null,
    model: {
      version: 1,
      gridSize: 3,
      lowMax: 33,
      midMax: 66,
      criteria: criteriaDefs.map(([axis, name], index) => ({
        key: `k${index}`,
        axis,
        name,
        description: 'Beschreibung',
        weight: 50,
        position: (index % 2) + 1,
      })),
      types,
    },
    overall: {
      ist: outcome('Typ mittel/mittel', 45, 55),
      soll: outcome('Typ hoch/hoch', 80, 80),
      count: 10,
    },
    groups: unitNames.map((name, index) => ({
      businessUnit: { id: `550e8400-e29b-41d4-a716-4466554401${String(10 + index)}`, name },
      materialGroup: { id: '550e8400-e29b-41d4-a716-446655440034', name: 'Stahl' },
      ist: outcome('Typ mittel/mittel', 45, 55),
      soll: outcome('Typ hoch/hoch', 80, 80),
      count: 2,
      status: 'provisional',
    })),
    rows,
    stats: criteriaDefs.map((_, index) => ({
      criterionKey: `k${index}`,
      mean: 50,
      min: 20,
      max: 85,
    })),
  },
};

test.use({ locale: 'de-DE' });

async function mock(page: Page, empty: boolean) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Beispiel-OEM' },
        supportView: false,
        orgRole: 'member',
        permissions: {
          viewOrganizationSettings: false,
          viewBuyerAreas: true,
          viewSuppliers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: { actions: ['organisation.sehen', 'bewertungen.sehen', 'bewertungen.abgeben'] },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/suppliers/${relationshipId}`, (route) =>
    route.fulfill({
      json: {
        relationshipId,
        name: 'Gamma Werkzeugbau KG',
        organizationName: 'Gamma Werkzeugbau KG',
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: null,
        notes: null,
        status: 'active',
        createdAt: '2026-10-01T08:00:00Z',
        endedAt: null,
        spend: [],
        permissions: { edit: true, editTeam: false },
      },
    }),
  );
  await page.route(`**/api/suppliers/${relationshipId}/overview`, (route) =>
    route.fulfill({ json: { head: { segment: null, sro: null, nextMeeting: null }, metrics: [] } }),
  );
  await page.route(`**/api/ratings/relationship/${relationshipId}/decisions`, (route) =>
    route.fulfill({ json: { versions: [], canConsolidate: false } }),
  );
  await page.route(`**/api/ratings/relationship/${relationshipId}/segmentation`, (route) =>
    route.fulfill({ json: empty ? { segmentation: null } : segmentation }),
  );
}

async function shoot(page: Page, testInfo: import('@playwright/test').TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Es gibt nur ein helles Thema (Designsprache).
    for (const colorScheme of ['light'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.waitForTimeout(400);
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *:not(svg *)')]
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

test('SEG-05 zeigt Matrix, Gruppen und Heatmap in Hell und Dunkel ohne Überlauf', async ({
  page,
}, testInfo) => {
  await mock(page, false);
  await page.goto(`/lieferanten/${relationshipId}/strategie/segmentierung`);
  await expect(page.locator('#inhalt h1')).toHaveText('Segmentierung');
  await expect(page.getByText('Antrieb · Stahl').first()).toBeVisible();
  await shoot(page, testInfo, 'seite');

  await page.goto(`/lieferanten/${relationshipId}/strategie/segmentierung/kriterium/k0`);
  await expect(page.getByText('Einschätzung 1', { exact: true })).toBeVisible();
  await shoot(page, testInfo, 'kriterium');
});

test('SEG-05 zeigt ohne Bewertung den leeren Zustand', async ({ page }, testInfo) => {
  await mock(page, true);
  await page.goto(`/lieferanten/${relationshipId}/strategie/segmentierung`);
  await expect(page.getByText('Noch keine abgegebene Bewertung')).toBeVisible();
  await shoot(page, testInfo, 'leer');
});
