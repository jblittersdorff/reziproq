// @vitest-environment jsdom
import type { ActionItem, ActionList } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/QBR-03.md in der Oberfläche: Liste mit Filtern in der Adresse, Status in der
// Zeile, Überfällige markiert, neue Maßnahme aus einem Termin, /start/massnahmen. Seit ZQ-01
// (K2-a.3) zeigen die Seiten Zusagen und Aufgaben: Status je Art, gehalten nur mit Beleg, die Art
// statt der Sichtbarkeit im Formular und fest nach dem Anlegen.

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
  kind: 'commitment',
  title: `Eintrag ${n}`,
  description: null,
  visibility: 'shared',
  side: 'buyer',
  own: true,
  ownerSide: 'buyer',
  ownerUserId: 'anna',
  ownerName: 'Anna Schmidt',
  dueDate: '2099-03-01',
  status: 'open',
  evidence: null,
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
      item(3, { kind: 'task', visibility: 'internal', status: 'done' }),
      item(4, { kind: 'task', visibility: 'internal', status: 'in_progress' }),
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
          durationMinutes: 60,
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

describe('QBR-03 Zusagen und Aufgaben in der Oberfläche', () => {
  it('die Liste zeigt offene Zusagen und Aufgaben mit Art, Person, Frist und Quelle; Überfällige sind markiert', async () => {
    renderAt(base);
    const list = await screen.findByRole('list', { name: 'Zusagen und Aufgaben' });
    const rows = within(list).getAllByRole('listitem');
    const first = rows.find((row) => row.textContent?.includes('Eintrag 1')) as HTMLElement;
    expect(first.textContent).toContain('Zusage · Anna Schmidt');
    expect(first.textContent).toContain('überfällig');
    expect(first.textContent).toContain('Termin: Quartalsreview Q3');
    // Offen heißt bei Aufgaben auch „In Arbeit“; Erledigte sind ausgeblendet, bis der Filter sie zeigt.
    const working = rows.find((row) => row.textContent?.includes('Eintrag 4')) as HTMLElement;
    expect(working.textContent).toContain('Aufgabe · Anna Schmidt');
    expect(within(working).getByText('Intern')).toBeDefined();
    expect(screen.queryByText('Eintrag 3')).toBeNull();
    // Die Zusage der anderen Seite trägt ihr Kennzeichen und lässt sich nicht bearbeiten.
    const theirs = rows.find((row) => row.textContent?.includes('Eintrag 2')) as HTMLElement;
    expect(within(theirs).getByText('Lieferant')).toBeDefined();
    expect(within(theirs).queryByRole('link', { name: /Bearbeiten/ })).toBeNull();
  });

  it('die Filter stehen in der Adresse', async () => {
    const router = renderAt(base);
    fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'alle' } });
    await waitFor(() => expect(router.state.location.search).toEqual({ status: 'alle' }));
    expect(await screen.findByText('Eintrag 3')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'aufgabe' } });
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ status: 'alle', art: 'aufgabe' }),
    );
    expect(screen.queryByText('Eintrag 1')).toBeNull();
    expect(screen.getByText('Eintrag 4')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: '' } });
    await waitFor(() => expect(router.state.location.search).toEqual({ status: 'alle' }));
    fireEvent.change(screen.getByLabelText('Verantwortlich'), { target: { value: 'Kim Kaiser' } });
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ status: 'alle', person: 'Kim Kaiser' }),
    );
    expect(screen.queryByText('Eintrag 1')).toBeNull();
  });

  it('der Status ändert sich direkt in der Zeile, je Art mit eigenen Status', async () => {
    renderAt(base);
    const task = await screen.findByLabelText('Status von „Eintrag 4“');
    expect([...task.querySelectorAll('option')].map((option) => option.value)).toEqual([
      'open',
      'in_progress',
      'done',
      'cancelled',
    ]);
    const commitment = screen.getByLabelText('Status von „Eintrag 1“');
    expect([...commitment.querySelectorAll('option')].map((option) => option.value)).toEqual([
      'open',
      'kept',
      'missed',
      'withdrawn',
    ]);
    fireEvent.change(task, { target: { value: 'done' } });
    await waitFor(() =>
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'PUT',
          url: `/api/suppliers/${rel}/massnahmen/${uuid(24)}/status`,
          body: { status: 'done' },
        }),
      ),
    );
  });

  it('„Gehalten“ bucht eine Zusage erst mit Beleg (ZQ-01 Regel 2)', async () => {
    renderAt(base);
    fireEvent.change(await screen.findByLabelText('Status von „Eintrag 1“'), {
      target: { value: 'kept' },
    });
    const form = await screen.findByRole('form', { name: 'Beleg für „Eintrag 1“' });
    expect(sent).toEqual([]);
    const book = within(form).getByRole('button', { name: 'Als gehalten buchen' });
    expect((book as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText('Beleg'), { target: { value: 'goods_receipt' } });
    fireEvent.change(within(form).getByLabelText('Notiz (optional)'), {
      target: { value: 'WE 4711' },
    });
    fireEvent.click(book);
    await waitFor(() =>
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'PUT',
          url: `/api/suppliers/${rel}/massnahmen/${uuid(21)}/status`,
          body: { status: 'kept', evidence: { kind: 'goods_receipt', note: 'WE 4711' } },
        }),
      ),
    );
  });

  it('eine Zusage aus dem Termin trägt den Termin als Quelle und ist geteilt', async () => {
    const router = renderAt(`${base}/neu?termin=${mid}`);
    expect(await screen.findByText('Aus dem Termin „Quartalsreview Q3“')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Was ist zu tun?'), {
      target: { value: 'Zweitquelle prüfen' },
    });
    fireEvent.change(screen.getByLabelText('Frist'), { target: { value: '2099-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zusage anlegen' }));
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

  it('eine Aufgabe ist intern und gehört der eigenen Seite', async () => {
    const router = renderAt(`${base}/neu`);
    fireEvent.change(await screen.findByLabelText('Art'), { target: { value: 'task' } });
    // Die verantwortliche Seite wählt nur eine Zusage
    expect(screen.queryByLabelText('Verantwortliche Seite')).toBeNull();
    fireEvent.change(screen.getByLabelText('Was ist zu tun?'), {
      target: { value: 'Preisspielraum klären' },
    });
    fireEvent.change(screen.getByLabelText('Frist'), { target: { value: '2099-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aufgabe anlegen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]?.body).toMatchObject({
      action: { visibility: 'internal', ownerSide: 'buyer', ownerUserId: 'anna' },
      sourceType: 'manual',
    });
  });

  it('beim Bearbeiten bleibt die Art fest; Kommentare hängen an der Zusage', async () => {
    renderAt(`${base}/${uuid(21)}`);
    expect(await screen.findByRole('heading', { name: 'Zusage bearbeiten' })).toBeDefined();
    expect(await screen.findByText('Zusage. Die Art bleibt nach dem Anlegen fest.')).toBeDefined();
    expect(screen.queryByLabelText('Art')).toBeNull();
    await waitFor(() =>
      expect(api.requests.map((request) => request.url)).toContain(
        `/api/suppliers/${rel}/kommentare/commitment/${uuid(21)}`,
      ),
    );
  });

  it('ohne Frist wird nichts angelegt', async () => {
    renderAt(`${base}/neu`);
    fireEvent.change(await screen.findByLabelText('Was ist zu tun?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zusage anlegen' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('/start/massnahmen zeigt die offenen Zusagen und Aufgaben aller Beziehungen mit Weg zum Ort', async () => {
    renderAt('/start/massnahmen');
    const link = await screen.findByRole('link', { name: /Eintrag 1/ });
    expect(link.getAttribute('href')).toBe(`${base}#${uuid(21)}`);
    expect(link.textContent).toContain('Zusage · Rheintal Elektronik GmbH (Demo)');
    expect(link.textContent).toContain('überfällig');
  });
});
