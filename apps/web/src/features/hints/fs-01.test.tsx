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

// FS-01 für die Oberfläche: Liste nach Lieferant mit „warum“ und „Beheben“, Annehmen,
// Verwerfen nur mit Begründung, Schwellwert nur für Admins.

const relationshipId = '550e8400-e29b-41d4-a716-446655440010';
const planHint = {
  id: '550e8400-e29b-41d4-a716-446655440091',
  ruleKey: 'plan_missing',
  relationshipId,
  supplier: 'Lieferant 1',
  detail: {},
  status: 'open',
  reason: null,
  createdAt: '2026-11-16T06:30:00Z',
  decidedAt: null,
  decidedByName: null,
  href: `/lieferanten/${relationshipId}/lieferantenplan`,
  canAccept: true,
  canDismiss: true,
  actionHref: null,
};
const sroHint = {
  ...planHint,
  id: '550e8400-e29b-41d4-a716-446655440092',
  ruleKey: 'too_many_focus',
  relationshipId: null,
  supplier: null,
  detail: { person: 'Anna Berg', count: 9, limit: 8 },
  href: '/portfolio/fokus',
  canAccept: false,
};

let hints: Record<string, unknown>[] = [];
let dismissed: unknown = null;
let accepted = 0;
let saved: unknown = null;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  hints = [planHint, sroHint];
  dismissed = null;
  accepted = 0;
  saved = null;
  api.handle = (request) => {
    if (request.url === '/api/hinweise') return Response.json({ hints, checkedAt: null });
    if (request.url === '/api/hinweise/einstellungen') {
      if (request.method === 'PUT') {
        saved = request.body;
        return Response.json(request.body);
      }
      return Response.json({ maxFocusPerSro: 8 });
    }
    const match = request.url.match(/^\/api\/hinweise\/([^/]+)(?:\/(annehmen|verwerfen))?$/);
    if (!match) return undefined;
    const hint = hints.find((entry) => entry.id === match[1]);
    if (!hint) return Response.json({ message: 'Nicht gefunden' }, { status: 404 });
    if (match[2] === 'annehmen') {
      accepted += 1;
      return Response.json({
        ...hint,
        status: 'accepted',
        decidedAt: '2026-11-16T09:00:00Z',
        decidedByName: 'Anna Berg',
        actionHref: `/lieferanten/${relationshipId}/massnahmen`,
      });
    }
    if (match[2] === 'verwerfen') {
      dismissed = request.body;
      return Response.json({
        ...hint,
        status: 'dismissed',
        reason: (request.body as { reason: string }).reason,
        decidedAt: '2026-11-16T09:00:00Z',
        decidedByName: 'Anna Berg',
      });
    }
    return Response.json(hint);
  };
});

afterEach(tearDownApp);

describe('FS-01 Hinweise', () => {
  it('zeigt die Hinweise nach Lieferant mit Satz, warum, und „Beheben“', async () => {
    renderAt('/hinweise');
    expect(await screen.findByRole('heading', { level: 1, name: 'Hinweise prüfen' })).toBeTruthy();
    const supplier = await screen.findByRole('region', { name: 'Lieferant 1' });
    expect(within(supplier).getByText('Lieferantenplan fehlt')).toBeTruthy();
    expect(within(supplier).getByRole('link', { name: 'Beheben' }).getAttribute('href')).toBe(
      `/lieferanten/${relationshipId}/lieferantenplan`,
    );
    const organization = screen.getByRole('region', { name: 'Ganze Organisation' });
    expect(
      within(organization).getByText(
        'Anna Berg betreut 9 Fokuslieferanten, eingestellt sind höchstens 8.',
      ),
    ).toBeTruthy();
  });

  it('Annehmen legt die interne Maßnahme an und verlinkt sie', async () => {
    renderAt(`/hinweise/${planHint.id}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Annehmen' }));
    await waitFor(() => expect(accepted).toBe(1));
    expect(await screen.findByText('Angenommen. Die interne Maßnahme ist angelegt.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zur Maßnahme' })).toBeTruthy();
  });

  it('Verwerfen geht nur mit Begründung; der Organisations-Hinweis lässt sich nur verwerfen', async () => {
    renderAt(`/hinweise/${sroHint.id}`);
    expect(
      await screen.findByText(
        'Dieser Hinweis betrifft keine einzelne Beziehung; er lässt sich nur verwerfen.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Annehmen' })).toBeNull();
    const dismiss = screen.getByRole('button', { name: 'Verwerfen' }) as HTMLButtonElement;
    expect(dismiss.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Begründung'), {
      target: { value: 'Anna übernimmt zwei Fokuslieferanten nur übergangsweise.' },
    });
    expect(dismiss.disabled).toBe(false);
    fireEvent.click(dismiss);
    await waitFor(() =>
      expect(dismissed).toEqual({
        reason: 'Anna übernimmt zwei Fokuslieferanten nur übergangsweise.',
      }),
    );
    expect(await screen.findByText(/Verworfen\. Er kommt erst wieder/)).toBeTruthy();
  });

  it('Admins stellen den Schwellwert ein; andere sehen nur den Hinweis', async () => {
    renderAt('/einstellungen/hinweise');
    const field = (await screen.findByLabelText(
      'Fokuslieferanten je SRO höchstens',
    )) as HTMLInputElement;
    expect(field.value).toBe('8');
    fireEvent.change(field, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(saved).toEqual({ maxFocusPerSro: 10 }));
  });

  it('Mitglieder sehen keine Einstellung der Hinweise', async () => {
    api.me = { ...anna, orgRole: 'member' };
    api.permissions = actionsFor.member;
    renderAt('/einstellungen/hinweise');
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByLabelText('Fokuslieferanten je SRO höchstens')).toBeNull();
  });
});
