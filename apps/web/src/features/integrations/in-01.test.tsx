// @vitest-environment jsdom
import type { Integrations, MyConnections } from '@reziproq/shared';
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

// Tests zu docs/specs/IN-01.md in der Oberfläche: Einstellungen › Anbindungen mit Tinte-Karte,
// Abschnitten, Stand als Text, Verwalten mit Teilen und Trennen mit Bestätigung, letzte Ereignisse;
// Profil › Meine Verbindungen.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const connection = (n: number, parts: string[], failed = 0) => ({
  id: uuid(n),
  scope: 'org' as const,
  status: 'active' as const,
  parts,
  connectedByName: 'Anna Berg',
  connectedAt: '2026-11-18T08:00:00Z',
  hookPath: '/api/anbindungen/eingang/abc',
  inboundAddress: null,
  allowedDomains: [],
  lastJob: { status: 'done' as const, itemsIn: 3, itemsOk: 3 - failed, itemsFailed: failed, finishedAt: '2026-11-23T05:00:00Z' },
});
const overview = (overrides: Partial<Integrations> = {}): Integrations => ({
  connectors: [
    { key: 'microsoft365', group: 'workplace', stage: 1, parts: ['login', 'calendar', 'outlook', 'teams', 'transcripts'], personal: true, provider: 'fake', connection: connection(10, ['login', 'calendar']) },
    { key: 'inbound_mail', group: 'workplace', stage: 1, parts: ['meetings', 'notes'], personal: false, provider: 'fake', connection: null },
    { key: 'google_workspace', group: 'workplace', stage: 1, parts: ['login', 'calendar', 'meet', 'drive'], personal: true, provider: 'fake', connection: null },
    { key: 'slack', group: 'workplace', stage: 2, parts: ['hints'], personal: false, provider: 'fake', connection: null },
    { key: 'import_api', group: 'purchasing', stage: 1, parts: ['spend', 'suppliers'], personal: false, provider: 'fake', connection: connection(11, ['spend', 'suppliers'], 1) },
    { key: 'sap_s4', group: 'purchasing', stage: 2, parts: ['orders'], personal: false, provider: 'fake', connection: null },
  ],
  events: [
    { id: uuid(20), connectorKey: 'import_api', kind: 'note', status: 'failed', reason: 'beziehung_fehlt', createdAt: '2026-11-23T05:00:00Z' },
    { id: uuid(21), connectorKey: 'microsoft365', kind: 'token_refresh', status: 'applied', reason: null, createdAt: '2026-11-20T05:00:00Z' },
  ],
  issue: { kind: 'failed_items', connectorKey: 'import_api', count: 1 },
  ...overrides,
});

let current: Integrations;
let mine: MyConnections;
let sent: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  current = overview();
  mine = { connections: [], available: ['microsoft365', 'google_workspace'] };
  sent = [];
  api.handle = (request) => {
    if (request.url.startsWith('/api/einstellungen/anbindungen')) {
      if (request.method !== 'GET') {
        sent.push({ url: request.url, method: request.method, body: request.body });
        if (request.url.endsWith('/trennen')) {
          current = overview({
            connectors: current.connectors.map((entry) =>
              entry.connection?.id === uuid(10) ? { ...entry, connection: null } : entry,
            ),
          });
        }
      }
      return Response.json(current);
    }
    if (request.url.startsWith('/api/profil/verbindungen')) {
      if (request.method !== 'GET') {
        sent.push({ url: request.url, method: request.method, body: request.body });
        mine = request.url.endsWith('/verbinden')
          ? { ...mine, connections: [{ connectorKey: 'microsoft365', connection: { ...connection(30, ['calendar']), scope: 'user' } }] }
          : { ...mine, connections: [] };
      }
      return Response.json(mine);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('IN-01 Einstellungen › Anbindungen', () => {
  it('Tinte-Karte mit dem wichtigsten offenen Punkt, zwei Abschnitte und Stand als Text', async () => {
    renderAt('/einstellungen/anbindungen');
    expect(await screen.findByRole('heading', { level: 1, name: 'Anbindungen' })).toBeTruthy();
    expect(await screen.findByText('1 Element aus Import-API mit Fehler')).toBeTruthy();
    const workplace = screen.getByRole('heading', { level: 2, name: 'Arbeitsplatz' }).closest('section') as HTMLElement;
    expect(within(workplace).getByText('Microsoft 365')).toBeTruthy();
    expect(within(workplace).getByText('verbunden')).toBeTruthy();
    expect(within(workplace).getAllByText('nicht verbunden')).toHaveLength(2);
    // Stufe 2: ausgegraut, ohne Knopf
    const slack = within(workplace).getByText('Slack').closest('li') as HTMLElement;
    expect(within(slack).getByText('kommt in Stufe 2')).toBeTruthy();
    expect(within(slack).queryByRole('button')).toBeNull();
    // Aktive Teile als Chips
    expect(within(workplace).getByText('Kalender')).toBeTruthy();
    const purchasing = screen.getByRole('heading', { level: 2, name: 'Daten aus dem Einkauf' }).closest('section') as HTMLElement;
    expect(within(purchasing).getByText('Import-API')).toBeTruthy();
    expect(screen.getByText(/Testbetrieb/)).toBeTruthy();
  });

  it('Verbinden schickt die Anbindung an die API', async () => {
    renderAt('/einstellungen/anbindungen');
    const row = (await screen.findByText('Eingangsadresse')).closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Verbinden' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({ url: '/api/einstellungen/anbindungen/inbound_mail/verbinden', method: 'POST' }),
    );
  });

  it('Verwalten: Teile an oder aus, Abgleich, Trennen mit Bestätigung, die nennt, was gelöscht wird', async () => {
    renderAt('/einstellungen/anbindungen');
    const row = (await screen.findByText('Microsoft 365')).closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Verwalten' }));
    fireEvent.click(within(row).getByRole('switch', { name: 'Teams-App' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({ method: 'PUT', body: { parts: ['login', 'calendar', 'teams'] } }),
    );
    expect(within(row).getByText(/anbindungen\/eingang\/abc/)).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Jetzt abgleichen' }));
    await waitFor(() => expect(sent[1]?.url).toMatch(/\/abgleichen$/));
    fireEvent.click(within(row).getByRole('button', { name: 'Trennen' }));
    expect(within(row).getByText(/löscht die Zugangsdaten sofort/)).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Ja, trennen' }));
    await waitFor(() => expect(sent[2]?.url).toMatch(/\/trennen$/));
    const after = (await screen.findByText('Microsoft 365')).closest('li') as HTMLElement;
    await waitFor(() => expect(within(after).getByText('nicht verbunden')).toBeTruthy());
  });

  it('Letzte Ereignisse: Titel und Zeit, der Grund klappt auf', async () => {
    renderAt('/einstellungen/anbindungen');
    const aside = (await screen.findByRole('heading', { level: 2, name: 'Letzte Ereignisse' })).closest('aside') as HTMLElement;
    expect(within(aside).getByText('Import-API: Notiz mit Fehler')).toBeTruthy();
    expect(within(aside).getByText('Keinem Lieferanten zugeordnet.')).toBeTruthy();
    expect(within(aside).getByText('Microsoft 365 Zugang erneuert')).toBeTruthy();
  });

  it('eine gestörte Verbindung steht in der Tinte-Karte mit Neu verbinden', async () => {
    const base = overview();
    current = overview({
      connectors: base.connectors.map((entry) =>
        entry.key === 'microsoft365' && entry.connection
          ? { ...entry, connection: { ...entry.connection, status: 'error' } }
          : entry,
      ),
      issue: { kind: 'error', connectorKey: 'microsoft365', count: 1 },
    });
    renderAt('/einstellungen/anbindungen');
    expect(await screen.findByText('Microsoft 365: Verbindung erneuern')).toBeTruthy();
    expect(screen.getByText('gestört')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Neu verbinden' }));
    await waitFor(() => expect(sent.map((entry) => entry.url.split('/').at(-1))).toEqual(['trennen', 'verbinden']));
  });

  it('Mitglieder sehen den Hinweis, dass Admins Anbindungen verwalten', async () => {
    api.me = anna;
    api.permissions = actionsFor.member;
    api.handle = (request) =>
      request.url.startsWith('/api/einstellungen/anbindungen')
        ? Response.json({ statusCode: 403, code: 'keine_berechtigung' }, { status: 403 })
        : undefined;
    renderAt('/einstellungen/anbindungen');
    expect(await screen.findByText('Anbindungen verwalten Admins.')).toBeTruthy();
  });
});

describe('IN-01 Profil › Meine Verbindungen', () => {
  it('Kalender und Outlook-Add-in für sich verbinden und trennen', async () => {
    renderAt('/profil');
    const group = (await screen.findByText('Meine Verbindungen')).closest('fieldset') as HTMLElement;
    const row = (await within(group).findByText('Microsoft 365')).closest('div')
      ?.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Verbinden' }));
    await waitFor(() => expect(sent[0]?.url).toBe('/api/profil/verbindungen/microsoft365/verbinden'));
    expect(await within(row).findByText('verbunden')).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Trennen' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Ja, trennen' }));
    await waitFor(() => expect(sent[1]?.url).toBe(`/api/profil/verbindungen/${uuid(30)}/trennen`));
  });
});
