// @vitest-environment jsdom
import type { MyFeedback, PublicSurvey, StartData } from '@reziproq/shared';
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

// Feedback in der App (Änderung zu PUL-02b): Start zeigt den Fragebogen als Aufgabe, beantwortet
// wird angemeldet unter /feedback/<einladung>, auf beiden Seiten; die Wellen-Seite weist darauf hin.

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
const invitationId = uuid(40);
const rel = uuid(1);
const waveId = uuid(30);
const survey: PublicSurvey = {
  status: 'open',
  kind: 'pulse',
  dueDate: '2099-03-31',
  side: 'supplier',
  buyer: 'Test-OEM (Demo)',
  supplier: 'Test-Lieferant (Demo)',
  questions: [
    {
      key: 'pulse_trust',
      dimension: 'trust',
      textDe: 'Ich vertraue der anderen Seite.',
      textEn: 'I trust the other side.',
      active: true,
      custom: false,
    },
  ],
};
let mine: MyFeedback;
let sent: { method: string; url: string; body: unknown }[];

const supplierMe = {
  ...anna,
  name: 'Kim Kaiser',
  firstName: 'Kim',
  organization: { id: 'org-lieferant', name: 'Test-Lieferant (Demo)' },
  orgRole: 'admin' as const,
  permissions: {
    viewOrganizationSettings: true,
    viewBuyerAreas: false,
    viewSuppliers: false,
    viewCustomers: true,
    switchCustomer: false,
  },
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  try {
    localStorage.clear();
  } catch {
    // jsdom
  }
  mine = {
    invitations: [
      {
        id: invitationId,
        waveId,
        relationshipId: rel,
        side: 'supplier',
        kind: 'pulse',
        dueDate: '2099-03-31',
        status: 'open',
        counterpart: 'Test-OEM (Demo)',
      },
    ],
  };
  const start: StartData = {
    due: {
      items: [
        {
          id: invitationId,
          kind: 'feedback',
          supplier: 'Test-OEM (Demo)',
          detail: null,
          dueDate: '2099-03-31',
          href: `/feedback/${invitationId}`,
        },
      ],
      total: 1,
    },
    relationships: { items: [], total: 0 },
    nextMeeting: null,
    portfolio: null,
    openActions: 0,
  };
  api.handle = (request) => {
    if (request.url === '/api/start') return Response.json(start);
    if (request.url === '/api/feedback/meine') return Response.json(mine);
    if (request.url === `/api/feedback/meine/${invitationId}`) {
      if (request.method === 'POST') {
        sent.push(request);
        mine = { invitations: mine.invitations.map((entry) => ({ ...entry, status: 'used' })) };
        return Response.json({ ...survey, status: 'used', questions: [] });
      }
      return Response.json(survey);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('Feedback in der App', () => {
  it('Start zeigt den Fragebogen als Aufgabe und führt in die App, nicht zu einer Mail', async () => {
    api.me = supplierMe;
    api.permissions = ['organisation.sehen', 'start.sehen', 'kunden.sehen', 'feedback.sehen'];
    renderAt('/start');
    const link = await screen.findByRole('link', {
      name: /Feedback zu Test-OEM \(Demo\) geben/,
    });
    expect(link.getAttribute('href')).toBe(`/feedback/${invitationId}`);
    expect(within(link).getByText('Feedback geben')).toBeTruthy();
  });

  it('der Lieferant beantwortet den Bogen angemeldet in der App', async () => {
    api.me = supplierMe;
    api.permissions = ['organisation.sehen', 'start.sehen', 'kunden.sehen', 'feedback.sehen'];
    renderAt(`/feedback/${invitationId}`);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Test-OEM (Demo) · Test-Lieferant (Demo)',
      }),
    ).toBeTruthy();
    const article = screen
      .getByText('Ich vertraue der anderen Seite.')
      .closest('article') as HTMLElement;
    fireEvent.click(
      within(within(article).getByRole('group', { name: 'Wie ist es heute?' })).getByRole('radio', {
        name: '4',
      }),
    );
    fireEvent.click(
      within(within(article).getByRole('group', { name: 'Wie sollte es sein?' })).getByRole(
        'radio',
        { name: '5' },
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Absenden' }));
    expect(await screen.findByText('Danke, deine Antworten sind angekommen')).toBeTruthy();
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/feedback/meine/${invitationId}`,
      body: { answers: { pulse_trust: { current: 4, target: 5 } }, comment: null },
    });
  });

  it('„Feedback geben“ listet offene und erledigte Fragebögen', async () => {
    api.permissions = actionsFor.admin;
    renderAt('/feedback');
    const open = await screen.findByRole('region', { name: 'Offen' });
    expect(
      within(open)
        .getByRole('link', { name: 'Jetzt beantworten: Test-OEM (Demo)' })
        .getAttribute('href'),
    ).toBe(`/feedback/${invitationId}`);
    mine = { invitations: [] };
  });

  it('ohne Einladung zeigt die Liste, wie man eingeladen wird', async () => {
    api.permissions = actionsFor.admin;
    mine = { invitations: [] };
    renderAt('/feedback');
    expect(await screen.findByText('Kein offener Fragebogen')).toBeTruthy();
    await waitFor(() => expect(sent).toEqual([]));
  });
});
