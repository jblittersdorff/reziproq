// @vitest-environment jsdom
import type { ActionItem, ActionList } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/QBR-03.md in der Oberfläche: Liste mit Filtern in der Adresse, Status in der
// Zeile, Überfällige markiert, neue Maßnahme aus einem Termin, /start/massnahmen.

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
const mid = uuid(10);
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
const item = (n: number, overrides: Partial<ActionItem> = {}): ActionItem => ({
  id: uuid(20 + n),
  title: `Maßnahme ${n}`,
  description: null,
  visibility: 'shared',
  side: 'buyer',
  own: true,
  ownerSide: 'buyer',
  ownerUserId: 'anna',
  ownerName: 'Anna Schmidt',
  dueDate: '2099-03-01',
  status: 'open',
  overdue: false,
  sourceType: 'manual',
  sourceId: null,
  sourceTitle: null,
  sourceDimension: null,
  canEdit: true,
  canChangeStatus: true,
  ...overrides,
});
let list: ActionList;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  list = {
    actions: [
      item(1, {
        overdue: true,
        dueDate: '2020-01-31',
        sourceType: 'meeting',
        sourceId: mid,
        sourceTitle: 'Quartalsreview Q3',
      }),
      item(2, {
        side: 'supplier',
        own: false,
        canEdit: false,
        ownerSide: 'supplier',
        ownerName: 'Kim Kaiser',
        ownerUserId: null,
      }),
      item(3, { status: 'done' }),
    ],
    canCreate: true,
    people: [{ userId: 'anna', name: 'Anna Schmidt' }],
  };
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
    if (request.url === `/api/suppliers/${rel}/termine/${mid}`) {
      return Response.json({
        meeting: {
          id: mid,
          type: 'quarterly_review',
          title: 'Quartalsreview Q3',
          startsAt: '2099-03-15T09:00:00Z',
          location: null,
          status: 'planned',
          ownerSide: 'buyer',
          protocol: null,
          createdByName: 'Anna Schmidt',
        },
        participants: [],
        agenda: [],
        decisions: [],
        note: null,
        canEditMeeting: true,
        canContribute: true,
        live: { sections: [], frozenAt: null },
        canClose: true,
      });
    }
    if (request.url === `/api/suppliers/${rel}/massnahmen`) {
      if (request.method === 'POST') {
        sent.push(request);
        return Response.json(item(9), { status: 201 });
      }
      return Response.json(list);
    }
    if (request.url.startsWith(`/api/suppliers/${rel}/massnahmen/`)) {
      sent.push(request);
      return Response.json(item(1, { status: 'done' }));
    }
    if (request.url === '/api/start/massnahmen') {
      return Response.json({
        items: [
          {
            ...item(1, { overdue: true, dueDate: '2020-01-31' }),
            relationshipId: rel,
            counterpart: 'Rheintal Elektronik GmbH (Demo)',
            href: `/lieferanten/${rel}/umsetzung/massnahmen#${uuid(21)}`,
          },
        ],
      });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/umsetzung/massnahmen`;

describe('QBR-03 Maßnahmen in der Oberfläche', () => {
  it('die Liste zeigt offene Maßnahmen mit Person, Frist und Quelle; Überfällige sind markiert', async () => {
    renderAt(base);
    const list = await screen.findByRole('list', { name: 'Maßnahmen' });
    const rows = within(list).getAllByRole('listitem');
    const first = rows.find((row) => row.textContent?.includes('Maßnahme 1')) as HTMLElement;
    expect(first.textContent).toContain('überfällig');
    expect(first.textContent).toContain('Termin: Quartalsreview Q3');
    // Erledigte sind ausgeblendet, bis der Filter sie zeigt.
    expect(screen.queryByText('Maßnahme 3')).toBeNull();
    // Die Maßnahme der anderen Seite trägt ihr Kennzeichen und lässt sich nicht bearbeiten.
    const theirs = rows.find((row) => row.textContent?.includes('Maßnahme 2')) as HTMLElement;
    expect(within(theirs).getByText('Lieferant')).toBeDefined();
    expect(within(theirs).queryByRole('link', { name: /Bearbeiten/ })).toBeNull();
  });

  it('die Filter stehen in der Adresse', async () => {
    const router = renderAt(base);
    fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'alle' } });
    await waitFor(() => expect(router.state.location.search).toEqual({ status: 'alle' }));
    expect(await screen.findByText('Maßnahme 3')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Verantwortlich'), { target: { value: 'Kim Kaiser' } });
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ status: 'alle', person: 'Kim Kaiser' }),
    );
    expect(screen.queryByText('Maßnahme 1')).toBeNull();
  });

  it('der Status ändert sich direkt in der Zeile', async () => {
    renderAt(base);
    fireEvent.change(await screen.findByLabelText('Status von „Maßnahme 1“'), {
      target: { value: 'done' },
    });
    await waitFor(() =>
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'PUT',
          url: `/api/suppliers/${rel}/massnahmen/${uuid(21)}/status`,
          body: { status: 'done' },
        }),
      ),
    );
  });

  it('eine Maßnahme aus dem Termin trägt den Termin als Quelle', async () => {
    const router = renderAt(`${base}/neu?termin=${mid}`);
    expect(await screen.findByText('Aus dem Termin „Quartalsreview Q3“')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Was ist zu tun?'), {
      target: { value: 'Zweitquelle prüfen' },
    });
    fireEvent.change(screen.getByLabelText('Frist'), { target: { value: '2099-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Maßnahme anlegen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]?.body).toEqual({
      action: {
        title: 'Zweitquelle prüfen',
        description: null,
        visibility: 'shared',
        ownerSide: 'buyer',
        ownerUserId: 'anna',
        ownerName: null,
        dueDate: '2099-04-01',
      },
      sourceType: 'meeting',
      sourceId: mid,
    });
  });

  it('ohne Frist wird keine Maßnahme angelegt', async () => {
    renderAt(`${base}/neu`);
    fireEvent.change(await screen.findByLabelText('Was ist zu tun?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Maßnahme anlegen' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('/start/massnahmen zeigt die offenen Maßnahmen aller Beziehungen mit Weg zum Ort', async () => {
    renderAt('/start/massnahmen');
    const link = await screen.findByRole('link', { name: /Maßnahme 1/ });
    expect(link.getAttribute('href')).toBe(`${base}#${uuid(21)}`);
    expect(link.textContent).toContain('Rheintal Elektronik GmbH (Demo)');
    expect(link.textContent).toContain('überfällig');
  });
});
