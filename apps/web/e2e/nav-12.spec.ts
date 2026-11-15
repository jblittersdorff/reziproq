import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const rel = (n: number, extra = {}) => ({
  relationshipId: `550e8400-e29b-41d4-a716-${String(n).padStart(12, '0')}`,
  name: `Lieferant ${n} Werkzeugbau`,
  country: 'DE',
  externalRef: `L-${n}`,
  status: 'active',
  spend: { amountCents: (10 - n) * 100_000_000, currency: 'EUR' },
  primaryMaterialGroup: 'Blech',
  materialGroups: ['Blech'],
  businessUnits: ['Antrieb'],
  businessUnitIds: ['bu1'],
  materialGroupIds: ['wg1'],
  targetType: '3-3',
  isFocus: n % 2 === 0,
  isMine: n % 3 === 0,
  ...extra,
});
const suppliers = Array.from({ length: 6 }, (_, n) => rel(n + 1));

test.use({ locale: 'de-DE' });

async function setUp(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Beispiel-OEM' },
        supportView: false,
        orgRole: 'admin',
        permissions: {
          viewOrganizationSettings: false,
          viewBuyerAreas: true,
          viewSuppliers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: ['organisation.sehen', 'portfolio.sehen', 'fokus.setzen'],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({
      json: {
        suppliers,
        count: 6,
        spendYear: 2025,
        totalSpend: [{ amountCents: 2_100_000_000, currency: 'EUR' }],
        filters: {
          businessUnits: [{ id: 'bu1', name: 'Antrieb' }],
          materialGroups: [
            { id: 'wg0', name: 'Stahl', parentId: null },
            { id: 'wg1', name: 'Blech', parentId: 'wg0' },
          ],
          targetTypes: [{ key: '3-3', name: 'Partner' }],
        },
      },
    }),
  );
}

async function shoot(page: Page, testInfo: import('@playwright/test').TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Es gibt nur ein helles Thema (Designsprache).
    for (const colorScheme of ['light'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.waitForTimeout(400);
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *:not(svg *)')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .map((element) => `${element.tagName.toLowerCase()}.${String(element.className)}`)
          .slice(-12),
      );
      expect(overflowing).toEqual([]);
      const path = testInfo.outputPath(`${name}-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`${name}-${colorScheme}-${width}`, {
        path,
        contentType: 'image/png',
      });
    }
  }
}

test('NAV-12 Filter', async ({ page }, testInfo) => {
  await setUp(page);
  await page.goto('/lieferanten?fokus=1&wg=wg0');
  await expect(page.getByText('3 Treffer')).toBeVisible();
  await expect(page).toHaveURL(/fokus=1/);
  await shoot(page, testInfo, 'filter');
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
  await expect(page.getByText('6 Treffer')).toBeVisible();
  await expect(page).not.toHaveURL(/fokus=1/);
});
