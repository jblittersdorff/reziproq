import { z } from 'zod';

// PLB-01: Kataloge für Spielregeln (Rechte und Pflichten) und Formate der Zusammenarbeit.

export const ruleKinds = ['right', 'obligation'] as const;
export const ruleGroups = ['cost', 'protection', 'collaboration', 'growth'] as const;
export const formatLevels = ['executive', 'management', 'operational'] as const;
export const formatCadences = [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'on_demand',
] as const;

export type RuleKind = (typeof ruleKinds)[number];
export type RuleGroup = (typeof ruleGroups)[number];
export type FormatLevel = (typeof formatLevels)[number];
export type FormatCadence = (typeof formatCadences)[number];

const level = z.number().int().min(1).max(3);

/** Text auf Deutsch und Englisch; beide Pflicht, damit jede Oberfläche ihre Sprache hat. */
export const localizedTextSchema = (max: number) =>
  z.object({ de: z.string().trim().min(1).max(max), en: z.string().trim().min(1).max(max) });

export const ruleItemSchema = z.object({
  id: z.uuid(),
  kind: z.enum(ruleKinds),
  group: z.enum(ruleGroups),
  title: localizedTextSchema(200),
  description: localizedTextSchema(1000),
  counterpartId: z.uuid().nullable(),
  minImpactLevel: level,
});

export const formatItemSchema = z.object({
  id: z.uuid(),
  name: localizedTextSchema(200),
  purpose: localizedTextSchema(1000),
  level: z.enum(formatLevels),
  cadence: z.enum(formatCadences),
  minImpactLevel: level,
  /** Leer: für jede Beziehungsqualität; sonst nur für diese Stufen (z. B. 1 = schwach) */
  forQualityLevels: z.array(level),
});

export const playbookCatalogSchema = z.object({
  rules: z.array(ruleItemSchema),
  formats: z.array(formatItemSchema),
  canManage: z.boolean(),
});

export const saveRuleItemSchema = ruleItemSchema.omit({ id: true }).strict();
export const saveFormatItemSchema = formatItemSchema
  .omit({ id: true })
  .extend({
    forQualityLevels: z
      .array(level)
      .max(3)
      .refine((levels) => new Set(levels).size === levels.length, 'duplicate_level'),
  })
  .strict();

/** Was ein Lieferant eines Typs bekäme (Vorschau je Typ). */
export const playbookPreviewSchema = z.object({
  impactLevel: level,
  qualityLevel: level,
  /** Name des Typs im aktiven Segmentmodell, sonst null */
  typeName: z.string().nullable(),
  rules: z.array(ruleItemSchema),
  formats: z.array(formatItemSchema),
});

/** Gilt ein Eintrag für diesen Typ? Ab Impact-Stufe min_impact_level, Formate ggf. nur für bestimmte Qualitätsstufen. */
export function appliesTo(
  item: { minImpactLevel: number; forQualityLevels?: readonly number[] },
  impactLevel: number,
  qualityLevel: number,
): boolean {
  if (impactLevel < item.minImpactLevel) return false;
  const quality = item.forQualityLevels ?? [];
  return quality.length === 0 || quality.includes(qualityLevel);
}

export type LocalizedText = z.infer<ReturnType<typeof localizedTextSchema>>;
export type RuleItem = z.infer<typeof ruleItemSchema>;
export type FormatItem = z.infer<typeof formatItemSchema>;
export type PlaybookCatalog = z.infer<typeof playbookCatalogSchema>;
export type SaveRuleItem = z.infer<typeof saveRuleItemSchema>;
export type SaveFormatItem = z.infer<typeof saveFormatItemSchema>;
export type PlaybookPreview = z.infer<typeof playbookPreviewSchema>;
