import type { SpendOverview, SupplierDetail } from '@reziproq/shared';

/** Spend-Übersicht (SPL-04) aus dem Spend je Jahr eines Lieferanten-Details, für Tests. */
export function spendOverviewOf(detail: Pick<SupplierDetail, 'spend'>): SpendOverview {
  return {
    currency: detail.spend[0]?.amount.currency ?? null,
    otherCurrencies: [],
    years: [...detail.spend].reverse().map((entry) => ({
      year: entry.year,
      kind: 'actual',
      amountCents: entry.amount.amountCents,
      byBusinessUnit: [],
      byMaterialGroup: [],
    })),
    kpis: null,
    entries: detail.spend.map((entry) => ({
      id: `0190a0a0-0000-7000-8000-00000000${entry.year}`,
      year: entry.year,
      kind: 'actual',
      businessUnit: null,
      materialGroup: null,
      amount: entry.amount,
    })),
    options: { businessUnits: [], materialGroups: [] },
    canEdit: true,
  };
}
