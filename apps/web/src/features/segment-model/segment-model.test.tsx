// @vitest-environment jsdom
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  type SegmentModelResponse,
} from '@reziproq/shared';
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

const activeModel: SegmentModelResponse['active'] = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  version: 1,
  status: 'active',
  lowMax: 33,
  midMax: 66,
  deviationThreshold: 30,
  focusSpendShare: 80,
  createdAt: '2026-04-02T10:00:00.000Z',
  activatedAt: '2026-04-02T10:00:00.000Z',
  criteria: defaultSegmentCriteria.map((criterion) => ({ ...criterion })),
  types: defaultSegmentTypes.map((type) => ({ ...type })),
};

let response: SegmentModelResponse;
let writes: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  response = { active: activeModel, draft: null };
  writes = [];
  api.handle = (request) => {
    if (!request.url.startsWith('/api/segment-model')) return undefined;
    writes.push(request);
    if (request.method === 'GET') return Response.json(response);
    if (request.url === '/api/segment-model/draft/weights') {
      const body = request.body as {
        impact: { key: string; weight: number }[];
        quality: { key: string; weight: number }[];
      };
      response = {
        active: activeModel,
        draft: {
          ...activeModel,
          id: '550e8400-e29b-41d4-a716-446655440001',
          version: 2,
          status: 'draft',
          activatedAt: null,
          criteria: activeModel.criteria.map((criterion) => ({
            ...criterion,
            weight:
              body[criterion.axis].find((entry) => entry.key === criterion.key)?.weight ??
              criterion.weight,
          })),
        },
      };
      return Response.json(response);
    }
    if (request.url === '/api/segment-model/draft/activate') {
      if (!response.draft) return Response.json({ code: 'nicht_gefunden' }, { status: 404 });
      response = {
        active: {
          ...response.draft,
          status: 'active',
          activatedAt: '2026-04-03T10:00:00.000Z',
        },
        draft: null,
      };
      return Response.json(response);
    }
    return Response.json({ statusCode: 404 }, { status: 404 });
  };
});

afterEach(tearDownApp);

describe('Einstellungen › Segmentmodell', () => {
  it('zeigt Kriterien, Grenzen und alle neun Beziehungstypen mit eigenen Bearbeitungsseiten', async () => {
    renderAt('/einstellungen/segmentmodell');

    expect(await screen.findByRole('heading', { level: 1, name: 'Segmentmodell' })).toBeDefined();
    expect(await screen.findByText('Zugang zu Technologie')).toBeDefined();
    expect(await screen.findByText('Niedrige Stufe bis')).toBeDefined();
    const editLinks = screen.getAllByRole('link', { name: /bearbeiten/ });
    expect(new Set(editLinks.map((link) => link.getAttribute('href'))).size).toBe(19);
    expect(screen.getByRole('link', { name: 'Gewichte anpassen' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Grenzen ändern' })).toBeDefined();
    const relationshipTypes = screen.getByRole('table', {
      name: 'Beziehungstypen nach Business Impact und Beziehungsqualität',
    });
    expect(within(relationshipTypes).getAllByRole('link')).toHaveLength(9);
    expect(within(relationshipTypes).getByText('Hoher Impact · starke Beziehung')).toBeDefined();
  });

  it('blockiert ungültige Gewichte im Formular und speichert eine gültige Summe als Entwurf', async () => {
    const router = renderAt('/einstellungen/segmentmodell/gewichte');
    const spend = await screen.findByLabelText('Spend');
    fireEvent.change(spend, { target: { value: '17.67' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Die Gewichte je Achse müssen zusammen genau 100 Prozent ergeben.',
    );
    expect(writes.some((request) => request.method === 'PUT')).toBe(false);

    fireEvent.change(screen.getByLabelText('Wirkung beim Endkunden'), {
      target: { value: '15.67' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/einstellungen/segmentmodell'),
    );
    expect(writes.find((request) => request.method === 'PUT')?.body).toMatchObject({
      impact: expect.arrayContaining([
        { key: 'spend', weight: 17.67 },
        { key: 'end_customer_impact', weight: 15.67 },
      ]),
    });
    expect(await screen.findByText('Änderung als Entwurf gespeichert.')).toBeDefined();
  });

  it('zeigt Mitgliedern das Modell, aber keine Verwaltungslinks oder Schreibaktionen', async () => {
    api.me = anna;
    api.permissions = actionsFor.member;
    renderAt('/einstellungen/segmentmodell');

    expect(
      await screen.findByText(
        'Du kannst das Modell ansehen. Ändern und aktivieren darf es nur ein Admin.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: /bearbeiten/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entwurf aktivieren' })).toBeNull();
    const relationshipTypes = screen.getByRole('table', {
      name: 'Beziehungstypen nach Business Impact und Beziehungsqualität',
    });
    expect(within(relationshipTypes).getByText('Hoher Impact · starke Beziehung')).toBeDefined();
  });

  it('öffnet die eigene Seite für einen Beziehungstyp', async () => {
    renderAt('/einstellungen/segmentmodell/typ/3-3');

    expect(
      await screen.findByRole('heading', { name: 'Hoher Impact · starke Beziehung bearbeiten' }),
    ).toBeDefined();
    const nameField = (await screen.findByRole('textbox', { name: 'Name' })) as HTMLInputElement;
    expect(nameField.value).toBe('Hoher Impact · starke Beziehung');
  });

  it('aktiviert einen Entwurf erst nach sichtbarer Bestätigung', async () => {
    response = {
      active: activeModel,
      draft: {
        ...activeModel,
        id: '550e8400-e29b-41d4-a716-446655440001',
        version: 2,
        status: 'draft',
        activatedAt: null,
      },
    };
    renderAt('/einstellungen/segmentmodell');

    fireEvent.click(await screen.findByRole('button', { name: 'Entwurf aktivieren' }));
    expect(await screen.findByText(/Ich habe den Hinweis gelesen/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf aktivieren' }));

    expect(await screen.findByText('Neue Version ist aktiv.')).toBeDefined();
    expect(writes.some((request) => request.url === '/api/segment-model/draft/activate')).toBe(
      true,
    );
  });
});
