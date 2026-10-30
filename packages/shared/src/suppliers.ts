import { z } from 'zod';
import { moneySchema } from './money.js';

/** Ein Lieferant aus Sicht eines Käufers, mit dessen käuferprivaten Werten (PLT-02). */
export const supplierSchema = z.object({
  relationshipId: z.string(),
  name: z.string(),
  /** ISO-3166-1-Code, z. B. DE */
  country: z.string().nullable(),
  category: z.string(),
  annualSpend: moneySchema,
  spendYear: z.number().int(),
});

export type Supplier = z.infer<typeof supplierSchema>;

export const suppliersResponseSchema = z.object({
  suppliers: z.array(supplierSchema),
  count: z.number().int(),
  /** Das Jahr, auf das sich totalSpend bezieht: das letzte Spend-Jahr; null ohne Lieferanten. */
  spendYear: z.number().int().nullable(),
  /**
   * Gesamtspend des Jahres spendYear je Währung. Ältere Jahre und verschiedene Währungen werden
   * nie zusammengezählt.
   */
  totalSpend: z.array(moneySchema),
});

export type SuppliersResponse = z.infer<typeof suppliersResponseSchema>;

/** Fehlercodes für 403-Antworten, damit die Oberfläche den passenden Hinweis zeigt. */
export const forbiddenCodes = ['keine_organisation', 'keine_berechtigung'] as const;
export type ForbiddenCode = (typeof forbiddenCodes)[number];
