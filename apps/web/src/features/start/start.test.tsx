// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
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
      });
    }
    if (request.url === '/api/start/due') return Response.json({ items: items(7) });
    return undefined;
  };
});

afterEach(tearDownApp);

describe('NAV-05 Start', () => {
  it('zeigt „Fällig bei mir“ mit Link zur Bewertung und „Alle“', async () => {
    renderAt('/start');
    const link = await screen.findByRole('link', { name: /Lieferant 1/ });
    expect(link.getAttribute('href')).toBe(`/bewertungen/${uuid(0)}`);
    expect(screen.getAllByRole('link', { name: /Lieferant \d/ })).toHaveLength(5);
    const all = screen.getAllByRole('link', { name: 'Alle' });
    expect(all[0]?.getAttribute('href')).toBe('/start/faellig');
    expect(screen.getAllByText('Kommt mit Release 0.2')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Alpha GmbH/ })).toBeTruthy();
    expect(screen.getByText('Soll: Partner')).toBeTruthy();
  });

  it('die Kacheln stehen auf breiten Bildschirmen zu zweit nebeneinander', async () => {
    renderAt('/start');
    await screen.findByRole('link', { name: /Lieferant 1/ });
    const grid = screen.getByText('Fällig bei mir').closest('[data-slot="tile"]')?.parentElement;
    expect(grid?.className).toContain('md:grid-cols-2');
    expect(grid?.className).toContain('gap-6');
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
        ? Response.json({ due: { items: [], total: 0 }, relationships: { items: [], total: 0 } })
        : undefined;
    renderAt('/start');
    expect(await screen.findByText('Nichts fällig.')).toBeTruthy();
  });
});
