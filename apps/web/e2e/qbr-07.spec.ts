import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// QBR-07: Zusammenfassung für den Pre-Read auf Telefonbreite und am Schreibtisch, ohne seitliches
// Scrollen; Entwurf gestrichelt, übernommene Zusammenfassung fest.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const mid = '0190a0a0-0000-7000-8000-000000000010';
const meeting = {
  meeting: {
    id: mid,
    type: 'quarterly_review',
    title: 'Quartalsreview Q1',
    startsAt: '2099-03-15T09:00:00Z',
    location: 'Werk Nord',
    status: 'planned',
    ownerSide: 'buyer',
    protocol: null,
    createdByName: 'Lena Berger',
  },
  participants: [],
  agenda: [],
  decisions: [],
  note: null,
  canEditMeeting: true,
  canContribute: true,
  live: {
    sections: [
      {
        key: 'actions',
        items: [{ id: 'a1', title: 'Zweitquelle Gehäuse', status: 'open', dueDate: null }],
      },
    ],
    frozenAt: null,
  },
  canClose: true,
};
const draft = (status: 'draft' | 'accepted') => ({
  id:
    status === 'draft'
      ? '0190a0a0-0000-7000-8000-000000000070'
      : '0190a0a0-0000-7000-8000-000000000071',
  status,
  content:
    'Stand: Die Zusammenarbeit läuft stabil, die Liefertreue liegt über dem Ziel. Erfolge: Die Initiative zur Gehäusekostensenkung liefert erste Einsparungen. Offen: Die Zweitquelle für Gehäuse und zwei überfällige Zusagen zur Prognosequalität.',
  model: 'test',
  createdAt: '2099-03-01T09:00:00Z',
  decidedAt: status === 'accepted' ? '2099-03-01T10:00:00Z' : null,
  decidedBy: status === 'accepted' ? 'Lena Berger' : null,
  decision: status === 'accepted' ? 'edited' : 'open',
  claims: [
    {
      key: '1',
      text: 'Die Liefertreue liegt über dem Ziel.',
      thinlySupported: true,
      sources: [
        {
          id: '0190a0a0-0000-7000-8000-000000000011',
          kind: 'own_data',
          title: 'Termin und Vorbereitung',
          objectType: 'meeting',
          objectId: mid,
          url: null,
          excerpt: 'Liefertreue oberhalb des Zielwerts',
          publishedAt: '2026-11-01',
        },
      ],
    },
  ],
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
      json: { actions: ['lieferanten.sehen', 'termine.sehen', 'termine.bearbeiten'] },
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
  await page.route('**/api/suppliers/*/kommentare/meeting/*', (route) =>
    route.fulfill({
      json: {
        comments: [],
        canComment: false,
        objectVisibility: 'shared',
        people: { internal: [], shared: [] },
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}`, (route) =>
    route.fulfill({ json: meeting }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}/zusammenfassung`, (route) =>
    route.fulfill({
      json: { canDraft: true, draft: draft('draft'), accepted: draft('accepted') },
    }),
  );
}

for (const width of [390, 1440]) {
  test(`Zusammenfassung für den Pre-Read ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto(`/lieferanten/${id}/umsetzung/termine/${mid}`);
    const section = page.getByRole('region', { name: 'Zusammenfassung für den Pre-Read' });
    await expect(section.getByText('KI-Entwurf, bitte prüfen')).toBeVisible();
    await expect(section.locator('[data-slot="ai-draft"]:not([data-confirmed])')).toHaveCSS(
      'border-top-style',
      'dashed',
    );
    await expect(section.locator('[data-slot="ai-draft"][data-confirmed]')).toHaveCSS(
      'border-top-style',
      'solid',
    );
    const accepted = section.locator('[data-slot="ai-draft"][data-confirmed]');
    await expect(accepted.getByText('Entschieden von Lena Berger')).toBeVisible();
    await expect(accepted.getByText('Dünn belegt')).toBeVisible();
    await accepted.getByText('Termin und Vorbereitung', { exact: true }).click();
    await expect(accepted.getByText('Liefertreue oberhalb des Zielwerts')).toBeVisible();
    await expect(accepted.getByRole('link', { name: 'Quelle öffnen' })).toHaveAttribute(
      'href',
      `/lieferanten/${id}/umsetzung/termine/${mid}`,
    );
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.QBR07_SHOTS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${process.env.QBR07_SHOTS}/qbr07-${width}.png`,
        fullPage: true,
      });
    }
  });
}
