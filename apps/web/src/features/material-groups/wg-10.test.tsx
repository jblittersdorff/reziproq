// @vitest-environment jsdom
import type { StrategyAssessment, StrategyContextResponse, StrategyStep } from '@reziproq/shared';
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

// Tests zu docs/specs/WG-10.md in der Oberfläche: Profil mit Kürzeln und Herkunft, Paarung nur aus
// internem und externem Eintrag, Begründung für einen gewählten Hebel, Katalog mit Markierung.

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
const group = uuid(10);
const strategyId = uuid(60);
let assessment: StrategyAssessment;
let sent: { method: string; url: string; body: unknown }[];

const context: StrategyContextResponse = {
  year: 2027,
  hidden: false,
  canCreate: false,
  context: {
    group: {
      id: group,
      name: 'Leiterplatten',
      code: 'LP',
      lead: { userId: 'anna', name: 'Anna Schmidt' },
      spend: null,
      supplierCount: 2,
    },
    strategy: {
      id: strategyId,
      year: 2027,
      status: 'draft',
      version: 1,
      steps: [
        'done',
        'done',
        'done',
        'done',
        'done',
        'in_progress',
        'open',
        'open',
        'open',
        'open',
      ],
    },
    role: 'lead',
    editableSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};
const content: StrategyStep = {
  step: 6,
  questions: [
    {
      id: uuid(30),
      view: null,
      text: 'Mit welchem Hebel nutzt ihr eine Stärke, um ein Risiko abzufedern?',
    },
  ],
  notes: [],
  milestones: [],
  leadSuggestion: null,
  dimensions: [],
  kpis: [],
  goals: [],
};
const item = (
  n: number,
  type: StrategyAssessment['items'][number]['type'],
  code: string,
  text: string,
  status: 'draft' | 'confirmed' = 'confirmed',
) => ({
  id: uuid(n),
  type,
  code,
  text,
  originStep: n === 20 ? 3 : null,
  originView: n === 20 ? 'supply_chain' : null,
  status,
});
const lever = (n: number, name: string, dimensions: ('supply' | 'cost')[]) => ({
  id: uuid(n),
  name,
  description: '',
  dimensions,
  active: true,
  custom: false,
  reason: null,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  assessment = {
    canEdit: true,
    items: [
      item(20, 'strength', 'S1', 'Guter Draht zu den Laminat-Herstellern'),
      item(21, 'weakness', 'W1', '65 % des Umsatzes bei zwei Lieferanten'),
      item(22, 'opportunity', 'O1', 'Moldau PCB baut Kapazität auf', 'draft'),
      item(23, 'threat', 'T1', 'Donau Print ist finanziell kritisch'),
    ],
    choices: [
      {
        id: uuid(40),
        internalItemId: uuid(20),
        externalItemId: uuid(23),
        leverId: uuid(50),
        reason: 'Laminat direkt einkaufen.',
        status: 'chosen',
      },
    ],
    levers: [
      lever(50, 'Second-Level Buying', ['cost', 'supply']),
      lever(51, 'Neue Lieferanten einführen', ['supply']),
    ],
    dimensions: [
      { key: 'supply', name: 'Versorgung' },
      { key: 'quality', name: 'Qualität' },
      { key: 'cost', name: 'Kosten' },
      { key: 'technology', name: 'Technologie' },
      { key: 'sustainability', name: 'Nachhaltigkeit' },
    ],
  };
  api.handle = (request) => {
    if (request.url === `/api/warengruppen/${group}/strategie`) return Response.json(context);
    if (request.url.endsWith('/schritte/6')) return Response.json(content);
    if (request.url === `/api/warengruppen/strategien/${strategyId}/bewertung`)
      return Response.json(assessment);
    if (
      request.method !== 'GET' &&
      request.url.startsWith(`/api/warengruppen/strategien/${strategyId}/`)
    ) {
      sent.push(request);
      return Response.json(assessment, { status: request.method === 'POST' ? 201 : 200 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-10 Bewertung und Hebel', () => {
  it('das Profil zeigt vier Felder mit Kürzel und Herkunft; Entwürfe lassen sich bestätigen', async () => {
    renderAt(`/warengruppen/${group}/strategie/6`);
    const strengths = await screen.findByRole('region', { name: 'Stärken' });
    expect(within(strengths).getByText('S1')).toBeTruthy();
    expect(within(strengths).getByText('aus Lieferkettensicht')).toBeTruthy();
    expect(screen.getByText(/Kern der Strategie/)).toBeTruthy();
    const chances = screen.getByRole('region', { name: 'Chancen' });
    expect(within(chances).getByText('Entwurf')).toBeTruthy();
    fireEvent.click(within(chances).getByRole('button', { name: 'Bestätigen: O1' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({ method: 'PATCH', body: { confirm: true } }),
    );
  });

  it('die Tabelle zeigt Paarung, Hebel, Wirkung, Begründung und Stand; der Katalog markiert Gewähltes', async () => {
    renderAt(`/warengruppen/${group}/strategie/6`);
    const choices = await screen.findByRole('region', { name: 'Gewählte Hebel' });
    const row = within(choices).getByRole('listitem', { name: 'S1 · T1' });
    expect(within(row).getByText('Second-Level Buying')).toBeTruthy();
    expect(within(row).getByText(/Kosten, Versorgung/)).toBeTruthy();
    expect(within(row).getByText('✓ gewählt')).toBeTruthy();
    const catalog = screen.getByRole('region', { name: 'Hebelkatalog · 2' });
    expect(within(catalog).getByText('(gewählt)')).toBeTruthy();
  });

  it('eine Paarung bietet nur interne und externe Einträge und verlangt eine Begründung', async () => {
    renderAt(`/warengruppen/${group}/strategie/6`);
    fireEvent.click(await screen.findByRole('button', { name: 'Paarung hinzufügen' }));
    const form = screen.getByRole('form', { name: 'Paarung hinzufügen' });
    const internal = within(form).getByLabelText('Stärke oder Schwäche') as HTMLSelectElement;
    expect([...internal.options].map((option) => option.text)).toEqual([
      'Bitte wählen',
      'S1 · Guter Draht zu den Laminat-Herstellern',
      'W1 · 65 % des Umsatzes bei zwei Lieferanten',
    ]);
    fireEvent.change(internal, { target: { value: uuid(21) } });
    fireEvent.change(within(form).getByLabelText('Chance oder Risiko'), {
      target: { value: uuid(22) },
    });
    fireEvent.change(within(form).getByLabelText('Hebel'), { target: { value: uuid(51) } });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern' }));
    expect(
      await within(form).findByText('Ein gewählter Hebel braucht eine Begründung.'),
    ).toBeTruthy();
    expect(sent).toEqual([]);
    fireEvent.change(within(form).getByLabelText('Begründung'), {
      target: { value: 'Moldau PCB aufbauen und die Abhängigkeit senken.' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        method: 'POST',
        url: `/api/warengruppen/strategien/${strategyId}/paarungen`,
        body: {
          internalItemId: uuid(21),
          externalItemId: uuid(22),
          leverId: uuid(51),
          status: 'chosen',
        },
      }),
    );
  });
  it('Schritt 26: ein Vorschlag von Reziproq steht gestrichelt mit „Vorschlag prüfen“ und „Verwerfen“', async () => {
    assessment = {
      ...assessment,
      choices: [
        ...assessment.choices,
        {
          id: uuid(41),
          internalItemId: uuid(21),
          externalItemId: uuid(22),
          leverId: uuid(51),
          reason: 'Moldau PCB als zweite Quelle aufbauen.',
          status: 'proposed',
        },
      ],
    };
    renderAt(`/warengruppen/${group}/strategie/6`);
    const row = await screen.findByRole('listitem', { name: 'W1 · O1' });
    expect(within(row).getByText('Vorschlag von Reziproq')).toBeTruthy();
    // Der Katalog markiert den vorgeschlagenen Hebel
    expect(screen.getByText(/Neue Lieferanten einführen · vorgeschlagen/)).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Vorschlag verwerfen: W1 · O1' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'PATCH',
        url: `/api/warengruppen/strategien/${strategyId}/paarungen/${uuid(41)}`,
        body: { status: 'dismissed', leverId: uuid(51) },
      }),
    );
    fireEvent.click(within(row).getByRole('button', { name: 'Vorschlag prüfen: W1 · O1' }));
    expect(await screen.findByDisplayValue('Moldau PCB als zweite Quelle aufbauen.')).toBeTruthy();
  });

  it('Schritt 26: Admins pflegen den Hebelkatalog in den Einstellungen', async () => {
    api.me = { ...anna, orgRole: 'admin' };
    api.permissions = actionsFor.admin;
    const handle = api.handle;
    api.handle = (request) => {
      if (request.url === '/api/warengruppen/hebel' && request.method === 'GET')
        return Response.json({ levers: assessment.levers });
      if (request.url === '/api/warengruppen/kennzahlen')
        return Response.json({ dimensions: assessment.dimensions, kpis: [] });
      if (request.url.startsWith('/api/warengruppen/hebel/') && request.method === 'PATCH') {
        sent.push(request);
        return Response.json({ ...assessment.levers[0], ...(request.body as object) });
      }
      return handle?.(request);
    };
    renderAt('/einstellungen/warengruppen/hebel');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hebelkatalog der Warengruppen' }),
    ).toBeTruthy();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Deaktivieren: Second-Level Buying' }),
    );
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'PATCH',
        url: `/api/warengruppen/hebel/${uuid(50)}`,
        body: { active: false },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Neue Lieferanten einführen' }));
    expect(await screen.findByDisplayValue('Neue Lieferanten einführen')).toBeTruthy();
  });
});
