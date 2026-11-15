import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const relationshipId = '550e8400-e29b-41d4-a716-000000000001';
const base = `/lieferanten/${relationshipId}`;
const settings = [
  { step: 'feedback', weeksRelativeToJbp: -8, reminderDaysBefore: 7 },
  { step: 'touchpoints', weeksRelativeToJbp: -6, reminderDaysBefore: 7 },
  { step: 'supplierPlan', weeksRelativeToJbp: -2, reminderDaysBefore: 7 },
  { step: 'jbp', weeksRelativeToJbp: 0, reminderDaysBefore: 7 },
  { step: 'scorecard', weeksRelativeToJbp: 3, reminderDaysBefore: 7 },
];
const cycle = {
  id: '550e8400-e29b-41d4-a716-000000000002',
  label: '2027',
  startedAt: '2027-01-01T00:00:00.000Z',
  jbpDate: null,
  schedule: settings.map((setting) => ({ ...setting, dueDate: null })),
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
        organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
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
        actions: ['einstellungen.verwalten', 'lieferanten.sehen', 'zyklus.starten'],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/suppliers/${relationshipId}`, (route) =>
    route.fulfill({
      json: {
        relationshipId,
        name: 'Rheintal Elektronik GmbH (Demo)',
        organizationName: 'Rheintal Elektronik GmbH (Demo)',
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: 'L-10001',
        notes: null,
        status: 'active',
        createdAt: '2027-01-01T00:00:00.000Z',
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
          segment: null,
          sro: { userId: 'sro-1', name: 'Anna Schmidt' },
          nextMeeting: null,
          isFocus: true,
        },
        metrics: [],
        cycle,
        canStartCycle: false,
        canSetJbpDate: true,
      },
    }),
  );
}

async function shoot(page: Page, name: string, testInfo: import('@playwright/test').TestInfo) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Es gibt nur ein helles Thema (Designsprache).
    for (const colorScheme of ['light'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.waitForTimeout(300);
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

test('ZYK-02 zeigt die Fristvorschau für den gewählten JBP-Termin', async ({ page }, testInfo) => {
  await setUp(page);
  await page.goto(base);
  await page.getByRole('link', { name: 'Termin festlegen' }).click();
  await expect(page).toHaveURL(`${base}/zyklus/termin`);
  await page.getByLabel('Termin des Gemeinsamen Plans').fill('2027-06-30');

  for (const deadline of ['05.05.2027', '19.05.2027', '16.06.2027', '30.06.2027', '21.07.2027']) {
    await expect(page.getByText(deadline)).toBeVisible();
  }
  await shoot(page, 'zyklus-termin', testInfo);
});

test('ZYK-02 lässt Admins die organisationsweiten Vorlaufzeiten ändern', async ({
  page,
}, testInfo) => {
  await setUp(page);
  await page.route('**/api/cycle/settings', (route) => route.fulfill({ json: { settings } }));
  await page.goto('/einstellungen/zyklus');
  await expect(page.getByRole('heading', { name: 'Zyklus-Einstellungen' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Feedback: Wochen zum Gemeinsamen Plan' }).fill('-9');
  await page.route('**/api/cycle/settings', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { settings } });
    const body = route.request().postDataJSON() as { settings: typeof settings };
    expect(body.settings[0]?.weeksRelativeToJbp).toBe(-9);
    return route.fulfill({ json: body });
  });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Zyklus-Einstellungen gespeichert.')).toBeVisible();
  await shoot(page, 'zyklus-einstellungen', testInfo);
});
