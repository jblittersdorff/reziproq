import { z } from 'zod';

export const segmentAxes = ['impact', 'quality'] as const;
export const segmentStatuses = ['draft', 'active', 'retired'] as const;
/** E-K0-33: Größe der Matrix je Segmentmodell; Standard 3 × 3, Hollmann 2 × 2 */
export const segmentGridSizes = [2, 3] as const;

const axisSchema = z.enum(segmentAxes);
const weightSchema = z.number().min(0).max(100).multipleOf(0.01);
const modelText = (max: number) => z.string().trim().min(1).max(max);

export const segmentCriterionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  axis: axisSchema,
  name: modelText(100),
  description: modelText(500),
  weight: weightSchema,
  position: z.number().int().positive(),
});

export const segmentTypeSchema = z.object({
  impactLevel: z.number().int().min(1).max(3),
  qualityLevel: z.number().int().min(1).max(3),
  name: modelText(120),
  description: modelText(500),
});

const gridSizeSchema = z.union([z.literal(2), z.literal(3)]);
const axisLabel = modelText(80);

export const segmentModelSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(segmentStatuses),
  /** E-K0-33: 2 × 2 oder 3 × 3; bei 2 × 2 trennt lowMax die Stufen, midMax ist 100 */
  gridSize: gridSizeSchema,
  impactLabel: axisLabel,
  qualityLabel: axisLabel,
  lowMax: z.number().int().min(0).max(99),
  midMax: z.number().int().min(1).max(100),
  deviationThreshold: z.number().int().min(1).max(100),
  focusSpendShare: z.number().int().min(1).max(100),
  createdAt: z.iso.datetime(),
  activatedAt: z.iso.datetime().nullable(),
  criteria: z.array(segmentCriterionSchema),
  types: z.array(segmentTypeSchema),
});

export const segmentModelResponseSchema = z.object({
  active: segmentModelSchema.nullable(),
  draft: segmentModelSchema.nullable(),
});

export const updateSegmentCriterionSchema = z.object({
  name: modelText(100),
  description: modelText(500),
});

const weightEntrySchema = z.object({ key: segmentCriterionSchema.shape.key, weight: weightSchema });
const axisWeightsSchema = z.array(weightEntrySchema).min(1);

export const updateSegmentWeightsSchema = z
  .object({
    impact: axisWeightsSchema,
    quality: axisWeightsSchema,
  })
  .superRefine((value, context) => {
    for (const axis of segmentAxes) {
      const entries = value[axis];
      if (new Set(entries.map((entry) => entry.key)).size !== entries.length) {
        context.addIssue({ code: 'custom', message: 'duplicate_key', path: [axis] });
      }
      const total = Math.round(entries.reduce((sum, entry) => sum + entry.weight, 0) * 100);
      if (total !== 10_000) {
        context.addIssue({ code: 'custom', message: 'weight_sum', path: [axis] });
      }
    }
  });

export const updateSegmentBoundariesSchema = z
  .object({
    lowMax: z.number().int().min(0).max(99),
    midMax: z.number().int().min(1).max(100),
    deviationThreshold: z.number().int().min(1).max(100).optional(),
    focusSpendShare: z.number().int().min(1).max(100).optional(),
  })
  .refine((value) => value.lowMax < value.midMax, {
    message: 'invalid_boundaries',
    path: ['midMax'],
  });

export const updateSegmentTypeSchema = z.object({
  name: modelText(120),
  description: modelText(500),
});

/** E-K0-33: Raster und Namen der Achsen des Entwurfs; ein anderes Raster legt die Typen neu an */
export const updateSegmentGridSchema = z
  .object({ gridSize: gridSizeSchema, impactLabel: axisLabel, qualityLabel: axisLabel })
  .strict();

export type SegmentAxis = (typeof segmentAxes)[number];
export type SegmentStatus = (typeof segmentStatuses)[number];
export type SegmentCriterion = z.infer<typeof segmentCriterionSchema>;
export type SegmentType = z.infer<typeof segmentTypeSchema>;
export type SegmentModel = z.infer<typeof segmentModelSchema>;
export type SegmentModelResponse = z.infer<typeof segmentModelResponseSchema>;
export type UpdateSegmentCriterion = z.infer<typeof updateSegmentCriterionSchema>;
export type UpdateSegmentWeights = z.infer<typeof updateSegmentWeightsSchema>;
export type UpdateSegmentBoundaries = z.infer<typeof updateSegmentBoundariesSchema>;
export type UpdateSegmentType = z.infer<typeof updateSegmentTypeSchema>;
export type UpdateSegmentGrid = z.infer<typeof updateSegmentGridSchema>;
export type SegmentGridSize = (typeof segmentGridSizes)[number];

const impactNames = ['Niedriger', 'Mittlerer', 'Hoher'] as const;
const qualityNames = ['schwache', 'ausbaufähige', 'starke'] as const;
const impactDescriptions = [
  'Geringe strategische Bedeutung für Produkt, Markt und Zugang zu Technologie.',
  'Spürbarer Beitrag zu Produkt, Markt oder technologischer Entwicklung.',
  'Hohe strategische Bedeutung für Wettbewerbsfähigkeit und zukünftige Produkte.',
] as const;
const qualityDescriptions = [
  'Die Zusammenarbeit braucht klare Vereinbarungen und mehr Verlässlichkeit.',
  'Die Zusammenarbeit funktioniert, hat aber noch erkennbare Lücken.',
  'Die Zusammenarbeit ist verlässlich, wirksam und transparent.',
] as const;

export const defaultSegmentCriteria: readonly SegmentCriterion[] = [
  {
    axis: 'impact',
    key: 'spend',
    name: 'Spend',
    description: 'Anteil und Bedeutung des Einkaufsvolumens.',
    weight: 16.67,
    position: 1,
  },
  {
    axis: 'impact',
    key: 'end_customer_impact',
    name: 'Wirkung beim Endkunden',
    description: 'Einfluss auf Nutzen und Zufriedenheit der Endkunden.',
    weight: 16.67,
    position: 2,
  },
  {
    axis: 'impact',
    key: 'uniqueness',
    name: 'Einzigartigkeit',
    description: 'Wie schwer sich die Leistung durch Alternativen ersetzen lässt.',
    weight: 16.67,
    position: 3,
  },
  {
    axis: 'impact',
    key: 'product_performance',
    name: 'Produktleistung',
    description: 'Beitrag zu Leistung, Qualität und Zuverlässigkeit des Produkts.',
    weight: 16.67,
    position: 4,
  },
  {
    axis: 'impact',
    key: 'innovation',
    name: 'Innovationsbeitrag',
    description: 'Beitrag zu neuen Produkten, Verfahren und Geschäftsmodellen.',
    weight: 16.66,
    position: 5,
  },
  {
    axis: 'impact',
    key: 'technology_access',
    name: 'Zugang zu Technologie',
    description: 'Zugang zu wichtigen Technologien und technischem Wissen.',
    weight: 16.66,
    position: 6,
  },
  {
    axis: 'quality',
    key: 'trust',
    name: 'Vertrauen',
    description: 'Verlässlichkeit, Offenheit und gegenseitiges Vertrauen.',
    weight: 25,
    position: 1,
  },
  {
    axis: 'quality',
    key: 'collaboration',
    name: 'Wirksamkeit der Zusammenarbeit',
    description: 'Wie gut gemeinsame Entscheidungen und Maßnahmen gelingen.',
    weight: 25,
    position: 2,
  },
  {
    axis: 'quality',
    key: 'integration',
    name: 'Integration',
    description: 'Wie gut Prozesse, Systeme und Teams zusammenarbeiten.',
    weight: 25,
    position: 3,
  },
  {
    axis: 'quality',
    key: 'transparency',
    name: 'Transparenz',
    description: 'Wie offen Informationen, Risiken und Änderungen geteilt werden.',
    weight: 25,
    position: 4,
  },
];

/** Standardtypen je Größe der Matrix; bei 2 × 2 die äußeren Stufen der 3 × 3-Matrix */
export function defaultSegmentTypesFor(size: SegmentGridSize): SegmentType[] {
  const indexes = size === 2 ? [0, 2] : [0, 1, 2];
  return indexes.flatMap((impactIndex, impactPosition) =>
    indexes.map((qualityIndex, qualityPosition) => ({
      impactLevel: impactPosition + 1,
      qualityLevel: qualityPosition + 1,
      name: `${impactNames[impactIndex]} Impact · ${qualityNames[qualityIndex]} Beziehung`,
      description: `${impactDescriptions[impactIndex]} ${qualityDescriptions[qualityIndex]}`,
    })),
  );
}

export const defaultSegmentTypes: readonly SegmentType[] = defaultSegmentTypesFor(3);

/** Stufe einer Achse: bei 2 × 2 bis lowMax Stufe 1, sonst 2; bei 3 × 3 drei Stufen */
export function segmentLevel(
  score: number,
  model: Readonly<Pick<SegmentModel, 'lowMax' | 'midMax' | 'gridSize'>>,
): number {
  if (model.gridSize === 2) return score <= model.lowMax ? 1 : 2;
  return score <= model.lowMax ? 1 : score <= model.midMax ? 2 : 3;
}

/**
 * HE-01, E-K0-17: Startgewicht eines Segmenttyps in der Triage. Der strategische Typ, also höchste
 * Wirkung und beste Beziehung, zählt doppelt; einstellbar je Modell.
 */
export function defaultTriageWeight(
  type: Pick<SegmentType, 'impactLevel' | 'qualityLevel'>,
  size = 3,
): number {
  return type.impactLevel === size && type.qualityLevel === size ? 2 : 1;
}

export function calculateSegment(
  model: Readonly<Pick<SegmentModel, 'lowMax' | 'midMax' | 'gridSize'>> & {
    readonly criteria: readonly SegmentCriterion[];
    readonly types: readonly SegmentType[];
  },
  scores: Readonly<Record<string, number>>,
) {
  const expectedKeys = new Set(model.criteria.map((criterion) => criterion.key));
  for (const key of Object.keys(scores)) {
    if (!expectedKeys.has(key)) throw new Error(`Unbekanntes Segmentkriterium: ${key}`);
  }

  const axisScore = (axis: SegmentAxis) => {
    const criteria = model.criteria.filter((criterion) => criterion.axis === axis);
    const totalWeight = Math.round(
      criteria.reduce((sum, criterion) => sum + criterion.weight, 0) * 100,
    );
    if (!criteria.length || totalWeight !== 10_000) {
      throw new Error(`Ungültige Kriteriengewichte für ${axis}.`);
    }
    return criteria.reduce((sum, criterion) => {
      const score = scores[criterion.key];
      if (score === undefined || !Number.isFinite(score) || score < 0 || score > 100) {
        throw new Error(`Ungültiger Wert für Segmentkriterium ${criterion.key}.`);
      }
      return sum + (score * criterion.weight) / 100;
    }, 0);
  };
  const impactScore = axisScore('impact');
  const qualityScore = axisScore('quality');
  const impactLevel = segmentLevel(impactScore, model);
  const qualityLevel = segmentLevel(qualityScore, model);
  const type = model.types.find(
    (entry) => entry.impactLevel === impactLevel && entry.qualityLevel === qualityLevel,
  );
  if (!type) throw new Error(`Segmenttyp ${impactLevel}-${qualityLevel} fehlt.`);

  return { impactScore, qualityScore, impactLevel, qualityLevel, type };
}
