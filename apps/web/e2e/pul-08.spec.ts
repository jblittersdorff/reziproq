import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// PUL-08: Themen der Freitexte auf Telefonbreite und am Schreibtisch, ohne seitliches Scrollen;
// Entwurf gestrichelt, übernommene Zusammenfassung fest.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const waveId = '0190a0a0-0000-7000-8000-000000000030';
const dim = (dimension: string, buyer: number, supplier: number) => ({
  dimension,
  resultId: `0190a0a0-0000-7000-8000-0000000001${String(dimension.length).padStart(2, '0')}`,
  buyer: { ist: buyer, soll: 4.6 },
  supplier: { ist: supplier, soll: 4.4 },
  delta: Math.round((buyer - supplier) * 100) / 100,
});
const wave = {
  id: waveId,
  kind: 'annual',
  templateVersion: 2,
  dueDate: '2027-03-31',
  createdAt: '2027-03-01T09:00:00Z',
  createdByName: 'Sara Ost',
  buyerClosedAt: '2027-03-30T09:00:00Z',
  supplierClosedAt: '2027-03-31T09:00:00Z',
  status: 'closed',
  turnout: { buyer: { invited: 6, completed: 5 }, supplier: { invited: 5, completed: 4 } },
  revealedAt: '2027-04-01T09:00:00Z',
  topGap: { dimension: 'transparency', delta: 0.9 },
};
const themes = [
  '- Abstimmungen bei technischen Änderungen dauern aus Sicht des Lieferanten zu lange.',
  '- Prognosen für Abrufe kommen spät und schwanken stark von Woche zu Woche.',
  '- Wechselnde Ansprechpartner machen Zuständigkeiten unklar.',
].join('\n');
const draft = (status: 'draft' | 'accepted') => ({
  id:
    status === 'draft'
      ? '0190a0a0-0000-7000-8000-000000000061'
      : '0190a0a0-0000-7000-8000-000000000062',
  status,
  content: themes,
  model: 'test',
  createdAt: '2027-04-02T09:00:00Z',
  decidedAt: status === 'accepted' ? '2027-04-02T10:00:00Z' : null,
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
      json: { actions: ['lieferanten.sehen', 'feedback.sehen', 'feedback.verwalten'] },
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
  await page.route(`**/api/suppliers/${id}/feedback`, (route) =>
    route.fulfill({ json: { waves: [wave], canStart: true, trends: [] } }),
  );
  await page.route(`**/api/suppliers/${id}/feedback/${waveId}`, (route) =>
    route.fulfill({
      json: {
        wave,
        ownSide: 'buyer',
        participants: [],
        canInvite: false,
        canClose: false,
        canExtend: false,
        results: {
          revealedAt: '2027-04-01T09:00:00Z',
          responses: { buyer: 5, supplier: 4 },
          dimensions: [dim('transparency', 4.1, 3.2), dim('trust', 4.2, 3.6)],
          topGaps: [dim('transparency', 4.1, 3.2)],
          functions: [],
          questions: [],
          freeTexts: [
            'Die Abstimmung bei technischen Änderungen am Bauteil dauert oft mehrere Wochen.',
            'Prognosen kommen spät und schwanken stark.',
            'Ansprechpartner wechseln häufig.',
          ],
          actions: [],
          canCreateAction: true,
        },
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/feedback/${waveId}/themen`, (route) =>
    route.fulfill({
      json: {
        freeTexts: 3,
        canSummarize: true,
        draft: draft('draft'),
        accepted: draft('accepted'),
      },
    }),
  );
}

for (const width of [390, 1440]) {
  test(`Themen der Freitexte ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto(`/lieferanten/${id}/beziehung/feedback/${waveId}`);
    await expect(page.getByText('KI-Entwurf, bitte prüfen')).toBeVisible();
    // Designsprache 2: Entwurf mit 1 px Mint-Rand und Doppelring, bestätigt ohne Doppelring
    await expect(page.locator('[data-slot="ai-draft"]:not([data-confirmed])')).toHaveCSS(
      'border-top-color',
      'rgb(207, 229, 221)',
    );
    await expect(
      page.locator('[data-slot="ai-draft"]:not([data-confirmed]) [data-slot="brand-mark"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="ai-draft"][data-confirmed] [data-slot="brand-mark"]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-slot="ai-draft"][data-confirmed]')).toHaveCSS(
      'border-top-style',
      'solid',
    );
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.PUL08_SHOTS) {
      await page.getByText('Themen der Freitexte').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.PUL08_SHOTS}/pul08-${width}.png` });
    }
  });
}
