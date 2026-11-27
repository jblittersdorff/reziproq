// @vitest-environment jsdom
import type { ActivityFeed, SupplierDetail } from '@reziproq/shared';
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

// Tests zu docs/specs/NAV-10.md in der Oberfläche: vier Hauptpunkte in fester Reihenfolge,
// Weiterleitungen alter Adressen, Aktivitäten mit privater Notiz und Einträgen von Reziproq,
// ⌘K mit Lieferant als Kontext, nichts davon für die Lieferantenseite.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const id = '0190a0a0-0000-7000-8000-000000000001';
const base = `/lieferanten/${id}`;
const detail: SupplierDetail = {
  relationshipId: id,
  name: 'Rheintal Elektronik GmbH',
  organizationName: 'Rheintal Elektronik GmbH',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: null,
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};
let feed: ActivityFeed;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  feed = {
    canWrite: true,
    items: [
      {
        id: 'note:1',
        kind: 'note',
        occurredAt: '2026-12-04T12:20:00Z',
        actor: { type: 'person', name: 'Sara Ost' },
        title: 'Tom wirkt beim Thema Kupfer offen.',
        code: null,
        meta: null,
        href: null,
        visibility: 'private',
        pinned: false,
        mine: true,
      },
      {
        id: 'agent:2',
        kind: 'agent',
        occurredAt: '2026-11-27T06:10:00Z',
        actor: { type: 'reziproq' },
        title: '',
        code: 'pre_read',
        meta: 'draft',
        href: `${base}/umsetzung/termine/abc`,
        visibility: 'team',
        pinned: false,
        mine: false,
      },
    ],
  };
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${id}`) return Response.json(detail);
    if (request.url.startsWith(`/api/suppliers/${id}/aktivitaeten`)) return Response.json(feed);
    if (request.url === `/api/suppliers/${id}/notizen` && request.method === 'POST') {
      sent.push(request);
      return Response.json(feed, { status: 201 });
    }
    return undefined;
  };
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

  it('TN-08: ⌘K auf der Seite eines Lieferanten öffnet Frag Reziproq mit ihm als Kontext', async () => {
    const router = renderAt(`${base}/aktivitaeten`);
    await screen.findByRole('heading', { level: 1, name: 'Aktivitäten' });
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const overlay = await screen.findByRole('dialog', { name: 'Frag Reziproq' });
    expect(router.state.location.pathname).toBe(`${base}/aktivitaeten`);
    fireEvent.change(
      await within(overlay).findByRole('textbox', { name: 'Deine Frage an Reziproq' }),
      { target: { value: 'Was ist offen?' } },
    );
    fireEvent.click(within(overlay).getByRole('button', { name: 'Fragen' }));
    await waitFor(() =>
      expect(api.promptRequests.at(-1)).toMatchObject({ context: { relationshipId: id } }),
    );
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

describe('NAV-10 Aktivitäten', () => {
  it('IN-03: ein Termin aus Outlook steht im Verlauf mit „aus Outlook“', async () => {
    feed = {
      ...feed,
      items: [
        {
          id: 'meeting:3',
          kind: 'meeting',
          occurredAt: '2026-12-09T13:00:00Z',
          actor: { type: 'person', name: 'Ida Roth' },
          title: 'Abstimmung Musterteile',
          code: 'outlook_addin',
          meta: 'Teams',
          href: `${base}/umsetzung/termine/m3`,
          visibility: 'team',
          pinned: false,
          mine: false,
        },
      ],
    };
    renderAt(`${base}/aktivitaeten`);
    expect(await screen.findByText('Abstimmung Musterteile')).toBeTruthy();
    expect(screen.getByText('aus Outlook · Teams')).toBeTruthy();
  });

  it('der Verlauf zeigt private Notizen als „nur ich“ und Einträge von Reziproq mit Verweis', async () => {
    renderAt(`${base}/aktivitaeten`);
    expect(await screen.findByText('Tom wirkt beim Thema Kupfer offen.')).toBeTruthy();
    expect(screen.getByText('nur ich')).toBeTruthy();
    const draft = screen
      .getByText('Reziproq hat das Pre-Read für den Termin vorbereitet')
      .closest('li') as HTMLElement;
    expect(within(draft).getByRole('link', { name: 'Öffnen' }).getAttribute('href')).toBe(
      `${base}/umsetzung/termine/abc`,
    );
    expect(screen.getByText('Der Lieferant sieht die Aktivitäten nie.')).toBeTruthy();
  });

  it('eine neue Notiz lässt sich für das Team oder nur für sich speichern', async () => {
    renderAt(`${base}/aktivitaeten`);
    const form = await screen.findByRole('form', { name: 'Neue Notiz' });
    fireEvent.change(within(form).getByLabelText('Notiz'), {
      target: { value: 'Vor dem Angebot mit Tom sprechen.' },
    });
    fireEvent.click(within(form).getByRole('radio', { name: 'Nur ich' }));
    fireEvent.click(within(form).getByLabelText('Telefonnotiz'));
    fireEvent.click(within(form).getByRole('button', { name: 'Notiz speichern' }));
    await waitFor(() =>
      expect(sent[0]?.body).toEqual({
        text: 'Vor dem Angebot mit Tom sprechen.',
        visibility: 'private',
        kind: 'call',
      }),
    );
  });

  it('eine Frage zu diesem Lieferanten geht mit Kontext an Frag Reziproq', async () => {
    const router = renderAt(`${base}/aktivitaeten`);
    const ask = await screen.findByRole('form', {
      name: 'Frag Reziproq zu Rheintal Elektronik GmbH',
    });
    fireEvent.change(within(ask).getByRole('textbox'), {
      target: { value: 'Was wurde zugesagt?' },
    });
    fireEvent.click(within(ask).getByRole('button', { name: 'Fragen' }));
    expect(await screen.findByRole('dialog', { name: 'Frag Reziproq' })).toBeDefined();
    expect(router.state.location.pathname).toBe(`${base}/aktivitaeten`);
    await waitFor(() =>
      expect(api.promptRequests.at(-1)).toMatchObject({
        messages: [{ role: 'user', content: 'Was wurde zugesagt?' }],
        context: { relationshipId: id },
      }),
    );
  });
});
