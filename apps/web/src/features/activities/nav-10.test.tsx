// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
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

// Tests zu docs/specs/NAV-10.md in der Oberfläche: vier Hauptpunkte in fester Reihenfolge,
// Weiterleitungen alter Adressen, nichts davon für die Lieferantenseite. Aktivitäten und ⌘K auf der
// Seite einer Beziehung prüft seit K2-c.7 die Akte (ak-01-privat.test.tsx).

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
});

afterEach(tearDownApp);

const bar = () => screen.getByRole('navigation', { name: 'Hauptnavigation' });

describe('NAV-10 Navigation', () => {
  it('die Seitenleiste zeigt genau vier Hauptpunkte in fester Reihenfolge (NAV-10 2.0)', async () => {
    renderAt('/beziehungen');
    await screen.findByRole('heading', { level: 1 });
    const main = within(bar())
      .getAllByRole('link')
      .map((link) => link.textContent?.trim())
      .filter((label) =>
        [
          'Heute',
          'Lieferanten',
          'Warengruppen',
          'Ergebnisse',
          'Übersicht',
          'Mein Tag',
          'Lieferanten',
          'Portfolio',
          'Ergebnisse',
          'Start',
        ].includes(label ?? ''),
      );
    expect(main).toEqual(['Heute', 'Lieferanten', 'Warengruppen', 'Ergebnisse']);
  });

  it.each([
    ['/wirkung', '/wert'],
    ['/uebersicht', '/wert'],
    ['/start', '/heute'],
    ['/mein-tag', '/heute'],
    ['/lieferanten', '/beziehungen'],
    ['/portfolio', '/beziehungen'],
    ['/agenten', '/mein-agent'],
    ['/einstellungen/ki/agenten', '/mein-agent'],
  ])('TN-07: die alte Adresse %s leitet auf %s weiter', async (from, to) => {
    const router = renderAt(from);
    await waitFor(() => expect(router.state.location.pathname).toBe(to));
    // BZ-01 (K2-b.5): /portfolio ist die Linse Segmente der Seite Lieferanten
    if (from === '/portfolio')
      expect(router.state.location.search).toMatchObject({ linse: 'segmente' });
  });

  it('WG-18: /portfolio?warengruppe=<id> führt bis K2-e zur bisherigen Matrix mit Filter Warengruppe', async () => {
    const group = '0190a0a0-0000-7000-8000-000000000077';
    const router = renderAt(`/portfolio?warengruppe=${group}`);
    await waitFor(() => expect(router.state.location.pathname).toBe('/portfolio/matrix'));
    expect(router.state.location.search).toMatchObject({ wg: group });
  });

  it('TN-13: die Lieferantenseite sieht Heute und Kunden, weder Warengruppen noch Wert', async () => {
    api.me = {
      ...anna,
      permissions: {
        ...anna.permissions,
        viewBuyerAreas: false,
        viewSuppliers: false,
        viewCustomers: true,
      },
    };
    renderAt('/kunden');
    await screen.findByRole('heading', { level: 1 });
    const labels = () =>
      within(bar())
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label') ?? link.textContent);
    await waitFor(() => expect(labels()).toContain('Kunden'));
    expect(labels()).toContain('Heute');
    for (const buyerOnly of ['Ergebnisse', 'Warengruppen', 'Lieferanten', 'Mein Agent']) {
      expect(labels()).not.toContain(buyerOnly);
    }
  });
});
