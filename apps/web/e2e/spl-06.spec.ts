import { expect, type Page, test, type TestInfo } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

const relationshipId = '550e8400-e29b-41d4-a716-446655440291';
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

const planId = '550e8400-e29b-41d4-a716-446655440292';
const cycleId = '550e8400-e29b-41d4-a716-446655440295';
const planPath = `${supplierPath}/strategie/lieferantenplan`;

const objectives = ['Kosten senken', 'Qualität sichern', 'Liefertreue erhöhen'].map((text, index) => ({
  id: `550e8400-e29b-41d4-a716-44665544030${index}`,
  categoryKey: 'cost',
  categoryName: 'Kosten',
  businessUnit: { id: 'bu-1', name: 'Werk Nord' },
  materialGroup: null,
  text,
  owner: { userId: 'anna', name: 'Anna Schmidt' },
  targetYear: 2027,
  canEdit: true,
}));

const makeTopics = (titles: string[]) =>
  titles.map((title, index) => ({
    id: `550e8400-e29b-41d4-a716-44665544040${index}`,
    title,
    reason: `Weil ${title} zählt.`,
    priority: index + 1,
    objectives: [{ id: objectives[0]?.id ?? '', text: objectives[0]?.text ?? '' }],
  }));

async function mockPlan(page: Page, getTopics: () => ReturnType<typeof makeTopics>) {
  await page.route(`**/api/suppliers/${relationshipId}/plan`, (route) =>
    route.fulfill({
      json: {
        plan: {
          id: planId,
          relationshipId,
          cycleId,
          version: 1,
          status: 'draft',
          summary: 'Versorgung sichern.',
          createdAt: '2026-01-01T00:00:00.000Z',
          targetType: 'Strategischer Partner',
          sro: { userId: 'anna', name: 'Anna Schmidt' },
          objectives,
          contributions: { done: 0, total: 0, items: [] },
          topics: getTopics(),
          canManage: true,
        },
        cycleId,
        categories,
        teamCandidates: [{ userId: 'anna', name: 'Anna Schmidt' }],
        canCreate: false,
      },
    }),
  );
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.waitForTimeout(300);
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *:not(svg *)')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .map((element) => `${element.tagName.toLowerCase()}.${String(element.className)}`)
          .slice(-12),
      );
      expect(overflowing).toEqual([]);
      const path = testInfo.outputPath(`spl-06-${name}-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`spl-06-${name}-${colorScheme}-${width}`, {
        path,
        contentType: 'image/png',
      });
    }
  }
}

test('SPL-06 ab dem sechsten Thema erscheint der Hinweis', async ({ page }, testInfo) => {
  await setUp(page);
  const five = makeTopics(['A', 'B', 'C', 'D', 'E']);
  let topics = five;
  await mockPlan(page, () => topics);
  await page.goto(planPath);
  await expect(page.getByRole('heading', { name: '1. A' })).toBeVisible();
  await expect(page.getByText('Mehr als fünf Themen verwässern den Fokus.')).toHaveCount(0);
  topics = makeTopics(['A', 'B', 'C', 'D', 'E', 'F']);
  await page.reload();
  await expect(page.getByText('Mehr als fünf Themen verwässern den Fokus.')).toBeVisible();
  await capture(page, testInfo, 'plan');
});

test('SPL-06 Reihenfolge per Tastatur ändern und nach Neuladen behalten', async ({ page }) => {
  await setUp(page);
  let topics = makeTopics(['Kosten', 'Qualität', 'Liefertreue']);
  let put: { topicIds: string[] } | null = null;
  await mockPlan(page, () => topics);
  await page.route(`**/api/suppliers/${relationshipId}/plan/${planId}/topic-order`, (route) => {
    put = route.request().postDataJSON() as { topicIds: string[] };
    topics = put.topicIds.map((id, index) => ({
      ...(topics.find((topic) => topic.id === id) as (typeof topics)[number]),
      priority: index + 1,
    }));
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto(planPath);
  const down = page.getByRole('button', { name: 'Kosten nach unten' });
  await down.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '2. Kosten' })).toBeVisible();
  expect(put).toMatchObject({ topicIds: [topics[0]?.id, topics[1]?.id, topics[2]?.id] });
  await expect(page.getByRole('button', { name: 'Kosten nach unten' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: '1. Qualität' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Qualität nach oben' })).toBeDisabled();
});

test('SPL-06 Thema braucht ein Ziel und wird mit Zielen gespeichert', async ({ page }, testInfo) => {
  await setUp(page);
  let posted: unknown = null;
  await mockPlan(page, () => []);
  await page.route(`**/api/suppliers/${relationshipId}/plan/${planId}/topics`, (route) => {
    posted = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: 'new' } });
  });
  await page.goto(`${planPath}/themen/neu`);
  await page.getByLabel('Titel').fill('Kosten');
  await page.getByLabel('Begründung').fill('Wegen Preisdruck.');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Bitte wähle mindestens ein Ziel.')).toBeVisible();
  expect(posted).toBeNull();
  await capture(page, testInfo, 'form');
  await page.getByLabel('Qualität sichern').check();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => posted).toMatchObject({
    title: 'Kosten',
    reason: 'Wegen Preisdruck.',
    objectiveIds: [objectives[1]?.id],
  });
});
