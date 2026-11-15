import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Browsertests zu docs/specs/LIF-02.md: Kunden, Arbeitsbereich und Kundenwechsel der
// Lieferantenseite. Die API ist nachgebaut; Screenshots hell und dunkel, breit und schmal.

test.use({ locale: 'de-DE' });

const idA = '0190a0a0-0000-7000-8000-00000000000a';
const idB = '0190a0a0-0000-7000-8000-00000000000b';

async function mockSupplier(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Sven Ludwig',
        firstName: 'Sven',
        email: 'sven@example.com',
        organization: { id: 'org-3', name: 'Test-Lieferant (Demo)' },
        supportView: false,
        orgRole: 'admin',
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: false,
          viewSuppliers: false,
          viewCustomers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({ json: { actions: ['organisation.sehen', 'start.sehen', 'kunden.sehen'] } }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/kunden', (route) =>
    route.fulfill({
      json: {
        customers: [
          { relationshipId: idA, name: 'Test-OEM (Demo)', nextMeeting: null },
          {
            relationshipId: idB,
            name: 'Zweit-OEM mit sehr langem Namen (Demo) GmbH & Co. KG',
            nextMeeting: '2026-12-03',
          },
        ],
      },
    }),
  );
  for (const [id, name] of [
    [idA, 'Test-OEM (Demo)'],
    [idB, 'Zweit-OEM mit sehr langem Namen (Demo) GmbH & Co. KG'],
  ] as const) {
    await page.route(`**/api/kunden/${id}`, (route) =>
      route.fulfill({
        json: { relationshipId: id, name, relationshipType: null, nextMeeting: null },
      }),
    );
  }
}

/** Kein Element ragt über den Rand; Screenshots hell und dunkel, 1440 und 390 Pixel breit. */
async function shoot(page: Page, testInfo: TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Es gibt nur ein helles Thema (Designsprache).
    for (const colorScheme of ['light'] as const) {
      await page.emulateMedia({ colorScheme });
      // Farbübergänge der Kacheln abwarten, sonst zeigt der Screenshot Zwischenfarben.
      await page.waitForTimeout(300);
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .map((element) => `${element.tagName.toLowerCase()}.${String(element.className)}`)
          .slice(-12),
      );
      expect(overflowing).toEqual([]);
      const path = testInfo.outputPath(`${name}-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`${name}-${colorScheme}-${width}`, { path, contentType: 'image/png' });
    }
  }
}

test('LIF-02 Kunden, Arbeitsbereich und Kundenwechsel', async ({ page }, testInfo) => {
  await mockSupplier(page);
  await page.goto('/kunden');
  await expect(page.locator('#inhalt h1')).toHaveText('Kunden');
  await expect(page.getByText('Noch kein gemeinsamer Termin')).toBeVisible();
  await shoot(page, testInfo, 'lif-02-kunden');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Test-OEM (Demo)' }).click();
  await expect(page.locator('#inhalt h1')).toHaveText('Test-OEM (Demo)');
  await shoot(page, testInfo, 'lif-02-ueberblick');

  await page.setViewportSize({ width: 1440, height: 900 });
  const bar = page.getByRole('navigation', { name: 'Arbeitsbereich des Kunden' });
  // Nur gebaute Bereiche stehen in der Leiste (UMB-05); Wirkung ist seit PNL-07 gebaut.
  await expect(bar.getByRole('link', { name: 'Wirkung' })).toHaveCount(1);
  await bar.getByRole('link', { name: 'Gemeinsamer Plan' }).click();
  await expect(page.locator('#inhalt h1')).toHaveText('Gemeinsamer Plan');
  await expect(bar.getByRole('link', { name: 'Strategie' })).toHaveCount(0);
  await shoot(page, testInfo, 'lif-02-bereich');

  await page.setViewportSize({ width: 1440, height: 900 });
  await bar.getByRole('link', { name: 'Test-OEM (Demo)' }).click();
  await page.getByRole('link', { name: /Zweit-OEM/ }).click();
  await expect(page).toHaveURL(new RegExp(`/kunden/${idB}/plan$`));
});
