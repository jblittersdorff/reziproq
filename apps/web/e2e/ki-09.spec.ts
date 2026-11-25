import { expect, type Page, test } from '@playwright/test';
import type { CustomAgentDetail } from '@reziproq/shared';
import { id, signIn } from './route-walk.js';

// KI-09: Liste „Eure Agenten“, Anlegen in fünf Abschnitten und Seite eines eigenen Agenten mit
// Testlauf, auf Telefonbreite und am Schreibtisch, ohne seitliches Scrollen.

const agentId = '0190a0a0-0000-7000-8000-000000000030';
const runId = '0190a0a0-0000-7000-8000-000000000040';
const agent: CustomAgentDetail = {
  id: agentId,
  name: 'Verfehlte Zusagen',
  status: 'draft',
  ownerName: 'Lena Berger',
  isOwn: true,
  version: 1,
  config: {
    name: 'Verfehlte Zusagen',
    instructions:
      'Finde jeden Montag Fokuslieferanten mit überfälligen Zusagen und entwirf je eine interne Maßnahme mit Vorschlag, wie wir nachfassen.',
    tools: ['commitments', 'actions', 'meetings'],
    trigger: { kind: 'schedule', schedule: { every: 'week', weekday: 1, time: '07:00' } },
    scope: { kind: 'focus' },
    output: 'action',
    reviewer: 'me',
    budgetCents: 100,
  },
  blockedReason: null,
  testPassed: true,
  lastTestRunId: runId,
  needsApproval: true,
  reviewComment: null,
  pausedReason: null,
  runCount: 1,
  canEdit: true,
  canApprove: false,
  canStart: true,
  runs: [
    {
      id: runId,
      version: 1,
      status: 'done',
      isTest: true,
      createdAt: '2026-11-23T07:00:00Z',
      startedBy: 'Lena Berger',
    },
  ],
};

async function mock(page: Page) {
  await signIn(page, { locale: 'de' });
  await page.route('**/api/ki/agenten', (route) =>
    route.fulfill({
      json: {
        agents: [{ id, key: 'meeting_brief', enabled: true, version: 2, runCount: 1 }],
        recentRuns: [],
        canManage: true,
      },
    }),
  );
  await page.route('**/api/ki/kontingent', (route) =>
    route.fulfill({
      json: { month: '2026-11', budgetMonthCents: 15000, usedCents: 1, calls: 1, byFeature: null },
    }),
  );
  await page.route('**/api/ki/eigene-agenten', (route) =>
    route.fulfill({
      json: {
        agents: [{ ...agent, status: 'active', runCount: 3 }],
        canCreate: true,
        pendingApproval: [
          {
            ...agent,
            id: '0190a0a0-0000-7000-8000-000000000031',
            name: 'Spend-Abweichungen Q4',
            ownerName: 'Ida Roth',
            status: 'pending_approval',
            isOwn: false,
            canApprove: true,
            config: { ...agent.config, tools: ['spend', 'supplier_master'] },
          },
        ],
      },
    }),
  );
  await page.route('**/api/ki/eigene-agenten/optionen', (route) =>
    route.fulfill({
      json: {
        tools: ['supplier_master', 'spend', 'commitments', 'actions', 'meetings', 'hints'],
        suppliers: [{ relationshipId: id, name: 'Rheintal Elektronik GmbH' }],
        categories: [],
        maxBudgetCents: 500,
        approvalRequired: true,
        templates: [
          { key: 'meeting_brief', name: 'Termin-Briefing', instructions: 'Bereite vor.' },
        ],
      },
    }),
  );
  await page.route(`**/api/ki/eigene-agenten/${agentId}`, (route) =>
    route.fulfill({ json: agent }),
  );
  await page.route(`**/api/ki/agenten/laeufe/${runId}`, (route) =>
    route.fulfill({
      json: {
        run: {
          id: runId,
          agentName: 'Verfehlte Zusagen',
          custom: true,
          version: 1,
          status: 'done',
          isTest: true,
          isOwn: true,
          stepsUsed: 4,
          costCents: 2,
          createdAt: '2026-11-23T07:00:00Z',
          startedAt: '2026-11-23T07:00:00Z',
          finishedAt: '2026-11-23T07:00:05Z',
          cancellationPending: false,
          canResume: false,
          startedBy: 'Lena Berger',
        },
        steps: [],
        draftHref: null,
        testResult: null,
        detailsAllowed: true,
        customAgentId: agentId,
      },
    }),
  );
  await page.route(`**/api/ki/eigene-agenten/laeufe/${runId}/ergebnisse`, (route) =>
    route.fulfill({
      json: {
        output: 'action',
        canAccept: false,
        results: [
          {
            relationshipId: id,
            supplier: 'Rheintal Elektronik GmbH',
            title: 'Zwei Zusagen überfällig: Lieferplan und Prüfbericht',
            text: 'Der Lieferplan Q1 und der Prüfbericht sind seit über einer Woche überfällig. Vorschlag: im nächsten Termin als Erstes ansprechen.',
            draftId: null,
            status: null,
          },
        ],
      },
    }),
  );
}

const noScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of [390, 1440]) {
  // Die Liste „Eure Agenten“ unter Mein Agent gibt es seit K1-f.3 nicht mehr (MA-01); eigene Agenten
  // sind aus (E-K0-13). Anlegen und Seite bleiben, bis K1-f.5 sie entfernt.
  test(`Eigene Agenten: Anlegen und Seite ohne seitliches Scrollen (${width})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    const shot = (name: string) =>
      page.screenshot({
        path: process.env.KI09_SHOTS
          ? `${process.env.KI09_SHOTS}/${name}-${width}.png`
          : testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });

    await page.goto('/einstellungen/ki/agenten/neu');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Eigenen Agenten anlegen' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Wer prüft und was darf es kosten/ }),
    ).toBeVisible();
    await page.getByText('Zeitplan', { exact: true }).click();
    await expect(page.getByLabel('Uhrzeit')).toBeVisible();
    expect(await noScroll(page)).toBe(0);
    await shot('anlegen');

    await page.goto(`/einstellungen/ki/agenten/eigene/${agentId}`);
    await expect(page.getByRole('heading', { name: 'Zur Freigabe senden' })).toBeVisible();
    await expect(
      page.getByText('Zwei Zusagen überfällig: Lieferplan und Prüfbericht'),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await noScroll(page)).toBe(0);
    await shot('agent');
  });
}
