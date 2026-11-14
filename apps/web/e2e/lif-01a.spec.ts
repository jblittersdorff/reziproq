import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Browsertests zu docs/specs/LIF-01.md, Teil a: Team-Seite mit Einladungen, Formular und die
// Annahme ohne Login. Die API ist nachgebaut; Screenshots hell und dunkel, breit und schmal.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const token = 'demo-einladung-test-lieferant-0001';
const supplierName = 'Rheintal Elektronik GmbH (Demo)';

async function mockBuyer(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Lena Berger',
        firstName: 'Lena',
        email: 'lena@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
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
      json: { actions: ['organisation.sehen', 'lieferanten.sehen', 'lieferanten.einladen'] },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/suppliers/${id}`, (route) =>
    route.fulfill({
      json: {
        relationshipId: id,
        name: supplierName,
        organizationName: supplierName,
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: 'L-10001',
        notes: null,
        status: 'draft',
        createdAt: '2026-10-01T08:00:00Z',
        endedAt: null,
        spend: [],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/team`, (route) =>
    route.fulfill({
      json: {
        side: 'buyer',
        counterpart: [{ name: 'Kim Kaiser', teamRole: 'sro', function: null }],
        canEdit: true,
        sroDescription: {
          role: 'sro',
          does: ['Strategie'],
          doesNot: ['Claims'],
          updatedByName: null,
        },
        members: [
          {
            userId: 'lena',
            name: 'Lena Berger',
            teamRole: 'sro',
            function: 'purchasing',
            visibility: 'shared',
          },
        ],
        candidates: [],
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/einladungen`, (route) =>
    route.fulfill({
      json: {
        canInvite: true,
        suggestions: [{ name: 'Kim Kaiser', email: 'kim.kaiser@rheintal-elektronik.example' }],
        invitations: [
          {
            id: '0190a0a0-0000-7000-8000-000000000101',
            email: 'ole.ost-mit-langer-adresse@rheintal-elektronik.example',
            status: 'open',
            invitedBy: 'Lena Berger',
            createdAt: '2026-11-01T08:00:00Z',
            expiresAt: '2026-11-08T08:00:00Z',
            acceptedAt: null,
          },
          {
            id: '0190a0a0-0000-7000-8000-000000000102',
            email: 'ida.brandt@rheintal-elektronik.example',
            status: 'accepted',
            invitedBy: 'Lena Berger',
            createdAt: '2026-10-20T08:00:00Z',
            expiresAt: '2026-10-27T08:00:00Z',
            acceptedAt: '2026-10-21T08:00:00Z',
          },
        ],
      },
    }),
  );
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
}

async function mockInvitation(page: Page) {
  await page.route(`**/api/einladungen/${token}`, (route) =>
    route.fulfill({
      json: {
        status: 'open',
        customer: 'Test-OEM (Demo)',
        sro: 'Lena Berger',
        supplier: supplierName,
        kamTaken: false,
      },
    }),
  );
  await page.route(`**/api/einladungen/${token}/annahme`, (route) =>
    route.fulfill({ json: { next: '/einladung-angenommen' } }),
  );
}

/** Kein Element ragt über den Rand; Screenshots hell und dunkel, 1440 und 390 Pixel breit. */
async function shoot(page: Page, testInfo: TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['light', 'dark'] as const) {
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

test('LIF-01a Team-Seite zeigt Personen des Lieferanten und führt zum Einladen', async ({
  page,
}, testInfo) => {
  await mockBuyer(page);
  await page.goto(`/lieferanten/${id}/beziehung/team`);
  await expect(page.getByRole('table', { name: 'Personen des Lieferanten' })).toBeVisible();
  await expect(page.getByText('Aktiv', { exact: true })).toBeVisible();
  await shoot(page, testInfo, 'lif-01a-team');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Lieferant einladen' }).click();
  await expect(page.locator('#inhalt h1')).toHaveText('Lieferant einladen');
  await expect(page.getByLabel('E-Mail')).toBeVisible();
  await shoot(page, testInfo, 'lif-01a-formular');
});

test('LIF-01a Annahme in drei Schritten ohne Login', async ({ page }, testInfo) => {
  await mockInvitation(page);
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.goto(`/einladung/${token}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Test-OEM (Demo) lädt dich ein');
  await shoot(page, testInfo, 'lif-01a-willkommen');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('textbox', { name: 'Dein Name' }).fill('Kim Kaiser');
  await page.getByRole('radio', { name: /Key Account Manager/ }).check();
  await shoot(page, testInfo, 'lif-01a-name');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('button', { name: 'Passkey einrichten' })).toBeVisible();
  await shoot(page, testInfo, 'lif-01a-passkey');

  const accepted = page.waitForRequest(`**/api/einladungen/${token}/annahme`);
  await page.getByRole('button', { name: 'Passkey einrichten' }).click();
  expect((await accepted).postDataJSON()).toEqual({
    name: 'Kim Kaiser',
    teamRole: 'sro',
    locale: 'de',
  });
  await page.waitForURL('**/einladung-angenommen');
});

test('LIF-01a ein abgelaufener Link zeigt einen klaren Hinweis', async ({ page }, testInfo) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/einladungen/${token}`, (route) =>
    route.fulfill({
      json: {
        status: 'expired',
        customer: 'Test-OEM (Demo)',
        sro: 'Lena Berger',
        supplier: supplierName,
        kamTaken: false,
      },
    }),
  );
  await page.goto(`/einladung/${token}`);
  await expect(page.getByText('Der Link ist abgelaufen')).toBeVisible();
  await shoot(page, testInfo, 'lif-01a-abgelaufen');
});
