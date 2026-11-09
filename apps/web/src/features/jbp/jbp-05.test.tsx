// @vitest-environment jsdom
import type { Commitment, Commitments } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/JBP-05.md in der Oberfläche: zwei Spalten, überfällige oben und markiert,
// Status und Bearbeiten nur bei eigenen Zusagen, Verantwortliche nur aus der eigenen Seite.

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
const commitment = (n: number, extra: Partial<Commitment> = {}): Commitment => ({
  id: uuid(n),
  side: 'buyer',
  own: true,
  title: `Zusage ${n}`,
  ownerUserId: 'mia',
  ownerName: 'Mia Mitglied',
  dueOn: '2099-03-31',
  status: 'open',
  overdue: false,
  initiative: null,
  ...extra,
});
const data: Commitments = {
  hasPlan: true,
  ownSide: 'buyer',
  canEdit: true,
  people: [
    { userId: 'mia', name: 'Mia Mitglied' },
    { userId: 'sara', name: 'Sara Ost' },
  ],
  initiatives: [{ id: uuid(70), title: 'Zweitquelle' }],
  buyer: [
    commitment(20, { title: 'Zeichnungen freigeben', dueOn: '2020-01-31', overdue: true }),
    commitment(21, { title: 'Bedarfsausblick 2027' }),
  ],
  supplier: [
    commitment(30, {
      side: 'supplier',
      own: false,
      title: 'Kapazität reservieren',
      ownerUserId: 'kim',
      ownerName: 'Kim Kaiser',
      status: 'kept',
    }),
  ],
};
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
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
    if (request.url.startsWith(`/api/suppliers/${rel}/jbp/zusagen`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(data, { status: request.method === 'POST' ? 201 : 200 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/plan/zusagen`;

describe('JBP-05 Zusagen in der Oberfläche', () => {
  it('zwei Spalten; überfällige stehen oben und sind markiert', async () => {
    renderAt(base);
    const buyer = (await screen.findByRole('heading', { level: 2, name: 'Käufer sagt zu' }))
      .parentElement as HTMLElement;
    const rows = within(buyer).getAllByRole('listitem');
    expect(rows[0]?.textContent).toContain('Zeichnungen freigeben');
    expect(rows[0]?.getAttribute('data-overdue')).toBe('true');
    expect(within(rows[0] as HTMLElement).getByText('Überfällig')).toBeDefined();
    expect(rows[1]?.getAttribute('data-overdue')).toBeNull();
    const supplierColumn = screen.getByRole('heading', { level: 2, name: 'Lieferant sagt zu' })
      .parentElement as HTMLElement;
    expect(within(supplierColumn).getByText('Gehalten')).toBeDefined();
  });

  it('nur eigene Zusagen haben Status und Bearbeiten; der Status geht an die API', async () => {
    renderAt(base);
    const supplierColumn = (
      await screen.findByRole('heading', { level: 2, name: 'Lieferant sagt zu' })
    ).parentElement as HTMLElement;
    expect(within(supplierColumn).queryByRole('combobox')).toBeNull();
    expect(within(supplierColumn).queryByRole('link')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Status: Bedarfsausblick 2027' }), {
      target: { value: 'kept' },
    });
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/suppliers/${rel}/jbp/zusagen/${uuid(21)}/status`,
      body: { status: 'kept' },
    });
    expect(
      screen.getByRole('link', { name: 'Bedarfsausblick 2027: Bearbeiten' }).getAttribute('href'),
    ).toBe(`${base}/${uuid(21)}`);
  });

  it('eine neue Zusage braucht Titel, Person der eigenen Seite und Frist', async () => {
    const router = renderAt(`${base}/neu`);
    fireEvent.click(await screen.findByRole('button', { name: 'Zusage anlegen' }));
    expect(await screen.findAllByText('Bitte ausfüllen.')).toHaveLength(3);
    const owner = screen.getByLabelText('Verantwortlich') as HTMLSelectElement;
    expect([...owner.options].map((option) => option.textContent)).toEqual([
      'Verantwortlich',
      'Mia Mitglied',
      'Sara Ost',
    ]);
    fireEvent.change(screen.getByLabelText(/^Zusage/), { target: { value: 'Bedarfsausblick' } });
    fireEvent.change(owner, { target: { value: 'sara' } });
    fireEvent.change(screen.getByLabelText('Frist'), { target: { value: '2099-06-30' } });
    fireEvent.change(screen.getByLabelText('Initiative'), { target: { value: uuid(70) } });
    fireEvent.click(screen.getByRole('button', { name: 'Zusage anlegen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      body: {
        title: 'Bedarfsausblick',
        ownerUserId: 'sara',
        dueOn: '2099-06-30',
        initiativeId: uuid(70),
      },
    });
  });

  it('eine Zusage der anderen Seite lässt sich nicht bearbeiten', async () => {
    renderAt(`${base}/${uuid(30)}`);
    expect(await screen.findByText('Diese Zusage gibt es hier nicht.')).toBeDefined();
  });
});
