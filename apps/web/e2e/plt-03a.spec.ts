import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-03.md (Teil a), die einen echten Browser brauchen: Suche, Sortierung
// und „Beendete zeigen“ stehen in der Adresse und überstehen Neuladen und Zurück.

test.use({ locale: 'de-DE' });

const supplier = (
  name: string,
  externalRef: string | null,
  euro: number | null,
  status: 'draft' | 'active' | 'ended' = 'active',
) => ({
  relationshipId: `rel-${name}`,
  name,
  country: 'DE',
  externalRef,
  status,
  spend: euro === null ? null : { amountCents: euro * 100, currency: 'EUR' },
});

const suppliers = [
  supplier('Rheintal Elektronik GmbH (Demo)', 'L-10001', 4_820_000),
  supplier('Silesia Guss Sp. z o.o. (Demo)', 'L-10002', 3_150_000),
  supplier('Lombardia Fonderie S.p.A. (Demo)', 'L-10004', 2_710_000, 'ended'),
  supplier('Alpen Sensorik GmbH (Demo)', 'L-10006', 2_260_000),
  supplier('Test-Lieferant (Demo)', null, null, 'draft'),
];

async function signIn(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        permissions: { viewOrganizationSettings: true, viewSuppliers: true, switchCustomer: false },
      },
    }),
  );
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({
      json: {
        suppliers,
        count: 4,
        spendYear: 2025,
        totalSpend: [{ amountCents: 1_023_000_000, currency: 'EUR' }],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

const cardNames = (page: Page) =>
  page
    .getByRole('list', { name: 'Lieferanten' })
    .getByRole('heading', { level: 2 })
    .allTextContents();

test('Suche, Sortierung und der Filter „Beendete zeigen“ funktionieren und stehen in der Adresse', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/lieferanten');
  await expect(page.locator('#inhalt h1')).toHaveText('Lieferanten');
  await expect(page.locator('#inhalt header')).toContainText(
    '4 Lieferanten · 10.230.000 € Jahresspend 2025',
  );
  expect(await cardNames(page)).toEqual([
    'Rheintal Elektronik GmbH (Demo)',
    'Silesia Guss Sp. z o.o. (Demo)',
    'Alpen Sensorik GmbH (Demo)',
    'Test-Lieferant (Demo)',
  ]);

  await page.getByRole('combobox', { name: 'Sortieren' }).selectOption('name');
  await expect(page).toHaveURL(/sortierung=name/);
  await page.getByRole('switch', { name: 'Beendete zeigen' }).click();
  await expect(page).toHaveURL(/beendet=1/);
  await page
    .getByRole('searchbox', { name: 'Lieferant oder eigene Nummer suchen' })
    .fill('fonderie');
  await expect(page).toHaveURL(/suche=fonderie/);
  await expect.poll(() => cardNames(page)).toEqual(['Lombardia Fonderie S.p.A. (Demo)']);
  await expect(page.getByRole('list', { name: 'Lieferanten' })).toContainText('Beendet');

  // Neuladen stellt dieselbe Ansicht wieder her.
  await page.reload();
  // Nach dem Neuladen holt eine Weiterleitung zu Zitadel die Sitzung (PLT-01); erst danach lesen.
  await expect(page.locator('#inhalt h1')).toHaveText('Lieferanten');
  await expect.poll(() => cardNames(page)).toEqual(['Lombardia Fonderie S.p.A. (Demo)']);
  await expect(page.getByRole('searchbox')).toHaveValue('fonderie');
  await expect(page.getByRole('combobox', { name: 'Sortieren' })).toHaveValue('name');
  await expect(page.getByRole('switch', { name: 'Beendete zeigen' })).toBeChecked();

  // Ein Lesezeichen mit Filter öffnet direkt diese Ansicht.
  await page.goto('/lieferanten?sortierung=name');
  await expect(page.locator('#inhalt h1')).toHaveText('Lieferanten');
  await expect
    .poll(() => cardNames(page))
    .toEqual([
      'Alpen Sensorik GmbH (Demo)',
      'Rheintal Elektronik GmbH (Demo)',
      'Silesia Guss Sp. z o.o. (Demo)',
      'Test-Lieferant (Demo)',
    ]);
});

test('Zurück führt nach der Lieferantenliste zur Seite davor, nicht durch jeden Buchstaben', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/start');
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Lieferanten' })
    .click();
  await page.getByRole('searchbox').pressSequentially('silesia');
  await expect(page).toHaveURL(/suche=silesia/);
  await page.goBack();
  await expect(page).toHaveURL('http://localhost:5174/mein-tag');
});
