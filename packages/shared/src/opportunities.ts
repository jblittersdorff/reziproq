import { z } from 'zod';
import { insightStatementSchema } from './insights.js';
import { leverValueSchema } from './levers.js';

export const opportunityConfidences = ['low', 'medium', 'high'] as const;
export type OpportunityConfidence = (typeof opportunityConfidences)[number];

const referenceSchema = z.object({
  objectType: z.string().min(1),
  objectId: z.uuid(),
  relationshipId: z.uuid(),
  observedOn: z.iso.date(),
});

const marketCitationSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  publisher: z.string().trim().min(1),
  publishedOn: z.iso.date(),
});

const provenanceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('own_data'), reference: referenceSchema }),
  z.object({ kind: z.literal('supplier_input'), reference: referenceSchema }),
  z.object({ kind: z.literal('template_assumption') }),
  z.object({ kind: z.literal('user_assumption') }),
  z.object({
    kind: z.literal('public_source'),
    citations: z.array(marketCitationSchema).nonempty(),
  }),
]);

/** Mengen und Anteile als Dezimaltext, Geld in ganzen Cent. Die Vorlage prüft die Einheit. */
export const opportunityInputSchema = z
  .object({
    low: leverValueSchema,
    high: leverValueSchema,
    source: provenanceSchema,
  })
  .strict();
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;

export const opportunityInputsSchema = z.record(z.string(), opportunityInputSchema);

export const opportunityTemplateKeys = [
  'forecast_sharing',
  'market_standard',
  'consignment',
  'volume_bundling',
  'quality_costs',
  'logistics_bundling',
  'index_clause',
  'capacity_shortage',
  'tariffs',
] as const;
export type OpportunityTemplateKey = (typeof opportunityTemplateKeys)[number];

export const opportunityImpactTypes = ['ebit', 'cash', 'cost_avoidance'] as const;
export type OpportunityImpactType = (typeof opportunityImpactTypes)[number];
export const opportunityStatuses = ['new', 'adopted', 'dismissed', 'superseded', 'realized'] as const;
export const marketSignalKinds = [
  'raw_material',
  'market_capacity',
  'supplier_public',
  'tariff_regulation',
  'technology',
] as const;
export const marketSignalOutcomes = ['opportunity', 'topic', 'data_gap', 'no_effect'] as const;

const rangeSchema = z.object({ low: z.number().int(), high: z.number().int() });

/** Eine Zeile im Rechenweg: Eingabe, Spanne als Dezimaltext und Herkunft */
export const opportunityStepSchema = z.object({
  key: z.string(),
  unit: z.enum(['cents', 'quantity', 'rate', 'index']),
  low: z.string(),
  high: z.string(),
  source: z.enum(['own_data', 'supplier_input', 'public_source', 'template_assumption', 'user_assumption']),
  citations: z.array(marketCitationSchema),
  editable: z.boolean(),
});

export const valueOpportunitySchema = z.object({
  id: z.uuid(),
  templateKey: z.enum(opportunityTemplateKeys),
  title: z.string(),
  reason: z.string(),
  impactType: z.enum(opportunityImpactTypes),
  buyer: rangeSchema,
  supplier: rangeSchema.nullable(),
  supplierEffect: z.string().nullable(),
  currency: z.string(),
  confidence: z.enum(opportunityConfidences),
  confidenceReason: z.string(),
  fromMarket: z.boolean(),
  steps: z.array(opportunityStepSchema),
  status: z.enum(opportunityStatuses),
  createdAt: z.iso.datetime(),
});
export type ValueOpportunity = z.infer<typeof valueOpportunitySchema>;

export const marketSignalSchema = z.object({
  id: z.uuid(),
  kind: z.enum(marketSignalKinds),
  title: z.string(),
  summary: z.string(),
  direction: z.enum(['relief', 'burden', 'neutral']),
  sources: z.array(
    z.object({ title: z.string(), url: z.string(), publishedOn: z.iso.date(), excerpt: z.string() }),
  ),
  outcome: z.enum(marketSignalOutcomes),
  outcomeReason: z.string(),
});

export const valueDataGapSchema = z.object({
  id: z.uuid(),
  dataKey: z.string(),
  description: z.string(),
  templatesBlocked: z.array(z.enum(opportunityTemplateKeys)),
  status: z.enum(['open', 'requested', 'closed']),
  /** Offener Entwurf der Anfrage an den Lieferanten (KI-03), sonst null */
  draft: z
    .object({ id: z.uuid(), title: z.string(), description: z.string() })
    .nullable()
    .optional(),
});

/** Summen je Wirkungsart: nur Sicherheit hoch und mittel, Wirkungsarten nie addiert */
export const opportunityTotalsSchema = z.object({
  impactType: z.enum(opportunityImpactTypes),
  new: rangeSchema,
  adopted: rangeSchema,
  realized: rangeSchema,
});

export const valueOpportunitiesSchema = z.object({
  researchEnabled: z.boolean(),
  canRun: z.boolean(),
  canDecide: z.boolean(),
  lastRun: z
    .object({ id: z.uuid(), status: z.string(), finishedAt: z.iso.datetime().nullable() })
    .nullable(),
  counts: z.object({
    new: z.number().int(),
    adopted: z.number().int(),
    realized: z.number().int(),
  }),
  totals: z.array(opportunityTotalsSchema),
  opportunities: z.array(valueOpportunitySchema),
  checked: z.object({
    templates: z.number().int(),
    checkable: z.number().int(),
    withOpportunity: z.number().int(),
    withoutOpportunity: z.array(z.object({ templateKey: z.enum(opportunityTemplateKeys) })),
    notCheckable: z.number().int(),
    signals: z.number().int(),
  }),
  signals: z.array(marketSignalSchema),
  dataGaps: z.array(valueDataGapSchema),
  outbound: z.array(z.object({ text: z.string(), sentAt: z.iso.datetime() })),
  statement: insightStatementSchema.nullable().optional(),
});
export type ValueOpportunities = z.infer<typeof valueOpportunitiesSchema>;

export const changeAssumptionsSchema = z
  .object({
    inputs: z
      .record(z.string(), z.object({ low: leverValueSchema, high: leverValueSchema }).strict())
      .refine((value) => Object.keys(value).length > 0),
  })
  .strict();
export type ChangeAssumptions = z.infer<typeof changeAssumptionsSchema>;

export const dismissOpportunitySchema = z
  .object({ reason: z.string().trim().min(3).max(1000) })
  .strict();

/** Was der Lieferant sehen wird: nur Titel und Beschreibung, ohne Zahlen und Quellen */
export const adoptOpportunitySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000),
  })
  .strict();
export type AdoptOpportunity = z.infer<typeof adoptOpportunitySchema>;

/** KI-11, Ablauf 7: Wertpotenziale über alle Lieferanten der Organisation */
export const valueOverviewSchema = z.object({
  counts: z.object({
    new: z.number().int(),
    adopted: z.number().int(),
    realized: z.number().int(),
    lowExcluded: z.number().int(),
  }),
  totals: z.array(opportunityTotalsSchema),
  biggest: z
    .object({
      relationshipId: z.uuid(),
      supplierName: z.string(),
      templateKey: z.enum(opportunityTemplateKeys),
      impactType: z.enum(opportunityImpactTypes),
      buyer: rangeSchema,
      confidence: z.enum(opportunityConfidences),
    })
    .nullable(),
  suppliers: z.array(
    z.object({
      relationshipId: z.uuid(),
      name: z.string(),
      newCount: z.number().int(),
      adoptedCount: z.number().int(),
      ebitNew: rangeSchema.nullable(),
      cashNew: rangeSchema.nullable(),
      confidence: z.enum(opportunityConfidences).nullable(),
      nextStep: z.enum(['review', 'in_jbp', 'run']),
    }),
  ),
  levers: z.array(z.object({ templateKey: z.enum(opportunityTemplateKeys), count: z.number().int() })),
  signals: z.array(z.object({ title: z.string(), suppliers: z.number().int() })),
  dataGaps: z.array(
    z.object({ dataKey: z.string(), description: z.string(), suppliers: z.number().int() }),
  ),
  statement: insightStatementSchema.nullable().optional(),
});
export type ValueOverview = z.infer<typeof valueOverviewSchema>;

/** Anfrage zu einer Datenlücke senden: erst dann entsteht die geteilte Maßnahme beim Lieferanten */
export const sendDataRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000),
    dueDate: z.iso.date(),
  })
  .strict();
export type SendDataRequest = z.infer<typeof sendDataRequestSchema>;

/** Annahmen der Hebel-Vorlagen mit Spanne (Herkunft template_assumption); je Kunde änderbar */
export const templateAssumptionDefaults: Partial<
  Record<OpportunityTemplateKey, Record<string, { low: string; high: string }>>
> = {
  forecast_sharing: {
    avoidable_setups: { low: '0.6', high: '0.8' },
    inventory_reduction: { low: '0.4', high: '0.6' },
    capital_rate: { low: '0.09', high: '0.09' },
    pass_through: { low: '0.5', high: '0.5' },
  },
  market_standard: { unit_price_reduction: { low: '0.05', high: '0.12' } },
  index_clause: { material_share: { low: '0.3', high: '0.5' } },
};

/** Abweichende Annahme eines Kunden, Anteile als Dezimaltext zwischen 0 und 1 */
export const valueAssumptionSchema = z
  .object({
    templateKey: z.enum(opportunityTemplateKeys),
    field: z.string().min(1).max(60),
    low: leverValueSchema,
    high: leverValueSchema,
  })
  .strict()
  .refine((value) => Number(value.low) >= 0 && Number(value.high) <= 1 && Number(value.low) <= Number(value.high))
  .refine((value) => Boolean(templateAssumptionDefaults[value.templateKey]?.[value.field]));
export type ValueAssumption = z.infer<typeof valueAssumptionSchema>;
