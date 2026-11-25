// @vitest-environment jsdom
import type { DueItem, MyDay } from '@reziproq/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionsFor,
  anna,
  api,
  myDayResponse,
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

const uuid = (n: number) => `550e8400-e29b-41d4-a716-4466554400${String(n).padStart(2, '0')}`;
const items = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: uuid(index),
    kind: 'rating' as const,
    supplier: `Lieferant ${index + 1}`,
    detail: 'Antrieb',
    dueDate: '2099-12-31',
    href: `/bewertungen/${uuid(index)}`,
  }));

let due: ReturnType<typeof items>;
let myDay: MyDay;

const focus = [
  { id: uuid(60), name: 'Alpha GmbH', rulesShared: true },
  { id: uuid(61), name: 'Beta AG', rulesShared: false },
];
const start = (overrides: Record<string, unknown> = {}) => ({
  due: { items: due.slice(0, 5), total: 7 },
  relationships: {
    items: [{ id: uuid(60), name: 'Alpha GmbH', target: 'Partner' }],
    total: 1,
  },
  nextMeeting: null,
  portfolio: { suppliers: 16, focusTotal: 2, openDecisions: 3, focus },
  openActions: 4,
  ...overrides,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  due = items(5);
  myDay = day();
  api.handle = (request) => {
    if (request.url === '/api/start') return Response.json(start());
    if (request.url === '/api/start/mein-tag') return Response.json(myDay);
    if (request.url === '/api/start/due') return Response.json({ items: items(7) });
    return undefined;
  };
});

afterEach(tearDownApp);

const rel = uuid(70);
const task = (id: number, dueDate: string, overrides: Partial<DueItem> = {}): DueItem => ({
  id: uuid(id),
  kind: 'action',
  supplier: 'Rheintal Elektronik',
  detail: `Aufgabe ${id}`,
  dueDate,
  href: `/lieferanten/${rel}/umsetzung/massnahmen#${uuid(id)}`,
  ...overrides,
});
const offset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Ein Tag mit überfälliger Aufgabe, einer für heute, einer in der Woche und rechts allem */
function day(): MyDay {
  const today = offset(0);
  return myDayResponse({
    today,
    next: {
      scope: 'global',
      item: task(1, offset(-2), { kind: 'validation', detail: 'Preis Leiterplatten' }),
      overdueDays: 2,
      minutes: 2,
    },
    todayItems: [task(2, today)],
    week: [task(3, offset(1), { kind: 'signature', supplier: 'Nordwerk Guss', detail: null })],
    total: 7,
    doneToday: 1,
    prepared: [
      {
        id: `meeting:${uuid(80)}`,
        kind: 'brief_goals',
        objectType: 'meeting',
        subject: 'JBP Rheintal',
        counterpart: 'Rheintal Elektronik',
        count: 4,
        createdAt: new Date().toISOString(),
        href: `/lieferanten/${rel}/umsetzung/termine/${uuid(80)}`,
      },
    ],
    preparedTotal: 1,
    waiting: [
      {
        id: `commitment:${uuid(81)}`,
        kind: 'commitment',
        title: '8D-Bericht Charge 4711',
        owner: 'Nils Ott',
        counterpart: 'Rheintal Elektronik',
        dueDate: offset(-3),
        href: `/lieferanten/${rel}/plan/zusagen#${uuid(81)}`,
      },
    ],
    waitingTotal: 1,
    timeline: [
      {
        id: `meeting:${uuid(82)}`,
        date: offset(3),
        kind: 'meeting',
        source: 'meeting',
        title: 'QBR Rheintal',
        counterpart: 'Rheintal Elektronik',
        detail: 'Teams',
        startsAt: new Date(`${offset(3)}T10:00:00`).toISOString(),
        progress: null,
        href: `/lieferanten/${rel}/umsetzung/termine/${uuid(82)}`,
        relationshipId: rel,
        categoryId: null,
      },
    ],
    hints: { open: 7, high: 1 },
  });
}

// Heute selbst testet features/today/he-01.test.tsx (K1-e). Alle Aufgaben bleibt für den Start der
// Lieferantenseite bis K5-b.
describe('Alle Aufgaben (bis K5-b für die Lieferantenseite)', () => {
  it('Alle Aufgaben: Zurück zu Heute, drei Ansichten und die volle Liste nach Frist', async () => {
    myDay = myDayResponse();
    renderAt('/start/faellig');
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /Lieferant \d/ })).toHaveLength(7),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Alle Aufgaben' })).toBeTruthy();
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Heute' }).getAttribute('href'),
    ).toBe('/heute');
    const views = screen.getByRole('navigation', { name: 'Ansichten' });
    expect(
      within(views)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Für mich · 7', 'Wartet auf andere · 0', 'Maßnahmen']);
    expect(
      within(views).getByRole('link', { name: 'Für mich · 7' }).getAttribute('aria-current'),
    ).toBe('page');
    // alle Fristen liegen weit in der Zukunft: Gruppe „Später“
    expect(screen.getByText('Später · 7')).toBeTruthy();
  });

  it('Alle Aufgaben, Ansicht „Wartet auf andere“: überfällige Zusagen anderer mit Dauer', async () => {
    renderAt('/start/faellig?ansicht=wartet');
    const row = await screen.findByRole('link', { name: /8D-Bericht Charge 4711/ });
    expect(row.getAttribute('href')).toBe(myDay.waiting[0]?.href);
    expect(within(row).getByText('seit 3 Tagen')).toBeTruthy();
  });

  it('Alle Aufgaben: „Als Nächstes“ oben, die übrigen nach Überfällig, Heute und Diese Woche', async () => {
    api.handle = (request) => {
      if (request.url === '/api/start/mein-tag') return Response.json(myDay);
      if (request.url === '/api/start/due') {
        return Response.json({
          items: [myDay.next?.item, task(4, offset(-1)), ...myDay.todayItems, ...myDay.week],
        });
      }
      return undefined;
    };
    renderAt('/start/faellig');
    await screen.findByText('Als Nächstes · überfällig seit 2 Tagen · 2 Min.');
    expect(screen.getByText('Überfällig · 1')).toBeTruthy();
    expect(screen.getByText('Heute · 1')).toBeTruthy();
    expect(screen.getByText('Diese Woche · 1')).toBeTruthy();
    expect(screen.getByText('seit 1 Tag')).toBeTruthy();
  });
});
