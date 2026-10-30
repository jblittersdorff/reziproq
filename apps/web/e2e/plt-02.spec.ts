import { expect, type Page, test } from '@playwright/test';

// Tests zu docs/specs/PLT-02.md, die einen echten Browser brauchen: Spalten und Breite.

test.use({ locale: 'de-DE' });

const suppliers = Array.from({ length: 8 }, (_, index) => ({
  relationshipId: `rel-${index}`,
  name: `Lieferant ${index + 1} (Demo)`,
  country: ['DE', 'PL', 'CZ', 'IT'][index % 4],
  category: ['Elektronik', 'Guss', 'Kunststoff', 'Logistik'][index % 4],
  annualSpend: { amountCents: (9 - index) * 100_000_000, currency: 'EUR' },
  spendYear: 2025,
}));

async function signIn(page: Page) {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id_token: `${b64({ alg: 'none' })}.${b64({ iss: 'https://zitadel.test', aud: 'web-client', sub: 'user-1', exp: now + 3600 })}.`,
    access_token: 'access-token-1',
    token_type: 'Bearer',
    scope: 'openid profile email',
    profile: { sub: 'user-1' },
    expires_at: now + 3600,
  };
  await page.addInitScript((value) => {
    sessionStorage.setItem('oidc.user:https://zitadel.test:web-client', value);
  }, JSON.stringify(user));
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
            amountCents: suppliers.reduce((sum, s) => sum + s.annualSpend.amountCents, 0),
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

test('Auf breiten Bildschirmen stehen die Karten in vier Spalten', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/lieferanten');
  expect(await cardColumns(page)).toBe(4);
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
    .getByRole('searchbox', { name: 'Lieferant oder Warengruppe suchen' })
    .pressSequentially('gus');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('Guss');
});
