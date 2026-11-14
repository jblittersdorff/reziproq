// @vitest-environment jsdom
import type { SupplierDetail, TeamResponse } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportLogin } from '@/lib/api';
import { createFormat } from '@/lib/format';
import {
  actionsFor,
  anna,
  api,
  browserLanguages,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';
import { spendOverviewOf } from '@/testing/spend';

// Oberflächentests zu docs/specs/PLT-09.md: Sprache wählen, Formate je Sprache, Fehler der API.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const id = '0190a0a0-0000-7000-8000-000000000001';
const detail: SupplierDetail = {
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
  spend: [{ year: 2025, amount: { amountCents: 1_234_567_00, currency: 'EUR' } }],
  permissions: { edit: true, editTeam: true },
};
const team: TeamResponse = {
  side: 'buyer',
  counterpart: [],
  canEdit: true,
  sroDescription: null,
  members: [
    {
      userId: 'lena',
      name: 'Lena Berger',
      teamRole: 'sro',
      function: 'purchasing',
      visibility: 'shared',
    },
  ],
  candidates: [{ userId: 'lena', name: 'Lena Berger', defaultFunction: 'purchasing' }],
};

let requests: { method: string; url: string; body: unknown }[] = [];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  requests = [];
  api.handle = (request) => {
    requests.push(request);
    if (request.url === '/api/me/sprache') return new Response(null, { status: 204 });
    if (request.url === `/api/suppliers/${id}`) return Response.json(detail);
    if (request.url === `/api/suppliers/${id}/team`) {
      // Ein anderer Admin hat gerade einen SRO gesetzt: Die API meldet den Konflikt als Code.
      if (request.method === 'PUT') {
        return Response.json({ statusCode: 409, code: 'too_many_sro' }, { status: 409 });
      }
      return Response.json(team);
    }
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    return undefined;
  };
});

afterEach(tearDownApp);

describe('Sprache', () => {
  it('Die Umstellung wirkt sofort, ohne Neuladen und ohne Neuanmeldung', async () => {
    const router = renderAt('/profil');
    fireEvent.click(await screen.findByRole('link', { name: /Sprache/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/profil/sprache'));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    // Gespeichert wird in der Datenbank; danach gilt die Sprache auch auf anderen Geräten.
    api.me = { ...anna, locale: 'en' };
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/profil'));
    expect(requests.find((request) => request.url === '/api/me/sprache')).toMatchObject({
      method: 'PUT',
      body: { locale: 'en' },
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Main navigation' }).textContent).toContain(
      'Suppliers',
    );
    expect(document.documentElement.lang).toBe('en');
    expect(signedIn.signinRedirect).not.toHaveBeenCalled();
  });

  it('Die gespeicherte Sprache gilt beim nächsten Login, auch auf einem Gerät mit anderer Browsersprache', async () => {
    // Deutscher Browser, gespeichert ist Englisch.
    api.me = { ...anna, locale: 'en' };
    renderAt('/profil');
    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeDefined();
  });

  it('Die Sprachseite zeigt die gespeicherte Sprache, auch bei anderer Browsersprache', async () => {
    browserLanguages(['en-GB']);
    renderAt('/profil/sprache');
    await screen.findByRole('heading', { level: 1, name: 'Sprache' });
    expect((screen.getByRole('radio', { name: 'Deutsch' }) as HTMLInputElement).checked).toBe(true);
  });

  it('Vor dem Login gilt die Browsersprache; beim Login geht sie an die API', async () => {
    browserLanguages(['fr-FR', 'en-GB', 'de-DE']);
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    await reportLogin('token');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/anmeldung',
      expect.objectContaining({ body: JSON.stringify({ browserLocale: 'en' }) }),
    );
    // Kann der Browser keine der beiden Sprachen, gilt Deutsch.
    browserLanguages(['fr-FR']);
    await reportLogin('token');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/me/anmeldung',
      expect.objectContaining({ body: JSON.stringify({ browserLocale: 'de' }) }),
    );
  });
});

describe('Formate je Sprache', () => {
  it('Beträge, Daten und Zahlen erscheinen je Sprache richtig formatiert', () => {
    const de = createFormat('de');
    const en = createFormat('en');
    const money = { amountCents: 1_234_567_00, currency: 'EUR' };
    expect(de.money(money, { wholeUnits: true })).toBe('1.234.567\u00a0€');
    expect(en.money(money, { wholeUnits: true })).toBe('€1,234,567');
    // Die Währung bleibt die des Betrags.
    expect(en.money({ amountCents: 50_00, currency: 'USD' })).toBe('US$50.00');
    expect(de.date('2026-10-01T08:00:00Z')).toBe('01.10.2026');
    expect(en.date('2026-10-01T08:00:00Z')).toBe('1 Oct 2026');
    expect(de.amountInput(980_000_50)).toBe('980.000,5');
    expect(en.amountInput(980_000_50)).toBe('980,000.5');
    expect(de.country('DE')).toBe('Deutschland');
    expect(en.country('DE')).toBe('Germany');
  });

  it('Profil und Spend zeigen auf Englisch Datum, Land und Betrag im englischen Format', async () => {
    api.me = { ...anna, locale: 'en' };
    renderAt(`/lieferanten/${id}/strategie/profil`);
    await screen.findByRole('heading', { level: 1, name: 'Profile' });
    expect(screen.getByText('Germany')).toBeDefined();
    expect(screen.getByText('1 Oct 2026')).toBeDefined();

    tearDownApp();
    setUpApp();
    api.permissions = actionsFor.admin;
    api.me = { ...anna, locale: 'en' };
    api.handle = (request) =>
      request.url === `/api/suppliers/${id}`
        ? Response.json(detail)
        : request.url === `/api/suppliers/${id}/spend`
          ? Response.json(spendOverviewOf(detail))
          : request.url.startsWith('/api/audit')
            ? Response.json({ entries: [] })
            : undefined;
    renderAt(`/lieferanten/${id}/strategie/spend`);
    const table = await screen.findByRole('table', { name: 'Entries' });
    expect(table.textContent).toContain('€1,234,567.00');
  });

  it('Das Spend-Feld nimmt Beträge im Format der Sprache an', async () => {
    api.me = { ...anna, locale: 'en' };
    api.handle = (request) => {
      requests.push(request);
      if (request.url === `/api/suppliers/${id}`) return Response.json(detail);
      if (request.url.startsWith(`/api/suppliers/${id}/spend`)) {
        return Response.json(spendOverviewOf(detail));
      }
      if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
      return undefined;
    };
    renderAt(`/lieferanten/${id}/strategie/spend/neu`);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.change(screen.getByLabelText(/^Year/), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText(/Spend in euros/i), { target: { value: '980,000.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
        year: 2024,
        amountCents: 980_000_50,
      }),
    );
  });
});

describe('Fehler der API', () => {
  it('Fehlermeldungen der API erscheinen in der gewählten Sprache', async () => {
    api.me = { ...anna, locale: 'en' };
    renderAt(`/lieferanten/${id}/beziehung/team/bearbeiten`);
    await screen.findByRole('heading', { level: 1, name: 'Edit team' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('A team has at most one SRO.');
    expect(within(alert).queryByText(/höchstens/)).toBeNull();
  });
});
