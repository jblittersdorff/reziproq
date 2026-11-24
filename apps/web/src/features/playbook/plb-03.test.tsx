// @vitest-environment jsdom
import type {
  ProposalItem,
  RuleSet,
  RuleSetProposal,
  RuleSetResponse,
  SupplierDetail,
} from '@reziproq/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLB-03.md: Spielregeln je Beziehung.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const rel = '0190a0a0-0000-7000-8000-000000000001';
const uuid = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const text = (de: string) => ({ de, en: `${de} EN` });
const detail: SupplierDetail = {
  relationshipId: rel,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: 'L-10001',
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};
const proposal: ProposalItem[] = [
  {
    catalogItemId: uuid(1),
    kind: 'right',
    group: 'cost',
    title: text('Kostenworkshops'),
    description: text('Gemeinsam sparen'),
    cadence: null,
    level: null,
  },
  {
    catalogItemId: uuid(2),
    kind: 'obligation',
    group: 'cost',
    title: text('Produktivitätsangebot'),
    description: text('Jährlich'),
    cadence: null,
    level: null,
  },
  {
    catalogItemId: uuid(3),
    kind: 'format',
    group: null,
    title: text('Quartalsreview'),
    description: text('Leistung bewerten'),
    cadence: 'quarterly',
    level: 'management',
  },
];
const target = { impactLevel: 2, qualityLevel: 2, typeName: 'Entwicklungspartner' };
const draft: RuleSet = {
  id: uuid(50),
  version: 1,
  status: 'draft',
  visibility: 'internal',
  target,
  items: proposal.map((item, index) => ({
    ...item,
    id: uuid(60 + index),
    origin: 'catalog' as const,
    reason: null,
  })),
  removed: [],
  approvedBy: null,
  approvedAt: null,
};

let response: RuleSetResponse;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  response = { current: draft, target, targetChanged: false, canManage: true, shared: null };
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(detail);
    if (request.url.startsWith(`/api/suppliers/${rel}/overview`)) {
      return Response.json({ head: { segment: null, sro: null, nextMeeting: null }, metrics: [] });
    }
    if (request.url.startsWith(`/api/suppliers/${rel}/spielregeln/vorschlag`)) {
      const body: RuleSetProposal = { target, items: proposal };
      return Response.json(body);
    }
    if (request.url.startsWith(`/api/suppliers/${rel}/spielregeln`)) {
      if (request.method !== 'GET') {
        sent.push(request);
        return Response.json(response, {
          status: request.method === 'POST' && !request.url.endsWith('freigabe') ? 201 : 200,
        });
      }
      return Response.json(response);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const page = `/lieferanten/${rel}/beziehung/spielregeln`;

describe('PLB-03 Spielregeln je Beziehung', () => {
  it('ohne Soll-Typ erklärt die Seite den nächsten Schritt', async () => {
    response = { current: null, target: null, targetChanged: false, canManage: true, shared: null };
    renderAt(page);
    expect(await screen.findByText('Noch kein Soll-Typ')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Zur Segmentierung' })).toBeDefined();
  });

  it('ohne Spielregeln übernimmt ein Klick den Vorschlag', async () => {
    response = { current: null, target, targetChanged: false, canManage: true, shared: null };
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Vorschlag übernehmen' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ method: 'POST', url: `/api/suppliers/${rel}/spielregeln` });
  });

  it('die aktuelle Version zeigt Rechte und Pflichten nebeneinander, Formate mit Takt und das Kennzeichen Intern', async () => {
    renderAt(page);
    expect(await screen.findByText('Kostenworkshops')).toBeDefined();
    expect(screen.getByText('Produktivitätsangebot')).toBeDefined();
    expect(screen.getByText('quartalsweise · Leistung bewerten')).toBeDefined();
    expect(screen.getByText('Intern')).toBeDefined();
    expect(screen.getByText('Soll-Typ Entwicklungspartner · Version 1')).toBeDefined();
  });

  it('intern freigeben fragt auf der Seite nach und schickt die Freigabe', async () => {
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Intern freigeben' }));
    expect(screen.getByText('Version 1 freigeben? Danach ist sie gesperrt.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Ja, freigeben' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.url).toBe(`/api/suppliers/${rel}/spielregeln/freigabe`);
  });

  it('ein geänderter Soll-Typ zeigt den Hinweis mit dem Weg zum neuen Vorschlag', async () => {
    response = { ...response, targetChanged: true };
    renderAt(page);
    expect(await screen.findByText('Der Soll-Typ hat sich geändert.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Neuen Vorschlag ansehen' })).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('ohne Begründung wird eine Abweichung nicht gespeichert, mit Begründung schon', async () => {
    const router = renderAt(`${page}/bearbeiten`);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Kostenworkshops/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte begründen (mindestens drei Zeichen).')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Interne Begründung: Kostenworkshops'), {
      target: { value: 'Passt nicht.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(page));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      body: {
        selected: [uuid(2), uuid(3)],
        removedReasons: { [uuid(1)]: 'Passt nicht.' },
        custom: [],
      },
    });
  });

  it('ein eigener Eintrag braucht Titel und Begründung', async () => {
    renderAt(`${page}/bearbeiten`);
    fireEvent.click(await screen.findByRole('button', { name: 'Eigenen Eintrag ergänzen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte begründen (mindestens drei Zeichen).')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Werksbesuch' } });
    fireEvent.change(screen.getByLabelText('Interne Begründung'), {
      target: { value: 'Wichtig.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toMatchObject({
      custom: [
        { kind: 'right', group: 'cost', title: 'Werksbesuch', cadence: null, reason: 'Wichtig.' },
      ],
    });
  });

  it('ohne Recht gibt es weder Freigabe noch Bearbeiten', async () => {
    response = { ...response, canManage: false };
    renderAt(page);
    await screen.findByText('Kostenworkshops');
    expect(screen.queryByRole('button', { name: 'Intern freigeben' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Bearbeiten' })).toBeNull();
  });
});
