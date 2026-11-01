import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-08.md, die einen echten Browser brauchen: der Baustein Verlauf im
// Styleguide (PLT-10).

test.use({ locale: 'de-DE' });

async function openStyleguide(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
        supportView: false,
        permissions: { viewOrganizationSettings: true, viewSuppliers: true, switchCustomer: false },
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.goto('/styleguide');
  await expect(page.getByRole('heading', { level: 1, name: 'Styleguide' })).toBeVisible();
}

test('Der Baustein „Verlauf“ steht im Styleguide und zeigt Einträge, leeren Zustand und Ladezustand', async ({
  page,
}) => {
  await openStyleguide(page);
  // Der Verlauf steht im Abschnitt „Tabellen und Listen“ unter einer eigenen Überschrift.
  const section = page
    .locator('[data-slot="subsection"]')
    .filter({ has: page.getByRole('heading', { level: 4, name: 'Verlauf' }) });
  await expect(section).toHaveCount(1);
  await section.scrollIntoViewIfNeeded();

  // Einträge: Datum, Änderung, Person und Organisation, neueste zuerst.
  const entries = section.locator('[data-slot="history-list"]').first().getByRole('listitem');
  await expect(entries.first()).toContainText('12.11.2026, 14:05');
  await expect(entries.first()).toContainText('Status: angelegt → aktiv');
  await expect(entries.first()).toContainText('Lena Berger · Test-OEM (Demo)');

  // Leerer Zustand und Ladezustand
  await expect(section.getByText('Noch keine Änderungen')).toBeVisible();
  await expect(
    section.getByRole('status').filter({ hasText: 'Verlauf wird geladen …' }),
  ).toBeVisible();
});
