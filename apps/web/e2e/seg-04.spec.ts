import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const id = '550e8400-e29b-41d4-a716-446655440030';
const criteriaDefs = [
  ['impact', 'Spend-Anteil', 'Wie groß ist der Anteil am Einkaufsvolumen?'],
  ['impact', 'Kritikalität', 'Wie schwer wiegt ein Ausfall für die Produktion?'],
  ['quality', 'Vertrauen', 'Wie verlässlich ist die Zusammenarbeit?'],
  ['quality', 'Offenheit', 'Wie offen werden Daten und Pläne geteilt?'],
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
const assignment = {
  id,
  roundId: '550e8400-e29b-41d4-a716-446655440031',
  roundName: 'Segmentierung 2026',
  roundStatus: 'open',
  dueDate: '2099-12-31',
  relationshipId: '550e8400-e29b-41d4-a716-446655440032',
  supplier: 'Gamma Werkzeugbau KG',
  businessUnit: { id: '550e8400-e29b-41d4-a716-446655440033', name: 'Antrieb' },
  materialGroup: { id: '550e8400-e29b-41d4-a716-446655440034', name: 'Stahl' },
  function: 'quality',
  status: 'in_progress',
  raterName: null,
};
const detail = (complete: boolean) => ({
  assignment,
  editable: true,
  model: {
    version: 1,
    lowMax: 33,
    midMax: 66,
    criteria: criteriaDefs.map(([axis, name, description], index) => ({
      key: `k${index}`,
      axis,
      name,
      description,
      weight: 50,
      position: (index % 2) + 1,
    })),
    types,
  },
  values: criteriaDefs.map((_, index) => ({
    criterionKey: `k${index}`,
    ist: complete ? 40 + index * 10 : index < 2 ? 55 : null,
    soll: complete ? 80 : null,
    comment: null,
  })),
  ist: complete
    ? {
        impactScore: 45,
        qualityScore: 65,
        impactLevel: 2,
        qualityLevel: 2,
        typeName: 'Typ mittel/mittel',
      }
    : null,
  soll: complete
    ? {
        impactScore: 80,
        qualityScore: 80,
        impactLevel: 3,
        qualityLevel: 3,
        typeName: 'Typ hoch/hoch',
      }
    : null,
});

test.use({ locale: 'de-DE' });

async function mock(page: Page, complete: boolean) {
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
  await page.route('**/api/ratings/mine', (route) =>
    route.fulfill({
      json: {
        assignments: [
          assignment,
          {
            ...assignment,
            id: '550e8400-e29b-41d4-a716-446655440039',
            status: 'submitted',
            supplier: 'Alpha GmbH',
          },
        ],
      },
    }),
  );
  await page.route(`**/api/ratings/${id}`, (route) => route.fulfill({ json: detail(complete) }));
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

test('SEG-04 zeigt Liste, Reglerschritte und Zusammenfassung in Hell und Dunkel ohne Überlauf', async ({
  page,
}, testInfo) => {
  await mock(page, true);
  await page.goto('/bewertungen');
  await expect(page.locator('#inhalt h1')).toHaveText('Meine Bewertungen');
  await expect(page.getByText('Alpha GmbH')).toBeVisible();
  await shoot(page, testInfo, 'liste');

  await page.goto(`/bewertungen/${id}`);
  await expect(page.getByText('Schritt 1 von 3')).toBeVisible();
  await expect(page.getByRole('slider').first()).toBeVisible();
  await shoot(page, testInfo, 'impact');

  await page.goto(`/bewertungen/${id}/zusammenfassung`);
  await expect(page.getByRole('button', { name: 'Abgeben' })).toBeEnabled();
  await shoot(page, testInfo, 'zusammenfassung');
});
