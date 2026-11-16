import type {
  Action,
  CustomersResponse,
  MeResponse,
  OrganizationResponse,
  PromptEvent,
  Supplier,
  SuppliersResponse,
} from '@reziproq/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render } from '@testing-library/react';
import { expect, vi } from 'vitest';
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
  locale: 'de',
  categoryLabel: { singular: 'Warengruppe', plural: 'Warengruppen' },
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
    },
    {
      id: 'ben',
      name: 'Ben Weber',
      email: 'ben@example.com',
      orgRole: 'admin',
      isControlling: true,
      defaultFunction: 'quality',
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
  if (!authorized && !url.startsWith('/api/einladungen/') && !url.startsWith('/api/umfrage/')) {
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
  return Response.json({ statusCode: 404 }, { status: 404 });
}

let consoleError: ReturnType<typeof vi.spyOn> | undefined;

/** In beforeEach aufrufen: setzt API, Browser-Ersatz und Konsolen-Wächter zurück. */
export function setUpApp() {
  api.me = anna;
  api.permissions = actionsFor.member;
  api.meStatus = 200;
  api.suppliers = { status: 200, body: sampleSuppliers };
  api.prompt = { status: 200, events: [], hold: false };
  api.promptRequests = [];
  api.requests = [];
  api.organization = sampleOrganization;
  api.handle = undefined;
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
