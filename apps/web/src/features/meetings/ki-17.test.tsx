// @vitest-environment jsdom
import type { CaptureItem, MeetingCapture, MeetingDetail } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/KI-17.md in der Oberfläche: Reiter Ergebnisse nach dem Termin, Notizen
// auswerten, Entwürfe mit Fundstelle und Schalter „Für den Lieferanten sichtbar“, Alle geteilten
// übernehmen, Protokoll als Vorschau und Teilen erst nach Bestätigung.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
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
const meeting = (startsAt = '2020-12-04T09:00:00Z'): MeetingDetail => ({
  meeting: {
    id: mid,
    type: 'jbp',
    title: 'JBP mit Rheintal',
    startsAt,
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
const item = (overrides: Partial<CaptureItem>): CaptureItem => ({
  kind: 'commitment',
  title: 'Punkt',
  visibility: 'shared',
  quote: 'Zeile',
  side: null,
  owner: null,
  ownerUnclear: false,
  dueOn: null,
  dateUnclear: false,
  addressee: null,
  commitmentId: null,
  commitmentTitle: null,
  proposal: null,
  goalKey: null,
  goalStatus: null,
  reason: null,
  createdId: null,
  ...overrides,
});
const draft = (n: number, entry: CaptureItem, status: 'draft' | 'accepted' = 'draft') => ({
  id: uuid(n),
  status,
  content: JSON.stringify(entry),
  model: 'test',
  createdAt: '2020-12-05T08:00:00Z',
  decidedAt: null,
  item: entry,
});
const capture = (): MeetingCapture => ({
  open: true,
  canCapture: true,
  canDecide: true,
  notes: {
    id: uuid(50),
    source: 'pasted',
    text: 'Zusage: Tom Weber schickt den Kapazitätsplan bis 15.01.2021',
    createdAt: '2020-12-05T08:00:00Z',
    createdByName: 'Sara Ost',
  },
  drafts: [
    draft(
      61,
      item({
        title: 'Tom Weber schickt den Kapazitätsplan',
        side: 'supplier',
        owner: 'Tom Weber',
        dueOn: '2021-01-15',
        quote: 'Zusage: Tom Weber schickt den Kapazitätsplan bis 15.01.2021',
      }),
    ),
    draft(
      62,
      item({
        title: 'Lea Brandt liefert ein Angebot',
        side: 'supplier',
        ownerUnclear: true,
        dueOn: '2020-12-19',
      }),
    ),
    draft(
      63,
      item({
        kind: 'decision',
        title: 'einer Erhöhung über 2 % nicht zustimmen',
        visibility: 'internal',
      }),
    ),
    draft(
      64,
      item({
        kind: 'goal_check',
        title: '„Liefertreue“ wieder auf Kurs bringen',
        visibility: 'internal',
        goalKey: 'g1',
        goalStatus: 'achieved',
        reason: 'Im Termin vereinbart.',
      }),
    ),
  ],
  protocol: {
    text: 'Teilnehmer: Sara Ost, Tom Weber\n\nZusagen\n- Tom Weber schickt den Kapazitätsplan',
    sharedCount: 2,
    internalCount: 1,
    sharedAt: null,
  },
  participants: [
    { name: 'Sara Ost', side: 'buyer' },
    { name: 'Tom Weber', side: 'supplier' },
  ],
});

let current: MeetingCapture;
let detail: MeetingDetail;
let sent: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  current = capture();
  detail = meeting();
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
    const path = `/api/suppliers/${rel}/termine/${mid}/ergebnisse`;
    if (request.url.startsWith(path)) {
      if (request.method !== 'GET') {
        sent.push({
          url: request.url.slice(path.length),
          method: request.method,
          body: request.body,
        });
        if (request.url.endsWith('/protokoll-teilen')) {
          current = {
            ...current,
            protocol: { ...current.protocol, sharedAt: '2020-12-05T09:00:00Z' },
          };
        }
      }
      return Response.json(current);
    }
    if (request.url === `/api/suppliers/${rel}/termine/${mid}`) return Response.json(detail);
    return undefined;
  };
});

afterEach(tearDownApp);

const page = `/lieferanten/${rel}/umsetzung/termine/${mid}?reiter=ergebnisse`;

describe('KI-17 Ergebnisse nach dem Termin', () => {
  it('zeigt Entwürfe in Gruppen mit Fundstelle, Hinweis „Verantwortlich unklar“ und das Protokoll als Vorschau', async () => {
    renderAt(page);
    const panel = (await screen.findByRole('heading', { level: 2, name: 'Zusagen' })).closest(
      '[data-slot="meeting-capture"]',
    ) as HTMLElement;
    expect(within(panel).getByText('Tom Weber schickt den Kapazitätsplan')).toBeTruthy();
    expect(within(panel).getByText('Verantwortlich unklar')).toBeTruthy();
    expect(within(panel).getAllByText('Fundstelle').length).toBeGreaterThan(0);
    expect(
      within(panel).getByRole('heading', { level: 2, name: 'Stand der Ziele aus dem Briefing' }),
    ).toBeTruthy();
    const protocol = within(panel)
      .getByRole('heading', {
        level: 2,
        name: 'So sieht Rheintal Elektronik GmbH (Demo) das Protokoll',
      })
      .closest('section') as HTMLElement;
    expect(within(protocol).getByText(/Kapazitätsplan/)).toBeTruthy();
    expect(within(protocol).queryByText(/2 %/)).toBeNull();
    expect(within(protocol).getByText('1 privater Punkt steht nicht darin.')).toBeTruthy();
    expect(within(panel).getByText('Prüfe 4 Entwürfe, dann teile das Protokoll')).toBeTruthy();
  });

  it('Auswerten schickt die Notizen; der Schalter stellt einen Punkt intern; Alle geteilten übernehmen', async () => {
    renderAt(page);
    fireEvent.change(await screen.findByLabelText('Eure Notizen zum Termin'), {
      target: { value: 'Frage: Woher kommt das Laminat?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Auswerten' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        url: '/auswerten',
        body: { source: 'typed', text: 'Frage: Woher kommt das Laminat?' },
      }),
    );
    const switches = screen.getAllByRole('switch', { name: 'Für den Lieferanten sichtbar' });
    fireEvent.click(switches[0] as HTMLElement);
    await waitFor(() =>
      expect(sent[1]).toMatchObject({
        url: `/${uuid(61)}`,
        method: 'PUT',
        body: { visibility: 'internal' },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Alle geteilten übernehmen' }));
    await waitFor(() =>
      expect(sent[2]).toMatchObject({ url: '/uebernehmen', body: { ids: [uuid(61), uuid(62)] } }),
    );
  });

  it('Protokoll teilen zeigt Empfänger und Inhalt und wartet auf Bestätigung', async () => {
    current = {
      ...capture(),
      drafts: capture().drafts.map((entry) => ({ ...entry, status: 'accepted' as const })),
    };
    renderAt(page);
    const protocol = (
      await screen.findByRole('heading', {
        level: 2,
        name: 'So sieht Rheintal Elektronik GmbH (Demo) das Protokoll',
      })
    ).closest('section') as HTMLElement;
    fireEvent.click(within(protocol).getByRole('button', { name: 'Protokoll teilen' }));
    expect(sent).toHaveLength(0);
    expect(within(protocol).getByText('Rheintal Elektronik GmbH (Demo): Tom Weber')).toBeTruthy();
    fireEvent.click(within(protocol).getByRole('button', { name: 'Teilen bestätigen' }));
    await waitFor(() => expect(sent[0]?.url).toBe('/protokoll-teilen'));
    expect(await within(protocol).findByText(/Geteilt am/)).toBeTruthy();
  });

  it('vor dem Termin gibt es den Reiter Ergebnisse nicht', async () => {
    detail = meeting('2099-12-04T09:00:00Z');
    renderAt(page);
    expect(await screen.findByRole('radio', { name: 'Agenda' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Ergebnisse' })).toBeNull();
  });
});
