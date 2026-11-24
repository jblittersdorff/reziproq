// @vitest-environment jsdom
import type { ImportBatch, ImportRowView } from '@reziproq/shared';
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

// Tests zu docs/specs/KI-15.md in der Oberfläche: Import anlegen, Spalten bestätigen, Prüfen mit
// Vorschlag und Begründung, Entscheidungen, Übernehmen und Rückgängig.

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
const normalized = (overrides: Partial<ImportRowView['normalized']>) => ({
  name: null,
  externalNumber: null,
  sourceSystem: 'erp',
  city: null,
  country: null,
  vatId: null,
  duns: null,
  amountCents: null,
  currency: 'EUR',
  year: 2025,
  erpMaterialGroup: null,
  account: null,
  description: null,
  ...overrides,
});
const row = (n: number, overrides: Partial<ImportRowView>): ImportRowView => ({
  id: uuid(n),
  rowNo: n,
  status: 'review',
  raw: {},
  normalized: normalized({}),
  supplier: null,
  matchMethod: null,
  matchScore: null,
  matchReason: null,
  suggestion: null,
  candidates: [],
  materialGroup: null,
  categoryMethod: null,
  categoryConfidence: null,
  categorySuggestion: null,
  needs: [],
  error: null,
  decidedBy: null,
  createNew: false,
  ...overrides,
});
const batch = (overrides: Partial<ImportBatch> = {}): ImportBatch => ({
  id: uuid(1),
  kind: 'spend',
  fileName: 'export_spend.csv',
  status: 'review',
  rowsTotal: 120,
  rowsOk: 116,
  rowsReview: 2,
  rowsError: 2,
  createdByName: 'Anna Berg',
  createdAt: '2026-11-23T08:12:00Z',
  committedAt: null,
  source: 'file',
  headers: ['Lieferantennummer', 'Name', 'Betrag'],
  sample: [{ Lieferantennummer: '4711', Name: 'Rheintal', Betrag: '1000,00' }],
  columnMap: { externalNumber: 'Lieferantennummer', name: 'Name', amount: 'Betrag' },
  suggestedMap: { externalNumber: 'Lieferantennummer', name: 'Name', amount: 'Betrag' },
  missingRequired: [],
  spend: { okCents: 96_800_000, reviewCents: 2_000_000, errorCents: 50_000 },
  learnedShare: 0.87,
  rows: [
    row(10, {
      normalized: normalized({
        name: 'RHEINTAL ELEKTRONIK GMBH & CO KG',
        externalNumber: '4711093',
        city: 'Speyer',
        country: 'DE',
        amountCents: 31_240_000,
      }),
      suggestion: {
        relationshipId: uuid(50),
        name: 'Rheintal Elektronik GmbH',
        reason: 'Ähnlichkeit 0,88: gleiche Stadt und gleiches Land, Rechtsform anders geschrieben.',
        parentRelationshipId: null,
        parentName: null,
      },
      candidates: [{ relationshipId: uuid(50), name: 'Rheintal Elektronik GmbH', score: 0.88 }],
      needs: ['supplier'],
    }),
    row(11, {
      normalized: normalized({
        description: 'Frachtkosten Express',
        account: '4730',
        amountCents: 2_280_000,
      }),
      supplier: { relationshipId: uuid(51), name: 'Pearl River Components' },
      categorySuggestion: { id: null, name: null, reason: 'Keine Warengruppe passt zum Text.' },
      needs: ['category'],
    }),
    row(12, { status: 'error', error: 'Währung CNY ohne Kurs' }),
  ],
  errors: [{ reason: 'Währung CNY ohne Kurs', count: 2 }],
  plan: { newSuppliers: 9, materialGroups: 14, openRows: 2, aliases: 3, rules: 2 },
  quality: null,
  groups: [
    { id: uuid(60), name: 'Leiterplatten' },
    { id: uuid(61), name: 'Logistik' },
  ],
  canManage: true,
  canRevert: false,
  revertUntil: null,
  ...overrides,
});

let current: ImportBatch;
let sent: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  current = batch();
  sent = [];
  api.handle = (request) => {
    if (request.url === '/api/einstellungen/importe') {
      return Response.json({
        batches: [
          {
            id: current.id,
            kind: current.kind,
            fileName: current.fileName,
            status: current.status,
            rowsTotal: current.rowsTotal,
            rowsOk: current.rowsOk,
            rowsReview: current.rowsReview,
            rowsError: current.rowsError,
            createdByName: current.createdByName,
            createdAt: current.createdAt,
            committedAt: current.committedAt,
          },
        ],
        canManage: true,
      });
    }
    const base = `/api/einstellungen/importe/${uuid(1)}`;
    if (request.url.startsWith(base)) {
      if (request.method !== 'GET') {
        sent.push({
          url: request.url.slice(base.length),
          method: request.method,
          body: request.body,
        });
        if (request.url.endsWith('/verarbeiten')) current = batch();
        if (request.url.endsWith('/uebernehmen')) {
          current = batch({
            status: 'committed',
            committedAt: '2026-11-23T09:00:00Z',
            rowsReview: 0,
            rows: [],
            quality: { assignedShare: 0.97, suppliersWithoutGroup: 3, proposedGroups: 1 },
            canRevert: true,
            revertUntil: '2026-12-23T09:00:00Z',
          });
        }
      }
      return Response.json(current);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('KI-15 Import und Zuordnung', () => {
  it('die Seite zeigt den neuen Import und die letzten Importe mit Stand', async () => {
    renderAt('/einstellungen/daten/import');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Daten importieren' }),
    ).toBeTruthy();
    expect(await screen.findByRole('radio', { name: 'Spend' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Lieferantenstamm' })).toBeTruthy();
    const recent = (
      await screen.findByRole('heading', { level: 2, name: 'Letzte Importe' })
    ).closest('aside') as HTMLElement;
    expect(within(recent).getByText('export_spend.csv')).toBeTruthy();
    expect(within(recent).getByText('zur Prüfung')).toBeTruthy();
  });

  it('Spalten: Vorschlag vorausgewählt, Weiter speichert und verarbeitet', async () => {
    current = batch({ status: 'mapped', rows: [] });
    renderAt(`/einstellungen/daten/import/${uuid(1)}`);
    const amount = (await screen.findByLabelText(/^Betrag/)) as HTMLSelectElement;
    expect(amount.value).toBe('Betrag');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() =>
      expect(sent.map((entry) => entry.url)).toEqual(['/spalten', '/verarbeiten']),
    );
  });

  it('Prüfen: drei Zahlen, Vorschlag mit Begründung, Übernehmen und Warengruppe nicht zuordnen', async () => {
    renderAt(`/einstellungen/daten/import/${uuid(1)}`);
    expect(await screen.findByText('Sicher zugeordnet')).toBeTruthy();
    expect(screen.getByText('116 Zeilen')).toBeTruthy();
    expect(screen.getByText('2 Zeilen warten auf dich')).toBeTruthy();
    const queue = screen
      .getByRole('heading', { level: 2, name: 'Zur Prüfung' })
      .closest('section') as HTMLElement;
    expect(within(queue).getByText('Rheintal Elektronik GmbH')).toBeTruthy();
    expect(within(queue).getByText(/Ähnlichkeit 0,88/)).toBeTruthy();
    expect(within(queue).getByText(/Lieferantennummer 4711093 ist neu/)).toBeTruthy();
    fireEvent.click(within(queue).getAllByRole('button', { name: 'Übernehmen' })[0] as HTMLElement);
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        url: '/entscheiden',
        body: { rowIds: [uuid(10)], action: 'accept' },
      }),
    );
    fireEvent.click(within(queue).getByRole('button', { name: 'Nicht zuordnen' }));
    await waitFor(() =>
      expect(sent[1]).toMatchObject({
        body: { rowIds: [uuid(11)], action: 'category', materialGroupId: null },
      }),
    );
    expect(screen.getByText(/zu 3 Aliassen und 2 Regeln/)).toBeTruthy();
    expect(screen.getByText('Währung CNY ohne Kurs')).toBeTruthy();
  });

  it('Übernehmen zeigt danach die Datenqualität und Rückgängig mit Frist', async () => {
    renderAt(`/einstellungen/daten/import/${uuid(1)}`);
    const plan = (
      await screen.findByRole('heading', { level: 2, name: 'Was beim Übernehmen passiert' })
    ).closest('section') as HTMLElement;
    fireEvent.click(within(plan).getByRole('button', { name: 'Jetzt übernehmen' }));
    expect(await screen.findByText('Datenqualität nach dem Übernehmen')).toBeTruthy();
    expect(screen.getByText('97 %')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig machen' }));
    await waitFor(() => expect(sent.at(-1)?.url).toBe('/rueckgaengig'));
  });
});
