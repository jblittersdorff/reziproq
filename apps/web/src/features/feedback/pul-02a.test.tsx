// @vitest-environment jsdom
import type {
  SurveySuggestions,
  SurveyWave,
  SurveyWaveDetail,
  SurveyWaves,
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

// Tests zu docs/specs/PUL-02.md, Teil a, in der Oberfläche: Liste mit Rücklauf als Anzahl, Neue
// Welle in drei Schritten mit Vorschlägen, beim Lieferanten nur eigene Einladungen und Abschluss.

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
const rel = uuid(1);
const waveId = uuid(30);
const supplier = {
  relationshipId: rel,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: null,
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};
const wave: SurveyWave = {
  id: waveId,
  kind: 'pulse',
  templateVersion: 1,
  dueDate: '2099-03-31',
  createdAt: '2099-03-01T09:00:00Z',
  createdByName: 'Sara Ost',
  buyerClosedAt: null,
  supplierClosedAt: null,
  status: 'open',
  turnout: { buyer: { invited: 5, completed: 2 }, supplier: { invited: 5, completed: 0 } },
};
const suggestions: SurveySuggestions = {
  templates: [
    { kind: 'pulse', version: 1, questions: 3 },
    { kind: 'annual', version: 2, questions: 25 },
  ],
  suggestions: [
    {
      side: 'buyer',
      name: 'Sara Ost',
      email: 'sara@oem.example',
      function: 'purchasing',
      source: 'team',
    },
    {
      side: 'supplier',
      name: 'Kim Kaiser',
      email: 'kim@rheintal.example',
      function: null,
      source: 'contact',
    },
  ],
};
let detail: SurveyWaveDetail;
let canStart: boolean;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = [...actionsFor.admin, 'feedback.sehen', 'feedback.verwalten'];
  sent = [];
  canStart = true;
  detail = {
    wave,
    ownSide: 'buyer',
    participants: [
      {
        id: uuid(40),
        side: 'buyer',
        email: 'sara@oem.example',
        name: 'Sara Ost',
        function: 'purchasing',
        invitedAt: '2099-03-01T09:00:00Z',
      },
    ],
    canInvite: true,
    canClose: true,
    canExtend: true,
  };
  try {
    sessionStorage.clear();
  } catch {
    // jsdom
  }
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(supplier);
    if (request.url.startsWith(`/api/suppliers/${rel}/overview`)) {
      return Response.json({
        head: { segment: null, sro: null, nextMeeting: null },
        metrics: [],
        cycle: null,
        canStartCycle: false,
        canSetJbpDate: false,
      });
    }
    if (request.url === `/api/kunden/${rel}`) {
      return Response.json({
        relationshipId: rel,
        name: 'Test-OEM (Demo)',
        relationshipType: null,
        nextMeeting: null,
      });
    }
    if (request.url === '/api/kunden') {
      return Response.json({
        customers: [{ relationshipId: rel, name: 'Test-OEM (Demo)', nextMeeting: null }],
      });
    }
    const match = request.url.match(/^\/api\/(suppliers|kunden)\/[^/]+\/feedback(.*)$/);
    if (!match) return undefined;
    const rest = match[2] ?? '';
    if (request.method !== 'GET') sent.push(request);
    if (rest === '' && request.method === 'GET') {
      const list: SurveyWaves = { waves: [wave], canStart: match[1] === 'suppliers' && canStart };
      return Response.json(list);
    }
    if (rest === '/vorschlaege') {
      return Response.json(
        match[1] === 'suppliers'
          ? suggestions
          : {
              templates: [],
              suggestions: [
                {
                  side: 'supplier',
                  name: 'Lea Lang',
                  email: 'lea@rheintal.example',
                  function: 'quality',
                  source: 'colleague',
                },
              ],
            },
      );
    }
    return Response.json(detail, { status: request.method === 'POST' ? 201 : 200 });
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/beziehung/feedback`;

describe('PUL-02a Feedback-Welle in der Oberfläche', () => {
  it('die Liste zeigt Art, Frist, Status und den Rücklauf je Seite nur als Anzahl', async () => {
    renderAt(base);
    const row = (await screen.findByRole('link', { name: /Puls · Frist/ })).closest(
      'li',
    ) as HTMLElement;
    expect(row.textContent).toContain('Eure Seite 2/5');
    expect(row.textContent).toContain('Lieferant 0/5');
    expect(row.textContent).toContain('Offen');
    expect(screen.getByRole('link', { name: 'Neue Welle' }).getAttribute('href')).toBe(
      `${base}/neu`,
    );
  });

  it('ohne Recht zum Starten gibt es keinen Knopf „Neue Welle“', async () => {
    canStart = false;
    renderAt(base);
    await screen.findByRole('link', { name: /Puls · Frist/ });
    expect(screen.queryByRole('link', { name: 'Neue Welle' })).toBeNull();
  });

  it('Neue Welle in drei Schritten: Art und Frist, Teilnehmende mit Funktion, Prüfen und Starten', async () => {
    const router = renderAt(`${base}/neu`);
    fireEvent.click(await screen.findByRole('radio', { name: /Jahres-Feedback/ }));
    fireEvent.change(screen.getByLabelText('Frist'), { target: { value: '2099-05-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ schritt: 2 }));
    // Vorschläge aus Team und Kontakten sind vorausgewählt; dem Kontakt fehlt die Funktion.
    expect(
      (
        screen.getByRole('checkbox', { name: 'Sara Ost einladen' }) as HTMLButtonElement
      ).getAttribute('data-state'),
    ).toBe('checked');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByText('Bitte für jede Person eine Funktion wählen.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Funktion von Kim Kaiser'), {
      target: { value: 'sales' },
    });
    // Eine weitere Person auf der Seite des Lieferanten.
    fireEvent.change(screen.getByLabelText('E-Mail'), {
      target: { value: 'Ole@Rheintal.example' },
    });
    fireEvent.change(screen.getByLabelText('Funktion'), { target: { value: 'quality' } });
    fireEvent.change(screen.getByLabelText('Seite'), { target: { value: 'supplier' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(await screen.findByText('ole@rheintal.example')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ schritt: 3 }));
    expect(screen.getByText('Eure Seite: 1 Personen')).toBeDefined();
    expect(screen.getByText('Lieferant: 2 Personen')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Starten' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/${waveId}`));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/feedback`,
      body: {
        kind: 'annual',
        dueDate: '2099-05-31',
        participants: [
          { side: 'buyer', email: 'sara@oem.example', name: 'Sara Ost', function: 'purchasing' },
          {
            side: 'supplier',
            email: 'kim@rheintal.example',
            name: 'Kim Kaiser',
            function: 'sales',
          },
          { side: 'supplier', email: 'ole@rheintal.example', name: null, function: 'quality' },
        ],
      },
    });
  });

  it('die Welle zeigt den Rücklauf je Seite und nur die eigenen Einladungen', async () => {
    renderAt(`${base}/${waveId}`);
    const buyerTile = (await screen.findByText('2 von 5 geantwortet')).closest(
      '[data-side]',
    ) as HTMLElement;
    expect(buyerTile.getAttribute('data-side')).toBe('buyer');
    const list = screen.getByRole('heading', { name: 'Eingeladen von eurer Seite' })
      .nextElementSibling as HTMLElement;
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(
      screen.getByText('Wer geantwortet hat, zeigt Reziproq nicht. Antworten sind anonym.'),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Frist verlängern' })).toBeDefined();
  });

  it('beim Lieferanten: eigene Einladungen und Abschluss der eigenen Seite', async () => {
    api.me = {
      ...anna,
      organization: { id: 'org-lieferant', name: 'Rheintal Elektronik GmbH (Demo)' },
      permissions: {
        viewOrganizationSettings: true,
        viewBuyerAreas: false,
        viewSuppliers: false,
        viewCustomers: true,
        switchCustomer: false,
      },
    };
    api.permissions = ['start.sehen', 'kunden.sehen', 'feedback.sehen', 'feedback.verwalten'];
    detail = { ...detail, ownSide: 'supplier', participants: [], canExtend: false };
    const router = renderAt(`/kunden/${rel}/beziehung/feedback/${waveId}`);
    expect(await screen.findByText('Eure Seite hat noch niemanden eingeladen.')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Frist verlängern' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Eigene Teilnahme abschließen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Abschließen' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.url).toBe(`/api/kunden/${rel}/feedback/${waveId}/abschliessen`);
    await router.navigate({ to: `/kunden/${rel}/beziehung/feedback/${waveId}/einladen` });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Lea Lang einladen' }));
    expect(screen.queryByLabelText('Seite')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Weitere einladen' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toMatchObject({
      url: `/api/kunden/${rel}/feedback/${waveId}/teilnehmende`,
      body: {
        participants: [
          {
            side: 'supplier',
            email: 'lea@rheintal.example',
            name: 'Lea Lang',
            function: 'quality',
          },
        ],
      },
    });
  });
});
