import type { Supplier } from '@reziproq/shared';
import { z } from 'zod';

// Suche, Sortierung und „Beendete zeigen“ stehen in der Adresse (PLT-03), z. B.
// /lieferanten?suche=guss&sortierung=name&beendet=1. Ungültige Werte fallen auf den Standard.

export const supplierSearchSchema = z.object({
  ansicht: z.enum(['matrix', 'runde']).optional().catch(undefined),
  segmente: z.enum(['ist', 'soll', 'both']).optional().catch(undefined),
  suche: z.string().optional().catch(undefined),
  sortierung: z.enum(['spend', 'name']).optional().catch(undefined),
  beendet: z.literal(1).optional().catch(undefined),
  // NAV-12: Filter der Liste
  bu: z.string().optional().catch(undefined),
  wg: z.string().optional().catch(undefined),
  typ: z.string().optional().catch(undefined),
  fokus: z.literal(1).optional().catch(undefined),
  meine: z.literal(1).optional().catch(undefined),
  // LS-01: Auswahl der Detailleiste
  lieferant: z.string().optional().catch(undefined),
});

export type SupplierSearch = z.infer<typeof supplierSearchSchema>;
export type SortKey = NonNullable<SupplierSearch['sortierung']>;

/** Filtert nach Name, eigener Nummer und Warengruppen (PLT-06), ohne Groß- und Kleinschreibung. */
export function filterSuppliers(suppliers: Supplier[], query: string): Supplier[] {
  const needle = query.trim().toLocaleLowerCase('de');
  if (!needle) return suppliers;
  return suppliers.filter((supplier) =>
    [supplier.name, supplier.externalRef ?? '', ...supplier.materialGroups].some((value) =>
      value.toLocaleLowerCase('de').includes(needle),
    ),
  );
}

/** Spend absteigend (ohne Spend zuletzt) oder Name von A bis Z. */
export function sortSuppliers(suppliers: Supplier[], key: SortKey): Supplier[] {
  return [...suppliers].sort((a, b) =>
    key === 'name'
      ? a.name.localeCompare(b.name, 'de')
      : (b.spend?.amountCents ?? -1) - (a.spend?.amountCents ?? -1) ||
        a.name.localeCompare(b.name, 'de'),
  );
}

/** Was die Liste zeigt: ohne beendete Beziehungen, außer der Filter holt sie zurück. */
export function visibleSuppliers(
  suppliers: Supplier[],
  search: SupplierSearch,
  groups: { id: string; parentId: string | null }[] = [],
): Supplier[] {
  // Eine Oberebene der Warengruppe schließt ihre Untergruppen ein.
  const groupIds = new Set(
    search.wg
      ? [search.wg, ...groups.filter((g) => g.parentId === search.wg).map((g) => g.id)]
      : [],
  );
  const current = suppliers.filter(
    (s) =>
      (search.beendet || s.status !== 'ended') &&
      (!search.bu || s.businessUnitIds?.includes(search.bu)) &&
      (!search.wg || s.materialGroupIds?.some((id) => groupIds.has(id))) &&
      (!search.typ || s.targetType === search.typ) &&
      (!search.fokus || s.isFocus) &&
      (!search.meine || s.isMine),
  );
  return sortSuppliers(filterSuppliers(current, search.suche ?? ''), search.sortierung ?? 'spend');
}

/** Anzahl der gesetzten Filter ohne Suche, Sortierung und „Beendete zeigen“. */
export const activeFilters = (search: SupplierSearch) =>
  [search.bu, search.wg, search.typ, search.fokus, search.meine].filter(Boolean).length;
