// @vitest-environment jsdom
import type { JbpApprovalView, JbpContent, JbpVersions } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/JBP-06.md in der Oberfläche: je Stand genau eine nächste Aktion,
// Zurückgeben nur mit Begründung, „Freigegeben von beiden am …“, Vergleich zweier Versionen.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
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
const view = (extra: Partial<JbpApprovalView> = {}): JbpApprovalView => ({
  hasPlan: true,
  ownSide: 'buyer',
  status: 'draft',
  version: 1,
  decisions: [],
  approvedAt: null,
  canSubmit: true,
  canDecide: false,
  canNewVersion: false,
  ...extra,
});
const initiative = (title: string, endsOn = '2027-12-31') => ({
  title,
  goal: 'Sichern',
  benefitBuyer: 'A',
  benefitSupplier: 'B',
  ownerBuyerName: 'Sara Ost',
  ownerSupplierName: 'Kim Kaiser',
  startsOn: '2027-01-01',
  endsOn,
});
const v1: JbpContent = {
  topics: [{ title: 'Ausfälle senken', side: 'buyer', status: 'merged' }],
  initiatives: [initiative('Zweitquelle'), initiative('Werkzeugpool')],
  commitments: [
    { title: 'Kapazität', side: 'supplier', ownerName: 'Kim Kaiser', dueOn: '2027-02-28' },
  ],
};
const v2: JbpContent = {
  ...v1,
  initiatives: [initiative('Zweitquelle', '2028-06-30'), initiative('Recycling')],
};
let current: JbpApprovalView;
let versions: JbpVersions;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  current = view();
  versions = { versions: [] };
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
    if (request.url === `/api/suppliers/${rel}/jbp/versionen`) return Response.json(versions);
    if (request.url.startsWith(`/api/suppliers/${rel}/jbp/freigabe`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(current);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/plan/freigabe`;

describe('JBP-06 Freigabe in der Oberfläche', () => {
  it('im Entwurf gibt der SRO den Plan an den Lieferanten zur Prüfung', async () => {
    renderAt(base);
    expect(await screen.findByText('Entwurf')).toBeDefined();
    const sides = document.querySelectorAll('[data-side]');
    expect([...sides].map((side) => side.textContent)).toEqual([
      'KäuferNoch keine Entscheidung',
      'LieferantNoch keine Entscheidung',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'An Lieferant zur Prüfung geben' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.url).toBe(`/api/suppliers/${rel}/jbp/freigabe/einreichen`);
  });

  it('zurückgeben verlangt eine Begründung; freigeben geht mit einem Klick', async () => {
    current = view({
      status: 'in_review',
      canSubmit: false,
      canDecide: true,
      decisions: [
        {
          id: uuid(40),
          version: 1,
          side: 'buyer',
          userName: 'Sara Ost',
          decision: 'approved',
          comment: null,
          decidedAt: '2026-11-09T10:00:00Z',
        },
      ],
    });
    renderAt(base);
    // Der Käufer hat freigegeben, der Lieferant hat in dieser Runde noch nicht entschieden.
    await screen.findByRole('button', { name: 'Zurückgeben' });
    expect([...document.querySelectorAll('[data-side]')].map((side) => side.textContent)).toEqual([
      'KäuferFreigegebenSara Ost, 09.11.2026, 11:00',
      'LieferantNoch keine Entscheidung',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Zurückgeben' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText(/^Begründung/), {
      target: { value: 'Frist zu knapp.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zurückgeben' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      url: `/api/suppliers/${rel}/jbp/freigabe/entscheiden`,
      body: { decision: 'returned', comment: 'Frist zu knapp.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.body).toEqual({ decision: 'approved', comment: null });
  });

  it('freigegeben zeigt „Freigegeben von beiden am …“ und bietet eine neue Version an', async () => {
    current = view({
      status: 'approved',
      canSubmit: false,
      canNewVersion: true,
      approvedAt: '2026-11-09T10:00:00Z',
    });
    renderAt(base);
    expect(await screen.findByText(/^Freigegeben von beiden am /)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Neue Version starten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Neue Version starten' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.url).toBe(`/api/suppliers/${rel}/jbp/freigabe/neue-version`);
  });

  it('der Vergleich zweier Versionen zeigt neue, entfallene und geänderte Einträge', async () => {
    versions = {
      versions: [
        { version: 2, approvedAt: '2026-11-09T10:00:00Z', content: v2 },
        { version: 1, approvedAt: '2026-10-01T10:00:00Z', content: v1 },
      ],
    };
    renderAt(`/lieferanten/${rel}/plan/versionen`);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Version 1 → Version 2' }),
    ).toBeDefined();
    const initiatives = document.querySelector('[data-section="initiatives"]') as HTMLElement;
    expect(within(initiatives).getByText('Recycling').previousSibling?.textContent).toBe('Neu');
    expect(within(initiatives).getByText('Werkzeugpool').previousSibling?.textContent).toBe(
      'Entfallen',
    );
    expect(initiatives.textContent).toContain('Ende: 31.12.2027 → 30.06.2028');
    const commitments = document.querySelector('[data-section="commitments"]') as HTMLElement;
    expect(commitments.textContent).toContain('Keine Änderungen.');
  });
});
