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

async function cardColumns(page: Page) {
  const cards = page.getByRole('list', { name: 'Lieferanten' }).getByRole('listitem');
  await expect(cards).toHaveCount(suppliers.length);
  const xs = await cards.evaluateAll((items) =>
    items.map((item) => Math.round(item.getBoundingClientRect().x)),
  );
  return new Set(xs).size;
}

// Handschrift A2: größere Karten mit Spend als Kennzahl, daher drei statt vier Spalten.
test('Auf breiten Bildschirmen stehen die Karten in drei Spalten', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/lieferanten');
  expect(await cardColumns(page)).toBe(3);
});

test('Bei 390 px stehen die Karten einspaltig, ohne waagerechte Scrollleiste', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/lieferanten');
  expect(await cardColumns(page)).toBe(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('Die Suche filtert schon beim Tippen', async ({ page }) => {
  await signIn(page);
  await page.goto('/lieferanten');
  const cards = page.getByRole('list', { name: 'Lieferanten' }).getByRole('listitem');
  await expect(cards).toHaveCount(8);
  await page
    .getByRole('searchbox', { name: 'Lieferant oder eigene Nummer suchen' })
    .pressSequentially('L-10003');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Lieferant 3 (Demo)');
});
