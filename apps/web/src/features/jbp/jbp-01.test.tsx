// @vitest-environment jsdom
import type { JbpPreparation } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/JBP-01.md in der Oberfläche: Anlegen mit Termin aus dem Zyklus, Agenda mit
// Stand je Punkt, Hinweis nur beim Käufer, eigenes Geschäftsupdate auf eigener Seite.

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
const empty: JbpPreparation = {
  jbp: null,
  canCreate: true,
  suggestedDate: '2099-01-15',
  meeting: null,
  agenda: [],
  live: { rules: null, feedback: null },
  updates: { buyer: null, supplier: null },
  ownSide: 'buyer',
  canEditOwnUpdate: false,
  buyerHint: { supplierPlanApproved: false },
};
const prepared: JbpPreparation = {
  ...empty,
  jbp: { id: uuid(5), version: 1, status: 'draft' },
  canCreate: false,
  meeting: {
    id: uuid(6),
    title: 'Joint Business Planning 2099',
    startsAt: '2099-01-15T09:00:00Z',
    location: 'Werk Nord',
    participants: [],
  },
  agenda: [
    {
      id: uuid(10),
      title: 'Geschäftsupdate Käufer',
      side: 'buyer',
      section: 'buyer_update',
      ready: true,
    },
    {
      id: uuid(11),
      title: 'Geschäftsupdate Lieferant',
      side: 'buyer',
      section: 'supplier_update',
      ready: false,
    },
  ],
  live: {
    rules: { typeName: 'Strategischer Partner', sharedAt: '2026-11-01T08:00:00Z' },
    feedback: {
      waveId: '0190a0a0-0000-7000-8000-000000000077',
      kind: 'annual',
      revealedAt: '2026-10-31T08:00:00Z',
      topGap: { dimension: 'transparency', delta: -0.9 },
    },
  },
  updates: {
    buyer: { text: 'Volumen plus 8 %.', updatedAt: '2026-11-08T08:00:00Z' },
    supplier: null,
  },
  canEditOwnUpdate: true,
};
let current: JbpPreparation;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  current = empty;
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
    if (request.url.startsWith(`/api/suppliers/${rel}/jbp`)) {
      if (request.method !== 'GET') {
        sent.push(request);
        current = prepared;
        return Response.json(current, { status: request.method === 'POST' ? 201 : 200 });
      }
      return Response.json(current);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/plan/vorbereitung`;

describe('JBP-01 Vorbereitung in der Oberfläche', () => {
  it('Anlegen schlägt den Termin aus dem Zyklus vor und schickt Termin und Ort', async () => {
    renderAt(base);
    const date = (await screen.findByLabelText('Termin')) as HTMLInputElement;
    expect(date.value).toBe('2099-01-15');
    fireEvent.change(screen.getByLabelText('Ort oder Link'), { target: { value: 'Werk Nord' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinsamen Plan anlegen' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toMatchObject({ location: 'Werk Nord', locale: 'de' });
    expect(await screen.findByText('Joint Business Planning 2099')).toBeDefined();
  });

  it('die Agenda zeigt je Punkt bereit oder fehlt, dazu die geteilten Spielregeln und das aufgedeckte Feedback', async () => {
    current = prepared;
    renderAt(base);
    const agenda = (await screen.findByRole('heading', { name: 'Agenda' }))
      .parentElement as HTMLElement;
    const rows = within(agenda).getAllByRole('listitem');
    expect(rows[0]?.textContent).toContain('bereit');
    expect(rows[1]?.textContent).toContain('fehlt');
    expect(
      within(agenda).getByText('Beziehungstyp und Spielregeln: Strategischer Partner'),
    ).toBeDefined();
    // PUL-03: das aufgedeckte Feedback mit seiner größten Lücke, live aus der Welle.
    expect(within(agenda).getByText('Größte Lücke: Transparenz 0,9')).toBeDefined();
    // Der Hinweis zum Lieferantenplan steht beim Käufer.
    expect(screen.getByText(/Der Lieferantenplan ist noch nicht freigegeben/)).toBeDefined();
  });

  it('ohne Hinweis vom Server erscheint auch keiner (Lieferantenseite)', async () => {
    current = { ...prepared, buyerHint: null };
    renderAt(base);
    await screen.findByRole('heading', { name: 'Agenda' });
    expect(screen.queryByText(/Der Lieferantenplan ist noch nicht freigegeben/)).toBeNull();
  });

  it('das eigene Geschäftsupdate wird auf eigener Seite geschrieben', async () => {
    current = prepared;
    const router = renderAt(`${base}/geschaeftsupdate`);
    const field = (await screen.findByLabelText('Euer Geschäftsupdate')) as HTMLTextAreaElement;
    expect(field.value).toBe('Volumen plus 8 %.');
    fireEvent.change(field, { target: { value: 'Volumen plus 10 %.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/suppliers/${rel}/jbp/geschaeftsupdate`,
      body: { text: 'Volumen plus 10 %.' },
    });
  });
});
