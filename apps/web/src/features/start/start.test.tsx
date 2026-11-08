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

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  due = items(5);
  api.handle = (request) => {
    if (request.url === '/api/start') {
      return Response.json({
        due: { items: due.slice(0, 5), total: 7 },
        relationships: {
          items: [{ id: uuid(60), name: 'Alpha GmbH', target: 'Partner' }],
          total: 1,
        },
        nextMeeting: null,
      });
    }
    if (request.url === '/api/start/due') return Response.json({ items: items(7) });
    return undefined;
  };
});

afterEach(tearDownApp);

describe('NAV-05 Start', () => {
  it('zeigt die fälligen Aufgaben als Liste mit genau einem Knopf je Zeile (UMB-05)', async () => {
    renderAt('/start');
    expect(
      await screen.findByRole('heading', { level: 2, name: '7 Dinge für heute' }),
    ).toBeTruthy();
    const list = document.querySelector('[data-slot="due-list"]') as HTMLElement;
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(within(row).getAllByRole('link')).toHaveLength(1);
    const first = within(rows[0] as HTMLElement).getByRole('link');
    expect(first.getAttribute('href')).toBe(`/bewertungen/${uuid(0)}`);
    expect(first.getAttribute('aria-label')).toBe(
      'Lieferant 1: Bewertung abgeben · Antrieb öffnen',
    );
    // Nur die erste Zeile hat den gefüllten Knopf.
    expect(first.className).toContain('bg-primary');
    expect(within(rows[1] as HTMLElement).getByRole('link').className).not.toContain('bg-primary');
    // Mehr als fünf: Link zur vollen Liste.
    expect(
      screen.getByRole('link', { name: 'Alle 7 fälligen Aufgaben' }).getAttribute('href'),
    ).toBe('/start/faellig');
    expect(screen.queryByText(/Kommt (mit|nach) Release/)).toBeNull();
    // Die eigenen Lieferanten als Karten mit Monogramm.
    const alpha = screen.getByRole('link', { name: /^Alpha GmbH/ });
    expect(alpha.querySelector('[data-slot="monogram"]')?.textContent).toBe('AL');
    expect(screen.getByText('Soll: Partner')).toBeTruthy();
  });

  it('zeigt den nächsten Termin als Kachel mit Link zur Termin-Seite (QBR-01b)', async () => {
    api.handle = (request) =>
      request.url === '/api/start'
        ? Response.json({
            due: { items: due, total: due.length },
            relationships: { items: [], total: 0 },
            nextMeeting: {
              id: uuid(90),
              relationshipId: uuid(60),
              counterpart: 'Alpha GmbH',
              title: 'Quartalsreview',
              startsAt: '2099-03-15T09:00:00Z',
              location: 'Werk Nord',
            },
          })
        : undefined;
    renderAt('/start');
    const link = await screen.findByRole('link', { name: 'Vorbereiten: Quartalsreview' });
    expect(link.getAttribute('href')).toBe(
      `/lieferanten/${uuid(60)}/umsetzung/termine/${uuid(90)}`,
    );
    const tile = link.closest('[data-slot="next-meeting"]') as HTMLElement;
    expect(within(tile).getByText('Nächster Termin')).toBeDefined();
    expect(within(tile).getByText(/Alpha GmbH/)).toBeDefined();
  });

  it('zeigt auf /start/faellig die vollständige Liste', async () => {
    renderAt('/start/faellig');
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /Lieferant \d/ })).toHaveLength(7),
    );
  });

  it('zeigt bei nichts Fälligem einen freundlichen leeren Zustand', async () => {
    due = [];
    api.handle = (request) =>
      request.url === '/api/start'
        ? Response.json({
            due: { items: [], total: 0 },
            relationships: { items: [], total: 0 },
            nextMeeting: null,
          })
        : undefined;
    renderAt('/start');
    expect(await screen.findByText('Nichts fällig.')).toBeTruthy();
  });
});
