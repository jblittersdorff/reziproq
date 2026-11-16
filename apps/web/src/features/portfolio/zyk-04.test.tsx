// @vitest-environment jsdom
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

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

// ZYK-04 für die Oberfläche: Tabelle mit „Termin fehlt“, Filter und Sortierung in der Adresse,
// Zeile führt zum Überblick.

const rel = (n: number) => `550e8400-e29b-41d4-a716-4466554400${String(n).padStart(2, '0')}`;
const unit = '550e8400-e29b-41d4-a716-446655440099';
let requests: string[] = [];

const response = {
  metrics: { total: 2, onTrack: 1, overdue: 1 },
  rows: [
    {
      relationshipId: rel(1),
      supplier: 'Alpha GmbH',
      sro: 'Anna Amsel',
      hasCycle: true,
      step: 'segment',
      dueDate: '2026-10-01',
      daysOverdue: 0,
      jbpDate: null,
    },
    {
      relationshipId: rel(2),
      supplier: 'Beta AG',
      sro: null,
      hasCycle: true,
      step: 'feedback',
      dueDate: '2026-11-01',
      daysOverdue: 15,
      jbpDate: '2027-01-15',
    },
  ],
  options: {
    sros: [{ id: 'anna', name: 'Anna Amsel' }],
    businessUnits: [{ id: unit, name: 'Antriebe' }],
    materialGroups: [],
  },
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = anna;
  api.permissions = actionsFor.member;
  requests = [];
  api.handle = (request) => {
    if (!request.url.startsWith('/api/portfolio/zyklen')) return undefined;
    requests.push(request.url);
    return Response.json(response);
  };
});

afterEach(tearDownApp);

describe('ZYK-04 Stand der Zyklen', () => {
  it('zeigt Kennzahlen, Schritt, Verzug und „Termin fehlt“; die Zeile führt zum Überblick', async () => {
    renderAt('/portfolio/zyklen');
    const table = await screen.findByRole('table', { name: 'Stand der Zyklen' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0] as HTMLElement).getByText('Termin fehlt')).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText('15 Tage')).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText('noch offen')).toBeTruthy();
    expect(
      within(rows[0] as HTMLElement)
        .getByRole('link', { name: 'Alpha GmbH' })
        .getAttribute('href'),
    ).toBe(`/lieferanten/${rel(1)}`);
    const metrics = screen.getByLabelText('Zyklen auf einen Blick');
    expect(metrics.textContent).toContain('Zyklen gesamt');
    expect(metrics.textContent).toContain('im Verzug');
  });

  it('Filter und Sortierung stehen in der Adresse und gehen an die API', async () => {
    const router = renderAt('/portfolio/zyklen');
    await screen.findByRole('table', { name: 'Stand der Zyklen' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Business Unit' }), {
      target: { value: unit },
    });
    await waitFor(() => expect(router.state.location.search).toEqual({ bu: unit }));
    fireEvent.click(screen.getByRole('radio', { name: 'Termin' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ bu: unit, sortierung: 'termin' }),
    );
    await waitFor(() =>
      expect(requests.at(-1)).toBe(`/api/portfolio/zyklen?bu=${unit}&sortierung=termin`),
    );
  });
});
