import { z } from 'zod';
import { moneySchema } from './money.js';

/** Status einer Beziehung (PLT-03): angelegt, aktiv mit dem Lieferanten, beendet. */
export const relationshipStatuses = ['draft', 'active', 'ended'] as const;
export type RelationshipStatus = (typeof relationshipStatuses)[number];

/** Ein Lieferant aus Sicht eines Käufers, mit dessen eigenen Werten (PLT-03). */
export const supplierSchema = z.object({
  relationshipId: z.string(),
  /** Eigener Anzeigename der Käuferseite, sonst der Name der Organisation */
  name: z.string(),
  /** ISO-3166-1-Code, z. B. DE */
  country: z.string().nullable(),
  /** Eigene Lieferantennummer des Käufers */
  externalRef: z.string().nullable(),
  status: z.enum(relationshipStatuses),
  /** Spend des Jahres spendYear aus der Antwort; null, wenn dafür nichts erfasst ist */
  spend: moneySchema.nullable(),
});

export type Supplier = z.infer<typeof supplierSchema>;

export const suppliersResponseSchema = z.object({
  /** Alle Beziehungen der eigenen Organisation, auch beendete; die Oberfläche filtert. */
  suppliers: z.array(supplierSchema),
  /** Anzahl der nicht beendeten Beziehungen */
  count: z.number().int(),
  /** Das letzte volle Kalenderjahr, auf das sich spend und totalSpend beziehen */
  spendYear: z.number().int(),
  /**
   * Gesamtspend des Jahres spendYear je Währung, über alle nicht beendeten Beziehungen.
   * Verschiedene Währungen werden nie zusammengezählt.
   */
  totalSpend: z.array(moneySchema),
});

export type SuppliersResponse = z.infer<typeof suppliersResponseSchema>;

/** Fehlercodes für 403-Antworten, damit die Oberfläche den passenden Hinweis zeigt. */
export const forbiddenCodes = ['keine_organisation', 'keine_berechtigung'] as const;
export type ForbiddenCode = (typeof forbiddenCodes)[number];

/** Das letzte volle Kalenderjahr; Geschäftsjahre kommen mit PNL-10. */
export const lastFullYear = (now: Date = new Date()) => now.getFullYear() - 1;
