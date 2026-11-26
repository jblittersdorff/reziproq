import { expect, test } from '@playwright/test';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  defaultSegmentTypesFor,
} from '@reziproq/shared';
import { fakeZitadel } from './fake-zitadel.js';

const model = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  version: 1,
  status: 'active' as const,
  gridSize: 3 as const,
  impactLabel: 'Business Impact',
  qualityLabel: 'Beziehungsqualität',
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

const signedInAsAdmin = async (
  page: import('@playwright/test').Page,
  current: Record<string, unknown>,
) => {
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
    route.fulfill({ json: { active: current, draft: null } }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
};

const sideOverflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .map((element) => element.tagName.toLowerCase())
      .slice(-12),
  );

test('SEG-01 passt sich auf Desktop und Mobil an und bleibt lesbar', async ({ page }, testInfo) => {
  await signedInAsAdmin(page, model);
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

// E-K0-33 (K2-b.1): Matrix 2 × 2 mit eigenen Achsen; mit UX_SHOTS entstehen Bilder
for (const width of [390, 1440]) {
  test(`Segmentmodell 2 × 2 mit eigenen Achsen, ${width} px (E-K0-33)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signedInAsAdmin(page, {
      ...model,
      gridSize: 2,
      impactLabel: 'Versorgungsrisiko',
      qualityLabel: 'Wertbeitrag',
      lowMax: 50,
      midMax: 100,
      types: defaultSegmentTypesFor(2).map((type, index) => ({
        ...type,
        name: ['Entwickeln', 'Hebeln', 'Absichern', 'Strategisch'][index] ?? type.name,
      })),
    });
    await page.goto('/einstellungen/segmentmodell');
    await expect(
      page.getByText('Matrix 2 × 2 · Zeilen Versorgungsrisiko, Spalten Wertbeitrag'),
    ).toBeVisible();
    await expect(page.getByText('Hohe Stufe ab 51')).toBeVisible();
    await expect(page.getByText('Mittlere Stufe bis')).toHaveCount(0);
    // Mobil steht die Matrix als Liste, auf dem Desktop als Tabelle; geprüft wird die sichtbare
    await expect(page.getByText('Strategisch').filter({ visible: true }).first()).toBeVisible();
    expect(await sideOverflow(page)).toEqual([]);
    if (process.env.UX_SHOTS) {
      await page.screenshot({
        path: `${process.env.UX_SHOTS}/segmentmodell-2x2-${width}.png`,
        fullPage: true,
      });
    }
  });
}
