// @vitest-environment jsdom
import type { Integrations, OrganizationMember, SsoOverview } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signedOut } from '@/lib/auth';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Tests zu docs/specs/IN-02.md in der Oberfläche: Anmeldung über das Firmenkonto einrichten
// (Mandant, Domains mit DNS-Eintrag, Standardrolle, nur SSO), Anmeldeseite mit Mail, Hinweis
// „wartet auf Freigabe“, Freigabe durch den Admin.

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
      key: 'microsoft365',
      group: 'workplace',
      stage: 1,
      parts: ['login', 'calendar'],
      personal: true,
      provider: 'fake',
      connection: {
        id: uuid(10),
        scope: 'org',
        status: 'active',
        parts: ['login', 'calendar'],
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
const sso: SsoOverview = {
  entra: {
    provider: 'entra',
    tenantId: 'tenant-a',
    hostedDomain: null,
    domains: [
      { domain: 'firma.de', recordName: '_zitadel-challenge.firma.de', recordValue: 'abc', verifiedAt: '2026-11-20T08:00:00Z' },
      { domain: 'firma.at', recordName: '_zitadel-challenge.firma.at', recordValue: 'xyz', verifiedAt: null },
    ],
    defaultRole: 'viewer',
    passwordLoginAllowed: true,
    status: 'active',
  },
  google: null,
};

let sent: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  sent = [];
  api.handle = (request) => {
    if (request.method !== 'GET') sent.push({ url: request.url, method: request.method, body: request.body });
    if (request.url === '/api/einstellungen/anbindungen') return Response.json(overview);
    if (request.url.startsWith('/api/einstellungen/anbindungen/anmeldung')) return Response.json(sso);
    if (request.url === '/api/anmeldung/sso') {
      return Response.json({ provider: 'entra', scope: 'urn:zitadel:iam:org:idp:id:idp-1' });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

async function openMicrosoft() {
  renderAt('/einstellungen/anbindungen');
  const row = (await screen.findByText('Microsoft 365')).closest('li') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: 'Verwalten' }));
  return (
    await within(row).findByRole('heading', { level: 3, name: /Anmeldung über das Firmenkonto/ })
  ).closest('section') as HTMLElement;
}

describe('IN-02 Anmeldung über das Firmenkonto einrichten', () => {
  it('zeigt Domains mit Stand und DNS-Eintrag; Domain bestätigen', async () => {
    const section = await openMicrosoft();
    expect(await within(section).findByText('firma.de')).toBeTruthy();
    expect(within(section).getByText('bestätigt')).toBeTruthy();
    expect(within(section).getByText(/TXT-Eintrag _zitadel-challenge\.firma\.at mit dem Wert xyz/)).toBeTruthy();
    fireEvent.click(within(section).getByRole('button', { name: 'Domain bestätigen' }));
    await waitFor(() =>
      expect(sent[0]?.url).toBe('/api/einstellungen/anbindungen/anmeldung/entra/domains/firma.at/bestaetigen'),
    );
    // Der Eintrag wurde (im Nachbau) noch nicht gefunden: Hinweis statt Fehler
    expect(await within(section).findByText(/noch nicht gefunden/)).toBeTruthy();
  });

  it('Speichern schickt Mandant, Domains, Standardrolle und „Nur noch über Microsoft“', async () => {
    const section = await openMicrosoft();
    await within(section).findByText('firma.de');
    fireEvent.change(within(section).getByLabelText('Standardrolle neuer Personen'), {
      target: { value: 'member' },
    });
    fireEvent.click(within(section).getByRole('switch', { name: 'Nur noch über Microsoft anmelden' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Anmeldung speichern' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        method: 'PUT',
        body: {
          tenantId: 'tenant-a',
          hostedDomain: null,
          domains: ['firma.de', 'firma.at'],
          defaultRole: 'member',
          passwordLoginAllowed: false,
        },
      }),
    );
  });
});

describe('IN-02 Anmelden mit dem Firmenkonto', () => {
  it('die Anmeldeseite fragt nach der Mail und führt direkt zum Anbieter', async () => {
    const signinRedirect = vi.fn();
    auth.state = { ...signedIn, user: null, signinRedirect };
    signedOut.mark();
    renderAt('/start');
    fireEvent.change(await screen.findByLabelText('Deine Mail'), {
      target: { value: 'anna@firma.de' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() =>
      expect(signinRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          login_hint: 'anna@firma.de',
          scope: expect.stringContaining('urn:zitadel:iam:org:idp:id:idp-1'),
        }),
      ),
    );
  });

  it('eine neue Person sieht bis zur Freigabe nur den Hinweis', async () => {
    api.me = { ...anna, orgRole: null, pendingApproval: true, permissions: { ...anna.permissions, viewBuyerAreas: false, viewSuppliers: false } };
    api.permissions = [];
    renderAt('/start');
    expect(await screen.findByText(/prüft gerade deinen Zugang/)).toBeTruthy();
  });

  it('abgelehnte Anmeldung (nur SSO) zeigt den Grund', async () => {
    api.meStatus = 403;
    api.handle = (request) =>
      request.url === '/api/me'
        ? Response.json({ statusCode: 403, code: 'nur_sso', provider: 'entra' }, { status: 403 })
        : undefined;
    renderAt('/start');
    expect(await screen.findByText(/nur noch über ihr Firmenkonto/)).toBeTruthy();
  });
});

describe('IN-02 Neue Person freigeben', () => {
  it('der Admin sieht „Neue Person prüfen“ und gibt frei', async () => {
    let member: OrganizationMember = {
      id: 'neu',
      name: 'Neue Person',
      email: 'neu@firma.de',
      orgRole: 'viewer',
      isControlling: false,
      defaultFunction: null,
      approvalPending: true,
    };
    api.handle = (request) => {
      if (request.url === '/api/organisation/mitglieder/neu/freigeben') {
        member = { ...member, approvalPending: false };
        sent.push({ url: request.url, method: request.method, body: null });
        return Response.json(member);
      }
      if (request.url === '/api/organisation/mitglieder/neu') return Response.json(member);
      return undefined;
    };
    renderAt('/einstellungen/organisation/neu');
    expect(await screen.findByRole('heading', { name: 'Neue Person prüfen' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    await waitFor(() => expect(sent[0]?.url).toBe('/api/organisation/mitglieder/neu/freigeben'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Neue Person prüfen' })).toBeNull());
  });
});
