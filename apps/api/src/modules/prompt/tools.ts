import { ForbiddenException } from '@nestjs/common';
import {
  areaKeys,
  areas,
  lastFullYear,
  type Money,
  type PromptEvent,
  type Supplier,
  spendYearSchema,
} from '@reziproq/shared';
import { type ToolSet, tool } from 'ai';
import { z } from 'zod';
import type { AuthContext } from '../auth/auth.guard.js';
import type { SupplierFilter, SuppliersService } from '../suppliers/suppliers.service.js';

// Beide Werkzeuge sind lesend und an fest definierte Routen gebunden. Die KI bekommt weder SQL
// noch eine frei wählbare URL; Suche und Ausführung verwenden die angemeldete Mandanten-Session.
const searchInput = z.object({
  name: z.string().max(200).optional(),
  nummer: z.string().max(200).optional(),
  land: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  businessUnit: z.string().max(120).optional(),
  materialGroup: z.string().max(120).optional(),
  year: spendYearSchema.optional(),
  minSpendEuro: z.number().nonnegative().optional(),
  maxSpendEuro: z.number().nonnegative().optional(),
  sortierung: z.enum(['spend_absteigend', 'spend_aufsteigend', 'name']).optional(),
  anzahl: z.number().int().min(1).max(20).optional(),
});

const openInput = z.object({
  bereich: z.enum(areaKeys).optional(),
  lieferant: z.string().trim().min(1).max(200).optional(),
});

const searchDescription =
  'Sucht Lieferanten der eigenen Organisation nach Name, eigener Lieferantennummer, Land, ' +
  'Business Unit, Warengruppe, Spend und Jahr. Beendete Beziehungen zählen nicht. Spend-Filter ' +
  'gelten nur für Euro-Beträge. Liefert höchstens 20 Treffer mit Name, Land, Nummer und Spend.';
const openDescription = `Bereitet das Öffnen eines festen Reziproq-Bereichs vor: ${areas
  .map((area) => `${area.key} (${area.name})`)
  .join(', ')}. Für den Spend eines Lieferanten über lieferant mit dessen Namen suchen.`;

export function createPromptTools(
  invoke: (name: string, input: unknown) => Promise<unknown>,
): ToolSet {
  return {
    lieferanten_suchen: tool({
      description: searchDescription,
      inputSchema: searchInput,
      execute: (input) => invoke('lieferanten_suchen', input),
    }),
    seite_oeffnen: tool({
      description: openDescription,
      inputSchema: openInput,
      execute: (input) => invoke('seite_oeffnen', input),
    }),
  };
}

/** Betrag in seiner eigenen Währung, ohne Nachkommastellen, z. B. 4.820.000 € oder 900.000 $. */
function formatSpend({ amountCents, currency }: Money) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

/** Was die KI über einen Lieferanten erfährt: dieselben Werte wie auf der Karte. */
function forModel(supplier: Supplier, year: number) {
  return {
    name: supplier.name,
    land: supplier.country,
    nummer: supplier.externalRef,
    spend: supplier.spend ? formatSpend(supplier.spend) : null,
    spendJahr: year,
  };
}

/** Führt einen Werkzeugaufruf mit den Rechten der fragenden Person aus. */
export async function invokePromptTool(
  name: string,
  input: unknown,
  auth: AuthContext,
  suppliers: SuppliersService,
  emit: (event: PromptEvent) => void,
): Promise<unknown> {
  if (name === 'lieferanten_suchen') {
    const parsed = searchInput.safeParse(input);
    if (!parsed.success) return { fehler: 'Ungültige Eingabe für die Suche.' };
    try {
      const filter: SupplierFilter = parsed.data;
      const hits = await suppliers.search(auth, filter);
      emit({ type: 'suppliers', suppliers: hits });
      return {
        anzahl: hits.length,
        treffer: hits.map((supplier) => forModel(supplier, filter.year ?? lastFullYear())),
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return { fehler: 'Der Nutzer darf keine Lieferanten sehen.' };
      }
      throw error;
    }
  }

  if (name === 'seite_oeffnen') {
    const parsed = openInput.safeParse(input);
    if (!parsed.success || Boolean(parsed.data.bereich) === Boolean(parsed.data.lieferant)) {
      return { fehler: 'Bitte genau einen Bereich oder Lieferanten angeben.' };
    }
    if (parsed.data.bereich) {
      const area = areas.find((candidate) => candidate.key === parsed.data.bereich);
      if (!area) return { fehler: 'Diesen Bereich gibt es nicht.' };
      emit({ type: 'navigate', destination: { type: 'area', path: area.path } });
      return { geoeffnet: area.name };
    }
    try {
      const supplierName = parsed.data.lieferant;
      if (!supplierName) return { fehler: 'Bitte einen Lieferanten angeben.' };
      const hits = await suppliers.search(auth, {
        name: supplierName,
        exactName: true,
        anzahl: 20,
      });
      const supplier = hits.find(
        (hit) => hit.name.toLocaleLowerCase('de') === supplierName.toLocaleLowerCase('de'),
      );
      if (!supplier) return { fehler: 'Diesen Lieferanten gibt es in deiner Liste nicht.' };
      emit({
        type: 'navigate',
        destination: { type: 'supplierSpend', relationshipId: supplier.relationshipId },
      });
      return { geoeffnet: `Spend von ${supplier.name}` };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return { fehler: 'Der Nutzer darf keine Lieferanten sehen.' };
      }
      throw error;
    }
  }

  return { fehler: 'Unbekanntes Werkzeug.' };
}
