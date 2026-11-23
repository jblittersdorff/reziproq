import { expect, test } from '@playwright/test';
import type { ImportBatch, ImportRowView } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// KI-15: Import prüfen auf Telefonbreite und am Schreibtisch, ohne seitliches Scrollen.

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

for (const width of [390, 1440]) {
  test(`Import prüfen ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route(`**/api/einstellungen/importe/${uuid(1)}`, (route) =>
      route.fulfill({ json: batch() }),
    );
    await page.goto(`/einstellungen/daten/import/${uuid(1)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Import prüfen' })).toBeVisible();
    await expect(page.getByText('2 Zeilen warten auf dich')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.KI15_SHOTS) {
      await page.screenshot({
        path: `${process.env.KI15_SHOTS}/import-${width}.png`,
        fullPage: true,
      });
    }
  });
}
