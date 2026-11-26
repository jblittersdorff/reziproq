// @vitest-environment jsdom
import type { DemoRegie, DemoSession } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveDemoSession } from '@/lib/demo-session';
import { api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

// DM-01 Demo-Regie (K1-g.4, Vorlage Demo-Regie): Uhr, Szenarien, Signal, Rolle, Modus und
// Zurücksetzen; was später kommt, steht als Text da. Außerhalb des Demo-Mandanten nur der Hinweis.

const session: DemoSession = {
  accessToken: 'demo-token',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  person: {
    id: 'nordwind-jan-luka',
    name: 'Jan-Luka',
    orgId: '550e8400-e29b-41d4-a716-446655440001',
    orgName: 'Nordwind Antriebe',
    orgRole: 'member',
    buyer: true,
  },
};
const start: DemoRegie = { demoNow: '2026-11-23T06:30:00.000Z', mode: 'replay', runs: [] };
let requests: { method: string; url: string; body: unknown }[];
let state: DemoRegie | 'none';

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  window.sessionStorage.clear();
  saveDemoSession(session);
  requests = [];
  state = start;
  api.handle = (request) => {
    if (!request.url.startsWith('/api/demo/regie')) return undefined;
    requests.push({ method: request.method, url: request.url, body: request.body });
    if (state === 'none') return Response.json({ statusCode: 404 }, { status: 404 });
    if (request.url === '/api/demo/regie/zeit') {
      return Response.json({
        demoNow: '2026-11-24T05:00:00.000Z',
        mode: 'replay',
        runs: [
          { key: 'briefing', at: '2026-11-24T05:00:00.000Z' },
          { key: 'triage', at: '2026-11-24T05:00:00.000Z' },
        ],
      });
    }
    if (request.url === '/api/demo/regie/signal') {
      return Response.json({
        key: 'mail_kim_kaiser',
        status: 'applied',
        objectType: 'inbound_item',
      });
    }
    if (request.url === '/api/demo/regie/modus') {
      return Response.json({ ...start, mode: (request.body as { mode: DemoRegie['mode'] }).mode });
    }
    return Response.json(start);
  };
});

afterEach(() => {
  window.sessionStorage.clear();
  tearDownApp();
});

describe('DM-01 Demo-Regie', () => {
  it('zeigt Uhr, Szenarien mit Stand, die aktive Rolle und den Modus', async () => {
    renderAt('/demo');
    expect(await screen.findByRole('heading', { level: 1, name: 'Demo-Regie' })).toBeTruthy();
    expect(await screen.findByText('Mo 23.11., 07:30')).toBeTruthy();
    const scenario = screen.getByRole('region', { name: 'Szenario' });
    expect(within(scenario).getByText('Morgen mit Reziproq')).toBeTruthy();
    expect(within(scenario).getByText('bereit')).toBeTruthy();
    expect(within(scenario).getAllByText('folgt mit K4')).toHaveLength(2);
    const role = screen.getByRole('region', { name: 'Rolle' });
    expect(
      within(role).getByRole('link', { name: 'Jan-Luka · SRO' }).getAttribute('aria-current'),
    ).toBe('true');
    expect(
      within(role).getByRole('link', { name: 'Kim Kaiser · Rheintal' }).getAttribute('href'),
    ).toBe('/demo/als/rheintal-kim-kaiser');
    expect(screen.getByRole('radio', { name: 'Abspielen' })).toHaveProperty('checked', true);
  });

  it('Neuer Tag, Signal und Modus gehen an die API und melden, was geschah', async () => {
    renderAt('/demo');
    fireEvent.click(await screen.findByRole('button', { name: 'Neuer Tag (06:00-Lauf)' }));
    expect(await screen.findByText('Uhr auf Di 24.11., 06:00, 2 Läufe ausgeführt.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mail von Kim Kaiser' }));
    expect(
      await screen.findByText('Mail von Kim Kaiser ist da: Die Zuordnung wartet in Kurz prüfen.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Live' }));
    await waitFor(() =>
      expect(requests).toContainEqual({
        method: 'PUT',
        url: '/api/demo/regie/modus',
        body: { mode: 'live' },
      }),
    );
    expect(requests).toContainEqual({
      method: 'POST',
      url: '/api/demo/regie/zeit',
      body: { aktion: 'neuer_tag' },
    });
  });

  it('Zurücksetzen fragt nach und meldet die Uhr', async () => {
    renderAt('/demo');
    fireEvent.click(await screen.findByRole('button', { name: 'Zurücksetzen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja, zurücksetzen' }));
    expect(await screen.findByText('Zurückgesetzt auf Mo 23.11., 07:30.')).toBeTruthy();
    expect(requests.map((entry) => entry.url)).toContain('/api/demo/regie/zuruecksetzen');
  });

  it('außerhalb des Demo-Mandanten nur der Hinweis', async () => {
    state = 'none';
    renderAt('/demo');
    expect(await screen.findByText('Die Demo-Regie gibt es nur im Demo-Mandanten.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).toBeNull();
  });
});
