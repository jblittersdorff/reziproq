import type {
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
import { ThemeProvider } from '@/lib/theme';
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
  roles: ['nutzer'],
  permissions: {
    viewOrganizationSettings: true,
    viewBuyerAreas: true,
    viewSuppliers: true,
    switchCustomer: false,
    manageSettings: false,
    editSuppliers: true,
  },
};

const mio = (euro: number) => Math.round(euro * 1_000_000 * 100);
const supplier = (
  name: string,
  country: string | null,
  externalRef: string | null,
  spend: number | null,
  status: Supplier['status'] = 'active',
): Supplier => ({
  relationshipId: `rel-${name}`,
  name,
  country,
  externalRef,
  status,
  spend: spend === null ? null : { amountCents: spend, currency: 'EUR' },
});

/**
 * Lieferanten, wie GET /api/suppliers sie liefert: nach Spend absteigend, ohne Spend zuletzt.
 * Drei aktive, ein Entwurf und eine beendete Beziehung; Anzahl und Summe ohne die beendete.
 */
export const sampleSuppliers: SuppliersResponse = {
  suppliers: [
    supplier('Rheintal Elektronik GmbH (Demo)', 'DE', 'L-10001', mio(4.82)),
    supplier('Silesia Guss Sp. z o.o. (Demo)', 'PL', 'L-10002', mio(3.15)),
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
    { name: 'Anna Schmidt', email: 'anna@example.com' },
    { name: 'Ben Weber', email: 'ben@example.com' },
  ],
};

/** Antworten der nachgebauten API; jeder Test kann sie vor dem Rendern ändern. */
export const api = {
  me: anna as MeResponse,
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
  /** Je Anfrage: Pfad und der mitgeschickte Kunde aus x-reziproq-kunde (oder null). */
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
  api.requests.push({ url, customer: headers.get('x-reziproq-kunde') });
  if (url === '/api/health') return Response.json({ status: 'ok' });
  if (!authorized) return Response.json({ statusCode: 401 }, { status: 401 });
  const own = api.handle?.({
    method: init?.method ?? 'GET',
    url,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  });
  if (own) return own;
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
  api.meStatus = 200;
  api.suppliers = { status: 200, body: sampleSuppliers };
  api.prompt = { status: 200, events: [], hold: false };
  api.promptRequests = [];
  api.requests = [];
  api.organization = sampleOrganization;
  api.handle = undefined;
  sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => fakeApi(input, init)),
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
export function tearDownApp() {
  cleanup();
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
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>,
  );
  return router;
}
