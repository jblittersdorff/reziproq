// @vitest-environment jsdom
import { defaultNotificationModes, type NotificationPrefs } from '@reziproq/shared';
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

// Tests zu docs/specs/IN-06.md in der Oberfläche: Profil › Benachrichtigungen mit Teams verbinden,
// Kanal und Häufigkeit je Anlass, Ruhezeiten; Admins schalten Teams-App und Mail der Organisation.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

let prefs: NotificationPrefs;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  prefs = {
    modes: structuredClone(defaultNotificationModes),
    quietHours: { from: '19:00', to: '07:00', weekend: true },
    teamsAvailable: true,
    teamsLinked: false,
    mailEnabled: true,
    canManageOrganization: true,
    recent: [
      {
        id: '0190a0a0-0000-7000-8000-000000000001',
        channel: 'teams',
        kind: 'brief_ready',
        title: 'JBP Rheintal am 04.12.: Briefing steht',
        status: 'sent',
        delivery: 'now',
        createdAt: '2026-11-26T09:00:00Z',
      },
    ],
  };
  api.handle = (request) => {
    if (request.url.startsWith('/api/profil/benachrichtigungen')) {
      if (request.method !== 'GET') sent.push(request);
      if (request.url.endsWith('/teams'))
        prefs = { ...prefs, teamsLinked: request.method === 'POST' };
      return Response.json(prefs);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('IN-06 Profil › Benachrichtigungen', () => {
  it('das Profil verlinkt die Seite', async () => {
    renderAt('/profil');
    expect(
      (await screen.findByRole('link', { name: /Benachrichtigungen/ })).getAttribute('href'),
    ).toBe('/profil/benachrichtigungen');
  });

  it('Profil verlinkt die Seite; sie zeigt Startwerte und das Zuletzt Gesendete mit Status als Text', async () => {
    renderAt('/profil/benachrichtigungen');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Benachrichtigungen' }),
    ).toBeTruthy();
    expect(await screen.findByText('Noch nicht verbunden.')).toBeTruthy();
    // Ohne verbundenes Teams ist die Teams-Spalte gesperrt
    const teams = screen.getAllByLabelText('Teams')[0] as HTMLSelectElement;
    expect(teams.disabled).toBe(true);
    expect(screen.getByText('JBP Rheintal am 04.12.: Briefing steht')).toBeTruthy();
    expect(screen.getByText('gesendet')).toBeTruthy();
  });

  it('Teams verbinden und Einstellungen mit Ruhezeiten speichern', async () => {
    renderAt('/profil/benachrichtigungen');
    fireEvent.click(await screen.findByRole('button', { name: 'Teams verbinden' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        method: 'POST',
        url: '/api/profil/benachrichtigungen/teams',
      }),
    );
    expect(
      await screen.findByText('Verbunden: Reziproq schreibt dir als persönlicher Bot.'),
    ).toBeTruthy();
    const row = screen
      .getByText('Ergebnisse nach dem Termin')
      .closest('[data-slot="settings-row"], div') as HTMLElement;
    const mail = within(row.parentElement as HTMLElement).getAllByLabelText(
      'Mail',
    )[0] as HTMLSelectElement;
    fireEvent.change(mail, { target: { value: 'now' } });
    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '20:00' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Am Wochenende ruhig' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(sent.find((request) => request.method === 'PUT')?.body).toMatchObject({
        modes: { results_ready: { teams: 'now', mail: 'now' } },
        quietHours: { from: '20:00', to: '07:00', weekend: false },
      }),
    );
  });

  it('Admins schalten Teams-App und Mail der Organisation', async () => {
    renderAt('/profil/benachrichtigungen');
    fireEvent.click(await screen.findByRole('switch', { name: 'Benachrichtigungen per Mail' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        method: 'PUT',
        url: '/api/profil/benachrichtigungen/organisation',
        body: { mail: false },
      }),
    );
  });
});
