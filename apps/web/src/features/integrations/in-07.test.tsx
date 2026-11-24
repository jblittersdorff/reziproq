// @vitest-environment jsdom
import type { ApiKeys, Integrations } from '@reziproq/shared';
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

// Tests zu docs/specs/IN-07.md in der Oberfläche: Schlüssel unter Anbindungen › Import-API
// erzeugen (einmal sichtbar), Liste mit letzter Nutzung und Widerrufen, letzte Lieferung; im
// Import die Herkunft „API“.

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
const overview: Integrations = {
  connectors: [
    {
      key: 'import_api',
      group: 'purchasing',
      stage: 1,
      parts: ['spend', 'suppliers'],
      personal: false,
      provider: 'fake',
      connection: {
        id: uuid(10),
        scope: 'org',
        status: 'active',
        parts: ['spend', 'suppliers'],
        connectedByName: 'Anna Berg',
        connectedAt: '2026-11-18T08:00:00Z',
        hookPath: null,
        inboundAddress: null,
        allowedDomains: [],
        lastJob: null,
      },
    },
  ],
  events: [],
  issue: null,
};
const keys = (overrides: Partial<ApiKeys> = {}): ApiKeys => ({
  keys: [
    {
      id: uuid(20),
      name: 'ERP-Middleware',
      prefix: 'rzq_ab12cd34',
      scopes: ['supplier', 'spend'],
      createdByName: 'Anna Berg',
      createdAt: '2026-11-20T08:00:00Z',
      lastUsedAt: '2026-11-23T05:00:00Z',
      revokedAt: null,
    },
  ],
  lastDelivery: {
    batchId: uuid(30),
    createdAt: '2026-11-23T05:00:00Z',
    status: 'committed',
    rowsTotal: 120,
    rowsError: 2,
  },
  ...overrides,
});

let sent: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  sent = [];
  api.handle = (request) => {
    if (request.url === '/api/einstellungen/anbindungen') return Response.json(overview);
    if (request.url.startsWith('/api/einstellungen/anbindungen/schluessel')) {
      if (request.method === 'POST') {
        sent.push({ url: request.url, method: request.method, body: request.body });
        if (request.url.endsWith('/widerrufen')) {
          const base = keys();
          return Response.json({
            ...base,
            keys: base.keys.map((key) => ({ ...key, revokedAt: '2026-11-23T09:00:00Z' })),
          });
        }
        return Response.json({ ...keys(), secret: 'rzq_ab12cd34_geheim' }, { status: 201 });
      }
      return Response.json(keys());
    }
    if (request.url === '/api/einstellungen/importe') {
      return Response.json({
        batches: [
          {
            id: uuid(30),
            kind: 'spend',
            fileName: 'ERP-Middleware',
            status: 'committed',
            rowsTotal: 118,
            rowsOk: 118,
            rowsReview: 0,
            rowsError: 0,
            createdByName: 'ERP-Middleware',
            createdAt: '2026-11-23T05:00:00Z',
            committedAt: '2026-11-23T05:01:00Z',
            source: 'api',
          },
        ],
        canManage: true,
      });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

async function openImportApi() {
  renderAt('/einstellungen/anbindungen');
  const row = (await screen.findByText('Import-API')).closest('li') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: 'Verwalten' }));
  return (await within(row).findByRole('heading', { level: 3, name: 'API-Schlüssel' })).closest(
    'section',
  ) as HTMLElement;
}

describe('IN-07 Schlüssel der Import-API', () => {
  it('Liste mit Objektarten, letzter Nutzung, letzter Lieferung und Link zur API-Beschreibung', async () => {
    const section = await openImportApi();
    expect(await within(section).findByText('ERP-Middleware')).toBeTruthy();
    expect(within(section).getByText('rzq_ab12cd34…')).toBeTruthy();
    const item = within(section).getByText('ERP-Middleware').closest('li') as HTMLElement;
    expect(within(item).getByText('Lieferantenstamm')).toBeTruthy();
    expect(within(section).getByText(/zuletzt genutzt/)).toBeTruthy();
    expect(within(section).getByText(/120 Zeilen · 2 mit Fehler/)).toBeTruthy();
    expect(within(section).getByRole('link', { name: 'Lieferung ansehen' })).toBeTruthy();
    expect(
      within(section).getByRole('link', { name: 'API-Beschreibung (OpenAPI)' }).getAttribute('href'),
    ).toBe('/api/v1/openapi.json');
  });

  it('Erzeugen mit Name und Objektarten zeigt den Schlüssel genau einmal', async () => {
    const section = await openImportApi();
    fireEvent.change(within(section).getByLabelText('Name'), { target: { value: 'SAP PI' } });
    fireEvent.click(within(section).getByRole('checkbox', { name: 'Lieferantenstamm' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Schlüssel erzeugen' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({ body: { name: 'SAP PI', scopes: ['spend'] } }),
    );
    expect(await within(section).findByText('rzq_ab12cd34_geheim')).toBeTruthy();
    expect(within(section).getByText('Neuer Schlüssel, nur jetzt sichtbar')).toBeTruthy();
  });

  it('Widerrufen mit Bestätigung', async () => {
    const section = await openImportApi();
    fireEvent.click(await within(section).findByRole('button', { name: 'Widerrufen' }));
    expect(within(section).getByText(/werden danach abgelehnt/)).toBeTruthy();
    fireEvent.click(within(section).getByRole('button', { name: 'Ja, widerrufen' }));
    await waitFor(() => expect(sent[0]?.url).toMatch(/\/widerrufen$/));
    expect(await within(section).findByText('widerrufen')).toBeTruthy();
  });

  it('der Import zeigt Lieferungen der API mit Herkunft', async () => {
    renderAt('/einstellungen/daten/import');
    const recent = (
      await screen.findByRole('heading', { level: 2, name: 'Letzte Importe' })
    ).closest('aside') as HTMLElement;
    expect(await within(recent).findByText('ERP-Middleware')).toBeTruthy();
    expect(within(recent).getByText('API')).toBeTruthy();
  });
});
