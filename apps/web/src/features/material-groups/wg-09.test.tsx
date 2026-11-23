// @vitest-environment jsdom
import type { MarketAnalysis, StrategyContextResponse, StrategyStep } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Tests zu docs/specs/WG-09.md in der Oberfläche: Kopf mit Stand, Entwurf gestrichelt mit Quellen
// und Bestätigen, bestätigte Kraft mit Namen, neuer Entwurf daneben, Ausfüllen von Hand.

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
const group = uuid(10);
const strategyId = uuid(60);
let market: MarketAnalysis;
let sent: { method: string; url: string; body: unknown }[];

const context: StrategyContextResponse = {
  year: 2027,
  hidden: false,
  canCreate: false,
  context: {
    group: {
      id: group,
      name: 'Leiterplatten',
      code: 'LP',
      lead: { userId: 'anna', name: 'Anna Schmidt' },
      spend: null,
      supplierCount: 2,
    },
    strategy: {
      id: strategyId,
      year: 2027,
      status: 'draft',
      version: 1,
      steps: [
        'done',
        'done',
        'done',
        'done',
        'in_progress',
        'open',
        'open',
        'open',
        'open',
        'open',
      ],
    },
    role: 'lead',
    editableSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};
const content: StrategyStep = {
  step: 5,
  questions: [
    {
      id: uuid(30),
      view: 'Verhandlungsmacht der Lieferanten',
      text: 'Wie viele alternative Lieferanten gibt es?',
    },
    { id: uuid(31), view: 'Zusammenschau', text: 'Welche Kraft ist ein Risiko?' },
  ],
  notes: [],
  milestones: [],
  leadSuggestion: null,
  dimensions: [],
  kpis: [],
  goals: [],
};
const source = {
  id: uuid(40),
  kind: 'own_data' as const,
  title: 'Interne Analyse · Volumen',
  url: null,
  publishedAt: null,
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  market = {
    canEdit: true,
    confirmedCount: 1,
    researchedAt: '2026-11-14T09:00:00Z',
    sourceCount: 2,
    publicResearch: false,
    synthesisDraft: { id: uuid(50), text: 'Die Macht der Lieferanten ist das größte Risiko.' },
    run: null,
    forces: [
      {
        force: 'supplier_power',
        today: 'high',
        future: 'high',
        relevant: true,
        points: [{ text: 'Zwei Lieferanten decken 65 % des Umsatzes.', sources: [source] }],
        status: 'confirmed',
        confirmedBy: 'Sara Ost',
        confirmedAt: '2026-11-14T10:00:00Z',
        proposal: {
          today: 'high',
          future: 'low',
          relevant: true,
          points: [{ text: 'Ein dritter Anbieter baut Kapazität auf.', sources: [source] }],
        },
      },
      {
        force: 'new_entrants',
        today: 'low',
        future: 'high',
        relevant: true,
        points: [{ text: 'Rechenzentren buchen Kapazität.', sources: [source] }],
        status: 'draft',
        confirmedBy: null,
        confirmedAt: null,
        proposal: null,
      },
    ],
  };
  api.handle = (request) => {
    if (request.url === `/api/warengruppen/${group}/strategie`) return Response.json(context);
    if (request.url.endsWith('/schritte/5')) return Response.json(content);
    if (request.url === `/api/warengruppen/strategien/${strategyId}/markt`)
      return Response.json(market);
    if (request.method !== 'GET' && request.url.includes('/markt')) {
      sent.push(request);
      return Response.json(market);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-09 Marktanalyse', () => {
  it('der Kopf nennt Stand und Grundlage; Entwürfe haben Quellen und Bestätigen', async () => {
    renderAt(`/warengruppen/${group}/strategie/5`);
    expect(await screen.findByText('1 von 6 Kräften bestätigt, 5 warten auf euch')).toBeTruthy();
    expect(screen.getByText(/Öffentliche Recherche ist aus/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neu recherchieren' })).toBeTruthy();
    // Bestätigte Kraft nennt, wer bestätigt hat
    expect(screen.getByText(/bestätigt von Sara Ost/)).toBeTruthy();
    // Entwurf mit Quelle und Bestätigen
    const entrant = screen
      .getByText('Rechenzentren buchen Kapazität.')
      .closest('[data-slot="ai-draft"]') as HTMLElement;
    expect(within(entrant).getByText('Interne Analyse · Volumen')).toBeTruthy();
    fireEvent.click(within(entrant).getByRole('button', { name: 'Bestätigen' }));
    await waitFor(() =>
      expect(sent[0]?.url).toBe(
        `/api/warengruppen/strategien/${strategyId}/markt/new_entrants/bestaetigen`,
      ),
    );
  });

  it('ein neuer Entwurf steht neben dem bestätigten Stand und zeigt die Unterschiede', async () => {
    renderAt(`/warengruppen/${group}/strategie/5`);
    expect(await screen.findByText('Neuer Entwurf neben eurem Stand')).toBeTruthy();
    expect(screen.getByText('In 3 bis 5 Jahren: hoch → niedrig')).toBeTruthy();
    // Der bestätigte Punkt bleibt sichtbar
    expect(screen.getByText('Zwei Lieferanten decken 65 % des Umsatzes.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Übernehmen' })[0] as HTMLElement);
    await waitFor(() =>
      expect(sent[0]?.url).toBe(
        `/api/warengruppen/strategien/${strategyId}/markt/supplier_power/vorschlag/uebernehmen`,
      ),
    );
  });

  it('ohne KI füllt das Team eine Kraft von Hand aus', async () => {
    market = {
      ...market,
      forces: [],
      confirmedCount: 0,
      researchedAt: null,
      synthesisDraft: null,
      sourceCount: 0,
    };
    renderAt(`/warengruppen/${group}/strategie/5`);
    expect(await screen.findByRole('button', { name: 'Recherche starten' })).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Von Hand ausfüllen' })[5] as HTMLElement,
    );
    const form = screen.getByRole('form', { name: 'Anpassen: Wettbewerb im Markt' });
    fireEvent.change(within(form).getByLabelText('Einschätzung in 3 bis 5 Jahren'), {
      target: { value: 'low' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern und bestätigen' }));
    expect(await within(form).findByText('Bitte mindestens einen Punkt eintragen.')).toBeTruthy();
    fireEvent.change(within(form).getByLabelText(/Begründung, ein Punkt je Zeile/), {
      target: { value: 'Viele Anbieter\nGeringe Unterschiede' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern und bestätigen' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        method: 'PUT',
        url: `/api/warengruppen/strategien/${strategyId}/markt/rivalry`,
        body: {
          today: 'high',
          future: 'low',
          relevant: true,
          points: ['Viele Anbieter', 'Geringe Unterschiede'],
        },
      }),
    );
  });
  it('KI-08: das Protokoll zeigt Schritte, Quellen, Verworfenes und was nach außen ging', async () => {
    market = {
      ...market,
      publicResearch: true,
      run: {
        id: uuid(60),
        status: 'done',
        createdAt: '2026-11-23T09:00:00Z',
        startedBy: 'Lena Berger',
        publicResearch: true,
        steps: (
          [
            'plan',
            'own_data',
            'public_sources',
            'forces',
            'check',
            'implications',
            'drafts',
          ] as const
        ).map((key) => ({ key, status: 'done' as const })),
        ownSources: ['Interne Analyse · Volumen', 'Spend 2025 der Warengruppe'],
        publicSources: [
          {
            title: 'Kupferindex Monatsstand',
            url: 'https://index-one.example.test/kupfer',
            publisher: 'Index One',
            publishedOn: '2026-10-23',
          },
        ],
        discardedSources: [{ title: 'Marktbericht 2022', reason: 'too_old' }],
        outbound: [{ text: 'Leiterplatten Marktentwicklung', sentAt: '2026-11-23T09:00:01Z' }],
        blockedQueries: 1,
        discardedPoints: [{ text: 'Die Kapazität wird ab 2028 knapp.', reason: 'not_supported' }],
        created: { forces: 6, opportunities: 1, threats: 1, levers: 2 },
      },
    };
    renderAt(`/warengruppen/${group}/strategie/5`);
    expect(await screen.findByText('Was Reziproq gemacht hat')).toBeTruthy();
    expect(screen.getByText(/sowie öffentliche Quellen/)).toBeTruthy();
    expect(screen.getByText('5. Aussagen gegen Quellen prüfen')).toBeTruthy();
    expect(
      screen.getByText('Die Kapazität wird ab 2028 knapp. · Quelle stützt die Aussage nicht'),
    ).toBeTruthy();
    expect(screen.getByText('Marktbericht 2022 · älter als 24 Monate')).toBeTruthy();
    expect(screen.getByText('Leiterplatten Marktentwicklung')).toBeTruthy();
    expect(
      screen.getByText('1 Suchfrage nicht gesendet: Sie enthielt Zahlen aus euren Daten.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Kupferindex Monatsstand' })).toBeTruthy();
  });
});
