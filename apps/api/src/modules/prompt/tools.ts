import type Anthropic from '@anthropic-ai/sdk';
import { ForbiddenException } from '@nestjs/common';
import {
  areaKeys,
  areas,
  lastFullYear,
  type Money,
  type PromptEvent,
  type Supplier,
} from '@reziproq/shared';
import { z } from 'zod';
import type { AuthContext } from '../auth/auth.guard.js';
import type { SuppliersService } from '../suppliers/suppliers.service.js';

// Die einzigen Werkzeuge der KI (PLT-12), beide nur lesend. Die KI schreibt keine Abfragen und
// ruft keine anderen Adressen auf; sie bekommt nur, was diese Funktionen zurückgeben.

const searchInput = z.object({
  name: z.string().max(200).optional(),
  nummer: z.string().max(200).optional(),
  land: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  minSpendEuro: z.number().nonnegative().optional(),
  maxSpendEuro: z.number().nonnegative().optional(),
  sortierung: z.enum(['spend_absteigend', 'spend_aufsteigend', 'name']).optional(),
  anzahl: z.number().int().min(1).max(20).optional(),
});

const openInput = z.object({ bereich: z.enum(areaKeys) });

export const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: 'lieferanten_suchen',
    description:
      'Sucht Lieferanten der eigenen Organisation nach Name, eigener Lieferantennummer, Land ' +
      '(ISO-Code, z. B. DE) und Spend des letzten vollen Jahres in Euro. Beendete Beziehungen ' +
      'zählen nicht. Liefert höchstens 20 Treffer mit Name, Land, Nummer und Spend. Die Treffer ' +
      'sieht der Nutzer zusätzlich als Karten.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Teil des Lieferantennamens' },
        nummer: {
          type: 'string',
          description: 'Teil der eigenen Lieferantennummer, z. B. L-10001',
        },
        land: { type: 'string', description: 'ISO-Ländercode mit zwei Buchstaben' },
        minSpendEuro: {
          type: 'number',
          description: 'Mindest-Jahresspend in Euro; Beträge in anderen Währungen fallen heraus',
        },
        maxSpendEuro: {
          type: 'number',
          description: 'Höchst-Jahresspend in Euro; Beträge in anderen Währungen fallen heraus',
        },
        sortierung: { type: 'string', enum: ['spend_absteigend', 'spend_aufsteigend', 'name'] },
        anzahl: { type: 'integer', minimum: 1, maximum: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'bereich_oeffnen',
    description: `Öffnet einen Bereich von Reziproq in der Oberfläche. Bereiche: ${areas
      .map((area) => `${area.key} (${area.name})`)
      .join(', ')}.`,
    input_schema: {
      type: 'object',
      properties: { bereich: { type: 'string', enum: [...areaKeys] } },
      required: ['bereich'],
      additionalProperties: false,
    },
  },
];

/** Betrag in seiner eigenen Währung, ohne Nachkommastellen, z. B. 4.820.000 € oder 900.000 $. */
function formatSpend({ amountCents, currency }: Money): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

/** Was die KI über einen Lieferanten erfährt: dieselben Werte wie auf der Karte. */
function forModel(supplier: Supplier) {
  return {
    name: supplier.name,
    land: supplier.country,
    nummer: supplier.externalRef,
    spend: supplier.spend ? formatSpend(supplier.spend) : null,
    spendJahr: lastFullYear(),
  };
}

const result = (
  use: Anthropic.Beta.BetaToolUseBlock,
  content: unknown,
  isError = false,
): Anthropic.Beta.BetaToolResultBlockParam => ({
  type: 'tool_result',
  tool_use_id: use.id,
  content: JSON.stringify(content),
  ...(isError ? { is_error: true } : {}),
});

/** Führt einen Werkzeugaufruf mit den Rechten der fragenden Person aus. */
export async function runTool(
  use: Anthropic.Beta.BetaToolUseBlock,
  auth: AuthContext,
  suppliers: SuppliersService,
  emit: (event: PromptEvent) => void,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  if (use.name === 'lieferanten_suchen') {
    const input = searchInput.safeParse(use.input);
    if (!input.success) return result(use, { fehler: 'Ungültige Eingabe für die Suche.' }, true);
    try {
      const hits = await suppliers.search(auth, input.data);
      emit({ type: 'suppliers', suppliers: hits });
      return result(use, { anzahl: hits.length, treffer: hits.map(forModel) });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return result(use, { fehler: 'Der Nutzer darf keine Lieferanten sehen.' }, true);
      }
      throw error;
    }
  }

  if (use.name === 'bereich_oeffnen') {
    const input = openInput.safeParse(use.input);
    const area = input.success && areas.find((candidate) => candidate.key === input.data.bereich);
    if (!area) return result(use, { fehler: 'Diesen Bereich gibt es nicht.' }, true);
    emit({ type: 'navigate', to: area.path });
    return result(use, { geoeffnet: area.name });
  }

  return result(use, { fehler: `Unbekanntes Werkzeug: ${use.name}` }, true);
}
