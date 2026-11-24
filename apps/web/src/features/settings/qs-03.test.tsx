// @vitest-environment jsdom
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

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

// QS-03 für die Oberfläche: Einstellungen › Datenexport, nur für Admins; Status und Link.

const exportId = '550e8400-e29b-41d4-a716-446655440077';
let exports: unknown[] = [];
let requested = 0;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  exports = [];
  requested = 0;
  api.handle = (request) => {
    if (request.url !== '/api/einstellungen/export') return undefined;
    if (request.method === 'POST') {
      requested += 1;
      exports = [
        {
          id: exportId,
          status: 'pending',
          createdAt: '2026-11-16T08:00:00Z',
          finishedAt: null,
          expiresAt: null,
          fileName: null,
          downloadable: false,
        },
      ];
      return Response.json({ exports }, { status: 201 });
    }
    return Response.json({ exports });
  };
});

afterEach(tearDownApp);

describe('QS-03 Datenexport', () => {
  it('Admins fordern den Gesamtexport an und sehen den Status', async () => {
    renderAt('/einstellungen/export');
    expect(await screen.findByText('Noch kein Export angefordert.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gesamtexport anfordern' }));
    await waitFor(() => expect(requested).toBe(1));
    const list = await screen.findByRole('region', { name: 'Letzte Exporte' });
    expect(within(list).getByText('Wartet')).toBeTruthy();
    // Solange er läuft, lässt er sich nicht noch einmal anfordern.
    expect(
      (screen.getByRole('button', { name: 'Gesamtexport anfordern' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('ein fertiger Export lässt sich 24 Stunden herunterladen, danach steht „Abgelaufen“', async () => {
    exports = [
      {
        id: exportId,
        status: 'done',
        createdAt: '2026-11-15T08:00:00Z',
        finishedAt: '2026-11-15T08:01:00Z',
        expiresAt: '2026-11-16T08:01:00Z',
        fileName: 'reziproq-export-2026-11-15.zip',
        downloadable: false,
      },
    ];
    renderAt('/einstellungen/export');
    expect(await screen.findByText('Abgelaufen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Herunterladen' })).toBeNull();
  });

  it('Mitglieder sehen nur den Hinweis, keinen Knopf', async () => {
    api.me = { ...anna, orgRole: 'member' };
    api.permissions = actionsFor.member;
    renderAt('/einstellungen/export');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Alle Daten exportieren' }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Gesamtexport anfordern' })).toBeNull(),
    );
  });
});
