import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const id = (n: number) => `550e8400-e29b-41d4-a716-${String(n).padStart(12, '0')}`;
const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
const points = Array.from({ length: 50 }, (_, n) => ({
  relationshipId: id(n + 1),
  name: `${names[n % names.length]} Werkzeugbau ${n + 1}`,
  spendCents: (n + 1) * 25_000_000,
  currency: 'EUR',
  businessUnit: null,
  materialGroup: null,
  ist: { impactLevel: (n % 3) + 1, qualityLevel: (n % 2) + 1, typeName: 'Strategisch' },
  soll: { impactLevel: (n % 3) + 1, qualityLevel: 3, typeName: 'Partner' },
}));
const item = (n: number, submitted: number, deviation: number | null) => ({
  relationshipId: id(n),
  name: `${names[n % names.length]} Werkzeugbau KG`,
  submitted,
  total: 3,
  deviation,
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
        orgRole: 'member',
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
        actions: ['organisation.sehen', 'bewertungen.sehen', 'portfolio.sehen', 'runden.sehen'],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/portfolio', (route) =>
    route.fulfill({ json: { matrixCount: 50, openCount: 6, openRounds: 1, focusCount: 2 } }),
  );
  await page.route('**/api/portfolio/matrix*', (route) =>
    route.fulfill({
      json: {
        spendYear: 2025,
        businessUnits: [{ id: id(900), name: 'Antrieb' }],
        materialGroups: [{ id: id(901), name: 'Stahl' }],
        points,
      },
    }),
  );
  await page.route('**/api/portfolio/open', (route) =>
    route.fulfill({
      json: {
        deviationThreshold: 30,
        groups: {
          ratings_open: [item(1, 1, null), item(2, 2, null)],
          not_consolidated: [item(3, 3, 12)],
          deviation: [item(4, 3, 42), item(5, 3, 55)],
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

test('SEG-07 Kacheln', async ({ page }, testInfo) => {
  await setUp(page);
  await page.goto('/portfolio');
  await expect(page.getByText('Lieferanten in der Matrix')).toBeVisible();
  await shoot(page, testInfo, 'kacheln');
});

test('SEG-07 Matrix mit 50 Lieferanten', async ({ page }, testInfo) => {
  await setUp(page);
  await page.goto('/portfolio/matrix');
  await expect(page.getByRole('link', { name: /Alpha Werkzeugbau 1$/ })).toBeVisible();
  await shoot(page, testInfo, 'matrix');
});

test('SEG-07 Offene Entscheidungen', async ({ page }, testInfo) => {
  await setUp(page);
  await page.goto('/portfolio/offen');
  await expect(page.getByText('Abweichung 55 Punkte')).toBeVisible();
  await shoot(page, testInfo, 'offen');
});
