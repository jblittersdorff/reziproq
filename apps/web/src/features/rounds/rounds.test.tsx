// @vitest-environment jsdom
import type { RoundDetail } from '@reziproq/shared';
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

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const roundId = '550e8400-e29b-41d4-a716-446655440010';
const supplierA = '550e8400-e29b-41d4-a716-446655440011';
const supplierB = '550e8400-e29b-41d4-a716-446655440012';
const unit = { id: '550e8400-e29b-41d4-a716-446655440013', name: 'Antrieb' };
const group = { id: '550e8400-e29b-41d4-a716-446655440014', name: 'Stahl' };

let round: RoundDetail;
let selection: string[];
let requests: { method: string; url: string; body: unknown }[];

const assignmentFor = (index: number, relationshipId: string) => ({
  id: `550e8400-e29b-41d4-a716-4466554400${20 + index}`,
  businessUnit: unit,
  materialGroup: group,
  function: 'quality' as const,
  rater: relationshipId === supplierA ? { id: 'u-1', name: 'Anna Beispiel' } : null,
  status: 'open' as const,
});

function build(status: RoundDetail['status'], suppliers: string[]): RoundDetail {
  return {
    id: roundId,
    name: 'Segmentierung 2026',
    dueDate: '2099-12-31',
    status,
    modelVersion: status === 'draft' ? null : 1,
    total: suppliers.length,
    submitted: 0,
    canManage: true,
    suppliers: suppliers.map((relationshipId, index) => ({
      relationshipId,
      name: relationshipId === supplierA ? 'Alpha GmbH' : 'Beta AG',
      total: 1,
      submitted: 0,
      canNominate: status === 'open',
      businessUnits: [unit],
      materialGroups: [group],
      assignments: [assignmentFor(index, relationshipId)],
    })),
  };
}

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  round = build('draft', []);
  selection = [];
  requests = [];
  api.handle = (request) => {
    if (!request.url.startsWith('/api/rounds')) return undefined;
    requests.push(request);
    const { method, url } = request;
    if (method === 'GET' && url === '/api/rounds') {
      return Response.json({
        rounds: [
          { ...round, total: 30, submitted: 18, status: 'open', name: 'Laufende Runde' },
          { ...round, id: '550e8400-e29b-41d4-a716-446655440099', name: 'Entwurf Q3' },
        ],
      });
    }
    if (method === 'POST' && url === '/api/rounds') {
      round = build('draft', []);
      return Response.json(round, { status: 201 });
    }
    if (method === 'GET' && url === `/api/rounds/${roundId}/candidates`) {
      return Response.json({
        candidates: [supplierA, supplierB].map((relationshipId) => ({
          relationshipId,
          name: relationshipId === supplierA ? 'Alpha GmbH' : 'Beta AG',
          businessUnits: [unit],
          materialGroups: [group],
          selected: selection.includes(relationshipId),
        })),
      });
    }
    if (method === 'PUT' && url === `/api/rounds/${roundId}/suppliers`) {
      selection = (request.body as { relationshipIds: string[] }).relationshipIds;
      round = build('draft', selection);
      return Response.json(round);
    }
    if (method === 'GET' && url === '/api/rounds/raters') {
      return Response.json({
        raters: [{ id: 'u-1', name: 'Anna Beispiel', defaultFunction: 'quality' }],
      });
    }
    if (method === 'POST' && url === `/api/rounds/${roundId}/start`) {
      round = build('open', selection);
      return Response.json(round, { status: 201 });
    }
    if (method === 'POST' && url === `/api/rounds/${roundId}/close`) {
      round = build('closed', selection);
      return Response.json(round, { status: 201 });
    }
    if (method === 'GET' && url === `/api/rounds/${roundId}`) return Response.json(round);
    return Response.json({ statusCode: 404 }, { status: 404 });
  };
});

afterEach(tearDownApp);

describe('Bewertungsrunden', () => {
  it('listet Runden mit Fortschritt und bietet Admins „Neue Runde“ an', async () => {
    renderAt('/portfolio/runden');

    expect(await screen.findByText('Laufende Runde')).toBeDefined();
    expect(screen.getByText(/18 von 30 abgegeben/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Entwurf fortsetzen' })).toBeDefined();
    expect((await screen.findByRole('link', { name: 'Neue Runde' })).getAttribute('href')).toBe(
      '/portfolio/runden/neu',
    );
  });

  it('blendet „Neue Runde“ für Nutzer ohne Verwalten-Recht aus', async () => {
    api.permissions = actionsFor.member;
    renderAt('/portfolio/runden');

    expect(await screen.findByText('Laufende Runde')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Neue Runde' })).toBeNull();
  });

  it('führt durch die Schritte und behält die Auswahl beim Zurückgehen', async () => {
    round = build('draft', []);
    renderAt('/portfolio/runden/neu');

    fireEvent.change(await screen.findByLabelText('Name der Runde'), {
      target: { value: 'Segmentierung 2026' },
    });
    fireEvent.change(screen.getByLabelText('Frist'), { target: { value: '2099-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Alpha GmbH wählen' }));
    expect(screen.getByText('1 Lieferant gewählt')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(await screen.findByText('Schritt 3 von 4')).toBeDefined();
    fireEvent.click(await screen.findByRole('link', { name: 'Zurück' }));

    const checkbox = await screen.findByRole('checkbox', { name: 'Alpha GmbH wählen' });
    await waitFor(() => expect(checkbox.getAttribute('aria-checked')).toBe('true'));
  });

  it('startet die Runde erst, wenn alle Plätze besetzt sind', async () => {
    selection = [supplierA, supplierB];
    round = build('draft', selection);
    renderAt(`/portfolio/runden/${roundId}/pruefen`);

    expect(await screen.findByText(/Es fehlen bewertende Personen/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Runde starten' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('startet eine vollständige Runde und zeigt danach ihre Seite', async () => {
    selection = [supplierA];
    round = build('draft', selection);
    renderAt(`/portfolio/runden/${roundId}/pruefen`);

    fireEvent.click(await screen.findByRole('button', { name: 'Runde starten' }));

    expect(
      await screen.findByText('Die Runde läuft. Die Einladungen sind unterwegs.'),
    ).toBeDefined();
    expect(requests.some((r) => r.method === 'POST' && r.url.endsWith('/start'))).toBe(true);
  });

  it('schließt die Runde erst nach Bestätigung auf der Seite', async () => {
    selection = [supplierA];
    round = build('open', selection);
    renderAt(`/portfolio/runden/${roundId}`);

    fireEvent.click(await screen.findByRole('button', { name: 'Runde schließen' }));
    expect(requests.some((r) => r.url.endsWith('/close'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Ja, schließen' }));

    expect(await screen.findByText('Die Runde ist geschlossen.')).toBeDefined();
    expect(
      screen.getByText('Eine geschlossene Runde nimmt keine Bewertungen mehr an.'),
    ).toBeDefined();
  });

  it('bietet Nutzern mit Nachnominierung den Link, aber keine Verwaltung', async () => {
    api.permissions = actionsFor.member;
    selection = [supplierA];
    round = { ...build('open', selection), canManage: false };
    renderAt(`/portfolio/runden/${roundId}`);

    expect(await screen.findByRole('link', { name: 'Nachnominieren' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Runde schließen' })).toBeNull();
  });
});
