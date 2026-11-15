import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

test.use({ locale: 'de-DE' });

const uuid = (n: number) => `550e8400-e29b-41d4-a716-4466554400${String(n).padStart(2, '0')}`;
const suppliers = ['Alpha GmbH', 'Beta AG', 'Gamma Werkzeugbau KG', 'Delta Stahl SE', 'Epsilon KG'];
const items = suppliers.map((supplier, index) => ({
  id: uuid(index),
  kind: 'rating',
  supplier,
  detail: 'Antrieb',
  dueDate: '2099-12-31',
  href: `/bewertungen/${uuid(index)}`,
}));

async function mock(page: Page) {
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
    route.fulfill({ json: { actions: ['organisation.sehen', 'start.sehen'] } }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/start', (route) =>
    route.fulfill({
      json: {
        due: { items, total: 8 },
        relationships: {
          items: suppliers.slice(0, 3).map((name, index) => ({
            id: uuid(60 + index),
            name,
            target: index === 0 ? 'Partner' : null,
          })),
          total: 3,
        },
        nextMeeting: {
          id: uuid(90),
          relationshipId: uuid(60),
          counterpart: suppliers[0],
          title: 'Quartalsreview',
          startsAt: '2099-03-15T09:00:00Z',
          location: 'Werk Nord',
        },
        portfolio: {
          suppliers: 16,
          focusTotal: 3,
          openDecisions: 2,
          focus: suppliers.slice(0, 3).map((name, index) => ({
            id: uuid(60 + index),
            name,
            rulesShared: index === 0,
          })),
        },
        openActions: 4,
      },
    }),
  );
  await page.route('**/api/start/due', (route) => route.fulfill({ json: { items } }));
}

async function shoot(page: Page, testInfo: import('@playwright/test').TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Es gibt nur ein helles Thema (Designsprache).
    for (const colorScheme of ['light'] as const) {
      // Ohne Übergänge, sonst zeigt das Bild Farben mitten im Wechsel zwischen Hell und Dunkel.
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
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

test('NAV-05 zeigt Start mit Bühne und vier Kacheln (A2) und die volle Liste ohne Überlauf', async ({
  page,
}, testInfo) => {
  await mock(page);
  await page.goto('/start');
  await expect(page.getByText('Acht Dinge warten heute auf dich.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Im Fokus' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Offene Entscheidungen' }),
  ).toBeVisible();
  await shoot(page, testInfo, 'start');

  await page.goto('/start/faellig');
  await expect(page.getByText('Alles, was bei mir fällig ist').first()).toBeVisible();
  await shoot(page, testInfo, 'faellig');
});
