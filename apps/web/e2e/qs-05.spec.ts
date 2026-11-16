import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// QS-05: Treffer auf der Seite Fragen (Käufer) und die Suche der Lieferantenseite, ohne seitliches
// Scrollen auf Telefonbreite und am Schreibtisch.

test.use({ locale: 'de-DE' });

const rel = '0190a0a0-0000-7000-8000-000000000001';
const hit = (n: number, title: string, detail: string | null, href: string) => ({
  id: `0190a0a0-0000-7000-8000-0000000000${n}`,
  title,
  detail,
  href,
});

async function mock(page: Page, side: 'buyer' | 'supplier') {
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
          viewBuyerAreas: side === 'buyer',
          viewSuppliers: side === 'buyer',
          viewCustomers: side === 'supplier',
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'organisation.sehen',
          'start.sehen',
          'prompt.nutzen',
          'suche.nutzen',
          'kunden.sehen',
        ],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/kunden', (route) =>
    route.fulfill({
      json: {
        customers: [
          { relationshipId: rel, name: 'Test-OEM (Demo)', nextMeeting: null },
          {
            relationshipId: '0190a0a0-0000-7000-8000-000000000002',
            name: 'Zweit-OEM (Demo)',
            nextMeeting: null,
          },
        ],
      },
    }),
  );
  await page.route('**/api/suche?**', (route) =>
    route.fulfill({
      json: {
        query: 'Kosten',
        suppliers:
          side === 'buyer'
            ? [hit(11, 'Rheintal Elektronik GmbH (Demo)', 'L-10001', `/lieferanten/${rel}`)]
            : [],
        initiatives: [
          hit(
            12,
            'Kostensenkung Leiterplatten durch zweite Bezugsquelle in Osteuropa',
            side === 'buyer' ? 'Rheintal Elektronik GmbH (Demo)' : null,
            `/lieferanten/${rel}/plan/initiativen/0190a0a0-0000-7000-8000-000000000012`,
          ),
        ],
        actions: [
          hit(13, 'Kostenanalyse Gehäuse', null, `/lieferanten/${rel}/umsetzung/massnahmen/x`),
          hit(14, 'Kostenfreigabe Werkzeug', null, `/lieferanten/${rel}/umsetzung/massnahmen/y`),
        ],
      },
    }),
  );
}

for (const side of ['buyer', 'supplier'] as const) {
  for (const width of [390, 1440]) {
    test(`Suche ohne seitliches Scrollen (${side}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mock(page, side);
      await page.goto('/fragen');
      const field =
        side === 'buyer' ? page.getByLabel('Deine Frage an Reziproq') : page.getByLabel('Suchwort');
      await field.fill('Kosten');
      const hits = page.getByRole('region', { name: 'Treffer' });
      await expect(hits.getByRole('link', { name: /Kostenanalyse Gehäuse/ })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBe(0);
      if (process.env.QS05_SHOTS)
        await page.screenshot({
          path: `${process.env.QS05_SHOTS}/qs05-${side}-${width}.png`,
          fullPage: true,
        });
    });
  }
}
