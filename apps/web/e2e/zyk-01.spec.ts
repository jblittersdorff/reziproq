import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const relationshipId = '550e8400-e29b-41d4-a716-000000000001';
const base = `/lieferanten/${relationshipId}`;
const cycle = {
  id: '550e8400-e29b-41d4-a716-000000000002',
  label: '2026',
  startedAt: '2026-01-01T00:00:00.000Z',
  jbpDate: null,
  schedule: [
    { step: 'feedback', weeksRelativeToJbp: -8, reminderDaysBefore: 7, dueDate: null },
    { step: 'touchpoints', weeksRelativeToJbp: -6, reminderDaysBefore: 7, dueDate: null },
    { step: 'supplierPlan', weeksRelativeToJbp: -2, reminderDaysBefore: 7, dueDate: null },
    { step: 'jbp', weeksRelativeToJbp: 0, reminderDaysBefore: 7, dueDate: null },
    { step: 'scorecard', weeksRelativeToJbp: 3, reminderDaysBefore: 7, dueDate: null },
  ],
  steps: [
    { key: 'segment', status: 'open', href: `${base}/strategie/segmentierung`, dueDate: null },
    { key: 'feedback', status: 'unavailable', href: null, dueDate: null },
    { key: 'touchpoints', status: 'unavailable', href: null, dueDate: null },
    { key: 'supplierPlan', status: 'unavailable', href: null, dueDate: null },
    { key: 'jbp', status: 'unavailable', href: null, dueDate: null },
    { key: 'scorecard', status: 'unavailable', href: null, dueDate: null },
    { key: 'execution', status: 'unavailable', href: null, dueDate: null },
  ],
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
    route.fulfill({ json: { actions: ['lieferanten.sehen', 'zyklus.starten'] } }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/suppliers/${relationshipId}`, (route) =>
    route.fulfill({
      json: {
        relationshipId,
        name: 'Rheintal Elektronik GmbH',
        organizationName: 'Rheintal Elektronik GmbH',
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: 'L-10001',
        notes: null,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        endedAt: null,
        spend: [],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
  await page.route(`**/api/suppliers/${relationshipId}/overview`, (route) =>
    route.fulfill({
      json: {
        head: {
          segment: { current: 'Strategisch', target: 'Partner' },
          sro: { userId: 'sro-1', name: 'Anna Schmidt' },
          nextMeeting: null,
          isFocus: true,
        },
        metrics: [],
        cycle,
        canStartCycle: false,
        canSetJbpDate: false,
      },
    }),
  );
}

async function shoot(page: Page, testInfo: import('@playwright/test').TestInfo) {
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
      const path = testInfo.outputPath(`zyklus-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`zyklus-${colorScheme}-${width}`, {
        path,
        contentType: 'image/png',
      });
    }
  }
}

test('ZYK-01 Zyklusübersicht und nächster Schritt', async ({ page }, testInfo) => {
  await setUp(page);
  await page.goto(base);
  await expect(page.getByRole('heading', { level: 2, name: 'Zyklus 2026' })).toBeVisible();
  await expect(page.getByText('Noch nicht verfügbar').first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Nächster Schritt: Segment konsolidieren' }),
  ).toHaveAttribute('href', `${base}/strategie/segmentierung`);
  await shoot(page, testInfo);
});
