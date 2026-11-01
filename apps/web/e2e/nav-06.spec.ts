import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/NAV-06.md, die einen echten Browser brauchen: kein Neuladen beim Wechsel,
// lokale Leiste beim Scrollen, 390 px.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const base = `/lieferanten/${id}`;
const url = (path: string) => `http://localhost:5174${path}`;
const areas = ['Strategie', 'Beziehung', 'Gemeinsamer Plan', 'Umsetzung', 'Wirkung'];

async function signIn(page: Page) {
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
        permissions: { viewOrganizationSettings: true, viewSuppliers: true, switchCustomer: false },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: ['lieferanten.sehen', 'lieferanten.bearbeiten', 'team.festlegen', 'verlauf.sehen'],
      },
    }),
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
  await page.route(`**/api/suppliers/${id}/overview`, (route) =>
    route.fulfill({
      json: {
        head: { segment: null, sro: { userId: 'lena', name: 'Lena Berger' }, nextMeeting: null },
        metrics: [
          {
            tile: 'strategy',
            kind: 'spend',
            year: 2025,
            amount: { amountCents: 4_820_000_00, currency: 'EUR' },
          },
          { tile: 'relationship', kind: 'team_size', count: 4 },
        ],
      },
    }),
  );
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
}

const localBar = (page: Page) => page.getByRole('navigation', { name: 'Bereiche des Lieferanten' });

test('Alle sechs Bereiche haben eigene Adressen; der Wechsel lädt die Seite nicht neu', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto(base);
  await expect(page.locator('#inhalt h1')).toHaveText('Überblick');
  // Eine Markierung im Fenster überlebt nur, wenn die Seite nicht neu lädt.
  await page.evaluate(() => {
    (window as unknown as { nav06: boolean }).nav06 = true;
  });
  for (const area of areas) {
    await localBar(page).getByRole('link', { name: area, exact: true }).click();
    await expect(page.locator('#inhalt h1')).toHaveText(area);
    await expect(localBar(page).getByRole('link', { name: area, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
  await localBar(page).getByRole('link', { name: 'Überblick' }).click();
  await expect(page).toHaveURL(url(base));
  expect(await page.evaluate(() => (window as unknown as { nav06?: boolean }).nav06)).toBe(true);
});

test('Die lokale Leiste bleibt beim Scrollen sichtbar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 500 });
  await signIn(page);
  await page.goto(base);
  await expect(page.getByRole('list', { name: 'Überblick' })).toBeVisible();
  const bar = localBar(page);
  const before = await bar.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  const after = await bar.boundingBox();
  // Sie steht weiter direkt unter der globalen Leiste.
  expect(after?.y).toBe(before?.y);
  await expect(bar.getByRole('link', { name: 'Strategie' })).toBeInViewport();
});

for (const path of ['', '/strategie', '/strategie/profil', '/beziehung/team']) {
  test(`Bei 390 px Breite bricht die lokale Leiste ohne waagerechtes Scrollen um (${path || '/'})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.route(`**/api/suppliers/${id}/team`, (route) =>
      route.fulfill({ json: { members: [], candidates: [] } }),
    );
    await page.goto(`${base}${path}`);
    await expect(page.locator('#inhalt h1')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    for (const label of ['Überblick', ...areas]) {
      const link = localBar(page).getByRole('link', { name: label, exact: true });
      await expect(link).toBeInViewport();
      const box = await link.boundingBox();
      expect(box?.height, label).toBeGreaterThanOrEqual(44);
      expect((box?.x ?? 0) + (box?.width ?? 0), label).toBeLessThanOrEqual(390);
    }
  });
}
