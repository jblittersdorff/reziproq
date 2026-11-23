import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// KI-07: Termin-Briefing auf Telefonbreite und am Schreibtisch, ohne seitliches Scrollen; Ziele und
// interne Fragen privat, die Agenda wird erst nach Übernahme geteilt.

test.use({ locale: 'de-DE' });

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const id = uuid(1);
const mid = uuid(10);
const meeting = {
  meeting: {
    id: mid,
    type: 'jbp',
    title: 'JBP mit Rheintal Elektronik',
    startsAt: '2099-12-04T09:00:00Z',
    durationMinutes: 120,
    location: 'Teams',
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
  live: { sections: [], frozenAt: null },
  canClose: true,
};
const source = (title: string) => ({
  id: uuid(80),
  kind: 'own_data',
  title,
  objectType: 'scorecard_kpi',
  objectId: uuid(81),
  url: null,
  publishedAt: '2026-10-01',
  excerpt: null,
});
const draft = (n: number, data: unknown, title = 'Scorecard') => ({
  id: uuid(n),
  status: 'draft',
  content: JSON.stringify(data),
  model: 'reziproq',
  createdAt: '2099-11-27T05:10:00Z',
  decidedAt: null,
  claims: [{ key: '1', text: 'Aussage', sources: [source(title)], thinlySupported: false }],
  data,
});
const brief = {
  canDecide: true,
  leadDays: 7,
  durationMinutes: 120,
  parts: {
    situation: {
      draft: draft(
        60,
        {
          sentences: [
            'Rheintal Elektronik GmbH (Demo) hat bei euch 2025 einen Spend von 4.820.000 €, plus 9 % zum Vorjahr.',
            'Vor dem Termin stehen 3 Risiken offen, zuerst: „Liefertreue“ liegt bei 86 %, Ziel 95 %.',
            'Der Wertpotenzial-Finder sieht 140.000 € bis 200.000 € EBIT im Jahr, vor allem über Prognose teilen.',
          ],
        },
        'Spend 2025',
      ),
      accepted: null,
    },
    goals: {
      draft: draft(61, {
        goals: [
          {
            key: 'g1',
            title: 'Prognose teilen anstoßen',
            reachedWhen:
              'Rheintal Elektronik GmbH (Demo) ist bereit, den Vorschlag gemeinsam zu prüfen, und nennt einen Termin für ein Angebot.',
            ref: { objectType: 'value_opportunity', objectId: uuid(82), title: 'Prognose teilen' },
          },
          {
            key: 'g2',
            title: '„Liefertreue“ wieder auf Kurs bringen',
            reachedWhen:
              'Rheintal Elektronik GmbH (Demo) nennt die Ursachen und einen Termin, bis wann Liefertreue das Ziel von 95 % erreicht.',
            ref: { objectType: 'scorecard_kpi', objectId: uuid(81), title: 'Liefertreue' },
          },
        ],
      }),
      accepted: null,
    },
    agenda: {
      draft: draft(62, {
        items: [
          {
            key: 'a0',
            kind: 'welcome',
            start: '10:00',
            minutes: 10,
            title: 'Begrüßung und Ziele des Termins',
            subline: null,
            leads: ['Lena Berger'],
            goalKey: null,
          },
          {
            key: 'a1',
            kind: 'topic',
            start: '10:10',
            minutes: 40,
            title: 'Vorschlag: Prognose teilen',
            subline: null,
            leads: ['Lena Berger'],
            goalKey: 'g1',
          },
          {
            key: 'pause',
            kind: 'break',
            start: '10:50',
            minutes: 5,
            title: 'Pause',
            subline: null,
            leads: [],
            goalKey: null,
          },
          {
            key: 'a2',
            kind: 'topic',
            start: '10:55',
            minutes: 50,
            title: 'Liefertreue: Stand und Maßnahmen',
            subline: 'Stand 86 %, Zielwert 95 %',
            leads: ['Lena Berger', 'Tom Weber'],
            goalKey: 'g2',
          },
          {
            key: 'close',
            kind: 'closing',
            start: '11:45',
            minutes: 15,
            title: 'Zusagen und nächste Schritte',
            subline: 'Wer macht was bis wann',
            leads: ['Lena Berger'],
            goalKey: null,
          },
        ],
        omitted: [
          {
            topic: 'Transparenz (Feedback-Lücke 0,9)',
            reason: 'Vorschlag von Reziproq: ein eigener Termin mit den Feedback-Ergebnissen.',
          },
        ],
      }),
      accepted: null,
    },
    internalQuestions: {
      draft: draft(63, {
        questions: [
          {
            key: 'q1',
            text: 'Wer erledigt „Prognose 12 Monate teilen“ bis zum Termin?',
            occasion: 'Zusage eurer Seite, fällig 01.12.',
            addressee: { userId: 'u1', name: 'Jonas Feld' },
            actionId: null,
            answer: null,
          },
          {
            key: 'q2',
            text: 'Wie weit dürfen wir beim Vorschlag „Prognose teilen“ gehen?',
            occasion: 'Ziel: Prognose teilen anstoßen',
            addressee: { userId: 'u2', name: 'Lena Berger' },
            actionId: uuid(77),
            answer: 'Bis 12 Monate rollierend, ohne Abnahmegarantie.',
          },
        ],
      }),
      accepted: null,
    },
    supplierQuestions: {
      draft: draft(64, {
        questions: [
          {
            key: 's1',
            text: 'Wäre das für euch denkbar: Prognose teilen? Was braucht ihr dafür?',
            goalKey: 'g1',
            about: null,
          },
          {
            key: 's2',
            text: 'Was sind die Ursachen bei Liefertreue, und bis wann seid ihr wieder beim Zielwert?',
            goalKey: 'g2',
            about: null,
          },
          {
            key: 's3',
            text: 'Könnt ihr uns sagen: Woher kommt das Laminat?',
            goalKey: null,
            about: 'Datenlücke im Wertpotenzial-Finder',
          },
        ],
      }),
      accepted: null,
    },
    expectedQuestions: {
      draft: draft(65, {
        questions: [
          {
            key: 'e1',
            text: 'Wie steht ihr zu unserem Thema „Planbarkeit der Abrufe“?',
            origin: 'Thema von Rheintal Elektronik GmbH (Demo) im Gemeinsamen Plan',
            answer:
              'Wir sehen das Thema und prüfen es gemeinsam mit euch. Eine Entscheidung treffen wir nach dem Termin.',
          },
        ],
      }),
      accepted: null,
    },
    risks: {
      draft: draft(66, {
        risks: [
          { key: 'r1', text: '„Liefertreue“ liegt bei 86 %, Ziel 95 %.' },
          {
            key: 'r2',
            text: 'Zusage „Liefertreue-Bericht Oktober“ (Rheintal Elektronik GmbH (Demo)) war am 01.11. fällig.',
          },
        ],
      }),
      accepted: null,
    },
    openPoints: {
      draft: draft(67, {
        points: [
          {
            key: 'o1',
            title: 'Liefertreue-Bericht Oktober',
            side: 'supplier',
            dueOn: '2099-11-01',
            overdue: true,
          },
          {
            key: 'o2',
            title: 'Prognose 12 Monate teilen',
            side: 'buyer',
            dueOn: '2099-12-01',
            overdue: false,
          },
        ],
      }),
      accepted: null,
    },
  },
  participants: [
    { name: 'Lena Berger', side: 'buyer' },
    { name: 'Jonas Feld', side: 'buyer' },
    { name: 'Tom Weber', side: 'supplier' },
  ],
  sourceCounts: [
    { kind: 'value', count: 3 },
    { kind: 'activities', count: 12 },
    { kind: 'commitments', count: 6 },
    { kind: 'topics', count: 5 },
    { kind: 'feedback', count: 1 },
    { kind: 'scorecard', count: 1 },
  ],
  freshness: {
    runId: uuid(70),
    preparedAt: '2099-11-27T05:10:00Z',
    unchanged: true,
    running: false,
  },
  agendaShared: false,
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
    route.fulfill({ json: { canDraft: true, draft: null, accepted: null } }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}/briefing`, (route) =>
    route.fulfill({ json: brief }),
  );
  await page.route('**/api/ki/agenten', (route) =>
    route.fulfill({
      json: {
        agents: [{ id: uuid(90), key: 'meeting_brief', enabled: true, version: 2, runCount: 1 }],
        recentRuns: [],
        canManage: false,
      },
    }),
  );
}

for (const width of [390, 1440]) {
  test(`Termin-Briefing ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto(`/lieferanten/${id}/umsetzung/termine/${mid}`);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Ziele für das Gespräch' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Agenda', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('120 von 120 Minuten verplant.')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.KI07_SHOTS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${process.env.KI07_SHOTS}/briefing-${width}.png`,
        fullPage: true,
      });
    }
  });
}
