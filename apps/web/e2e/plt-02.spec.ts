import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-02.md, die einen echten Browser brauchen: Spalten und Breite.

test.use({ locale: 'de-DE' });

const suppliers = Array.from({ length: 8 }, (_, index) => ({
  relationshipId: `rel-${index}`,
  name: `Lieferant ${index + 1} (Demo)`,
  country: ['DE', 'PL', 'CZ', 'IT'][index % 4],
  externalRef: `L-${10_001 + index}`,
  status: 'active',
  spend: { amountCents: (9 - index) * 100_000_000, currency: 'EUR' },
}));

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
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({
      json: {
        suppliers,
        count: suppliers.length,
        spendYear: 2025,
        totalSpend: [
          {
            amountCents: suppliers.reduce((sum, s) => sum + s.spend.amountCents, 0),
            currency: 'EUR',
          },
        ],
      },
    }),
  );
}

const rows = (page: Page) =>
  page.getByRole('list', { name: 'Lieferanten' }).locator('[data-slot="supplier-row"]');

// LS-01: Liste mit festen Spalten statt Karten; alle Zeilen gleich hoch, rechts die Detailleiste.
for (const width of [1440, 390]) {
  test(`Bei ${width} px haben alle Zeilen dieselbe Höhe, ohne waagerechte Scrollleiste`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto('/lieferanten');
    await expect(rows(page)).toHaveCount(suppliers.length);
    const heights = await rows(page).evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size).toBe(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    // Breit: Detailleiste neben der Liste; schmal: erst nach Auswahl als eigene Ansicht
    const panel = page.getByRole('region', { name: /^Details zu/ });
    if (width === 1440) await expect(panel).toBeVisible();
    else {
      await expect(panel).toHaveCount(0);
      await rows(page).first().click();
      await expect(panel).toBeVisible();
      await expect(page.getByRole('button', { name: 'Zurück zur Liste' })).toBeVisible();
    }
  });
}

test('Die Suche filtert schon beim Tippen', async ({ page }) => {
  await signIn(page);
  await page.goto('/lieferanten');
  const cards = rows(page);
  await expect(cards).toHaveCount(8);
  await page
    .getByRole('searchbox', { name: 'Lieferant oder eigene Nummer suchen' })
    .pressSequentially('L-10003');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Lieferant 3');
});
