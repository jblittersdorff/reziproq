import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';
import { relationshipList, relationshipRow, routeRelationships } from './relationships.js';

// Tests zu docs/specs/PLT-02.md, die einen echten Browser brauchen: Zeilen und Breite.

test.use({ locale: 'de-DE' });

// Seit BZ-01 (K2-b.4): Seite Lieferanten mit Zeilen aus GET /api/beziehungen
const rows = Array.from({ length: 8 }, (_, index) =>
  relationshipRow(index + 1, {
    name: `Lieferant ${index + 1} (Demo)`,
    country: ['DE', 'PL', 'CZ', 'IT'][index % 4] ?? 'DE',
    spend: { amountCents: (9 - index) * 100_000_000, currency: 'EUR' },
    isMine: index % 2 === 0,
  }),
);

async function signIn(page: Page) {
  // Seit PLT-01 über den echten Ablauf mit nachgebautem Zitadel; Tokens liegen nur im Speicher.
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
        supportView: false,
        permissions: {
          viewOrganizationSettings: false,
          viewSuppliers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  await routeRelationships(page, rows);
}

const lines = (page: Page) => relationshipList(page).getByRole('link');

// BZ-01: alle Zeilen gleich hoch, ohne Detailleiste; die Zeile öffnet den Lieferanten
for (const width of [1440, 390]) {
  test(`Bei ${width} px haben alle Zeilen dieselbe Höhe, ohne waagerechte Scrollleiste`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto('/lieferanten');
    await expect(lines(page)).toHaveCount(rows.length);
    // Ohne Rand gemessen: Der Trennstrich steht unter jeder Zeile außer der letzten
    const heights = await lines(page).evaluateAll((items) =>
      items.map((item) => item.clientHeight),
    );
    expect(new Set(heights).size).toBe(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    await expect(page.getByRole('region', { name: /^Details zu/ })).toHaveCount(0);
  });
}

// BZ-01 streicht die eigene Suche (Frag Reziproq übernimmt); die Chips filtern sofort
test('Die Filter-Chips filtern sofort und stehen in der Adresse', async ({ page }) => {
  await signIn(page);
  await page.goto('/lieferanten');
  await expect(lines(page)).toHaveCount(8);
  await page
    .getByRole('group', { name: 'Filter' })
    .getByRole('button', { name: 'Meine · 4' })
    .click();
  await expect(lines(page)).toHaveCount(4);
  await expect(page).toHaveURL(/filter=meine/);
  await expect(lines(page).first()).toContainText('Lieferant 1');
});
