// @vitest-environment jsdom
import type { CustomerList, CustomerWorkspace, StartData } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anna, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Oberflächentests zu docs/specs/LIF-02.md: Arbeitsbereich der Lieferantenseite.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const idA = '0190a0a0-0000-7000-8000-00000000000a';
const idB = '0190a0a0-0000-7000-8000-00000000000b';
const list: CustomerList = {
  customers: [
    { relationshipId: idA, name: 'Test-OEM (Demo)', nextMeeting: null },
    { relationshipId: idB, name: 'Zweit-OEM (Demo)', nextMeeting: '2026-12-03' },
  ],
};
const workspace = (relationshipId: string, name: string): CustomerWorkspace => ({
  relationshipId,
  name,
  relationshipType: null,
  nextMeeting: null,
});
const start: StartData = {
  due: { items: [], total: 0 },
  relationships: {
    items: list.customers.map((customer) => ({
      id: customer.relationshipId,
      name: customer.name,
      target: null,
    })),
    total: 2,
  },
  nextMeeting: null,
  portfolio: null,
  openActions: 0,
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = {
    ...anna,
    name: 'Kim Kaiser',
    firstName: 'Kim',
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
  api.permissions = ['organisation.sehen', 'start.sehen', 'kunden.sehen'];
  api.handle = ({ url }) => {
    if (url === '/api/kunden') return Response.json(list);
    if (url === `/api/kunden/${idA}`) return Response.json(workspace(idA, 'Test-OEM (Demo)'));
    if (url === `/api/kunden/${idB}`) return Response.json(workspace(idB, 'Zweit-OEM (Demo)'));
    if (url.startsWith('/api/kunden/')) return Response.json({}, { status: 404 });
    if (url === '/api/start') return Response.json(start);
    return undefined;
  };
});

afterEach(tearDownApp);

describe('LIF-02 Arbeitsbereich des Lieferanten', () => {
  it('die globale Leiste zeigt Start, Kunden und Profil, aber keine Käuferbereiche', async () => {
    renderAt('/kunden');
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' });
    await waitFor(() => expect(within(nav).getByRole('link', { name: 'Kunden' })).toBeDefined());
    expect(within(nav).getByRole('link', { name: 'Start' })).toBeDefined();
    for (const buyer of ['Lieferanten', 'Portfolio', 'Wirkung', 'Fragen']) {
      expect(within(nav).queryByRole('link', { name: buyer })).toBeNull();
    }
  });

  it('Kunden zeigt Karten aller Kunden mit nächstem Termin; eine Karte öffnet den Arbeitsbereich', async () => {
    const router = renderAt('/kunden');
    expect(await screen.findByText('Noch kein gemeinsamer Termin')).toBeDefined();
    expect(screen.getByText(/Nächster Termin: /)).toBeDefined();
    fireEvent.click(screen.getByRole('link', { name: 'Test-OEM (Demo)' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/kunden/${idA}`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Test-OEM (Demo)' })).toBeDefined();
  });

  it('die lokale Leiste hat nur gebaute Bereiche ohne Strategie (UMB-05); leere Bereiche erklären sich', async () => {
    renderAt(`/kunden/${idA}/plan`);
    const bar = await screen.findByRole('navigation', { name: 'Arbeitsbereich des Kunden' });
    const labels = within(bar)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual([
      'Test-OEM (Demo)',
      'Überblick',
      'Beziehung',
      'Gemeinsamer Plan',
      'Umsetzung',
      // PNL-07: Wirkung ist für den Lieferanten gebaut.
      'Wirkung',
    ]);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Gemeinsamer Plan' }),
    ).toBeDefined();
    // Der Bereich führt zur Vorbereitung des Joint Business Planning (JBP-01).
    expect(screen.getByRole('link', { name: /Vorbereitung/ }).getAttribute('href')).toBe(
      `/kunden/${idA}/plan/vorbereitung`,
    );
  });

  it('der Kundenwechsel behält den Bereich', async () => {
    const router = renderAt(`/kunden/${idA}/umsetzung`);
    const bar = await screen.findByRole('navigation', { name: 'Arbeitsbereich des Kunden' });
    fireEvent.click(within(bar).getByRole('link', { name: 'Test-OEM (Demo)' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/kunden'));
    expect(router.state.location.search).toEqual({ bereich: 'umsetzung' });
    expect(
      await screen.findByText('Ein Klick öffnet bei diesem Kunden den Bereich Umsetzung.'),
    ).toBeDefined();
    fireEvent.click(await screen.findByRole('link', { name: 'Zweit-OEM (Demo)' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/kunden/${idB}/umsetzung`));
  });

  it('ein unbekannter Kunde zeigt einen Hinweis', async () => {
    renderAt('/kunden/0190a0a0-0000-7000-8000-0000000000ff');
    expect((await screen.findAllByText('Diesen Kunden gibt es hier nicht')).length).toBeGreaterThan(
      0,
    );
  });

  it('Adressen des Käufers zeigen einen Hinweis statt der Seite', async () => {
    renderAt('/portfolio');
    expect(
      await screen.findByText(
        'Diese Seite gibt es nur für Käufer. Deine Kunden findest du unter Kunden.',
      ),
    ).toBeDefined();
  });

  it('Start nennt die Kunden und führt in ihren Arbeitsbereich, ohne Fragefeld', async () => {
    renderAt('/start');
    expect(await screen.findByRole('heading', { level: 2, name: 'Meine Kunden' })).toBeDefined();
    expect(screen.getByRole('link', { name: /^Zweit-OEM \(Demo\)/ }).getAttribute('href')).toBe(
      `/kunden/${idB}`,
    );
    expect(screen.queryByRole('textbox', { name: /Frage/ })).toBeNull();
  });
});
