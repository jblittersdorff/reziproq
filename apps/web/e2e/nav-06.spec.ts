import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/NAV-06.md, die einen echten Browser brauchen: kein Neuladen beim Wechsel,
// lokale Leiste beim Scrollen, 390 px.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const base = `/lieferanten/${id}`;
const url = (path: string) => `http://localhost:5174${path}`;
// NAV-10 1.1: Lieferantenkopf mit vier Bereichen und dem Knopf „···“ für das Profil
const areas = [
  // K2-c.7: Der Verlauf steht in der Akte; im alten Rahmen führt Aktivitäten zu den Terminen
  ['Aktivitäten', 'umsetzung/termine'],
  ['Plan', 'plan/vorbereitung'],
  ['Ergebnisse', 'wirkung/bruecke'],
  ['Profil, Segmentierung und Team', 'strategie/profil'],
] as const;

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
        cycle: null,
        canStartCycle: false,
        canSetJbpDate: false,
      },
    }),
  );
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
}

const header = (page: Page) => page.locator('[data-slot="supplier-header"]');

test('NAV-10: Die Reiter führen zu ihren Seiten; der Wechsel lädt die Seite nicht neu', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto(base);
  // Auf dem Überblick ist der Name des Lieferanten der Titel der Seite.
  await expect(page.locator('#inhalt h1')).toHaveText('Rheintal Elektronik GmbH (Demo)');
  // Eine Markierung im Fenster überlebt nur, wenn die Seite nicht neu lädt.
  await page.evaluate(() => {
    (window as unknown as { nav06: boolean }).nav06 = true;
  });
  for (const [label, segment] of areas) {
    await header(page).getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(url(`${base}/${segment}`));
    await expect(page.locator('#inhalt h1')).toBeVisible();
  }
  expect(await page.evaluate(() => (window as unknown as { nav06?: boolean }).nav06)).toBe(true);
});

test('Der Lieferantenkopf steht oben auf jeder Seite; die Seite scrollt darunter', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 500 });
  await signIn(page);
  await page.goto(base);
  await expect(page.getByRole('region', { name: 'Stand der Beziehung' })).toBeVisible();
  // Kopf und Bereiche gehören zur Seite (Vorlage SupplierBar), nicht zur Seitenleiste
  await expect(header(page).getByRole('link', { name: 'Lieferanten' })).toHaveAttribute(
    'href',
    '/beziehungen',
  );
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  // Die Seitenleiste bleibt stehen, der Inhalt scrollt (Entscheidung vom 23.11.2026).
  await expect(
    page.locator('[data-slot="sidebar"]').getByRole('link', { name: 'Lieferanten' }),
  ).toBeInViewport();
});

for (const path of ['', '/strategie', '/strategie/profil', '/beziehung/team']) {
  test(`Bei 390 px Breite bricht der Lieferantenkopf ohne waagerechtes Scrollen um (${path || '/'})`, async ({
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
    for (const [label] of areas) {
      const link = header(page).getByRole('link', { name: label, exact: true });
      await expect(link).toBeInViewport();
      const box = await link.boundingBox();
      expect(box?.height, label).toBeGreaterThanOrEqual(44);
      expect((box?.x ?? 0) + (box?.width ?? 0), label).toBeLessThanOrEqual(390);
    }
  });
}
