import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';
import { relationshipList, relationshipRow, routeRelationships } from './relationships.js';

// NAV-12 seit BZ-01 (K2-b.4): Seite Lieferanten mit Filter-Chips und „Mehr Filter“
const rows = Array.from({ length: 6 }, (_, index) => {
  const n = index + 1;
  return relationshipRow(n, {
    name: `Lieferant ${n} Werkzeugbau`,
    spend: { amountCents: (10 - n) * 100_000_000, currency: 'EUR' },
    materialGroup: 'Blech',
    businessUnitIds: ['bu1'],
    materialGroupIds: ['wg1'],
    targetType: { key: '3-3', name: 'Partner' },
    isFocus: n % 2 === 0,
    isMine: n % 3 === 0,
  });
});

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
  await routeRelationships(page, rows, {
    overrides: {
      filters: {
        businessUnits: [{ id: 'bu1', name: 'Antrieb' }],
        materialGroups: [
          { id: 'wg0', name: 'Stahl', parentId: null },
          { id: 'wg1', name: 'Blech', parentId: 'wg0' },
        ],
        targetTypes: [{ key: '3-3', name: 'Partner' }],
      },
    },
  });
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
  // Strategisch als Chip, Warengruppe Stahl mit Untergruppe Blech unter „Mehr Filter“
  await page.goto('/lieferanten?filter=strategisch&wg=wg0');
  const chips = page.getByRole('group', { name: 'Filter' });
  await expect(chips.getByRole('button', { name: 'Strategisch · 3' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(relationshipList(page).getByRole('link')).toHaveCount(3);
  await expect(page).toHaveURL(/filter=strategisch/);
  await shoot(page, testInfo, 'filter');
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
  await expect(page).not.toHaveURL(/wg=/);
  await expect(chips.getByRole('button', { name: 'Alle · 6' })).toBeVisible();
  await expect(relationshipList(page).getByRole('link')).toHaveCount(3);
});
