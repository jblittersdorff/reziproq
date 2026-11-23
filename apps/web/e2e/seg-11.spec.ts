import { expect, type Page, test } from '@playwright/test';
import { defaultSegmentCriteria, defaultSegmentTypes } from '@reziproq/shared';
import { fakeZitadel } from './fake-zitadel.js';

// SEG-11: Erklärungen der Abweichungen auf Telefonbreite und am Schreibtisch, ohne seitliches
// Scrollen; Entwurf gestrichelt, übernommene Erklärung fest.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const unit = { id: '550e8400-e29b-41d4-a716-446655440033', name: 'Antrieb' };
const outcome = { impactScore: 70, qualityScore: 40, impactLevel: 3, qualityLevel: 2 };
const [first, second, third] = defaultSegmentCriteria;
const draft = (status: 'draft' | 'accepted', content: string) => ({
  id:
    status === 'draft'
      ? '550e8400-e29b-41d4-a716-446655440051'
      : '550e8400-e29b-41d4-a716-446655440052',
  status,
  content,
  model: 'test',
  createdAt: '2026-11-16T09:00:00Z',
  decidedAt: status === 'accepted' ? '2026-11-16T10:00:00Z' : null,
});

async function mock(page: Page) {
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
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: { actions: ['lieferanten.sehen', 'bewertungen.sehen', 'segmentierung.konsolidieren'] },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/suppliers/${id}`, (route) =>
    route.fulfill({
      json: {
        relationshipId: id,
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
  await page.route(`**/api/suppliers/${id}/overview`, (route) =>
    route.fulfill({
      json: {
        head: { segment: null, sro: { userId: 'lena', name: 'Lena Berger' }, nextMeeting: null },
        metrics: [],
      },
    }),
  );
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
  await page.route(`**/api/ratings/relationship/${id}/decisions`, (route) =>
    route.fulfill({ json: { versions: [], canConsolidate: true } }),
  );
  await page.route(`**/api/ratings/relationship/${id}/segmentation`, (route) =>
    route.fulfill({
      json: {
        segmentation: {
          roundId: '550e8400-e29b-41d4-a716-446655440031',
          roundName: 'Runde 2026',
          status: 'provisional',
          decision: null,
          model: {
            version: 1,
            lowMax: 33,
            midMax: 66,
            criteria: defaultSegmentCriteria,
            types: defaultSegmentTypes,
          },
          overall: {
            ist: { ...outcome, typeName: 'Strategisch' },
            soll: { ...outcome, typeName: 'Partner' },
            count: 2,
          },
          groups: [],
          rows: ['quality', 'purchasing'].map((fn, index) => ({
            assignmentId: `550e8400-e29b-41d4-a716-44665544004${index}`,
            businessUnit: unit,
            materialGroup: null,
            function: fn,
            values: defaultSegmentCriteria.map((criterion) => ({
              criterionKey: criterion.key,
              ist: index === 0 ? 90 : 20,
              soll: 80,
              comment: null,
            })),
            deviation: 35,
          })),
          stats: defaultSegmentCriteria.map((criterion) => ({
            criterionKey: criterion.key,
            mean: 55,
            min: 20,
            max: 90,
          })),
        },
      },
    }),
  );
  await page.route(`**/api/ratings/relationship/${id}/segmentation/explanations`, (route) =>
    route.fulfill({
      json: {
        roundId: '550e8400-e29b-41d4-a716-446655440031',
        canExplain: true,
        withoutReasons: [third?.key],
        explanations: [
          {
            criterionKey: first?.key,
            criterionName: first?.name,
            range: 70,
            reasons: 2,
            draft: null,
            accepted: draft(
              'accepted',
              'Die Qualität erlebt eine enge Abstimmung bei Serienanläufen. Der Einkauf sieht dagegen kaum Bereitschaft zu gemeinsamen Kostensenkungen.',
            ),
          },
          {
            criterionKey: second?.key,
            criterionName: second?.name,
            range: 70,
            reasons: 1,
            draft: draft(
              'draft',
              'Die Bewertungen gehen auseinander, weil die Funktionen unterschiedliche Erfahrungen schildern. Die Begründungen nennen vor allem Liefertreue und Abstimmung als Ursache.',
            ),
            accepted: null,
          },
          {
            criterionKey: third?.key,
            criterionName: third?.name,
            range: 70,
            reasons: 0,
            draft: null,
            accepted: null,
          },
        ],
      },
    }),
  );
}

for (const width of [390, 1440]) {
  test(`Erklärungen der Abweichungen ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto(`/lieferanten/${id}/strategie/segmentierung`);
    const section = page.getByRole('region', { name: 'Abweichungen verstehen' });
    await expect(section.getByText('KI-Entwurf, bitte prüfen')).toBeVisible();
    // Designsprache 2: Entwurf mit 1 px Mint-Rand und Doppelring, bestätigt ohne Doppelring
    await expect(section.locator('[data-slot="ai-draft"]:not([data-confirmed])')).toHaveCSS(
      'border-top-color',
      'rgb(207, 229, 221)',
    );
    await expect(
      section
        .locator('[data-slot="ai-draft"]:not([data-confirmed]) [data-slot="brand-mark"]')
        .first(),
    ).toBeVisible();
    await expect(
      section.locator('[data-slot="ai-draft"][data-confirmed] [data-slot="brand-mark"]'),
    ).toHaveCount(0);
    await expect(section.locator('[data-slot="ai-draft"][data-confirmed]')).toHaveCSS(
      'border-top-style',
      'solid',
    );
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.SEG11_SHOTS)
      await section.screenshot({ path: `${process.env.SEG11_SHOTS}/seg11-${width}.png` });
  });
}
