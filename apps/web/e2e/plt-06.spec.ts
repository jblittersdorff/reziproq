import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-06.md, die einen echten Browser brauchen: Formulare als eigene Seiten
// mit Zurück, Zuordnung am Lieferanten, 390 px.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const uuid = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const url = (path: string) => `http://localhost:5174${path}`;

async function signIn(page: Page) {
  await fakeZitadel(page);
  const units = [
    { id: uuid(101), name: 'Pkw', code: 'PKW', active: true, supplierCount: 3 },
    { id: uuid(102), name: 'Nutzfahrzeuge', code: 'NFZ', active: true, supplierCount: 0 },
  ];
  const groups = [
    {
      id: uuid(201),
      name: 'Elektronik',
      code: 'EL',
      active: true,
      supplierCount: 2,
      parentId: null,
      childCount: 1,
    },
    {
      id: uuid(202),
      name: 'Sensorik',
      code: 'EL-SE',
      active: true,
      supplierCount: 1,
      parentId: uuid(201),
      childCount: 0,
    },
    {
      id: uuid(203),
      name: 'Guss',
      code: 'GU',
      active: true,
      supplierCount: 0,
      parentId: null,
      childCount: 0,
    },
  ];
  let assignment = {
    businessUnits: [{ id: uuid(101), name: 'Pkw', code: 'PKW', active: true }],
    materialGroups: [
      { id: uuid(202), name: 'Sensorik', code: 'EL-SE', active: true, isPrimary: true },
    ],
    canEdit: true,
  };
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Lena Berger',
        firstName: 'Lena',
        email: 'lena@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        orgRole: 'admin',
        permissions: { viewOrganizationSettings: true, viewSuppliers: true, switchCustomer: false },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'organisation.sehen',
          'einstellungen.verwalten',
          'lieferanten.sehen',
          'lieferanten.bearbeiten',
          'verlauf.sehen',
          'stammdaten.verwalten',
          'zuordnung.bearbeiten',
        ],
      },
    }),
  );
  await page.route('**/api/business-units', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      units.push({ id: uuid(100 + units.length + 1), ...body, active: true, supplierCount: 0 });
      return route.fulfill({ status: 201, json: units.at(-1) });
    }
    return route.fulfill({ json: { businessUnits: units } });
  });
  await page.route('**/api/business-units/*', (route) => {
    const target = units.find((unit) => route.request().url().endsWith(unit.id));
    if (target && route.request().method() === 'PATCH') {
      Object.assign(target, route.request().postDataJSON());
    }
    return route.fulfill({ json: target });
  });
  await page.route('**/api/material-groups', (route) =>
    route.fulfill({ json: { materialGroups: groups } }),
  );
  await page.route(`**/api/suppliers/${id}`, (route) =>
    route.fulfill({
      json: {
        relationshipId: id,
        name: 'Rheintal Elektronik GmbH (Demo)',
        organizationName: 'Rheintal Elektronik GmbH (Demo)',
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: 'L-10001',
        notes: null,
        status: 'active',
        createdAt: '2026-10-01T08:00:00Z',
        endedAt: null,
        spend: [],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/zuordnung`, (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as {
        businessUnitIds: string[];
        materialGroupIds: string[];
        primaryMaterialGroupId: string;
      };
      assignment = {
        businessUnits: units
          .filter((unit) => body.businessUnitIds.includes(unit.id))
          .map(({ id, name, code, active }) => ({ id, name, code, active })),
        materialGroups: groups
          .filter((group) => body.materialGroupIds.includes(group.id))
          .map(({ id, name, code, active }) => ({
            id,
            name,
            code,
            active,
            isPrimary: id === body.primaryMaterialGroupId,
          })),
        canEdit: true,
      };
    }
    return route.fulfill({ json: assignment });
  });
  await page.route(`**/api/suppliers/${id}/overview`, (route) =>
    route.fulfill({ json: { head: { segment: null, sro: null, nextMeeting: null }, metrics: [] } }),
  );
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

test('Alle Formulare sind eigene Seiten. Speichern und Abbrechen führen zurück.', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/einstellungen');
  await page.getByRole('link', { name: /Business Units/ }).click();
  await expect(page).toHaveURL(url('/einstellungen/business-units'));

  await page.getByRole('link', { name: 'Neue Business Unit' }).click();
  await expect(page).toHaveURL(url('/einstellungen/business-units/neu'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page).toHaveURL(url('/einstellungen/business-units'));

  await page.getByRole('link', { name: 'Neue Business Unit' }).click();
  await page.getByLabel('Name').fill('Busse');
  await page.getByLabel('Code', { exact: false }).fill('BUS');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(url('/einstellungen/business-units'));
  await expect(page.getByRole('table', { name: 'Business Units' })).toContainText('Busse');

  // Deaktivieren mit Bestätigung auf der Seite, danach zurück zur Liste.
  await page.getByRole('link', { name: 'Nutzfahrzeuge bearbeiten' }).click();
  await page.getByRole('button', { name: 'Deaktivieren' }).click();
  await page
    .getByRole('group', { name: /Wirklich deaktivieren/ })
    .getByRole('button', { name: 'Deaktivieren' })
    .click();
  await expect(page).toHaveURL(url('/einstellungen/business-units'));
  await expect(
    page.getByRole('row', { name: /Nutzfahrzeuge/ }).getByText('Deaktiviert'),
  ).toBeVisible();

  // Zuordnung am Lieferanten: eigene Seite, Speichern führt zum Profil zurück.
  await page.goto(`/lieferanten/${id}/strategie/profil`);
  await page.getByRole('link', { name: 'Zuordnung bearbeiten' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/profil/zuordnung`));
  await page.getByText('Guss', { exact: true }).click();
  await page.getByLabel('Haupt-Warengruppe').selectOption({ label: 'Guss' });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/strategie/profil`));
  await expect(page.getByText('Haupt-Warengruppe: Guss')).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`Seiten von PLT-06 ohne waagerechte Scrollleiste und mit 44-px-Klickflächen (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    for (const path of [
      '/einstellungen/business-units',
      '/einstellungen/warengruppen',
      `/einstellungen/warengruppen/${uuid(203)}/bearbeiten`,
      `/lieferanten/${id}/strategie/profil/zuordnung`,
    ]) {
      await page.goto(path);
      await expect(page.locator('#inhalt h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
      const small = await page.locator('#inhalt a, #inhalt button').evaluateAll((elements) =>
        elements
          .filter((element) => (element as HTMLElement).offsetParent !== null)
          .map((element) => {
            const box = element.getBoundingClientRect();
            const after = getComputedStyle(element, '::after');
            const extra = after.position === 'absolute' ? 24 : 0;
            return { text: element.textContent, height: box.height + extra };
          })
          .filter((target) => target.height < 44),
      );
      expect(small, path).toEqual([]);
    }
  });
}
