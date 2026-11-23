import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// WG-20: Warengruppen des Lieferanten auf Telefonbreite und am Schreibtisch, ohne seitliches
// Scrollen; Widerspruch als nächster Schritt, Vorschlag als Entwurf von Reziproq.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
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
      json: { actions: ['lieferanten.sehen', 'warengruppen.sehen', 'bewertungen.sehen'] },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
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
        metrics: [],
      },
    }),
  );
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
  const segment = (impactLevel: number, qualityLevel: number, name: string) => ({
    impactLevel,
    qualityLevel,
    name,
  });
  const group = (n: number) => `0190a0a0-0000-7000-8000-0000000000${n}`;
  await page.route(`**/api/warengruppen/lieferanten/${id}`, (route) =>
    route.fulfill({
      json: {
        relationshipId: id,
        supplierName: 'Rheintal Elektronik GmbH (Demo)',
        spendYear: 2025,
        currency: 'EUR',
        totalCents: 420_000_000,
        rows: [
          {
            groupId: group(10),
            groupName: 'Leiterplatten',
            lead: { userId: 'sara', name: 'Sara Ost' },
            amountCents: 310_000_000,
            shareInGroup: 0.38,
            segmentIst: segment(3, 2, 'Hoher Impact · ausbaufähige Beziehung'),
            sollType: { kind: 'segment', ...segment(3, 3, 'Hoher Impact · starke Beziehung') },
            qualityLevel: 2,
            strategy: { id: group(60), year: 2027, version: 1, status: 'draft' },
          },
          {
            groupId: group(11),
            groupName: 'Bestückte Baugruppen',
            lead: { userId: 'ida', name: 'Ida Roth' },
            amountCents: 90_000_000,
            shareInGroup: 0.12,
            segmentIst: segment(2, 3, 'Mittlerer Impact · starke Beziehung'),
            sollType: { kind: 'segment', ...segment(2, 3, 'Mittlerer Impact · starke Beziehung') },
            qualityLevel: 3,
            strategy: { id: group(61), year: 2027, version: 1, status: 'approved' },
          },
          {
            groupId: group(12),
            groupName: 'Kabelsätze',
            lead: { userId: 'max', name: 'Max Klein' },
            amountCents: 20_000_000,
            shareInGroup: 0.04,
            segmentIst: segment(1, 1, 'Niedriger Impact · schwache Beziehung'),
            sollType: { kind: 'ended' },
            qualityLevel: 1,
            strategy: null,
          },
        ],
        conflicts: [
          {
            id: group(70),
            ruleKey: 'phase_out_vs_growth',
            groups: [
              { id: group(12), name: 'Kabelsätze' },
              { id: group(10), name: 'Leiterplatten' },
            ],
            status: 'open',
            note: null,
            decidedBy: null,
            decidedAt: null,
            createdAt: '2026-11-20T08:00:00Z',
            canResolve: true,
          },
        ],
        proposal: {
          ist: {
            impactScore: 70,
            qualityScore: 55,
            impactLevel: 3,
            qualityLevel: 2,
            typeName: 'Hoher Impact · ausbaufähige Beziehung',
          },
          soll: {
            impactScore: 80,
            qualityScore: 75,
            impactLevel: 3,
            qualityLevel: 3,
            typeName: 'Hoher Impact · starke Beziehung',
          },
          criteria: [{ criterionKey: 'trust', label: 'Vertrauen', ist: 55, soll: 75 }],
          sources: [
            {
              groupId: group(10),
              groupName: 'Leiterplatten',
              amountCents: 310_000_000,
              weight: 0.775,
            },
            {
              groupId: group(11),
              groupName: 'Bestückte Baugruppen',
              amountCents: 90_000_000,
              weight: 0.225,
            },
          ],
          skipped: [{ groupId: group(12), groupName: 'Kabelsätze', reason: 'no_rating' }],
        },
        decided: null,
        canAdopt: true,
      },
    }),
  );
}

for (const width of [390, 1440]) {
  test(`Warengruppen des Lieferanten ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto(`/lieferanten/${id}/strategie/warengruppen`);
    await expect(
      page.getByRole('heading', { level: 1, name: /in euren Warengruppen/ }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Eine Botschaft abstimmen' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.WG20_SHOTS)
      await page.screenshot({
        path: `${process.env.WG20_SHOTS}/wg20-${width}.png`,
        fullPage: true,
      });
  });
}
