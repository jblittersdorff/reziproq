import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';
import { relationshipList, relationshipRow, routeRelationships } from './relationships.js';

// Tests zu docs/specs/PLT-03.md (Teil a), die einen echten Browser brauchen: Sortierung und
// „Beendete zeigen“ stehen in der Adresse und überstehen Neuladen und Zurück. Seit BZ-01 (K2-b.4)
// ohne eigene Suche (Frag Reziproq übernimmt); sortiert wird nach Aufmerksamkeit oder Spend.

test.use({ locale: 'de-DE' });

const eur = (euro: number) => ({ amountCents: euro * 100, currency: 'EUR' });
const rows = [
  relationshipRow(1, {
    name: 'Rheintal Elektronik GmbH (Demo)',
    spend: eur(4_820_000),
    reason: { kind: 'unrated' },
    attention: 2,
  }),
  relationshipRow(2, { name: 'Silesia Guss Sp. z o.o. (Demo)', spend: eur(3_150_000) }),
  relationshipRow(3, { name: 'Alpen Sensorik GmbH (Demo)', spend: eur(2_260_000) }),
  relationshipRow(4, {
    name: 'Kessler Präzision GmbH (Demo)',
    spend: eur(1_600_000),
    reason: { kind: 'disputed' },
    attention: 3,
    disputed: true,
  }),
  relationshipRow(5, {
    name: 'Lombardia Fonderie S.p.A. (Demo)',
    spend: eur(2_710_000),
    status: 'ended',
  }),
  relationshipRow(6, { name: 'Test-Lieferant (Demo)', status: 'draft' }),
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
  // Die nachgebaute API ordnet nach Aufmerksamkeit: Kessler (strittig), dann Rheintal (ohne Bewertung)
  await routeRelationships(
    page,
    [rows[3], rows[0], rows[1], rows[2], rows[4], rows[5]].flatMap((row) => (row ? [row] : [])),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

/** Namen der Zeilen der Liste in ihrer Folge (Anzeigename ohne Rechtsform, LS-01) */
const names = (page: Page) =>
  relationshipList(page)
    .locator('a[href^="/lieferanten/"] b')
    .evaluateAll((items) => items.map((item) => item.firstChild?.textContent?.trim()));

test('Sortierung und der Filter „Beendete zeigen“ funktionieren und stehen in der Adresse', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/beziehungen');
  await expect(page.locator('#inhalt h1')).toHaveText('Lieferanten');
  await expect(page.locator('#inhalt header')).toContainText('4 Beziehungen');
  await expect
    .poll(() => names(page))
    .toEqual(['Kessler Präzision', 'Rheintal Elektronik', 'Silesia Guss', 'Alpen Sensorik']);

  await page.getByRole('combobox', { name: 'Sortierung' }).selectOption('spend');
  await expect(page).toHaveURL(/sortierung=spend/);
  await page.getByRole('button', { name: 'Mehr Filter' }).click();
  await page.getByRole('switch', { name: 'Beendete zeigen' }).click();
  await expect(page).toHaveURL(/beendet=1/);
  await expect
    .poll(() => names(page))
    .toEqual([
      'Rheintal Elektronik',
      'Silesia Guss',
      'Alpen Sensorik',
      'Kessler Präzision',
      'Lombardia Fonderie',
    ]);
  await expect(relationshipList(page).getByRole('link', { name: /Lombardia/ })).toContainText(
    'beendet',
  );

  // Neuladen stellt dieselbe Ansicht wieder her.
  await page.reload();
  // Nach dem Neuladen holt eine Weiterleitung zu Zitadel die Sitzung (PLT-01); erst danach lesen.
  await expect(page.locator('#inhalt h1')).toHaveText('Lieferanten');
  await expect.poll(async () => (await names(page)).at(-1)).toBe('Lombardia Fonderie');
  await expect(page.getByRole('combobox', { name: 'Sortierung' })).toHaveValue('spend');
  await expect(page.getByRole('switch', { name: 'Beendete zeigen' })).toBeChecked();

  // Ein Lesezeichen mit Filter öffnet direkt diese Ansicht.
  await page.goto('/beziehungen?sortierung=spend');
  await expect(page.locator('#inhalt h1')).toHaveText('Lieferanten');
  await expect
    .poll(() => names(page))
    .toEqual(['Rheintal Elektronik', 'Silesia Guss', 'Alpen Sensorik', 'Kessler Präzision']);
});

test('Zurück führt nach der Lieferantenliste zur Seite davor, nicht durch jeden Filter', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/heute');
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Lieferanten' })
    .click();
  const chips = page.getByRole('group', { name: 'Filter' });
  await chips.getByRole('button', { name: /^Strategisch/ }).click();
  await expect(page).toHaveURL(/filter=strategisch/);
  await chips.getByRole('button', { name: /^Meine/ }).click();
  await expect(page).toHaveURL(/filter=meine/);
  await page.goBack();
  await expect(page).toHaveURL('http://localhost:5174/heute');
});
