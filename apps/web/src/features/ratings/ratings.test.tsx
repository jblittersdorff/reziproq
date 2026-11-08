// @vitest-environment jsdom
import { defaultSegmentCriteria, defaultSegmentTypes, type RatingDetail } from '@reziproq/shared';
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

const id = '550e8400-e29b-41d4-a716-446655440030';
const named = (suffix: string, name: string) => ({
  id: `550e8400-e29b-41d4-a716-4466554400${suffix}`,
  name,
});

const assignment = {
  id,
  roundId: '550e8400-e29b-41d4-a716-446655440031',
  roundName: 'Runde',
  roundStatus: 'open' as const,
  dueDate: '2099-12-31',
  relationshipId: '550e8400-e29b-41d4-a716-446655440032',
  supplier: 'Alpha GmbH',
  businessUnit: named('33', 'Antrieb'),
  materialGroup: named('34', 'Stahl'),
  function: 'quality' as const,
  status: 'open' as const,
  raterName: null,
};

let detail: RatingDetail;
let requests: { method: string; url: string; body: unknown }[];

const first = defaultSegmentCriteria.filter((criterion) => criterion.axis === 'impact')[0];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  requests = [];
  detail = {
    assignment,
    editable: true,
    model: {
      version: 1,
      lowMax: 33,
      midMax: 66,
      criteria: defaultSegmentCriteria.map((criterion) => ({ ...criterion })),
      types: defaultSegmentTypes.map((type) => ({ ...type })),
    },
    values: defaultSegmentCriteria.map((criterion) => ({
      criterionKey: criterion.key,
      ist: null,
      soll: null,
      comment: null,
    })),
    ist: null,
    soll: null,
  };
  api.handle = (request) => {
    if (!request.url.startsWith('/api/ratings')) return undefined;
    requests.push(request);
    if (request.url === '/api/ratings/mine') return Response.json({ assignments: [assignment] });
    if (request.method === 'PUT') {
      const body = request.body as { criterionKey: string; ist?: number };
      detail = {
        ...detail,
        values: detail.values.map((value) =>
          value.criterionKey === body.criterionKey ? { ...value, ...body } : value,
        ),
      };
    }
    return Response.json(detail);
  };
});

afterEach(tearDownApp);

describe('SEG-04 Bewertung abgeben', () => {
  it('die Liste zeigt Lieferant, Business Unit und Status', async () => {
    renderAt('/bewertungen');
    expect(await screen.findByText('Alpha GmbH')).toBeTruthy();
    expect(screen.getByText(/Antrieb · Stahl/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bewerten' }).getAttribute('href')).toBe(
      `/bewertungen/${id}`,
    );
  });

  it('die Regler lassen sich mit der Tastatur bedienen und speichern den Wert', async () => {
    renderAt(`/bewertungen/${id}`);
    const sliders = await screen.findAllByRole('slider');
    const ist = sliders[0] as HTMLInputElement;
    expect(ist.type).toBe('range');
    await waitFor(() => expect(ist.disabled).toBe(false));
    ist.focus();
    expect(document.activeElement).toBe(ist);
    fireEvent.change(ist, { target: { value: '70' } });
    fireEvent.keyUp(ist, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
        criterionKey: first?.key,
        ist: 70,
      }),
    );
  });

  it('abgeben ist ohne vollständige Werte gesperrt und nennt die fehlenden Kriterien', async () => {
    renderAt(`/bewertungen/${id}/zusammenfassung`);
    expect(await screen.findByText(/fehlen noch:/)).toBeTruthy();
    const submit = (await screen.findByRole('button', { name: 'Abgeben' })) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('nach dem Schließen sind die Regler gesperrt', async () => {
    detail = { ...detail, editable: false };
    renderAt(`/bewertungen/${id}`);
    const sliders = await screen.findAllByRole('slider');
    expect(sliders.every((slider) => (slider as HTMLInputElement).disabled)).toBe(true);
  });
});
