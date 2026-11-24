// @vitest-environment jsdom
import type { SupplierCategories } from '@reziproq/shared';
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

// Tests zu docs/specs/WG-20.md in der Oberfläche: Warengruppen des Lieferanten mit Summenzeile,
// Widerspruch als nächster Schritt und Lösen mit Notiz, Vorschlag für das Gesamtsegment.

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
const rel = uuid(80);
const groups = { lp: uuid(10), ks: uuid(11), bg: uuid(12) };
let data: SupplierCategories;
let sent: { method: string; url: string; body: unknown }[];

const supplierDetail = {
  relationshipId: rel,
  name: 'Rheintal Elektronik',
  organizationName: 'Rheintal Elektronik',
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
const segment = (impactLevel: number, qualityLevel: number, name: string) => ({
  impactLevel,
  qualityLevel,
  name,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  data = {
    relationshipId: rel,
    supplierName: 'Rheintal Elektronik',
    spendYear: 2025,
    currency: 'EUR',
    totalCents: 420_000_000,
    rows: [
      {
        groupId: groups.lp,
        groupName: 'Leiterplatten',
        lead: { userId: 'sara', name: 'Sara Ost' },
        amountCents: 310_000_000,
        shareInGroup: 0.38,
        segmentIst: segment(3, 2, 'Hoher Impact · ausbaufähige Beziehung'),
        sollType: { kind: 'segment', ...segment(3, 3, 'Hoher Impact · starke Beziehung') },
        qualityLevel: 2,
        strategy: { id: uuid(60), year: 2027, version: 1, status: 'draft' },
      },
      {
        groupId: groups.bg,
        groupName: 'Bestückte Baugruppen',
        lead: { userId: 'ida', name: 'Ida Roth' },
        amountCents: 90_000_000,
        shareInGroup: 0.12,
        segmentIst: segment(2, 3, 'Mittlerer Impact · starke Beziehung'),
        sollType: { kind: 'segment', ...segment(2, 3, 'Mittlerer Impact · starke Beziehung') },
        qualityLevel: 3,
        strategy: null,
      },
      {
        groupId: groups.ks,
        groupName: 'Kabelsätze',
        lead: null,
        amountCents: 20_000_000,
        shareInGroup: 0.04,
        segmentIst: segment(1, 1, 'Niedriger Impact · schwache Beziehung'),
        sollType: { kind: 'ended' },
        qualityLevel: 1,
        strategy: { id: uuid(61), year: 2027, version: 1, status: 'approved' },
      },
    ],
    conflicts: [
      {
        id: uuid(70),
        ruleKey: 'phase_out_vs_growth',
        groups: [
          { id: groups.ks, name: 'Kabelsätze' },
          { id: groups.lp, name: 'Leiterplatten' },
        ],
        status: 'open',
        note: null,
        decidedBy: null,
        decidedAt: null,
        createdAt: '2026-11-20T08:00:00Z',
        canResolve: true,
      },
      {
        id: uuid(71),
        ruleKey: 'relationship_mixed',
        groups: [{ id: groups.ks, name: 'Kabelsätze' }],
        status: 'aligned',
        note: 'Botschaft abgestimmt.',
        decidedBy: 'Sara Ost',
        decidedAt: '2026-11-10T08:00:00Z',
        createdAt: '2026-11-01T08:00:00Z',
        canResolve: false,
      },
    ],
    proposal: {
      ist: {
        impactScore: 70,
        qualityScore: 55,
        impactLevel: 3,
        qualityLevel: 2,
        typeName: 'Hoher Impact · ausbaufähige Beziehung',
      },
      soll: {
        impactScore: 80,
        qualityScore: 75,
        impactLevel: 3,
        qualityLevel: 3,
        typeName: 'Hoher Impact · starke Beziehung',
      },
      criteria: [{ criterionKey: 'trust', label: 'Vertrauen', ist: 55, soll: 75 }],
      sources: [
        { groupId: groups.lp, groupName: 'Leiterplatten', amountCents: 310_000_000, weight: 0.775 },
        {
          groupId: groups.bg,
          groupName: 'Bestückte Baugruppen',
          amountCents: 90_000_000,
          weight: 0.225,
        },
      ],
      skipped: [{ groupId: groups.ks, groupName: 'Kabelsätze', reason: 'no_rating' }],
    },
    decided: null,
    canAdopt: true,
  };
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(supplierDetail);
    if (request.url === `/api/warengruppen/lieferanten/${rel}`) {
      if (request.method === 'GET') return Response.json(data);
    }
    if (request.method === 'POST' && request.url.startsWith('/api/warengruppen/')) {
      sent.push(request);
      if (
        request.url.includes('/widersprueche/') &&
        !(request.body as { note: string }).note.trim()
      )
        return Response.json({ statusCode: 400, code: 'note_required' }, { status: 400 });
      return Response.json(data, { status: 201 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-20 Zusammenführung', () => {
  it('zeigt je Warengruppe eine Zeile mit Summe, auch ohne Strategie', async () => {
    renderAt(`/lieferanten/${rel}/strategie/warengruppen`);
    const table = await screen.findByRole('table', { name: 'Warengruppen' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(5);
    expect(within(rows[2] as HTMLElement).getByText('noch keine Strategie')).toBeTruthy();
    expect(within(rows[3] as HTMLElement).getByText('beendet')).toBeTruthy();
    expect(within(rows[4] as HTMLElement).getByText('Rheintal Elektronik gesamt')).toBeTruthy();
    expect(
      screen.getByText('Die Beziehung wird unterschiedlich erlebt: ausbaufähig, stark, schwach.'),
    ).toBeTruthy();
  });

  it('ein offener Widerspruch ist der nächste Schritt und wird mit Notiz gelöst', async () => {
    renderAt(`/lieferanten/${rel}/strategie/warengruppen`);
    expect(await screen.findByRole('heading', { name: 'Eine Botschaft abstimmen' })).toBeTruthy();
    expect(
      screen.getByText(/abgestimmt von Sara Ost am 10\.11\.2026: Botschaft abgestimmt\./),
    ).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Lösen' })[0] as HTMLElement);
    const form = screen.getByRole('form', { name: 'Widerspruch lösen' });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte eine Notiz oder Begründung schreiben.')).toBeTruthy();
    fireEvent.change(within(form).getByLabelText('Notiz zur abgestimmten Botschaft'), {
      target: { value: 'Kabelsätze laufen aus, Leiterplatten wachsen; Botschaft im JBP.' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        url: `/api/warengruppen/widersprueche/${uuid(70)}`,
        body: {
          status: 'aligned',
          note: 'Kabelsätze laufen aus, Leiterplatten wachsen; Botschaft im JBP.',
        },
      }),
    );
  });

  it('der Vorschlag für das Gesamtsegment zeigt Quellen und lässt sich übernehmen', async () => {
    renderAt(`/lieferanten/${rel}/strategie/warengruppen`);
    expect(
      await screen.findByText(
        'Vorschlag für das Gesamtsegment: Hoher Impact · ausbaufähige Beziehung',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Leiterplatten · Gewicht 77,5 %')).toBeTruthy();
    expect(screen.getByText('Kabelsätze: ohne Bewertung, nicht gezählt')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'In der Segmentierung prüfen' }).getAttribute('href'),
    ).toBe(`/lieferanten/${rel}/strategie/segmentierung`);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschlag übernehmen' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        url: `/api/warengruppen/lieferanten/${rel}/gesamtsegment`,
      }),
    );
  });
});
