import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// SPL-10: KI-Entwurf der Strategie-Zusammenfassung auf Telefonbreite und am Schreibtisch, ohne
// seitliches Scrollen; der Entwurf ist gestrichelt.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const planId = '0190a0a0-0000-7000-8000-000000000005';
const plan = {
  plan: {
    id: planId,
    relationshipId: id,
    cycleId: '0190a0a0-0000-7000-8000-000000000003',
    version: 1,
    status: 'draft',
    summary: 'Partner für die neue Plattform.',
    createdAt: '2026-10-01T08:00:00Z',
    targetType: 'Strategischer Partner',
    sro: { userId: 'lena', name: 'Lena Berger' },
    objectives: [],
    contributions: { done: 0, total: 0, items: [] },
    topics: [],
    canManage: true,
    approval: {
      round: 0,
      submittedAt: null,
      approvedAt: null,
      hasSponsor: false,
      decisions: [],
      hints: { openContributions: 0, noTopics: true },
      canSubmit: true,
      canDecide: false,
      canNewVersion: false,
    },
  },
  cycleId: '0190a0a0-0000-7000-8000-000000000003',
  categories: [],
  teamCandidates: [],
  canCreate: false,
};

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
      json: { actions: ['lieferanten.sehen', 'lieferantenplan.bearbeiten'] },
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
  await page.route(`**/api/suppliers/${id}/plan`, (route) => route.fulfill({ json: plan }));
  await page.route(`**/api/suppliers/${id}/plan/${planId}/summary/draft`, (route) =>
    route.fulfill({
      json: {
        canDraft: true,
        draft: {
          id: '0190a0a0-0000-7000-8000-000000000070',
          status: 'draft',
          content:
            'Rheintal Elektronik soll in den nächsten zwei Jahren zum strategischen Partner für die neue Steuergeräte-Plattform werden. Grundlage sind steigender Spend und eine hohe Liefertreue; die größte Lücke im Feedback liegt bei der Transparenz der Kosten. Fortschritt zeigt sich an fünf Prozent geringeren Kosten je Baugruppe bis 2027 und an einer kleineren Lücke im nächsten Feedback.',
          model: 'test',
          createdAt: '2026-11-16T09:00:00Z',
          decidedAt: null,
        },
      },
    }),
  );
}

for (const width of [390, 1440]) {
  test(`Entwurf der Zusammenfassung ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto(`/lieferanten/${id}/strategie/lieferantenplan/zusammenfassung/bearbeiten`);
    await expect(page.getByText('KI-Entwurf, bitte prüfen')).toBeVisible();
    // Designsprache 2: Entwurf mit 1 px Mint-Rand und Doppelring
    await expect(page.locator('[data-slot="ai-draft"]')).toHaveCSS(
      'border-top-color',
      'rgb(207, 229, 221)',
    );
    await expect(
      page.locator('[data-slot="ai-draft"] [data-slot="brand-mark"]').first(),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.SPL10_SHOTS)
      await page.screenshot({
        path: `${process.env.SPL10_SHOTS}/spl10-${width}.png`,
        fullPage: true,
      });
  });
}
