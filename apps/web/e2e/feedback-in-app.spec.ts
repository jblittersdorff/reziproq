import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Feedback in der App: Fragebogen angemeldet beantworten, Käufer und Lieferant, ohne seitliches
// Scrollen auf Telefonbreite und am Schreibtisch.

test.use({ locale: 'de-DE' });

const invitation = '0190a0a0-0000-7000-8000-000000000040';
const questions = [
  ['pulse_satisfaction', 'collaboration', 'Ich bin mit der Zusammenarbeit insgesamt zufrieden.'],
  ['pulse_trust', 'trust', 'Ich vertraue der anderen Seite, dass sie Zusagen einhält.'],
  ['pulse_alignment', 'strategy', 'Wir verfolgen dieselben Ziele.'],
].map(([key, dimension, textDe]) => ({
  key,
  dimension,
  textDe,
  textEn: textDe,
  active: true,
  custom: false,
}));

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
  await page.route('**/api/feedback/meine', (route) =>
    route.fulfill({
      json: {
        invitations: [
          {
            id: invitation,
            waveId: '0190a0a0-0000-7000-8000-000000000030',
            relationshipId: '0190a0a0-0000-7000-8000-000000000001',
            side,
            kind: 'pulse',
            dueDate: '2099-03-31',
            status: 'open',
            counterpart: side === 'buyer' ? 'Rheintal Elektronik GmbH (Demo)' : 'Test-OEM (Demo)',
          },
        ],
      },
    }),
  );
  await page.route(`**/api/feedback/meine/${invitation}`, (route) =>
    route.fulfill({
      json: {
        status: 'open',
        kind: 'pulse',
        dueDate: '2099-03-31',
        side,
        buyer: 'Test-OEM (Demo)',
        supplier: 'Rheintal Elektronik GmbH (Demo)',
        questions,
      },
    }),
  );
}

for (const side of ['buyer', 'supplier'] as const) {
  for (const width of [390, 1440]) {
    test(`Feedback in der App ohne seitliches Scrollen (${side}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mock(page, side);
      await page.goto(`/feedback/${invitation}`);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Test-OEM (Demo) · Rheintal Elektronik GmbH (Demo)',
        }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Absenden' })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
      expect(await overflow()).toBe(0);
      if (process.env.FIA_SHOTS)
        await page.screenshot({
          path: `${process.env.FIA_SHOTS}/fia-${side}-${width}.png`,
          fullPage: true,
        });
      await page.goto('/feedback');
      await expect(page.getByRole('link', { name: /Jetzt beantworten/ })).toBeVisible();
      expect(await overflow()).toBe(0);
    });
  }
}
