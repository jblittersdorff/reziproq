import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const relationshipId = '550e8400-e29b-41d4-a716-446655440191';
const supplierPath = `/lieferanten/${relationshipId}`;
const categories = [
  { key: 'cost', name: 'Kosten', position: 1, active: true },
  { key: 'quality', name: 'Qualität', position: 2, active: true },
  { key: 'technology', name: 'Technologie', position: 3, active: true },
  { key: 'supply', name: 'Versorgung', position: 4, active: true },
  { key: 'sustainability', name: 'Nachhaltigkeit', position: 5, active: true },
  { key: 'capacity', name: 'Kapazität', position: 6, active: true },
  { key: 'location', name: 'Standort', position: 7, active: true },
];

test.use({ locale: 'de-DE' });

async function setUp(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Beispiel-OEM' },
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
        actions: [
          'lieferanten.sehen',
          'lieferantenplan.bearbeiten',
          'stammdaten.verwalten',
          'organisation.sehen',
        ],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/suppliers/${relationshipId}`, (route) =>
    route.fulfill({
      json: {
        relationshipId,
        name: 'Rheintal Elektronik GmbH',
        organizationName: 'Rheintal Elektronik GmbH',
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: 'L-10001',
        notes: null,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        endedAt: null,
        spend: [],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
}

const planId = '550e8400-e29b-41d4-a716-446655440192';
const contributionId = '550e8400-e29b-41d4-a716-446655440193';
const planPath = `${supplierPath}/strategie/lieferantenplan`;

const contributionList = [
  {
    id: contributionId,
    businessUnit: { id: 'bu-1', name: 'Werk Nord' },
    materialGroup: null,
    assignee: { userId: 'anna', name: 'Anna Schmidt' },
    dueDate: '2099-03-01',
    status: 'open',
    doneAt: null,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440194',
    businessUnit: null,
    materialGroup: { id: 'mg-1', name: 'Stahl' },
    assignee: { userId: 'ben', name: 'Ben Roth' },
    dueDate: '2099-03-15',
    status: 'done',
    doneAt: '2099-02-01T10:00:00.000Z',
  },
];

async function capture(page: Page, testInfo: TestInfo, name: string) {
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
      const path = testInfo.outputPath(`spl-03-${name}-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`spl-03-${name}-${colorScheme}-${width}`, {
        path,
        contentType: 'image/png',
      });
    }
  }
}

test('SPL-03 Plan zeigt Fortschritt und offene Beiträge', async ({ page }, testInfo) => {
  await setUp(page);
  await page.route(`**/api/suppliers/${relationshipId}/plan`, (route) =>
    route.fulfill({
      json: {
        plan: {
          id: planId,
          relationshipId,
          cycleId: '550e8400-e29b-41d4-a716-446655440195',
          version: 1,
          status: 'draft',
          summary: 'Versorgung sichern.',
          createdAt: '2026-01-01T00:00:00.000Z',
          targetType: 'Strategischer Partner',
          sro: { userId: 'anna', name: 'Anna Schmidt' },
          objectives: [],
          contributions: { done: 1, total: 2, items: contributionList },
          topics: [],
          canManage: true,
          approval: {
            round: 0,
            submittedAt: null,
            approvedAt: null,
            hasSponsor: true,
            decisions: [],
            hints: { openContributions: 0, noTopics: false },
            canSubmit: false,
            canDecide: false,
            canNewVersion: false,
          },
        },
        cycleId: '550e8400-e29b-41d4-a716-446655440195',
        categories,
        teamCandidates: [{ userId: 'anna', name: 'Anna Schmidt' }],
        canCreate: false,
      },
    }),
  );
  await page.goto(planPath);
  await expect(page.getByText('1 von 2 Beiträgen')).toBeVisible();
  await expect(page.getByText(/Werk Nord · Anna Schmidt · Frist/)).toBeVisible();
  await expect(page.getByText(/Stahl · Ben Roth/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Beiträge anfordern' })).toBeVisible();
  await capture(page, testInfo, 'plan');
});

test('SPL-03 Anfrage: eine Zeile je Bezug und ein Klick auf Anfragen', async ({
  page,
}, testInfo) => {
  await setUp(page);
  let posted: unknown = null;
  await page.route(`**/api/suppliers/${relationshipId}/plan`, (route) =>
    route.fulfill({
      json: {
        plan: {
          id: planId,
          relationshipId,
          cycleId: '550e8400-e29b-41d4-a716-446655440195',
          version: 1,
          status: 'draft',
          summary: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          targetType: null,
          sro: null,
          objectives: [],
          contributions: { done: 0, total: 0, items: [] },
          topics: [],
          canManage: true,
          approval: {
            round: 0,
            submittedAt: null,
            approvedAt: null,
            hasSponsor: true,
            decisions: [],
            hints: { openContributions: 0, noTopics: false },
            canSubmit: false,
            canDecide: false,
            canNewVersion: false,
          },
        },
        cycleId: '550e8400-e29b-41d4-a716-446655440195',
        categories,
        teamCandidates: [],
        canCreate: false,
      },
    }),
  );
  await page.route(
    `**/api/suppliers/${relationshipId}/plan/${planId}/contribution-suggestions`,
    (route) =>
      route.fulfill({
        json: {
          rows: [
            {
              businessUnit: { id: '550e8400-e29b-41d4-a716-446655440201', name: 'Werk Nord' },
              materialGroup: null,
              suggestedUserId: 'anna',
            },
            {
              businessUnit: null,
              materialGroup: { id: '550e8400-e29b-41d4-a716-446655440202', name: 'Stahl' },
              suggestedUserId: 'ben',
            },
          ],
          teamCandidates: [
            { userId: 'anna', name: 'Anna Schmidt' },
            { userId: 'ben', name: 'Ben Roth' },
          ],
        },
      }),
  );
  await page.route(
    `**/api/suppliers/${relationshipId}/plan/${planId}/contributions`,
    async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { ids: ['a', 'b'] } });
    },
  );

  await page.goto(`${planPath}/beitraege/neu`);
  await expect(page.getByRole('heading', { level: 1, name: 'Beiträge anfordern' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /Zuständig · Werk Nord/ })).toHaveValue('anna');
  await expect(page.getByRole('combobox', { name: /Zuständig · Stahl/ })).toHaveValue('ben');
  await capture(page, testInfo, 'request');
  await page.getByLabel(/Frist · Werk Nord/).fill('2099-03-01');
  await page.getByLabel(/Frist · Stahl/).fill('2099-03-15');
  await page.getByRole('button', { name: 'Anfragen' }).click();
  await expect
    .poll(() => posted)
    .toMatchObject({
      contributions: [
        { assigneeUserId: 'anna', dueDate: '2099-03-01' },
        { assigneeUserId: 'ben', dueDate: '2099-03-15' },
      ],
    });
});

test('SPL-03 Beitrag: Ziele erfassen und abschließen', async ({ page }, testInfo) => {
  await setUp(page);
  const posted: string[] = [];
  await page.route(
    `**/api/suppliers/${relationshipId}/plan/contributions/${contributionId}`,
    (route) =>
      route.fulfill({
        json: {
          id: contributionId,
          planId,
          relationshipId,
          businessUnit: { id: 'bu-1', name: 'Werk Nord' },
          materialGroup: null,
          assignee: { userId: 'anna', name: 'Anna Schmidt' },
          dueDate: '2099-03-01',
          status: 'open',
          summary: 'Versorgung sichern.',
          targetType: 'Strategischer Partner',
          categories,
          objectives: [
            {
              id: '550e8400-e29b-41d4-a716-446655440203',
              categoryKey: 'quality',
              categoryName: 'Qualität',
              businessUnit: { id: 'bu-1', name: 'Werk Nord' },
              materialGroup: null,
              text: 'Ausschussquote senken',
              owner: { userId: 'anna', name: 'Anna Schmidt' },
              targetYear: 2027,
              canEdit: false,
            },
          ],
          canEdit: true,
        },
      }),
  );
  await page.route(
    `**/api/suppliers/${relationshipId}/plan/contributions/${contributionId}/objectives`,
    async (route) => {
      posted.push('objective');
      await route.fulfill({ status: 201, json: { id: 'neu' } });
    },
  );
  await page.route(
    `**/api/suppliers/${relationshipId}/plan/contributions/${contributionId}/complete`,
    async (route) => {
      posted.push('complete');
      await route.fulfill({ status: 201, json: { id: contributionId } });
    },
  );

  await page.goto(`${planPath}/beitrag/${contributionId}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Beitrag zum Lieferantenplan' }),
  ).toBeVisible();
  await expect(page.getByText('Strategischer Partner')).toBeVisible();
  await expect(page.getByText('Ausschussquote senken')).toBeVisible();
  await capture(page, testInfo, 'contribution');
  await page.getByLabel('Ziel', { exact: true }).fill('Lieferquote erhöhen');
  await page.getByRole('button', { name: 'Ziel speichern' }).click();
  await expect.poll(() => posted).toContain('objective');
  await page.getByRole('button', { name: 'Beitrag abschließen' }).click();
  await expect.poll(() => posted).toContain('complete');
});
