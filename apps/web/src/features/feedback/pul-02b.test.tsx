// @vitest-environment jsdom
import type { PublicSurvey } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, renderAt, setUpApp, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/PUL-02.md, Teil b, in der Oberfläche: ohne Anmeldung, je Dimension eine
// Seite mit Fortschritt, Ist und Soll mit „Kann ich nicht beurteilen“, Zwischenstand auf dem Gerät,
// einmal absenden; ungültige, benutzte und abgelaufene Links mit klarem Hinweis.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const token = 'a'.repeat(43);
const open: PublicSurvey = {
  status: 'open',
  kind: 'annual',
  dueDate: '2099-03-31',
  side: 'supplier',
  buyer: 'Test-OEM (Demo)',
  supplier: 'Rheintal Elektronik GmbH (Demo)',
  questions: [
    {
      key: 'trust_1',
      dimension: 'trust',
      textDe: 'Zusagen werden eingehalten.',
      textEn: 'Commitments are kept.',
      active: true,
      custom: false,
    },
    {
      key: 'collaboration_1',
      dimension: 'collaboration',
      textDe: 'Ansprechpartner sind klar und erreichbar.',
      textEn: 'Contacts are clear and reachable.',
      active: true,
      custom: false,
    },
  ],
};
let survey: { status: number; body: unknown };
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = { isAuthenticated: false, isLoading: false, user: null };
  setUpApp();
  sent = [];
  survey = { status: 200, body: open };
  try {
    localStorage.clear();
  } catch {
    // jsdom
  }
  api.handle = (request) => {
    if (!request.url.startsWith(`/api/umfrage/`)) return undefined;
    if (request.method === 'POST') {
      sent.push(request);
      return Response.json({ ...open, status: 'used', questions: [] });
    }
    return Response.json(survey.body, { status: survey.status });
  };
});

afterEach(tearDownApp);

const choose = (
  question: string,
  group: 'Wie ist es heute?' | 'Wie sollte es sein?',
  name: string,
) => {
  const article = screen.getByText(question).closest('article') as HTMLElement;
  fireEvent.click(
    within(within(article).getByRole('group', { name: group })).getByRole('radio', { name }),
  );
};

describe('PUL-02b Beantworten in der Oberfläche', () => {
  it('je Dimension eine Seite; weiter erst mit Ist und Soll; am Ende Freitext und Absenden', async () => {
    renderAt(`/umfrage/${token}`);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Test-OEM (Demo) · Rheintal Elektronik GmbH (Demo)',
      }),
    ).toBeDefined();
    expect(screen.getByText('Seite 1 von 2')).toBeDefined();
    expect(screen.getByText('Frage 1 von 2')).toBeDefined();
    expect(screen.queryByLabelText('Möchtest du noch etwas sagen? (optional)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(
      await screen.findByText(
        'Bitte zu jeder Frage Ist und Soll wählen, oder „Kann ich nicht beurteilen“.',
      ),
    ).toBeDefined();
    choose('Zusagen werden eingehalten.', 'Wie ist es heute?', '3');
    choose('Zusagen werden eingehalten.', 'Wie sollte es sein?', 'Kann ich nicht beurteilen');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByText('Seite 2 von 2')).toBeDefined();
    expect(screen.getByText('Frage 2 von 2')).toBeDefined();
    choose('Ansprechpartner sind klar und erreichbar.', 'Wie ist es heute?', '2');
    choose('Ansprechpartner sind klar und erreichbar.', 'Wie sollte es sein?', '5');
    fireEvent.change(screen.getByLabelText('Möchtest du noch etwas sagen? (optional)'), {
      target: { value: 'Mehr Planungsdaten.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Absenden' }));
    expect(await screen.findByText('Danke, deine Antworten sind angekommen')).toBeDefined();
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/umfrage/${token}`,
      body: {
        answers: {
          trust_1: { current: 3, target: null },
          collaboration_1: { current: 2, target: 5 },
        },
        comment: 'Mehr Planungsdaten.',
      },
    });
  });

  it('der Zwischenstand bleibt auf dem Gerät und kommt beim nächsten Öffnen wieder', async () => {
    renderAt(`/umfrage/${token}`);
    await screen.findByText('Zusagen werden eingehalten.');
    choose('Zusagen werden eingehalten.', 'Wie ist es heute?', '4');
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(`reziproq:umfrage:${token}`) ?? '{}')).toMatchObject({
        answers: { trust_1: { current: 4 } },
      }),
    );
  });

  it('ein gespeicherter Zwischenstand füllt die Auswahl wieder aus', async () => {
    localStorage.setItem(
      `reziproq:umfrage:${token}`,
      JSON.stringify({ answers: { trust_1: { current: 2 } }, comment: '', page: 0 }),
    );
    renderAt(`/umfrage/${token}`);
    const article = (await screen.findByText('Zusagen werden eingehalten.')).closest(
      'article',
    ) as HTMLElement;
    const radio = within(
      within(article).getByRole('group', { name: 'Wie ist es heute?' }),
    ).getByRole('radio', { name: '2' }) as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it('die Sprache lässt sich umschalten', async () => {
    renderAt(`/umfrage/${token}`);
    await screen.findByText('Zusagen werden eingehalten.');
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(await screen.findByText('Commitments are kept.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDefined();
    expect(screen.getAllByRole('group', { name: 'How is it today?' })).toHaveLength(1);
  });

  it('ungültige, benutzte und abgelaufene Links zeigen einen klaren Hinweis', async () => {
    survey = { status: 404, body: { statusCode: 404 } };
    renderAt(`/umfrage/${token}`);
    expect(await screen.findByText('Dieser Link ist ungültig')).toBeDefined();
    tearDownApp();
    setUpApp();
    api.handle = () => Response.json({ ...open, status: 'expired', questions: [] });
    renderAt(`/umfrage/${token}`);
    expect(await screen.findByText('Die Frist ist abgelaufen')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Absenden' })).toBeNull();
  });

  it('ein schon benutzter Link nimmt keine zweite Antwort an', async () => {
    api.handle = () => Response.json({ ...open, status: 'used', questions: [] });
    renderAt(`/umfrage/${token}`);
    expect(await screen.findByText('Danke, deine Antworten sind angekommen')).toBeDefined();
    await waitFor(() => expect(screen.queryByRole('radio', { name: '3' })).toBeNull());
  });
});
