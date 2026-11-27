import type {
  Action,
  CustomersResponse,
  MeResponse,
  MyDay,
  OrganizationResponse,
  PromptEvent,
  RelationshipRow,
  RelationshipSegments,
  RelationshipsResponse,
  SegmentSupplier,
  Supplier,
  SuppliersResponse,
  TodayAll,
  TodayPage,
} from '@reziproq/shared';
import { defaultOrgModules } from '@reziproq/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { resetBusinessTime } from '@/lib/clock';
import { LocaleProvider } from '@/lib/i18n';
import { routeTree } from '@/routeTree.gen';

// Gemeinsamer Aufbau für Oberflächentests mit jsdom: echter Router, nachgebauter Login,
// nachgebaute API. Die vi.mock-Aufrufe für react-oidc-context und @/lib/auth stehen in jeder
// Testdatei selbst, weil Vitest sie nur dort an den Dateianfang hebt.

export const accessToken = 'access-token-1';

export const signedIn = {
  isLoading: false,
  error: undefined,
  user: { access_token: accessToken, expired: false },
  signinRedirect: vi.fn(),
  signoutRedirect: vi.fn(),
};

export const anna: MeResponse = {
  name: 'Anna Schmidt',
  firstName: 'Anna',
  email: 'anna@example.com',
  organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
  supportView: false,
  orgRole: 'member',
  isControlling: false,
  isOperator: false,
  pendingApproval: false,
  locale: 'de',
  categoryLabel: { singular: 'Warengruppe', plural: 'Warengruppen' },
  modules: defaultOrgModules,
  permissions: {
    viewOrganizationSettings: true,
    viewBuyerAreas: true,
    viewSuppliers: true,
    viewCustomers: false,
    switchCustomer: false,
  },
};

/** Was eine Person je Rolle darf, wie GET /api/me/permissions es liefert (PLT-05). */
export const actionsFor: Record<'admin' | 'member' | 'viewer', Action[]> = {
  admin: [
    'organisation.sehen',
    'rollen.aendern',
    'einstellungen.verwalten',
    'lieferanten.sehen',
    'lieferanten.bearbeiten',
    'team.festlegen',
    'verlauf.sehen',
    'prompt.nutzen',
    'stammdaten.verwalten',
    'zuordnung.bearbeiten',
    'segmentmodell.sehen',
    'segmentmodell.verwalten',
    'runden.sehen',
    'runden.verwalten',
    'runden.nachnominieren',
    'bewertungen.sehen',
    'bewertungen.abgeben',
    'segmentierung.konsolidieren',
    'portfolio.sehen',
    'fokus.setzen',
    'zyklus.starten',
    'lieferantenplan.bearbeiten',
    'datenexport.anfordern',
    'hinweise.sehen',
    'suche.nutzen',
    'hinweise.entscheiden',
    'hinweise.einstellen',
    'warengruppen.sehen',
    'warengruppen.team',
    'warengruppenstrategie.bearbeiten',
    'warengruppen.segmentieren',
    'aktivitaeten.sehen',
    'notizen.schreiben',
  ],
  member: [
    'organisation.sehen',
    'lieferanten.sehen',
    'lieferanten.bearbeiten',
    'verlauf.sehen',
    'prompt.nutzen',
    'zuordnung.bearbeiten',
    'segmentmodell.sehen',
    'runden.sehen',
    'runden.nachnominieren',
    'bewertungen.sehen',
    'bewertungen.abgeben',
    'segmentierung.konsolidieren',
    'portfolio.sehen',
    'zyklus.starten',
    'lieferantenplan.bearbeiten',
    'hinweise.sehen',
    'suche.nutzen',
    'hinweise.entscheiden',
    'warengruppen.sehen',
    'warengruppen.team',
    'warengruppenstrategie.bearbeiten',
    'warengruppen.segmentieren',
    'aktivitaeten.sehen',
    'notizen.schreiben',
  ],
  viewer: [
    'organisation.sehen',
    'lieferanten.sehen',
    'verlauf.sehen',
    'prompt.nutzen',
    'segmentmodell.sehen',
    'runden.sehen',
    'bewertungen.sehen',
    'portfolio.sehen',
    'hinweise.sehen',
    'suche.nutzen',
    'warengruppen.sehen',
    'aktivitaeten.sehen',
  ],
};

const mio = (euro: number) => Math.round(euro * 1_000_000 * 100);
const supplier = (
  name: string,
  country: string | null,
  externalRef: string | null,
  spend: number | null,
  status: Supplier['status'] = 'active',
  /** Warengruppen (PLT-06), die Haupt-Warengruppe zuerst */
  materialGroups: string[] = [],
): Supplier => ({
  relationshipId: `rel-${name}`,
  name,
  country,
  externalRef,
  status,
  spend: spend === null ? null : { amountCents: spend, currency: 'EUR' },
  primaryMaterialGroup: materialGroups[0] ?? null,
  materialGroups,
});

/**
 * Lieferanten, wie GET /api/suppliers sie liefert: nach Spend absteigend, ohne Spend zuletzt.
 * Drei aktive, ein Entwurf und eine beendete Beziehung; Anzahl und Summe ohne die beendete.
 */
export const sampleSuppliers: SuppliersResponse = {
  suppliers: [
    supplier('Rheintal Elektronik GmbH (Demo)', 'DE', 'L-10001', mio(4.82), 'active', [
      'Elektronik',
      'Kabel',
    ]),
    supplier('Silesia Guss Sp. z o.o. (Demo)', 'PL', 'L-10002', mio(3.15), 'active', ['Guss']),
    supplier('Lombardia Fonderie S.p.A. (Demo)', 'IT', 'L-10004', mio(2.71), 'ended'),
    supplier('Alpen Sensorik GmbH (Demo)', 'AT', 'L-10006', mio(2.26)),
    supplier('Test-Lieferant (Demo)', 'DE', null, null, 'draft'),
  ],
  count: 4,
  spendYear: 2025,
  totalSpend: [{ amountCents: mio(10.23), currency: 'EUR' }],
};

const relationshipId = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const eur = (euro: number) => ({ amountCents: mio(euro), currency: 'EUR' });
const strategic = { key: '3-3', name: 'Strategisch' };
const relationshipRow = (overrides: Partial<RelationshipRow>): RelationshipRow => ({
  relationshipId: relationshipId(99),
  name: 'Lieferant',
  status: 'active',
  country: 'DE',
  materialGroup: null,
  spend: null,
  reason: null,
  attention: 0,
  segment: null,
  disputed: false,
  quota: null,
  isMine: false,
  isFocus: false,
  openCommitments: 0,
  businessUnitIds: [],
  materialGroupIds: [],
  targetType: null,
  categorySegments: [],
  ...overrides,
});
const quote = (kept: number, due: number) => ({
  kept,
  due,
  percent: Math.round((100 * kept) / due),
});

/**
 * Seite Lieferanten (BZ-01), wie GET /api/beziehungen sie liefert: vier aktive Beziehungen nach
 * Aufmerksamkeit. Mit `portfolio=1` kommt der Entwurf dazu, mit `beendet=1` die beendete.
 */
export const sampleRelationships: RelationshipsResponse = {
  year: 2026,
  head: { active: 4, spend: [eur(11.83)], portfolio: 5 },
  counts: { alle: 4, meine: 2, strategisch: 2, offeneZusagen: 2 },
  rows: [
    relationshipRow({
      relationshipId: relationshipId(1),
      name: 'Rheintal Elektronik GmbH (Demo)',
      materialGroup: 'Leiterplatten',
      spend: eur(4.82),
      reason: { kind: 'overdue', count: 1, title: '8D-Bericht Charge 4711' },
      attention: 5,
      segment: strategic,
      quota: { own: quote(9, 10), counterpart: quote(7, 9) },
      isMine: true,
      isFocus: true,
      openCommitments: 2,
      businessUnitIds: ['bu-1'],
      materialGroupIds: ['mg-lp'],
      targetType: strategic,
      categorySegments: [{ materialGroupId: 'mg-lp', key: '1-1', name: 'Hebeln' }],
    }),
    relationshipRow({
      relationshipId: relationshipId(2),
      name: 'Silesia Guss Sp. z o.o. (Demo)',
      country: 'PL',
      materialGroup: 'Sandguss',
      spend: eur(3.15),
      reason: {
        kind: 'hint',
        hint: {
          id: relationshipId(50),
          ruleKey: 'performance_drop',
          severity: 'high',
          status: 'in_progress',
          title: '„Liefertreue“ seit 3 Monaten unter Ziel und schlechter',
          metric: 'Liefertreue',
          value: '86 %',
        },
      },
      attention: 4,
      segment: strategic,
      quota: { own: quote(5, 5), counterpart: quote(3, 5) },
      isMine: true,
      isFocus: true,
      openCommitments: 1,
      businessUnitIds: ['bu-1'],
      materialGroupIds: ['mg-gu-sand'],
      targetType: strategic,
    }),
    relationshipRow({
      relationshipId: relationshipId(3),
      name: 'Kessler Präzision GmbH (Demo)',
      materialGroup: 'Drehteile',
      spend: eur(1.6),
      reason: { kind: 'disputed' },
      attention: 3,
      segment: { key: '3-1', name: 'Entwickeln' },
      disputed: true,
      quota: { own: quote(7, 8), counterpart: quote(4, 5) },
      businessUnitIds: ['bu-1'],
      materialGroupIds: ['mg-dt'],
      targetType: strategic,
    }),
    relationshipRow({
      relationshipId: relationshipId(4),
      name: 'Alpen Sensorik GmbH (Demo)',
      country: 'AT',
      materialGroup: 'Sensorik',
      spend: eur(2.26),
      reason: { kind: 'unrated' },
      attention: 2,
      businessUnitIds: ['bu-2'],
      materialGroupIds: ['mg-se'],
    }),
  ],
  summary: {
    keptBetter: 2,
    unrated: {
      relationshipId: relationshipId(4),
      name: 'Alpen Sensorik GmbH (Demo)',
      spend: eur(2.26),
      largest: false,
    },
    rows: [
      {
        kind: 'counterpart_low',
        relationshipId: relationshipId(2),
        name: 'Silesia Guss Sp. z o.o. (Demo)',
        kept: 3,
        due: 5,
        hint: {
          id: relationshipId(50),
          ruleKey: 'performance_drop',
          severity: 'high',
          status: 'in_progress',
          title: null,
          metric: 'Liefertreue',
          value: '86 %',
        },
      },
      {
        kind: 'unrated',
        relationshipId: relationshipId(4),
        name: 'Alpen Sensorik GmbH (Demo)',
        spend: eur(2.26),
      },
      {
        kind: 'quota_gap',
        relationshipId: relationshipId(1),
        name: 'Rheintal Elektronik GmbH (Demo)',
        own: 90,
        counterpart: 78,
        overdue: { count: 1, title: '8D-Bericht Charge 4711' },
      },
    ],
  },
  filters: {
    businessUnits: [
      { id: 'bu-1', name: 'Antriebstechnik' },
      { id: 'bu-2', name: 'Sensorsysteme' },
    ],
    materialGroups: [
      { id: 'mg-lp', name: 'Leiterplatten', parentId: null },
      { id: 'mg-gu', name: 'Guss', parentId: null },
      { id: 'mg-gu-sand', name: 'Sandguss', parentId: 'mg-gu' },
      { id: 'mg-dt', name: 'Drehteile', parentId: null },
      { id: 'mg-se', name: 'Sensorik', parentId: null },
    ],
    targetTypes: [
      strategic,
      { key: '3-1', name: 'Entwickeln' },
      { key: '1-3', name: 'Absichern' },
      { key: '1-1', name: 'Hebeln' },
    ],
  },
};

/** Entwurf aus dem Import (E-K2-10) und eine beendete Beziehung (PLT-03) */
export const sampleDraftRelationship = relationshipRow({
  relationshipId: relationshipId(5),
  name: 'Test-Lieferant (Demo)',
  status: 'draft',
  reason: { kind: 'unrated' },
  attention: 2,
});
export const sampleEndedRelationship = relationshipRow({
  relationshipId: relationshipId(6),
  name: 'Lombardia Fonderie S.p.A. (Demo)',
  status: 'ended',
  country: 'IT',
  materialGroup: 'Guss',
  spend: eur(2.71),
  segment: { key: '1-1', name: 'Hebeln' },
});

/** Lieferant in einem Feld der Linse Segmente; Entwürfe ohne Anbindung mit `status: 'draft'` */
const segmentSupplier = (
  n: number,
  name: string,
  spend: number | null,
  extra: Partial<SegmentSupplier> = {},
): SegmentSupplier => ({
  relationshipId: relationshipId(n),
  name,
  status: 'active',
  spend: spend === null ? null : eur(spend),
  disputed: false,
  ...extra,
});
const importedSuppliers = (from: number, prefix: string, count: number, spend: number) =>
  Array.from({ length: count }, (_, index) =>
    segmentSupplier(from + index, `${prefix} ${index + 1}`, spend, { status: 'draft' }),
  );
const kesslerId = relationshipId(103);

/**
 * Linse Segmente (BZ-01, K2-b.5), wie GET /api/beziehungen/segmente sie liefert, mit den Zahlen
 * von Hollmann (T2-03): Modell 2 × 2, Felder Entwickeln 9, Strategisch 8, Hebeln 9, Absichern 12,
 * Kessler strittig, 8 ohne Bewertung mit Pearl River als größtem.
 */
export const sampleSegments: RelationshipSegments = {
  year: 2026,
  model: {
    id: '00000000-0000-7000-8000-000000000a01',
    version: 1,
    gridSize: 2,
    impactLabel: 'Versorgungsrisiko',
    qualityLabel: 'Wertbeitrag',
  },
  portfolio: 46,
  rated: 38,
  ratedSpend: [eur(38)],
  round: {
    id: '00000000-0000-7000-8000-000000000a02',
    name: 'Bewertungsrunde 2027',
    dueDate: '2026-12-19',
  },
  fields: [
    {
      key: '2-1',
      impactLevel: 2,
      qualityLevel: 1,
      name: 'Entwickeln',
      count: 9,
      spend: [eur(4.3)],
      suppliers: [
        segmentSupplier(103, 'Kessler Präzision GmbH (Demo)', 1.6, { disputed: true }),
        segmentSupplier(105, 'Alpen Kunststofftechnik GmbH (Demo)', 1.3),
        ...importedSuppliers(200, 'Entwicklung', 7, 0.2),
      ],
    },
    {
      key: '2-2',
      impactLevel: 2,
      qualityLevel: 2,
      name: 'Strategisch',
      count: 8,
      spend: [eur(18.4)],
      suppliers: [
        segmentSupplier(101, 'Rheintal Elektronik GmbH (Demo)', 4.2),
        segmentSupplier(102, 'Silesia Guss Sp. z o.o. (Demo)', 3.15),
        segmentSupplier(109, 'Nordwerk Guss GmbH (Demo)', 1.6),
        segmentSupplier(112, 'Saar Circuits GmbH (Demo)', 1.4),
        ...importedSuppliers(210, 'Strategie', 4, 2),
      ],
    },
    {
      key: '1-1',
      impactLevel: 1,
      qualityLevel: 1,
      name: 'Hebeln',
      count: 9,
      spend: [eur(9.1)],
      suppliers: [
        segmentSupplier(106, 'Lombardia Fonderie S.p.A. (Demo)', 2.71),
        segmentSupplier(108, 'Moravia Plast s.r.o. (Demo)', 1.94),
        segmentSupplier(114, 'Moldau PCB s.r.o. (Demo)', 0.9),
        segmentSupplier(115, 'Weser PCB GmbH (Demo)', 0.7),
        ...importedSuppliers(220, 'Hebel', 5, 0.5),
      ],
    },
    {
      key: '1-2',
      impactLevel: 1,
      qualityLevel: 2,
      name: 'Absichern',
      count: 12,
      spend: [eur(6.2)],
      suppliers: [
        segmentSupplier(107, 'Alpen Sensorik GmbH (Demo)', 2.26),
        segmentSupplier(110, 'Baltic Logistics (Demo)', 1.1),
        segmentSupplier(111, 'Hanse Verpackung GmbH (Demo)', 0.6),
        segmentSupplier(113, 'Donau Print GmbH (Demo)', 0.5),
        segmentSupplier(116, 'Elbe Kabelwerk GmbH (Demo)', 0.5),
        ...importedSuppliers(230, 'Absicherung', 7, 0.2),
      ],
    },
  ],
  unrated: {
    count: 8,
    spend: [eur(6.9)],
    suppliers: [
      segmentSupplier(104, 'Pearl River Components Ltd. (Demo)', 5.64),
      ...importedSuppliers(240, 'Ohne', 7, 0.18),
    ],
  },
  summary: {
    top: { key: '2-2', name: 'Strategisch', count: 8, spend: [eur(18.4)], share: 48 },
    disputed: [
      {
        relationshipId: kesslerId,
        name: 'Kessler Präzision GmbH (Demo)',
        criterion: { key: 'qualitaet', name: 'Qualität' },
        min: 25,
        max: 100,
        decidesSegment: true,
      },
    ],
  },
};

export const sampleOrganization: OrganizationResponse = {
  name: 'Beispiel-OEM (Demo)',
  country: 'DE',
  members: [
    {
      id: 'anna',
      name: 'Anna Schmidt',
      email: 'anna@example.com',
      orgRole: 'member',
      isControlling: false,
      defaultFunction: null,
      approvalPending: false,
    },
    {
      id: 'ben',
      name: 'Ben Weber',
      email: 'ben@example.com',
      orgRole: 'admin',
      isControlling: true,
      defaultFunction: 'quality',
      approvalPending: false,
    },
  ],
};

/** Antworten der nachgebauten API; jeder Test kann sie vor dem Rendern ändern. */
export const api = {
  me: anna as MeResponse,
  /** Antwort von GET /api/me/permissions */
  permissions: actionsFor.member as Action[],
  /** Status von GET /api/me; alles außer 200 lässt die Anfrage scheitern. */
  meStatus: 200,
  suppliers: { status: 200, body: sampleSuppliers as unknown },
  /** GET /api/beziehungen (BZ-01): Antwort; drafts und ended kommen mit portfolio=1 und beendet=1 */
  relationships: {
    status: 200,
    body: sampleRelationships as unknown,
    drafts: [sampleDraftRelationship] as RelationshipRow[],
    ended: [sampleEndedRelationship] as RelationshipRow[],
  },
  /** GET /api/beziehungen/segmente (BZ-01, K2-b.5) */
  relationshipSegments: { status: 200, body: sampleSegments as unknown },
  /** Antwort von POST /api/prompt; mit hold bleibt der Strom offen (Ladezustand). */
  prompt: { status: 200, events: [] as PromptEvent[], hold: false },
  /** Alle Anfragen an /api/prompt, z. B. um den mitgeschickten Verlauf zu prüfen. */
  promptRequests: [] as unknown[],
  /** Kunden für Betreiber (PLT-13). */
  customers: {
    customers: [
      { id: 'org-1', name: 'Beispiel-OEM (Demo)', country: 'DE' },
      { id: 'org-2', name: 'Zweit-OEM (Demo)', country: 'AT' },
    ],
  } as CustomersResponse,
  /** Eigene Organisation mit Mitgliedern (PLT-02). */
  organization: sampleOrganization as OrganizationResponse,
  /**
   * Eigene Antworten eines Tests, z. B. für Anlegen und Ändern von Lieferanten (PLT-03b).
   * Liefert die Funktion nichts, antwortet die nachgebaute API wie sonst.
   */
  handle: undefined as
    | ((request: { method: string; url: string; body: unknown }) => Response | undefined)
    | undefined,
  /** Je Anfrage: Pfad und der mitgeschickte Kunde aus x-reziproq-support-org (oder null). */
  requests: [] as { url: string; customer: string | null }[],
  /** Antwort von GET /api/heute (HE-01, NAV-10 2.0): Seite Heute, Zahl an Heute, „Im Hintergrund“ */
  today: undefined as TodayPage | undefined,
  /** Antwort von GET /api/heute/alles (HE-01, K1-e): Ansicht Alles */
  todayAll: undefined as TodayAll | undefined,
};

/** Streamt Ereignisse als NDJSON, eine Zeile je Ereignis, wie die echte API. */
function streamEvents(events: PromptEvent[], hold: boolean) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events)
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        if (!hold) controller.close();
      },
    }),
    { headers: { 'content-type': 'application/x-ndjson' } },
  );
}

function fakeApi(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const headers = new Headers(init?.headers);
  const authorized = headers.get('authorization') === `Bearer ${accessToken}`;
  api.requests.push({ url, customer: headers.get('x-reziproq-support-org') });
  if (url === '/api/health') return Response.json({ status: 'ok' });
  // Der Einladungslink ist öffentlich (LIF-01a): ohne Token, nur über eigene Antworten des Tests.
  if (
    !authorized &&
    !url.startsWith('/api/einladungen/') &&
    !url.startsWith('/api/umfrage/') &&
    // IN-02: Hinweis zur Firmenanmeldung auf der Anmeldeseite, ohne Login
    !url.startsWith('/api/anmeldung/') &&
    // DM-01, E-K0-05: Demo-Sitzung im Demo-Mandanten, ohne Login
    !url.startsWith('/api/demo/')
  ) {
    return Response.json({ statusCode: 401 }, { status: 401 });
  }
  const own = api.handle?.({
    method: init?.method ?? 'GET',
    url,
    body: init?.body
      ? headers.get('content-type')?.includes('application/json')
        ? JSON.parse(String(init.body))
        : init.body
      : undefined,
  });
  if (own) return own;
  if (url === '/api/me/permissions') return Response.json({ actions: api.permissions });
  if (url === '/api/me') {
    return api.meStatus === 200
      ? Response.json(api.me)
      : Response.json({ statusCode: api.meStatus }, { status: api.meStatus });
  }
  if (url === '/api/betreiber/kunden') return Response.json(api.customers);
  // IN-01: Profil › Meine Verbindungen; ohne eigene Antwort des Tests noch nichts verbunden
  if (url === '/api/profil/verbindungen') {
    return Response.json({ connections: [], available: ['microsoft365', 'google_workspace'] });
  }
  if (url === '/api/organisation') return Response.json(api.organization);
  if (url === '/api/prompt') {
    api.promptRequests.push(JSON.parse(String(init?.body)));
    if (api.prompt.status !== 200) {
      return Response.json({ statusCode: api.prompt.status }, { status: api.prompt.status });
    }
    return streamEvents(api.prompt.events, api.prompt.hold);
  }
  if (url === '/api/suppliers') {
    return Response.json(api.suppliers.body, { status: api.suppliers.status });
  }
  if (url === '/api/beziehungen/segmente') {
    return Response.json(api.relationshipSegments.body, {
      status: api.relationshipSegments.status,
    });
  }
  if (url === '/api/beziehungen' || url.startsWith('/api/beziehungen?')) {
    const { status, body, drafts, ended } = api.relationships;
    if (status !== 200) return Response.json(body, { status });
    const query = new URL(url, 'http://reziproq.test').searchParams;
    const response = body as RelationshipsResponse;
    return Response.json({
      ...response,
      rows: [
        ...response.rows,
        ...(query.get('portfolio') === '1' ? drafts : []),
        ...(query.get('beendet') === '1' ? ended : []),
      ],
    });
  }
  // NAV-10 1.1: Mein Tag, Terminschiene, „Als Nächstes“ und „Brauchen dich“ ohne eigene Antwort leer
  if (url === '/api/start/mein-tag') return Response.json(myDayResponse());
  if (url.startsWith('/api/start/termine')) {
    const today = localDay();
    return Response.json({ from: today, to: today, items: [] });
  }
  if (url.startsWith('/api/start/als-naechstes')) return Response.json({ next: null });
  if (url === '/api/start/brauchen-dich') return Response.json({ items: [] });
  if (url === '/api/heute') return Response.json(api.today ?? todayResponse());
  if (url === '/api/heute/alles') return Response.json(api.todayAll ?? todayAllResponse());
  return Response.json({ statusCode: 404 }, { status: 404 });
}

/**
 * Heute nach Ortszeit (in Tests Berlin) wie in der API, nicht nach UTC: Sonst ist es zwischen
 * 00:00 und 01:00 (im Sommer 02:00) noch gestern, und Fristen in Tagen weichen um einen Tag ab.
 */
function localDay(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Antwort von /api/heute; ohne Angaben nichts offen und nichts im Hintergrund */
export function todayResponse(overrides: Partial<TodayPage> = {}): TodayPage {
  const today = localDay();
  return {
    today,
    next: null,
    more: [],
    openFocus: 0,
    review: { count: 0, minutes: 0 },
    done: { since: new Date(`${today}T00:00:00Z`).toISOString(), count: 0, tasks: [] },
    background: null,
    summary: { sentence: 'Nichts braucht dich gerade.', facts: [], sources: [] },
    drafts: [],
    week: [],
    waiting: [],
    waitingTotal: 0,
    counts: { forYou: 0, others: 0, hints: 0, commitments: 0 },
    ...overrides,
  };
}

/** Antwort von /api/heute/alles; ohne Angaben nichts offen */
export function todayAllResponse(overrides: Partial<TodayAll> = {}): TodayAll {
  return {
    today: localDay(),
    forYou: [],
    drafts: { rows: [], minutes: 0 },
    others: [],
    hints: [],
    assign: [],
    commitments: { open: 0, relationships: 0, next: null },
    doneCount: 0,
    relationships: [],
    materialGroups: [],
    ...overrides,
  };
}

/** Antwort von /api/start/mein-tag; ohne Angaben ein ruhiger Tag ohne Aufgaben */
export function myDayResponse(overrides: Partial<MyDay> = {}): MyDay {
  return {
    today: localDay(),
    next: null,
    todayItems: [],
    week: [],
    total: 0,
    doneToday: 0,
    prepared: [],
    preparedTotal: 0,
    waiting: [],
    waitingTotal: 0,
    timeline: [],
    hints: null,
    ...overrides,
  };
}

let consoleError: ReturnType<typeof vi.spyOn> | undefined;

/** In beforeEach aufrufen: setzt API, Browser-Ersatz und Konsolen-Wächter zurück. */
export function setUpApp() {
  api.me = anna;
  api.permissions = actionsFor.member;
  api.meStatus = 200;
  api.suppliers = { status: 200, body: sampleSuppliers };
  api.relationships = {
    status: 200,
    body: sampleRelationships,
    drafts: [sampleDraftRelationship],
    ended: [sampleEndedRelationship],
  };
  api.relationshipSegments = { status: 200, body: sampleSegments };
  api.prompt = { status: 200, events: [], hold: false };
  api.promptRequests = [];
  api.requests = [];
  api.organization = sampleOrganization;
  api.handle = undefined;
  api.today = undefined;
  api.todayAll = undefined;
  sessionStorage.clear();
  // jsdom kennt kein Scrollen; der Router springt zu Abschnitten wie #strategie (UMB-05).
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
  // Wie ein deutscher Browser; Tests auf Englisch setzen browserLanguages selbst (PLT-09).
  browserLanguages(['de-DE', 'de']);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => fakeApi(input, init)),
  );
  // jsdom kennt keinen ResizeObserver; Radix braucht ihn für Schalter in Formularen.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  consoleError = vi.spyOn(console, 'error');
}

/** In afterEach aufrufen: Keine Seite darf Fehler in die Konsole schreiben. */
/** Sprachen, die der nachgebaute Browser meldet (navigator.languages). */
let languagesSpy: { mockRestore: () => void } | undefined;
export function browserLanguages(languages: string[]) {
  languagesSpy?.mockRestore();
  languagesSpy = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
}

export function tearDownApp() {
  cleanup();
  languagesSpy?.mockRestore();
  languagesSpy = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  // DM-01 (K1-b.5): Die Fachzeit eines Demo-Tests gilt nicht für den nächsten Test im Worker
  resetBusinessTime();
  expect(consoleError).not.toHaveBeenCalled();
  consoleError?.mockRestore();
}

export function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  });
  render(
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </LocaleProvider>,
  );
  return router;
}
