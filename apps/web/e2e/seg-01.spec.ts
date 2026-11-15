import { expect, test } from '@playwright/test';
import { defaultSegmentCriteria, defaultSegmentTypes } from '@reziproq/shared';
import { fakeZitadel } from './fake-zitadel.js';

const model = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  version: 1,
  status: 'active' as const,
  lowMax: 33,
  midMax: 66,
  deviationThreshold: 30,
  focusSpendShare: 80,
  createdAt: '2026-04-02T10:00:00.000Z',
  activatedAt: '2026-04-02T10:00:00.000Z',
  criteria: defaultSegmentCriteria.map((criterion) => ({ ...criterion })),
  types: defaultSegmentTypes.map((type) => ({ ...type })),
};

test.use({ locale: 'de-DE' });

test('SEG-01 passt sich auf Desktop und Mobil an und bleibt lesbar', async ({ page }, testInfo) => {
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
          viewOrganizationSettings: true,
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
        actions: [
          'organisation.sehen',
          'einstellungen.verwalten',
          'segmentmodell.sehen',
          'segmentmodell.verwalten',
        ],
      },
    }),
  );
  await page.route('**/api/segment-model', (route) =>
    route.fulfill({ json: { active: model, draft: null } }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));

  await page.goto('/einstellungen/segmentmodell');
  await expect(page.locator('#inhalt h1')).toHaveText('Segmentmodell');
  await expect(
    page.getByRole('table', {
      name: 'Beziehungstypen nach Business Impact und Beziehungsqualität',
    }),
  ).toBeVisible();
  await expect(page.getByText(/^Aktiv seit/)).toBeVisible();

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['light'] as const) {
      await page.emulateMedia({ colorScheme });
      const overflowingElements = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            return `${element.tagName.toLowerCase()}.${String(element.className)} (${Math.round(bounds.right)}px)`;
          })
          .slice(-12),
      );
      expect(overflowingElements).toEqual([]);
      const path = testInfo.outputPath(`segment-model-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`segment-model-${colorScheme}-${width}`, {
        path,
        contentType: 'image/png',
      });
    }
  }
});
