// @vitest-environment jsdom
import {
  defaultSurveyQuestions,
  type SurveyDetail,
  type SurveyQuestion,
  type Surveys,
} from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/PUL-01.md in der Oberfläche: zwei Kacheln, Fragen nach Dimension mit
// Schalter, aktiv nur mit beiden Sprachen, Vorschau wie für Teilnehmende in beiden Sprachen.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const withState = (kind: 'pulse' | 'annual'): SurveyQuestion[] =>
  defaultSurveyQuestions[kind].map((question) => ({ ...question, active: true, custom: false }));
const version = (n: number, name: string | null) => ({
  id: uuid(n),
  version: n,
  createdAt: '2026-11-13T10:00:00Z',
  createdByName: name,
  note: null,
});
let pulse: SurveyQuestion[];
let annual: SurveyQuestion[];
let sent: { method: string; url: string; body: unknown }[];

const detail = (kind: 'pulse' | 'annual'): SurveyDetail => ({
  template: { ...version(2, 'Ada Admin'), kind, questions: kind === 'pulse' ? pulse : annual },
  versions: [version(2, 'Ada Admin'), version(1, null)],
  canManage: true,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  pulse = withState('pulse');
  annual = [
    ...withState('annual'),
    {
      key: 'eigene_1',
      dimension: 'strategy',
      textDe: 'Wir teilen Roadmaps.',
      textEn: '',
      active: false,
      custom: true,
    },
  ];
  api.handle = (request) => {
    if (request.url === '/api/fragebogen') {
      const list: Surveys = {
        canManage: true,
        templates: [
          { ...version(2, 'Ada Admin'), kind: 'pulse', active: 3, total: 3 },
          { ...version(1, null), kind: 'annual', active: 25, total: 26 },
        ],
      };
      return Response.json(list);
    }
    const match = request.url.match(/^\/api\/fragebogen\/(pulse|annual)/);
    if (match) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(detail(match[1] as 'pulse' | 'annual'), {
        status: request.method === 'POST' ? 201 : 200,
      });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('PUL-01 Fragebogen in der Oberfläche', () => {
  it('Einstellungen › Fragebogen hat zwei Kacheln: Puls und Jahres-Feedback', async () => {
    renderAt('/einstellungen/fragebogen');
    const pulseTile = await screen.findByRole('link', { name: /Puls/ });
    expect(pulseTile.getAttribute('href')).toBe('/einstellungen/fragebogen/pulse');
    expect(pulseTile.textContent).toContain('3 / 3Fragen aktiv');
    const annualTile = screen.getByRole('link', { name: /Jahres-Feedback/ });
    expect(annualTile.textContent).toContain('25 / 26Fragen aktiv');
    expect(annualTile.textContent).toContain('Standard von Reziproq');
  });

  it('die Fragen stehen nach Dimension; der Schalter blendet aus und legt eine Version an', async () => {
    renderAt('/einstellungen/fragebogen/annual');
    const trust = (await screen.findByRole('region', { name: 'Vertrauen' })) as HTMLElement;
    expect(within(trust).getAllByRole('listitem')).toHaveLength(5);
    const strategy = screen.getByRole('region', { name: 'Strategische Ausrichtung' });
    expect(within(strategy).getByText('Eigene Frage')).toBeDefined();
    expect(within(strategy).getByText('Text in beiden Sprachen fehlt')).toBeDefined();
    expect(
      (
        within(strategy).getByRole('switch', {
          name: 'Aktiv: Wir teilen Roadmaps.',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      within(trust).getByRole('switch', { name: 'Aktiv: Zusagen werden eingehalten.' }),
    );
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: '/api/fragebogen/annual/fragen/trust_1',
      body: {
        dimension: 'trust',
        textDe: 'Zusagen werden eingehalten.',
        textEn: 'Commitments are kept.',
        active: false,
      },
    });
    expect(screen.getByText(/Version 1 · Standard von Reziproq/)).toBeDefined();
  });

  it('eine neue Frage lässt sich nur mit Text in beiden Sprachen aktivieren', async () => {
    const router = renderAt('/einstellungen/fragebogen/pulse/neu');
    fireEvent.change(await screen.findByLabelText('Dimension'), {
      target: { value: 'transparency' },
    });
    fireEvent.change(screen.getByLabelText('Text auf Deutsch'), {
      target: { value: 'Wie offen teilen wir Informationen?' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aktiv' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Zum Aktivieren in beiden Sprachen ausfüllen.')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Text auf Englisch'), {
      target: { value: 'How openly do we share information?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/einstellungen/fragebogen/pulse'),
    );
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: '/api/fragebogen/pulse/fragen',
      body: {
        dimension: 'transparency',
        textDe: 'Wie offen teilen wir Informationen?',
        textEn: 'How openly do we share information?',
        active: true,
      },
    });
  });

  it('Standardfragen behalten ihre Dimension', async () => {
    renderAt('/einstellungen/fragebogen/pulse/pulse_trust');
    expect(((await screen.findByLabelText('Dimension')) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Text auf Englisch') as HTMLTextAreaElement).value).toBe(
      'How much do we trust each other?',
    );
  });

  it('die Vorschau zeigt nur aktive Fragen mit Ist, Soll und „Kann ich nicht beurteilen“', async () => {
    pulse = pulse.map((question) =>
      question.key === 'pulse_alignment' ? { ...question, active: false } : question,
    );
    renderAt('/einstellungen/fragebogen/pulse/vorschau');
    const form = (await screen.findByText('Wie sehr vertrauen wir einander?')).closest(
      '[data-slot="survey-form"]',
    ) as HTMLElement;
    expect(form.querySelectorAll('[data-question]')).toHaveLength(2);
    expect(within(form).getAllByRole('group', { name: 'Wie ist es heute?' })).toHaveLength(2);
    expect(within(form).getAllByRole('group', { name: 'Wie sollte es sein?' })).toHaveLength(2);
    const current = within(form).getAllByRole('group', {
      name: 'Wie ist es heute?',
    })[0] as HTMLElement;
    expect(within(current).getAllByRole('radio')).toHaveLength(6);
    fireEvent.click(within(current).getByRole('radio', { name: '4' }));
    expect((within(current).getByRole('radio', { name: '4' }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(within(form).getByLabelText('Möchtest du noch etwas sagen? (optional)')).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: 'Englisch' }));
    expect(await screen.findByText('How much do we trust each other?')).toBeDefined();
    expect(screen.getAllByRole('group', { name: 'How is it today?' })).toHaveLength(2);
    expect(sent).toEqual([]);
  });
});
