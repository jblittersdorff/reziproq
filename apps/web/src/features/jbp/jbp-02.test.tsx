// @vitest-environment jsdom
import type { JbpTopic, JbpTopics } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/JBP-02.md in der Oberfläche: zwei Spalten nach Priorität, nur eigene Themen
// ordnen und bearbeiten, Herkunft nur beim Käufer, Übernahme mit teilbarer Beschreibung, Parken
// mit Begründung.

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
const rel = uuid(1);
const supplier = {
  relationshipId: rel,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
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
const topic = (n: number, side: 'buyer' | 'supplier', extra: Partial<JbpTopic> = {}): JbpTopic => ({
  id: uuid(n),
  side,
  own: side === 'buyer',
  title: `Thema ${n}`,
  description: `Beschreibung ${n}`,
  priority: n,
  status: 'proposed',
  parkReason: null,
  origin: null,
  ...extra,
});
const topics: JbpTopics = {
  hasPlan: true,
  ownSide: 'buyer',
  buyer: [
    topic(20, 'buyer', { origin: { title: 'Zweitquelle Leiterplatten' } }),
    topic(21, 'buyer'),
    topic(22, 'buyer', { status: 'parked', parkReason: 'Budget fehlt' }),
  ],
  supplier: [topic(30, 'supplier')],
  canEditOwn: true,
  canImport: true,
};
let current: JbpTopics;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  current = topics;
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(supplier);
    if (request.url.startsWith(`/api/suppliers/${rel}/overview`)) {
      return Response.json({
        head: { segment: null, sro: null, nextMeeting: null },
        metrics: [],
        cycle: null,
        canStartCycle: false,
        canSetJbpDate: false,
      });
    }
    if (request.url === `/api/suppliers/${rel}/jbp/themen/vorschlaege`) {
      return Response.json({
        candidates: [
          { id: uuid(40), title: 'Kostensenkung Gehäuse', reason: 'Intern: Preis zu hoch' },
        ],
      });
    }
    if (request.url.startsWith(`/api/suppliers/${rel}/jbp/themen`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(current, { status: request.method === 'POST' ? 201 : 200 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/plan/themen`;

describe('JBP-02 Themen in der Oberfläche', () => {
  it('zeigt zwei Spalten nach Priorität; nur die eigenen Themen lassen sich ordnen und bearbeiten', async () => {
    renderAt(base);
    const buyer = (await screen.findByRole('heading', { level: 2, name: 'Themen des Käufers' }))
      .parentElement as HTMLElement;
    const supplierColumn = screen.getByRole('heading', { level: 2, name: 'Themen des Lieferanten' })
      .parentElement as HTMLElement;
    expect(
      within(buyer)
        .getAllByRole('listitem')
        .map((row) => row.querySelector('.font-semibold')?.textContent),
    ).toEqual(['Thema 20', 'Thema 21', 'Thema 22']);
    expect(within(buyer).getByRole('link', { name: 'Thema 20: Bearbeiten' })).toBeDefined();
    expect(within(supplierColumn).getByText('Thema 30')).toBeDefined();
    expect(within(supplierColumn).queryByRole('link')).toBeNull();
    expect(within(supplierColumn).queryByRole('button')).toBeNull();
    // Herkunft (nur der Käufer bekommt sie vom Server) und geparkt mit Begründung.
    expect(
      within(buyer).getByText('Aus dem Lieferantenplan: Zweitquelle Leiterplatten'),
    ).toBeDefined();
    expect(within(buyer).getByText('Geparkt: Budget fehlt')).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'Aus Lieferantenplan übernehmen' }).getAttribute('href'),
    ).toBe(`${base}/uebernehmen`);
  });

  it('nach unten schickt die neue Reihenfolge der eigenen Themen', async () => {
    renderAt(base);
    fireEvent.click(await screen.findByRole('button', { name: '„Thema 20“ nach unten' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/suppliers/${rel}/jbp/themen/reihenfolge`,
      body: { ids: [uuid(21), uuid(20), uuid(22)] },
    });
  });

  it('ohne Recht und ohne Plan erscheinen keine Knöpfe bzw. ein Hinweis', async () => {
    current = { ...topics, canEditOwn: false, canImport: false };
    renderAt(base);
    await screen.findByText('Thema 20');
    expect(screen.queryByRole('link', { name: 'Neues Thema' })).toBeNull();
    expect(screen.queryByRole('button', { name: /nach unten/ })).toBeNull();
  });

  it('ohne Gemeinsamen Plan erklärt sich die Seite', async () => {
    current = { ...topics, hasPlan: false, buyer: [], supplier: [] };
    renderAt(base);
    expect(
      await screen.findByText('Themen kommen dazu, sobald der Gemeinsame Plan angelegt ist.'),
    ).toBeDefined();
  });

  it('ein neues Thema entsteht auf eigener Seite', async () => {
    const router = renderAt(`${base}/neu`);
    fireEvent.click(await screen.findByRole('button', { name: 'Thema anlegen' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neues Werk' } });
    fireEvent.change(screen.getByLabelText(/^Beschreibung/), { target: { value: 'Brno 2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thema anlegen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/jbp/themen`,
      body: { title: 'Neues Werk', description: 'Brno 2027' },
    });
  });

  it('Parken verlangt eine Begründung', async () => {
    const router = renderAt(`${base}/${uuid(21)}`);
    const park = await screen.findByRole('region', { name: 'Parken' });
    fireEvent.change(within(park).getByLabelText('Warum wird das Thema nicht weiterverfolgt?'), {
      target: { value: 'Kein Budget' },
    });
    fireEvent.click(within(park).getByRole('button', { name: 'Parken' }));
    fireEvent.click(await within(park).findByRole('button', { name: 'Parken' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/suppliers/${rel}/jbp/themen/${uuid(21)}/parken`,
      body: { reason: 'Kein Budget' },
    });
  });

  it('die Übernahme zeigt die interne Begründung und schickt nur die teilbare Beschreibung', async () => {
    const router = renderAt(`${base}/uebernehmen`);
    expect(await screen.findByText(/Intern: Preis zu hoch/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(await screen.findByText('Bitte mindestens ein Thema wählen.')).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kostensenkung Gehäuse' }));
    fireEvent.change(
      await screen.findByLabelText('Teilbare Beschreibung für „Kostensenkung Gehäuse“'),
      { target: { value: 'Gemeinsam Gehäusekosten senken' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/jbp/themen/uebernehmen`,
      body: {
        items: [{ strategicTopicId: uuid(40), description: 'Gemeinsam Gehäusekosten senken' }],
      },
    });
    expect(JSON.stringify(sent[0]?.body)).not.toContain('Preis zu hoch');
  });
});
