import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// WG-01: Werkstoffgruppen (eigene Bezeichnung) als Baum und je Gruppe mit Team, Produktgruppen und
// Lieferanten; ohne seitliches Scrollen auf Telefonbreite und am Schreibtisch.

test.use({ locale: 'de-DE' });

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const label = { singular: 'Werkstoffgruppe', plural: 'Werkstoffgruppen' };
const summary = (
  n: number,
  name: string,
  code: string,
  parentId: string | null,
  lead: string | null,
) => ({
  id: uuid(n),
  name,
  code,
  parentId,
  active: true,
  lead: lead ? { userId: lead, name: lead } : null,
  productGroupCount: 2,
  memberCount: 3,
  supplierCount: 4,
});

async function mock(page: Page) {
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
        categoryLabel: { singular: 'Werkstoffgruppe', plural: 'Werkstoffgruppen' },
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: true,
          viewSuppliers: true,
          viewCustomers: false,
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
          'start.sehen',
          'prompt.nutzen',
          'suche.nutzen',
          'kunden.sehen',
        ],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/warengruppen', (route) =>
    route.fulfill({
      json: {
        label,
        canManage: true,
        unassignedSpendRows: 3,
        groups: [
          summary(10, 'Elektronik', 'EL', null, 'Lena Berger'),
          summary(11, 'Sensorik und Aktorik für Antriebsstränge', 'EL-SE', uuid(10), null),
          summary(12, 'Leiterplatten', 'EL-LP', uuid(10), 'Lena Berger'),
          summary(13, 'Guss', 'GU', null, 'Paul Plan'),
        ],
      },
    }),
  );
  await page.route(`**/api/warengruppen/${uuid(10)}`, (route) =>
    route.fulfill({
      json: {
        label,
        group: {
          id: uuid(10),
          name: 'Elektronik',
          code: 'EL',
          description: 'Elektronische Bauteile und Baugruppen für alle Business Units.',
          active: true,
          lead: { userId: 'lena', name: 'Lena Berger' },
          commodityManager: { userId: 'paul', name: 'Paul Plan' },
        },
        parent: null,
        children: [{ id: uuid(11), name: 'Sensorik', code: 'EL-SE', active: true }],
        productGroups: [
          { id: uuid(20), name: 'Leiterplatten', description: null, position: 1 },
          {
            id: uuid(21),
            name: 'Steuergeräte',
            description: 'Motor- und Getriebesteuerung',
            position: 2,
          },
        ],
        members: [
          {
            id: uuid(30),
            userId: 'lena',
            name: 'Lena Berger',
            role: 'lead',
            businessUnit: null,
            region: null,
            task: null,
          },
          {
            id: uuid(31),
            userId: 'paul',
            name: 'Paul Plan',
            role: 'commodity_manager',
            businessUnit: null,
            region: null,
            task: null,
          },
          {
            id: uuid(32),
            userId: 'ben',
            name: 'Ben Berg',
            role: 'buyer',
            businessUnit: { id: uuid(50), name: 'Antrieb' },
            region: 'Europa',
            task: 'Leiterplatten',
          },
        ],
        suppliers: [
          {
            relationshipId: uuid(40),
            name: 'Rheintal Elektronik GmbH (Demo)',
            source: 'spend',
            isPrimary: true,
          },
          {
            relationshipId: uuid(41),
            name: 'Pearl River Components Ltd. (Demo)',
            source: 'manual',
            isPrimary: false,
          },
        ],
        canEdit: true,
        people: [{ userId: 'lena', name: 'Lena Berger' }],
        businessUnits: [{ id: uuid(50), name: 'Antrieb' }],
      },
    }),
  );
}

for (const width of [390, 1440]) {
  test(`Werkstoffgruppen ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    await page.goto('/warengruppen');
    await expect(page.getByRole('heading', { level: 1, name: 'Werkstoffgruppen' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await overflow()).toBe(0);
    if (process.env.WG01_SHOTS)
      await page.screenshot({
        path: `${process.env.WG01_SHOTS}/wg01-liste-${width}.png`,
        fullPage: true,
      });
    await page.goto(`/warengruppen/${uuid(10)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Elektronik' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await overflow()).toBe(0);
    if (process.env.WG01_SHOTS)
      await page.screenshot({
        path: `${process.env.WG01_SHOTS}/wg01-detail-${width}.png`,
        fullPage: true,
      });
  });
}
