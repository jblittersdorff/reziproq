import { z } from 'zod';
import { formatCadences, formatLevels, localizedTextSchema, ruleGroups } from './playbook.js';

// PLB-03: Spielregeln je Beziehung. Vorschlag aus dem Katalog (PLB-01) für den konsolidierten
// Soll-Typ (SEG-06); Abweichungen brauchen eine interne Begründung, Freigaben sind gesperrt.

export const ruleSetItemKinds = ['right', 'obligation', 'format'] as const;
export const ruleSetStatuses = ['draft', 'approved', 'shared'] as const;
export type RuleSetItemKind = (typeof ruleSetItemKinds)[number];
export type RuleSetStatus = (typeof ruleSetStatuses)[number];

const level = z.number().int().min(1).max(3);

export const segmentTargetSchema = z.object({
  impactLevel: level,
  qualityLevel: level,
  typeName: z.string(),
});

/** Ein Eintrag im Vorschlag: aus dem Katalog, mit seiner ID dort. */
export const proposalItemSchema = z.object({
  catalogItemId: z.uuid(),
  kind: z.enum(ruleSetItemKinds),
  group: z.enum(ruleGroups).nullable(),
  title: localizedTextSchema(200),
  description: localizedTextSchema(1000),
  cadence: z.enum(formatCadences).nullable(),
  level: z.enum(formatLevels).nullable(),
});

export const ruleSetItemSchema = proposalItemSchema.extend({
  id: z.uuid(),
  catalogItemId: z.uuid().nullable(),
  origin: z.enum(['catalog', 'custom']),
  /** Interne Begründung bei eigenen Einträgen; nur für den Käufer */
  reason: z.string().nullable(),
});

export const ruleSetSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(ruleSetStatuses),
  visibility: z.enum(['internal', 'shared']),
  target: segmentTargetSchema,
  items: z.array(ruleSetItemSchema),
  /** Abgewählte Katalogeinträge mit interner Begründung */
  removed: z.array(z.object({ item: proposalItemSchema, reason: z.string() })),
  approvedBy: z.string().nullable(),
  approvedAt: z.iso.datetime({ offset: true }).nullable(),
});

/** Was der Lieferant zu einer geteilten Version sieht (SEG-10): nur Inhalt, keine Herkunft. */
export const sharedRuleSetItemSchema = z.object({
  kind: z.enum(ruleSetItemKinds),
  group: z.enum(ruleGroups).nullable(),
  title: localizedTextSchema(200),
  description: localizedTextSchema(1000),
  cadence: z.enum(formatCadences).nullable(),
});

/** Der geteilte Stand: Typ mit Beschreibung beim Teilen und die Version. */
export const sharedTargetSchema = z.object({
  version: z.number().int().positive(),
  typeName: z.string(),
  typeDescription: z.string(),
  sharedAt: z.iso.datetime({ offset: true }),
});

/** Vorschau genau so, wie der Lieferant sie sehen wird. */
export const ruleSetSharePreviewSchema = z.object({
  version: z.number().int().positive(),
  typeName: z.string(),
  typeDescription: z.string(),
  items: z.array(sharedRuleSetItemSchema),
});

/** Lieferantenseite: der geteilte Typ und die Spielregeln dieser Version, sonst nichts. */
export const customerRuleSetSchema = z.object({
  target: sharedTargetSchema.nullable(),
  items: z.array(sharedRuleSetItemSchema),
  /** Geteilte Version, z. B. für Kommentare (QS-02); null vor dem ersten Teilen */
  ruleSetId: z.uuid().nullable().optional(),
});

export const ruleSetResponseSchema = z.object({
  current: ruleSetSchema.nullable(),
  /** Konsolidierter Soll-Typ (SEG-06); ohne Konsolidierung null */
  target: segmentTargetSchema.nullable(),
  /** Der Soll-Typ weicht vom Typ der aktuellen Version ab */
  targetChanged: z.boolean(),
  /** SRO der Beziehung oder Admin, und die Beziehung ist nicht beendet */
  canManage: z.boolean(),
  /** Was der Lieferant gerade sieht (SEG-10); vor dem ersten Teilen null */
  shared: sharedTargetSchema.nullable(),
});

export const ruleSetProposalSchema = z.object({
  target: segmentTargetSchema,
  items: z.array(proposalItemSchema),
});

const reason = z.string().trim().min(3).max(1000);
const customText = z.string().trim().min(1).max(200);

export const customRuleSetItemSchema = z
  .object({
    kind: z.enum(ruleSetItemKinds),
    group: z.enum(ruleGroups).nullable(),
    title: customText,
    description: z.string().trim().max(1000),
    cadence: z.enum(formatCadences).nullable(),
    reason,
  })
  .refine((item) => (item.kind === 'format') === (item.group === null), {
    message: 'group_for_rules_only',
    path: ['group'],
  })
  .refine((item) => (item.kind === 'format') === (item.cadence !== null), {
    message: 'cadence_for_formats_only',
    path: ['cadence'],
  });

/** Bearbeiten: gewählte Einträge des Vorschlags, Begründungen fürs Abwählen, eigene Einträge. */
export const saveRuleSetSchema = z
  .object({
    selected: z.array(z.uuid()),
    removedReasons: z.record(z.uuid(), reason),
    custom: z.array(customRuleSetItemSchema).max(50),
  })
  .strict();

export type SegmentTarget = z.infer<typeof segmentTargetSchema>;
export type ProposalItem = z.infer<typeof proposalItemSchema>;
export type RuleSetItem = z.infer<typeof ruleSetItemSchema>;
export type RuleSet = z.infer<typeof ruleSetSchema>;
export type RuleSetResponse = z.infer<typeof ruleSetResponseSchema>;
export type RuleSetProposal = z.infer<typeof ruleSetProposalSchema>;
export type CustomRuleSetItem = z.infer<typeof customRuleSetItemSchema>;
export type SaveRuleSet = z.infer<typeof saveRuleSetSchema>;
export type SharedRuleSetItem = z.infer<typeof sharedRuleSetItemSchema>;
export type SharedTarget = z.infer<typeof sharedTargetSchema>;
export type RuleSetSharePreview = z.infer<typeof ruleSetSharePreviewSchema>;
export type CustomerRuleSet = z.infer<typeof customerRuleSetSchema>;
