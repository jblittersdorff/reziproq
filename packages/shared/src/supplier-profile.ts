import { z } from 'zod';

// SPL-05: Profil und Finanzen eines Lieferanten, nur für den Käufer. Beträge in ganzen Cent mit
// Währung, Quoten in Basispunkten (1 % = 100). Jede Kennzahl hat Jahr, Einheit und Quelle.

export const financialMetrics = [
  'revenue',
  'ebit_margin',
  'net_debt',
  'equity_ratio',
  'cash',
] as const;
export type FinancialMetric = (typeof financialMetrics)[number];

/** Quoten in Basispunkten, alle anderen Kennzahlen als Betrag in Cent. */
export const ratioMetrics: readonly FinancialMetric[] = ['ebit_margin', 'equity_ratio'];
export const isRatio = (metric: FinancialMetric) => ratioMetrics.includes(metric);

const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const companyProfileSchema = z.object({
  headquarters: optionalText(200),
  foundedYear: z.number().int().min(1600).max(2100).nullable(),
  employees: z.number().int().min(0).max(10_000_000).nullable(),
  businessSegments: optionalText(2000),
});
export type CompanyProfile = z.infer<typeof companyProfileSchema>;

export const executiveSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  since: z.number().int().min(1950).max(2100).nullable(),
});
export type Executive = z.infer<typeof executiveSchema>;

export const financialValueSchema = z.object({
  id: z.uuid(),
  year: z.number().int(),
  metric: z.enum(financialMetrics),
  /** Cent bei Beträgen, Basispunkte bei Quoten */
  value: z.number().int(),
  unit: z.enum(['cents', 'basis_points']),
  currency: z.string().nullable(),
  source: z.string(),
});
export type FinancialValue = z.infer<typeof financialValueSchema>;

export const supplierProfileSchema = z.object({
  company: companyProfileSchema,
  implications: z.string().nullable(),
  updatedByName: z.string().nullable(),
  updatedAt: z.string().nullable(),
  executives: z.array(executiveSchema.extend({ id: z.uuid() })),
  financials: z.array(financialValueSchema),
  /** Unser Anteil: eigener Ist-Spend durch Umsatz des Lieferanten im selben Jahr */
  share: z
    .discriminatedUnion('status', [
      z.object({ status: z.literal('ok'), year: z.number().int(), basisPoints: z.number().int() }),
      z.object({ status: z.literal('currency_mismatch'), year: z.number().int() }),
    ])
    .nullable(),
  canEdit: z.boolean(),
});
export type SupplierProfile = z.infer<typeof supplierProfileSchema>;

export const saveCompanyProfileSchema = companyProfileSchema.strict();
export const saveImplicationsSchema = z.object({ implications: optionalText(4000) }).strict();
export const saveExecutivesSchema = z
  .object({ executives: z.array(executiveSchema).max(30) })
  .strict();

export const saveFinancialSchema = z
  .object({
    year: z.number().int().min(1990).max(2100),
    metric: z.enum(financialMetrics),
    value: z.number().int(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    source: z.string().trim().min(1, { error: 'source_required' }).max(500),
  })
  .strict()
  .refine((input) => isRatio(input.metric) === (input.currency === null), {
    message: 'unit_mismatch',
    path: ['currency'],
  });
export type SaveFinancial = z.infer<typeof saveFinancialSchema>;

export const financialImportIssues = [
  'invalid_year',
  'unknown_metric',
  'invalid_value',
  'invalid_unit',
  'source_required',
  'duplicate_row',
  'missing_column',
] as const;
export type FinancialImportIssue = (typeof financialImportIssues)[number];

export const financialImportResultSchema = z.object({
  imported: z.number().int(),
  rows: z.array(
    z.object({ row: z.number().int(), issues: z.array(z.enum(financialImportIssues)) }),
  ),
});
export type FinancialImportResult = z.infer<typeof financialImportResultSchema>;
