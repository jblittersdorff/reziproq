import type { Supplier } from '@reziproq/shared';
import { z } from 'zod';

// Suche, Sortierung und „Beendete zeigen“ stehen in der Adresse (PLT-03), z. B.
// /lieferanten?suche=guss&sortierung=name&beendet=1. Ungültige Werte fallen auf den Standard.

export const supplierSearchSchema = z.object({
  suche: z.string().optional().catch(undefined),
  sortierung: z.enum(['spend', 'name']).optional().catch(undefined),
  beendet: z.literal(1).optional().catch(undefined),
});

export type SupplierSearch = z.infer<typeof supplierSearchSchema>;
export type SortKey = NonNullable<SupplierSearch['sortierung']>;

/** Filtert nach Name und eigener Nummer, ohne Groß- und Kleinschreibung. */
export function filterSuppliers(suppliers: Supplier[], query: string): Supplier[] {
  const needle = query.trim().toLocaleLowerCase('de');
  if (!needle) return suppliers;
  return suppliers.filter((supplier) =>
    [supplier.name, supplier.externalRef ?? ''].some((value) =>
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
export function visibleSuppliers(suppliers: Supplier[], search: SupplierSearch): Supplier[] {
  const current = search.beendet ? suppliers : suppliers.filter((s) => s.status !== 'ended');
  return sortSuppliers(filterSuppliers(current, search.suche ?? ''), search.sortierung ?? 'spend');
}
