// @vitest-environment jsdom
import type { DoneList, DoneRow } from '@reziproq/shared';
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

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

// HE-01 Erledigt im Hintergrund (K1-e.3, Vorlage Erledigt): Zeilen mit Uhrzeit, Aufgabe, Text und
// Objekt; Zurücknehmen oder der Grund, warum nicht; Filter nach Aufgabe; rechts die Stufen je Aufgabe
// mit Verweis auf Mein Agent (Inventar T1-I11 und T1-I15, Teil Erledigt).

const uuid = (n: number) => `550e8400-e29b-41d4-a716-4466554403${String(n).padStart(2, '0')}`;
const rheintal = uuid(90);
const at = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const row = (n: number, overrides: Partial<DoneRow> = {}): DoneRow => ({
  id: uuid(n),
  at: at(1),
  task: 'inbox',
  taskName: 'Postfach',
  status: 'done',
  action: 'inbound_assign',
  subject: `Termin ${n}`,
  counterpart: 'Rheintal Elektronik',
  href: `/lieferanten/${rheintal}/umsetzung/termine/${uuid(n + 40)}`,
  openDrafts: 0,
  undo: { possible: true, blocker: null },
  ...overrides,
});

function list(): DoneList {
  return {
    since: at(20),
    recent: 4,
    rows: [
      row(1, { subject: 'Abstimmung Musterteile' }),
      row(2, {
        task: 'meeting_brief',
        taskName: 'Termin-Briefing',
        action: 'prepared',
        subject: 'JBP Rheintal',
        openDrafts: 3,
        href: '/kurz-pruefen',
        undo: { possible: false, blocker: 'ohne' },
      }),
      row(3, { subject: 'QBR Nordwerk', undo: { possible: false, blocker: 'geaendert' } }),
      row(4, {
        task: 'meeting_brief',
        taskName: 'Termin-Briefing',
        action: 'run',
        status: 'failed',
        subject: null,
        href: null,
        undo: { possible: false, blocker: 'ohne' },
      }),
    ],
    tasks: [
      { key: 'inbox', level: 'do' },
      { key: 'meeting_brief', level: 'prepare' },
      { key: 'early_warning', level: 'suggest' },
    ],
  };
}

let posted: string[];
let current: DoneList;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  // Feste Uhrzeit am Tag: „vor einer Stunde“ wäre zwischen 00:00 und 01:00 gestern
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 25, 10, 30));
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  posted = [];
  current = list();
  api.handle = (request) => {
    if (request.url === '/api/erledigt') return Response.json(current);
    if (request.method === 'POST' && request.url.startsWith('/api/erledigt/')) {
      posted.push(request.url);
      current = {
        ...current,
        rows: current.rows.map((entry) =>
          entry.id === uuid(1)
            ? { ...entry, status: 'undone', undo: { possible: false, blocker: 'zurueckgenommen' } }
            : entry,
        ),
      };
      return Response.json({ state: 'undone' });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('HE-01 Erledigt im Hintergrund', () => {
  it('Kopf, Zusammenfassung mit Arten und die Zeilen des Tages mit Uhrzeit', async () => {
    renderAt('/erledigt');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Erledigt im Hintergrund' }),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        '4 Vorgänge seit gestern 18:00 · alles nachlesbar, vieles mit einem Klick zurückzunehmen',
      ),
    ).toBeTruthy();
    const summary = screen.getByRole('region', { name: 'Zusammengefasst von Reziproq' });
    expect(
      within(summary).getByText(
        '4 Vorgänge erledigt, nichts davon verbindlich gegenüber Lieferanten.',
      ),
    ).toBeTruthy();
    expect(within(summary).getByText('2 Termine zugeordnet')).toBeTruthy();
    expect(within(summary).getByText('1 Entwurf vorbereitet')).toBeTruthy();
    expect(within(summary).getByText('1 fehlgeschlagen')).toBeTruthy();
    const day = screen.getByRole('region', { name: 'Heute' });
    expect(
      within(day).getByText(
        'Termin „Abstimmung Musterteile“ der Beziehung Rheintal Elektronik zugeordnet',
      ),
    ).toBeTruthy();
    expect(within(day).getAllByText('Postfach · Rheintal Elektronik').length).toBeGreaterThan(0);
  });

  it('T1-I11: Zurücknehmen nimmt eine Zuordnung zurück; danach steht sie als zurückgenommen da', async () => {
    renderAt('/erledigt');
    const buttons = await screen.findAllByRole('button', { name: 'Zurücknehmen' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0] as HTMLElement);
    await waitFor(() => expect(posted).toEqual([`/api/erledigt/${uuid(1)}/zuruecknehmen`]));
    expect(await screen.findByText('zurückgenommen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zurücknehmen' })).toBeNull();
  });

  it('Geändert: der Grund steht in der Zeile; die Ablehnung beim Zurücknehmen nennt die Person', async () => {
    api.handle = (request) => {
      if (request.url === '/api/erledigt') return Response.json(current);
      if (request.method === 'POST') {
        return Response.json(
          { statusCode: 409, code: 'geaendert', changedBy: 'Carla Brandt' },
          { status: 409 },
        );
      }
      return undefined;
    };
    renderAt('/erledigt');
    expect(await screen.findByText('Seitdem geändert, Rücknahme nicht möglich')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurücknehmen' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Seitdem geändert von Carla Brandt, Rücknahme nicht möglich',
    );
  });

  it('Vorbereitetes führt nach Kurz prüfen; Fehlgeschlagenes steht mit Status als Text', async () => {
    renderAt('/erledigt');
    expect(await screen.findByText('JBP Rheintal vorbereitet, wartet in Kurz prüfen')).toBeTruthy();
    expect(
      screen.getAllByRole('link', { name: 'Ansehen' }).map((link) => link.getAttribute('href')),
    ).toContain('/kurz-pruefen');
    expect(screen.getByText('Termin-Briefing fehlgeschlagen')).toBeTruthy();
    expect(screen.getByText('fehlgeschlagen')).toBeTruthy();
  });

  it('Filter nach Aufgabe; rechts die Stufen je Aufgabe und der Weg zu Mein Agent', async () => {
    renderAt('/erledigt');
    await screen.findByText('JBP Rheintal vorbereitet, wartet in Kurz prüfen');
    fireEvent.click(screen.getByRole('radio', { name: 'Termin-Briefing' }));
    expect(screen.queryByText(/Abstimmung Musterteile/)).toBeNull();
    expect(screen.getByText('JBP Rheintal vorbereitet, wartet in Kurz prüfen')).toBeTruthy();
    const levels = screen.getByRole('region', { name: 'So arbeitet Reziproq für dich' });
    expect(within(levels).getByText('erledigt selbst')).toBeTruthy();
    expect(within(levels).getByText('Erledigen')).toBeTruthy();
    expect(within(levels).getByText('Vorbereiten')).toBeTruthy();
    expect(within(levels).getByText('Vorschlagen')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'In Mein Agent ändern ›' }).getAttribute('href')).toBe(
      '/mein-agent',
    );
    expect(screen.getByText('Nie automatisch')).toBeTruthy();
  });
});
