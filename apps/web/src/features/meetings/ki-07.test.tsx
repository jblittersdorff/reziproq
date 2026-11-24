// @vitest-environment jsdom
import {
  defaultAiSettings,
  defaultBriefLeadDays,
  type MeetingBrief,
  type MeetingDetail,
} from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/KI-07.md in der Oberfläche (Termin-Briefing): Reiter Vorbereitung mit Lage,
// nächstem Schritt, Zielen „nur für euch“, Agenda mit Zeiten, Fragen in drei Gruppen, Risiken und
// offenen Punkten; Agenda übernehmen, Frage senden, Bearbeiten rechnet die Zeiten neu.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const rel = uuid(1);
const mid = uuid(10);
const supplier = {
  relationshipId: rel,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: null,
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};
const meeting = (): MeetingDetail => ({
  meeting: {
    id: mid,
    type: 'jbp',
    title: 'JBP mit Rheintal',
    startsAt: '2099-12-04T09:00:00Z',
    durationMinutes: 120,
    location: 'Teams',
    status: 'planned',
    ownerSide: 'buyer',
    protocol: null,
    createdByName: 'Sara Ost',
  },
  participants: [],
  agenda: [],
  decisions: [],
  note: null,
  canEditMeeting: true,
  canContribute: true,
  live: { sections: [], frozenAt: null },
  canClose: true,
});
const source = {
  id: uuid(80),
  kind: 'own_data' as const,
  title: 'Liefertreue',
  objectType: 'scorecard_kpi',
  objectId: uuid(81),
  url: null,
  publishedAt: '2026-10-01',
  excerpt: null,
};
const draft = (id: number, data: unknown, status: 'draft' | 'accepted' = 'draft') => ({
  id: uuid(id),
  status,
  content: JSON.stringify(data),
  model: 'reziproq',
  createdAt: '2099-11-27T05:10:00Z',
  decidedAt: null,
  claims: [{ key: '1', text: 'Aussage', sources: [source], thinlySupported: false }] as [
    { key: string; text: string; sources: (typeof source)[]; thinlySupported: boolean },
  ],
  data,
});
const empty = { draft: null, accepted: null };
const agendaData = {
  items: [
    {
      key: 'a0',
      kind: 'welcome',
      start: '10:00',
      minutes: 10,
      title: 'Begrüßung und Ziele des Termins',
      subline: null,
      leads: ['Sara Ost'],
      goalKey: null,
    },
    {
      key: 'a1',
      kind: 'topic',
      start: '10:10',
      minutes: 95,
      title: 'Liefertreue: Stand und Maßnahmen',
      subline: 'Stand 82 %, Zielwert 95 %',
      leads: ['Sara Ost', 'Tom Weber'],
      goalKey: 'g1',
    },
    {
      key: 'close',
      kind: 'closing',
      start: '11:45',
      minutes: 15,
      title: 'Zusagen und nächste Schritte',
      subline: 'Wer macht was bis wann',
      leads: ['Sara Ost'],
      goalKey: null,
    },
  ],
  omitted: [
    { topic: 'Transparenz (Feedback-Lücke 0,9)', reason: 'Vorschlag: ein eigener Termin.' },
  ],
};
const full = (): MeetingBrief =>
  ({
    canDecide: true,
    leadDays: 7,
    durationMinutes: 120,
    parts: {
      situation: {
        draft: draft(60, { sentences: ['Rheintal hat 4,82 Mio. € Spend.', 'Liefertreue 82 %.'] }),
        accepted: null,
      },
      goals: {
        draft: draft(61, {
          goals: [
            {
              key: 'g1',
              title: '„Liefertreue“ wieder auf Kurs bringen',
              reachedWhen: 'Rheintal nennt die Ursachen und einen Termin.',
              ref: { objectType: 'scorecard_kpi', objectId: uuid(81), title: 'Liefertreue' },
            },
          ],
        }),
        accepted: null,
      },
      agenda: { draft: draft(62, agendaData), accepted: null },
      internalQuestions: {
        draft: draft(63, {
          questions: [
            {
              key: 'q1',
              text: 'Wer erledigt „Forecast teilen“ bis zum Termin?',
              occasion: 'Zusage eurer Seite, fällig 01.12.',
              addressee: { userId: 'u-jonas', name: 'Jonas Feld' },
              actionId: null,
              answer: null,
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
              text: 'Was sind die Ursachen bei Liefertreue?',
              goalKey: 'g1',
              about: null,
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
              text: 'Wie steht ihr zu unserem Thema „Planbarkeit“?',
              origin: 'Thema von Rheintal im Gemeinsamen Plan',
              answer: 'Wir prüfen es gemeinsam mit euch.',
            },
          ],
        }),
        accepted: null,
      },
      risks: {
        draft: draft(66, {
          risks: [{ key: 'r1', text: '„Liefertreue“ liegt bei 82 %, Ziel 95 %.' }],
        }),
        accepted: null,
      },
      openPoints: {
        draft: draft(67, {
          points: [
            {
              key: 'o1',
              title: 'Kapazitätsplan liefern',
              side: 'supplier',
              dueOn: '2099-11-01',
              overdue: true,
            },
          ],
        }),
        accepted: null,
      },
    },
    participants: [
      { name: 'Sara Ost', side: 'buyer' },
      { name: 'Tom Weber', side: 'supplier' },
    ],
    sourceCounts: [
      { kind: 'value', count: 3 },
      { kind: 'activities', count: 12 },
    ],
    freshness: {
      runId: uuid(70),
      preparedAt: '2099-11-27T05:10:00Z',
      unchanged: true,
      running: false,
    },
    agendaShared: false,
  }) as unknown as MeetingBrief;

let brief: MeetingBrief;
let sent: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  brief = full();
  sent = [];
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(supplier);
    if (request.url.startsWith(`/api/suppliers/${rel}/overview`)) {
      return Response.json({
        head: { segment: null, sro: null, nextMeeting: null },
        metrics: [],
        cycle: null,
        canStartCycle: false,
        canSetJbpDate: false,
      });
    }
    if (request.url.startsWith(`/api/suppliers/${rel}/termine/${mid}/zusammenfassung`)) {
      return Response.json({ canDraft: true, draft: null, accepted: null });
    }
    const briefPath = `/api/suppliers/${rel}/termine/${mid}/briefing`;
    if (request.url.startsWith(briefPath)) {
      if (request.method !== 'GET') {
        sent.push({
          url: request.url.slice(briefPath.length),
          method: request.method,
          body: request.body,
        });
        if (request.url.endsWith(`${uuid(62)}/uebernehmen`)) {
          brief = {
            ...brief,
            agendaShared: true,
            parts: {
              ...brief.parts,
              agenda: { draft: null, accepted: draft(62, agendaData, 'accepted') },
            },
          } as unknown as MeetingBrief;
        }
      }
      return Response.json(brief);
    }
    if (request.url === '/api/ki/agenten') {
      return Response.json({
        agents: [{ id: uuid(90), key: 'meeting_brief', enabled: true, version: 2, runCount: 1 }],
        recentRuns: [],
        canManage: false,
      });
    }
    if (request.url === `/api/suppliers/${rel}/termine/${mid}`) return Response.json(meeting());
    return undefined;
  };
});

afterEach(tearDownApp);

const page = `/lieferanten/${rel}/umsetzung/termine/${mid}`;

describe('KI-07 Termin-Briefing', () => {
  it('zeigt Lage, nächsten Schritt, Ziele nur für euch, Agenda mit Zeiten, Fragen, Risiken und offene Punkte', async () => {
    renderAt(page);
    const briefing = (
      await screen.findByRole('heading', { level: 2, name: 'Ziele für das Gespräch' })
    ).closest('[data-slot="meeting-brief"]') as HTMLElement;
    expect(within(briefing).getByText(/Lage · Entwurf von Reziproq/)).toBeTruthy();
    expect(
      within(briefing).getByText(/Agenda bis .* an Rheintal Elektronik GmbH \(Demo\) schicken/),
    ).toBeTruthy();
    const goals = within(briefing)
      .getByRole('heading', { level: 2, name: 'Ziele für das Gespräch' })
      .closest('section') as HTMLElement;
    expect(within(goals).getByText('nur für euch')).toBeTruthy();
    expect(within(goals).getByText('Rheintal nennt die Ursachen und einen Termin.')).toBeTruthy();
    const agenda = within(briefing)
      .getByRole('heading', { level: 2, name: 'Agenda' })
      .closest('section') as HTMLElement;
    expect(within(agenda).getByText('10:10')).toBeTruthy();
    expect(within(agenda).getByText('95 Min.')).toBeTruthy();
    expect(within(agenda).getByText('Ziel 1')).toBeTruthy();
    expect(within(agenda).getByText('120 von 120 Minuten verplant.')).toBeTruthy();
    expect(within(agenda).getByText(/Transparenz/)).toBeTruthy();
    expect(within(briefing).getByText('Vorher intern klären')).toBeTruthy();
    expect(within(briefing).getByText('Im Termin an Rheintal Elektronik GmbH (Demo)')).toBeTruthy();
    expect(
      within(briefing).getByText('Was Rheintal Elektronik GmbH (Demo) fragen wird'),
    ).toBeTruthy();
    expect(within(briefing).getByText('Wir prüfen es gemeinsam mit euch.')).toBeTruthy();
    expect(within(briefing).getByText('überfällig')).toBeTruthy();
    expect(within(briefing).getByText('Eingaben seitdem unverändert.')).toBeTruthy();
    // Neu vorbereiten geht erst, wenn sich Eingaben geändert haben
    expect(
      (within(briefing).getByRole('button', { name: 'Neu vorbereiten' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('Agenda übernehmen teilt sie; Senden macht eine Frage zur Aufgabe', async () => {
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Agenda übernehmen' }));
    await waitFor(() => expect(sent[0]?.url).toBe(`/${uuid(62)}/uebernehmen`));
    expect(
      await screen.findByText('Übernommen. Die Agenda steht jetzt geteilt im Termin.'),
    ).toBeTruthy();
    expect(screen.getByText('Interne Fragen klären')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'An Jonas Feld senden' }));
    await waitFor(() => expect(sent[1]?.url).toBe('/fragen/q1/senden'));
  });

  it('Bearbeiten rechnet die Zeiten neu und speichert nur, wenn die Summe stimmt', async () => {
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Dauer von Punkt 2 in Minuten'), {
      target: { value: '90' },
    });
    expect(screen.getByText(/115 von 120 Minuten verplant/)).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Agenda speichern' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Dauer von Punkt 1 in Minuten'), {
      target: { value: '15' },
    });
    expect(screen.getByText('11:45')).toBeTruthy();
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(sent[0]).toMatchObject({ url: '/agenda', method: 'PUT' }));
    const body = sent[0]?.body as { items: { key: string; minutes: number }[] };
    expect(body.items.map((item) => item.minutes)).toEqual([15, 90, 15]);
  });

  it('ohne Briefing beginnt die Seite bei der Agenda; die Vorbereitung nennt den Vorlauf', async () => {
    brief = {
      ...full(),
      parts: Object.fromEntries(
        Object.keys(full().parts).map((key) => [key, empty]),
      ) as MeetingBrief['parts'],
      freshness: { runId: null, preparedAt: null, unchanged: false, running: false },
    };
    renderAt(page);
    expect(await screen.findByRole('heading', { level: 2, name: 'Agenda' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Vorbereitung' }));
    expect(
      await screen.findByText('Reziproq bereitet diesen Termin 7 Tage vorher vor.'),
    ).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Jetzt vorbereiten' })).toBeTruthy();
  });

  it('Admins stellen in den Einstellungen KI den Vorlauf je Termintyp ein', async () => {
    let saved: unknown = null;
    const handle = api.handle;
    api.handle = (request) => {
      if (request.url === '/api/einstellungen/termin-briefing') {
        if (request.method === 'PUT') {
          saved = request.body;
          return Response.json(request.body);
        }
        return Response.json({ leadDays: defaultBriefLeadDays });
      }
      if (request.url === '/api/einstellungen/ki')
        return Response.json({ settings: defaultAiSettings, euOnly: true, canEdit: true });
      if (request.url === '/api/ki/kontingent')
        return Response.json({
          month: '2099-11',
          budgetMonthCents: 15_000,
          usedCents: 0,
          calls: 0,
          byFeature: [],
        });
      return handle?.(request);
    };
    renderAt('/einstellungen/ki');
    const field = (await screen.findByLabelText('Verhandlung: Tage vorher')) as HTMLInputElement;
    expect(field.value).toBe('3');
    expect((screen.getByLabelText('Anderer Termin: Tage vorher') as HTMLInputElement).value).toBe(
      '',
    );
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vorlauf speichern' }));
    await waitFor(() =>
      expect(saved).toMatchObject({ leadDays: { negotiation: 5, escalation: 0, other: null } }),
    );
  });
});
