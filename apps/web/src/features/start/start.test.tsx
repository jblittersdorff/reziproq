// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
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

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
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
  api.handle = (request) => {
    if (request.url === '/api/start') return Response.json(start());
    if (request.url === '/api/start/due') return Response.json({ items: items(7) });
    return undefined;
  };
});

afterEach(tearDownApp);

describe('NAV-05 Start (Handschrift Bühne A2)', () => {
  it('die Bühne nennt die Lage, führt zu den fälligen Aufgaben und zeigt drei Zahlen', async () => {
    renderAt('/start');
    expect(await screen.findByText('Sieben Dinge warten heute auf dich.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Fällige Aufgaben' }).getAttribute('href')).toBe(
      '/start/faellig',
    );
    const metrics = document.querySelector('dl[aria-label="Auf einen Blick"]') as HTMLElement;
    expect(
      [...metrics.querySelectorAll('[data-metric]')].map((metric) => metric.textContent),
    ).toEqual(['Lieferanten16', 'im Fokus2', 'offene Entscheidungen3']);
    // Das Fragefeld steht ohne Symbol direkt unter der Bühne.
    const prompt = document.querySelector('[data-slot="prompt"]') as HTMLElement;
    expect(within(prompt).getByRole('textbox', { name: 'Deine Frage an Reziproq' })).toBeTruthy();
    expect(prompt.querySelectorAll('svg')).toHaveLength(1);
  });

  it('die erste Kachel zeigt die nächste Aufgabe mit einem Knopf und dem Weg zu allen', async () => {
    renderAt('/start');
    const tile = (
      await screen.findByRole('heading', { level: 2, name: 'Bewertung abgeben' })
    ).closest('[data-slot="due-tile"]') as HTMLElement;
    expect(within(tile).getByText('Nur intern')).toBeTruthy();
    expect(within(tile).getByText('Lieferant 1 · Antrieb')).toBeTruthy();
    const action = within(tile).getByRole('link', {
      name: 'Lieferant 1: Bewertung abgeben · Antrieb öffnen',
    });
    expect(action.textContent).toBe('Jetzt bewerten');
    expect(action.getAttribute('href')).toBe(`/bewertungen/${uuid(0)}`);
    expect(within(tile).getByRole('link', { name: 'Alle Aufgaben' }).getAttribute('href')).toBe(
      '/start/faellig',
    );
  });

  it('Im Fokus nennt die Fokuslieferanten mit Stand der Spielregeln; die Zahl führt zu den Entscheidungen', async () => {
    renderAt('/start');
    const list = (await screen.findByRole('heading', { level: 2, name: 'Im Fokus' })).closest(
      '[data-slot="list-tile"]',
    ) as HTMLElement;
    const alpha = within(list).getByRole('link', { name: /^Alpha GmbH/ });
    expect(alpha.getAttribute('href')).toBe(`/lieferanten/${uuid(60)}`);
    expect(within(alpha).getByText('Spielregeln geteilt')).toBeTruthy();
    expect(
      within(within(list).getByRole('link', { name: /^Beta AG/ })).getByText('intern'),
    ).toBeTruthy();
    expect(within(list).getByRole('link', { name: 'Zum Portfolio' }).getAttribute('href')).toBe(
      '/portfolio',
    );
    const count = document.querySelector('[data-slot="count-tile"]') as HTMLElement;
    expect(within(count).getByText('3')).toBeTruthy();
    expect(
      within(count).getByRole('link', { name: 'Entscheidungen ansehen' }).getAttribute('href'),
    ).toBe('/portfolio/offen');
  });

  it('ohne Portfolio zeigt Start die eigenen Beziehungen und die offenen Maßnahmen', async () => {
    api.handle = (request) =>
      request.url === '/api/start' ? Response.json(start({ portfolio: null })) : undefined;
    renderAt('/start');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Meine Beziehungen' }),
    ).toBeTruthy();
    expect(screen.getByText('Partner')).toBeTruthy();
    const count = document.querySelector('[data-slot="count-tile"]') as HTMLElement;
    expect(within(count).getByText('4')).toBeTruthy();
    expect(
      within(count).getByRole('link', { name: 'Maßnahmen ansehen' }).getAttribute('href'),
    ).toBe('/start/massnahmen');
  });

  it('zeigt den nächsten Termin als dunkle Kachel mit Link zur Agenda (QBR-01b)', async () => {
    api.handle = (request) =>
      request.url === '/api/start'
        ? Response.json(
            start({
              nextMeeting: {
                id: uuid(90),
                relationshipId: uuid(60),
                counterpart: 'Alpha GmbH',
                title: 'Quartalsreview',
                startsAt: '2099-03-15T09:00:00Z',
                location: 'Werk Nord',
              },
            }),
          )
        : undefined;
    renderAt('/start');
    const link = await screen.findByRole('link', { name: 'Agenda öffnen: Quartalsreview' });
    expect(link.getAttribute('href')).toBe(
      `/lieferanten/${uuid(60)}/umsetzung/termine/${uuid(90)}`,
    );
    const tile = link.closest('[data-slot="next-meeting"]') as HTMLElement;
    expect(tile.getAttribute('data-tone')).toBe('stage');
    expect(within(tile).getByText('Geteilt mit Alpha GmbH')).toBeDefined();
    expect(within(tile).getByText('Werk Nord')).toBeDefined();
  });

  it('eine fällige Zusage oder ein Meilenstein steht als Aufgabe auf Start (JBP-05)', async () => {
    api.handle = (request) =>
      request.url === '/api/start'
        ? Response.json(
            start({
              due: {
                items: [
                  {
                    id: uuid(80),
                    kind: 'commitment',
                    supplier: 'Alpha GmbH',
                    detail: 'Bedarfsausblick 2027',
                    dueDate: '2099-03-31',
                    href: `/lieferanten/${uuid(60)}/plan/zusagen#${uuid(80)}`,
                  },
                ],
                total: 1,
              },
            }),
          )
        : undefined;
    renderAt('/start');
    const tile = (
      await screen.findByRole('heading', { level: 2, name: 'Zusage einhalten' })
    ).closest('[data-slot="due-tile"]') as HTMLElement;
    expect(within(tile).getByText('Alpha GmbH · Bedarfsausblick 2027')).toBeTruthy();
    expect(
      within(tile)
        .getByRole('link', { name: 'Alpha GmbH: Zusage · Bedarfsausblick 2027 öffnen' })
        .getAttribute('href'),
    ).toBe(`/lieferanten/${uuid(60)}/plan/zusagen#${uuid(80)}`);
  });

  it('zeigt auf /start/faellig die vollständige Liste', async () => {
    renderAt('/start/faellig');
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /Lieferant \d/ })).toHaveLength(7),
    );
  });

  it('bei nichts Fälligem bleibt die Bühne ruhig und die Kacheln erklären sich', async () => {
    due = [];
    api.handle = (request) =>
      request.url === '/api/start'
        ? Response.json(start({ due: { items: [], total: 0 } }))
        : undefined;
    renderAt('/start');
    expect(await screen.findByText('Heute wartet nichts auf dich.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Fällige Aufgaben' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Nichts fällig.' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Kein Termin geplant' })).toBeTruthy();
  });
});
