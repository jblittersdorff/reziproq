import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-03.md (Teil b), die einen echten Browser brauchen: eigene Seiten fürs
// Anlegen, Bearbeiten und den Spend, Speichern und Abbrechen mit dem Zurück-Knopf, 390 px.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const url = (path: string) => `http://localhost:5174${path}`;

/** Nachgebaute API mit einem Lieferanten, der sich beim Speichern wirklich ändert. */
async function signIn(page: Page) {
  await fakeZitadel(page);
  const supplier = {
    relationshipId: id,
    name: 'Neu GmbH (Demo)',
    organizationName: 'Neu GmbH (Demo)',
    country: 'PL',
    vatId: null as string | null,
    duns: null,
    externalRef: 'L-2' as string | null,
    notes: null as string | null,
    status: 'draft',
    createdAt: '2026-11-01T08:00:00Z',
    endedAt: null as string | null,
    spend: [{ year: 2025, amount: { amountCents: 125_000_000, currency: 'EUR' } }],
    permissions: { edit: true, editTeam: false },
  };
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        permissions: {
          viewOrganizationSettings: true,
          viewSuppliers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: { actions: ['lieferanten.sehen', 'lieferanten.bearbeiten', 'verlauf.sehen'] },
    }),
  );
  await page.route('**/api/suppliers', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 201, json: { relationshipId: id, linked: false } })
      : route.fulfill({
          json: {
            suppliers: [
              {
                relationshipId: id,
                name: supplier.name,
                country: 'PL',
                externalRef: supplier.externalRef,
                status: supplier.status,
                spend: supplier.spend[0]?.amount ?? null,
              },
            ],
            count: 1,
            spendYear: 2025,
            totalSpend: [{ amountCents: 125_000_000, currency: 'EUR' }],
          },
        }),
  );
  await page.route('**/api/suppliers/lookup**', (route) =>
    route.fulfill({ json: { known: false } }),
  );
  await page.route(`**/api/suppliers/${id}**`, (route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON();
      supplier.name = body.displayName;
      supplier.externalRef = body.externalRef ?? null;
      supplier.notes = body.notes ?? null;
    }
    if (request.method() === 'PUT') {
      const year = Number(request.url().split('/').at(-1));
      supplier.spend = [
        { year, amount: { amountCents: request.postDataJSON().amountCents, currency: 'EUR' } },
        ...supplier.spend.filter((entry) => entry.year !== year),
      ].sort((a, b) => b.year - a.year);
    }
    if (request.url().endsWith('/beenden')) {
      supplier.status = 'ended';
      supplier.endedAt = '2026-11-01T09:00:00Z';
    }
    return route.fulfill({ json: supplier });
  });
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

test('Anlegen, Bearbeiten und Spend-Erfassung laufen über eigene Seiten. Speichern und Abbrechen führen zurück.', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/lieferanten');
  await page.getByRole('link', { name: 'Lieferant hinzufügen' }).click();
  await expect(page).toHaveURL(url('/lieferanten/neu'));
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Abbrechen führt zur Liste zurück.
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page).toHaveURL(url('/lieferanten'));

  // Anlegen führt zum neuen Lieferanten; Zurück führt danach zur Liste, nicht ins Formular.
  await page.getByRole('link', { name: 'Lieferant hinzufügen' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Neu GmbH (Demo)');
  await page.getByLabel('Land').selectOption('PL');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/profil`));
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(url('/lieferanten'));
  await page.goForward();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/profil`));

  // Bearbeiten: Speichern führt zum Profil zurück und zeigt den neuen Wert.
  await page.getByRole('link', { name: 'Bearbeiten' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/profil/bearbeiten`));
  await page.getByLabel('Notizen').fill('Rahmenvertrag bis 2027');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/profil`));
  await expect(page.getByText('Rahmenvertrag bis 2027')).toBeVisible();

  // Spend: Jahr hinzufügen auf eigener Seite, Abbrechen und Speichern führen zur Liste der Jahre.
  await page.getByRole('link', { name: /Spend je Jahr/ }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/spend`));
  await page.getByRole('link', { name: 'Jahr hinzufügen' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/spend/neu`));
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/spend`));
  await page.getByRole('link', { name: 'Jahr hinzufügen' }).click();
  await page.getByLabel('Jahr').fill('2024');
  await page.getByLabel('Spend in Euro').fill('980.000');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/spend`));
  await expect(page.getByRole('table', { name: 'Spend' })).toContainText('980.000,00');

  // Zurück-Pfeil im Pfad führt eine Ebene nach oben zum Bereich Strategie (seit NAV-06), von dort
  // die Kachel zum Profil.
  await page
    .getByRole('navigation', { name: 'Pfad' })
    .getByRole('link', { name: 'Zurück zu Strategie' })
    .click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie`));
  await page.getByRole('link', { name: 'Profil öffnen' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/profil`));

  // Beenden mit Bestätigung auf der Seite.
  await page.getByRole('button', { name: 'Beziehung beenden' }).click();
  await page
    .getByRole('group', { name: /wirklich beenden/ })
    .getByRole('button', { name: 'Beenden' })
    .click();
  await expect(page.getByText('Die Beziehung ist beendet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Beziehung beenden' })).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`Formular- und Profilseiten ohne waagerechte Scrollleiste und mit 44-px-Klickflächen (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    for (const path of [
      '/lieferanten/neu',
      `/lieferanten/${id}/strategie/profil`,
      `/lieferanten/${id}/strategie/profil/bearbeiten`,
      `/lieferanten/${id}/strategie/spend`,
      `/lieferanten/${id}/strategie/spend/2025`,
    ]) {
      await page.goto(path);
      await expect(page.locator('#inhalt h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '#inhalt a[href], #inhalt button, #inhalt input, #inhalt select',
          ),
        ]
          .map((element) => ({ element, box: element.getBoundingClientRect() }))
          .filter(({ box }) => box.width > 1 && box.height < 44)
          .map(({ element }) => element.getAttribute('aria-label') ?? element.textContent?.trim()),
      );
      expect(small, path).toEqual([]);
    }
  });
}
