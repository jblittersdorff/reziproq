// @vitest-environment jsdom
import type { CustomerList, SearchResults } from '@reziproq/shared';
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

// Tests zu docs/specs/QS-05.md in der Oberfläche: Treffer über der KI-Antwort ab drei Zeichen,
// gruppiert nach Art, ein Klick führt zum Ort; Lieferanten suchen nur im aktuellen Kunden.

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
const idA = uuid(10);
const idB = uuid(11);
const customers: CustomerList = {
  customers: [
    { relationshipId: idA, name: 'Test-OEM (Demo)', nextMeeting: null },
    { relationshipId: idB, name: 'Zweit-OEM (Demo)', nextMeeting: null },
  ],
};
const results = (query: string): SearchResults => ({
  query,
  suppliers: [
    {
      id: uuid(1),
      title: 'Rheintal Elektronik GmbH',
      detail: 'L-10001',
      href: `/lieferanten/${uuid(1)}`,
    },
  ],
  initiatives: [
    {
      id: uuid(2),
      title: 'Kostensenkung Leiterplatten',
      detail: 'Rheintal Elektronik GmbH',
      href: `/lieferanten/${uuid(1)}/plan/initiativen/${uuid(2)}`,
    },
  ],
  actions: [],
});
let searches: string[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  searches = [];
  api.handle = ({ url }) => {
    if (url.startsWith('/api/suche?')) {
      searches.push(url);
      const q = new URLSearchParams(url.split('?')[1]).get('q') ?? '';
      return Response.json(results(q));
    }
    if (url === '/api/kunden') return Response.json(customers);
    return undefined;
  };
});

afterEach(tearDownApp);

describe('QS-05 Suche', () => {
  it('Treffer erscheinen beim Tippen ab drei Zeichen, nach Art gruppiert, ohne KI', async () => {
    api.permissions = actionsFor.admin;
    renderAt('/fragen');
    const field = await screen.findByLabelText('Deine Frage an Reziproq');
    fireEvent.change(field, { target: { value: 'Ko' } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(searches).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Treffer' })).toBeNull();

    fireEvent.change(field, { target: { value: 'Kosten' } });
    const hits = await screen.findByRole('region', { name: 'Treffer' });
    const initiatives = await within(hits).findByRole('region', { name: 'Initiativen' });
    expect(
      within(initiatives)
        .getByRole('link', { name: /Kostensenkung Leiterplatten/ })
        .getAttribute('href'),
    ).toBe(`/lieferanten/${uuid(1)}/plan/initiativen/${uuid(2)}`);
    expect(within(hits).getByRole('region', { name: 'Lieferanten' })).toBeTruthy();
    // Arten ohne Treffer fehlen; die KI wurde nicht gefragt.
    expect(within(hits).queryByRole('region', { name: 'Maßnahmen' })).toBeNull();
    expect(api.promptRequests).toEqual([]);
    expect(searches.at(-1)).toBe('/api/suche?q=Kosten');
  });

  it('Lieferanten suchen nur im aktuellen Kunden und können den Kunden wechseln', async () => {
    api.me = {
      ...anna,
      organization: { id: 'org-lieferant', name: 'Test-Lieferant (Demo)' },
      orgRole: 'admin',
      permissions: {
        viewOrganizationSettings: true,
        viewBuyerAreas: false,
        viewSuppliers: false,
        viewCustomers: true,
        switchCustomer: false,
      },
    };
    api.permissions = ['organisation.sehen', 'start.sehen', 'kunden.sehen', 'suche.nutzen'];
    renderAt(`/fragen?kunde=${idB}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Suchen' })).toBeTruthy();
    // Keine KI-Fragen auf der Lieferantenseite
    expect(screen.queryByLabelText('Deine Frage an Reziproq')).toBeNull();
    const select = (await screen.findByLabelText('Kunde')) as HTMLSelectElement;
    expect(select.value).toBe(idB);
    fireEvent.change(screen.getByLabelText('Suchwort'), { target: { value: 'Kosten' } });
    await waitFor(() => expect(searches.at(-1)).toBe(`/api/suche?q=Kosten&kunde=${idB}`));
    fireEvent.change(select, { target: { value: idA } });
    await waitFor(() => expect(searches.at(-1)).toBe(`/api/suche?q=Kosten&kunde=${idA}`));
    // Suchen oder fragen steht in der Seitenleiste des Lieferanten, „Frag“ in der Tab-Leiste.
    expect(screen.getAllByRole('link', { name: 'Suchen oder fragen' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Frag' }).length).toBeGreaterThan(0);
  });
});
