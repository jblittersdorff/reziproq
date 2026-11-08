import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const id = (n: number) => `550e8400-e29b-41d4-a716-${String(n).padStart(12, '0')}`;
const lv = (impactLevel: number, qualityLevel: number, typeName: string) => ({
  impactLevel,
  qualityLevel,
  typeName,
});
const item = (n: number, name: string) => ({
  relationshipId: id(n),
  name,
  spendCents: 900_000_000 - n * 100_000_000,
  currency: 'EUR',
  sharePercent: 30 - n * 4,
  ist: lv(2, 2, 'Strategisch'),
  soll: lv(3, 3, 'Partner'),
});
const list = {
  spendYear: 2025,
  spendShare: 80,
  canEdit: true,
  focus: [{ ...item(1, 'Alpha Werkzeugbau KG'), reason: 'Engpass bei Druckgussteilen' }],
  suggestions: [
    { ...item(2, 'Beta Stahl GmbH'), reasons: ['spend_share', 'target_type'] },
    { ...item(3, 'Gamma Kunststoff AG'), reasons: ['spend_share'] },
  ],
};
const detail = {
  ...item(2, 'Beta Stahl GmbH'),
  spendYear: 2025,
  isFocus: false,
  reason: null,
  setAt: null,
  setBy: null,
  suggestionReasons: ['spend_share'],
  canEdit: true,
};

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
  await page.route('**/api/portfolio/fokus', (route) => route.fulfill({ json: list }));
  await page.route(`**/api/portfolio/fokus/${id(2)}`, (route) => route.fulfill({ json: detail }));
}

async function shoot(page: Page, testInfo: import('@playwright/test').TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['light', 'dark'] as const) {
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

test('SEG-02 Fokusliste', async ({ page }, testInfo) => {
  await setUp(page);
  await page.goto('/portfolio/fokus');
  await expect(page.getByText('Engpass bei Druckgussteilen')).toBeVisible();
  await shoot(page, testInfo, 'liste');
});

test('SEG-02 Lieferant', async ({ page }, testInfo) => {
  await setUp(page);
  await page.goto(`/portfolio/fokus/${id(2)}`);
  await expect(page.getByRole('switch', { name: 'Fokuslieferant' })).toBeVisible();
  await shoot(page, testInfo, 'lieferant');
});
