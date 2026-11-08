// @vitest-environment jsdom
import type { FocusDetail, FocusList } from '@reziproq/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

const id = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const item = (n: number) => ({
  relationshipId: id(n),
  name: `Lieferant ${n}`,
  spendCents: 100_000 * n,
  currency: 'EUR',
  sharePercent: 40,
  ist: null,
  soll: null,
});
let list: FocusList;
let detail: FocusDetail;
let puts: unknown[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  puts = [];
  list = {
    spendYear: 2025,
    spendShare: 80,
    canEdit: true,
    focus: [{ ...item(1), reason: 'Wichtig für die Serie' }],
    suggestions: [{ ...item(2), reasons: ['spend_share', 'target_type'] }],
  };
  detail = {
    ...item(2),
    spendYear: 2025,
    isFocus: false,
    reason: null,
    setAt: null,
    setBy: null,
    suggestionReasons: ['spend_share'],
    canEdit: true,
  };
  api.handle = ({ url, method, body }) => {
    if (url === '/api/portfolio/fokus') return Response.json(list);
    if (url === `/api/portfolio/fokus/${id(2)}`) {
      if (method === 'PUT') {
        puts.push(body);
        return Response.json({ ...detail, isFocus: true });
      }
      return Response.json(detail);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('SEG-02 Fokuslieferanten', () => {
  it('zeigt Fokus mit Begründung und Vorschläge mit Grund', async () => {
    renderAt('/portfolio/fokus');
    expect(await screen.findByText('Wichtig für die Serie')).toBeTruthy();
    expect(screen.getByText(/zusammen 80 % des Spend/)).toBeTruthy();
    expect(screen.getByText(/Hoher Impact im Soll-Typ/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lieferant 2' }).getAttribute('href')).toBe(
      `/portfolio/fokus/${id(2)}`,
    );
  });

  it('ohne Begründung wird nicht gespeichert', async () => {
    renderAt(`/portfolio/fokus/${id(2)}`);
    fireEvent.click(await screen.findByRole('switch', { name: 'Fokuslieferant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte eine Begründung angeben.')).toBeTruthy();
    expect(puts).toHaveLength(0);
  });

  it('speichert Schalter und Begründung', async () => {
    renderAt(`/portfolio/fokus/${id(2)}`);
    fireEvent.click(await screen.findByRole('switch', { name: 'Fokuslieferant' }));
    fireEvent.change(screen.getByLabelText('Begründung'), { target: { value: 'Engpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(puts).toEqual([{ isFocus: true, reason: 'Engpass' }]));
  });

  it('ohne Recht gibt es keinen Schalter', async () => {
    detail = { ...detail, canEdit: false };
    renderAt(`/portfolio/fokus/${id(2)}`);
    expect(await screen.findByText('Nur ein Admin kann den Fokus ändern.')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
