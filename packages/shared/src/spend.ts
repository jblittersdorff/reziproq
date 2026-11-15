import { z } from 'zod';
import { moneySchema } from './money.js';
import { amountCentsSchema } from './suppliers.js';

// SPL-04: Spend-Entwicklung. Zeilen für Ist und Plan, optional je Business Unit und Warengruppe;
// ohne Aufteilung gilt eine Zeile für den ganzen Lieferanten. Geld immer in ganzen Cent.

export const spendKinds = ['actual', 'plan'] as const;
export type SpendKind = (typeof spendKinds)[number];

/** Ist bis zum nächsten Jahr, Plan bis zehn Jahre voraus. */
export const spendEntryYearOk = (year: number, kind: SpendKind) =>
  Number.isInteger(year) &&
  year >= 2000 &&
  year <= new Date().getFullYear() + (kind === 'plan' ? 10 : 1);

const named = z.object({ id: z.uuid(), name: z.string() });

export const spendEntrySchema = z.object({
  id: z.uuid(),
  year: z.number().int(),
  kind: z.enum(spendKinds),
  businessUnit: named.nullable(),
  materialGroup: named.nullable(),
  amount: moneySchema,
});
export type SpendEntry = z.infer<typeof spendEntrySchema>;

/** Ein Anteil an einer Jahressumme; id null = ohne Zuordnung. */
const partSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().nullable(),
  amountCents: z.number().int(),
});

export const spendYearTotalSchema = z.object({
  year: z.number().int(),
  kind: z.enum(spendKinds),
  amountCents: z.number().int(),
  byBusinessUnit: z.array(partSchema),
  byMaterialGroup: z.array(partSchema),
});
export type SpendYearTotal = z.infer<typeof spendYearTotalSchema>;

export const spendOverviewSchema = z.object({
  /** Währung von Diagramm und Kennzahlen; Zeilen in anderen Währungen stehen nur in der Tabelle */
  currency: z.string().nullable(),
  /** Andere Währungen in den Zeilen (Hinweis) */
  otherCurrencies: z.array(z.string()),
  years: z.array(spendYearTotalSchema),
  kpis: z
    .object({
      year: z.number().int(),
      amount: moneySchema,
      previous: moneySchema.nullable(),
      /** Veränderung zum Vorjahr in Basispunkten (1 % = 100) */
      changeBasisPoints: z.number().int().nullable(),
      /** Anteil am gesamten Ist-Spend des Käufers im selben Jahr, in Basispunkten */
      shareBasisPoints: z.number().int().nullable(),
    })
    .nullable(),
  entries: z.array(spendEntrySchema),
  options: z.object({ businessUnits: z.array(named), materialGroups: z.array(named) }),
  canEdit: z.boolean(),
});
export type SpendOverview = z.infer<typeof spendOverviewSchema>;

export const saveSpendEntrySchema = z
  .object({
    year: z.number({ error: 'invalid_year' }).int({ error: 'invalid_year' }),
    kind: z.enum(spendKinds),
    businessUnitId: z.uuid().nullable(),
    materialGroupId: z.uuid().nullable(),
    amountCents: amountCentsSchema,
    currency: z.string().regex(/^[A-Z]{3}$/, { error: 'invalid_currency' }),
  })
  .strict()
  .refine((entry) => spendEntryYearOk(entry.year, entry.kind), {
    message: 'invalid_year',
    path: ['year'],
  });
export type SaveSpendEntry = z.infer<typeof saveSpendEntrySchema>;
