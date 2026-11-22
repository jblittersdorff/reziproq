import { z } from 'zod';
import { goalDimensions } from './material-group-strategy.js';

// WG-10: Profil aus Stärken, Schwächen, Chancen und Risiken; je wichtiger Paarung ein Hebel aus dem
// Katalog mit Begründung. Stärken und Schwächen sind intern, Chancen und Risiken extern.

export const swotTypes = ['strength', 'weakness', 'opportunity', 'threat'] as const;
export type SwotType = (typeof swotTypes)[number];
export const internalSwotTypes: readonly SwotType[] = ['strength', 'weakness'];
export const isInternalSwot = (type: SwotType) => internalSwotTypes.includes(type);
export const swotCodePrefix: Record<SwotType, string> = {
  strength: 'S',
  weakness: 'W',
  opportunity: 'O',
  threat: 'T',
};

const dimension = z.enum(goalDimensions);

export const swotItemSchema = z.object({
  id: z.uuid(),
  type: z.enum(swotTypes),
  code: z.string(),
  text: z.string(),
  originStep: z.number().int().nullable(),
  originView: z.string().nullable(),
  status: z.enum(['draft', 'confirmed']),
});

export const strategyLeverSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  dimensions: z.array(dimension),
  active: z.boolean(),
  custom: z.boolean(),
  reason: z.string().nullable(),
});

export const leverChoiceSchema = z.object({
  id: z.uuid(),
  internalItemId: z.uuid(),
  externalItemId: z.uuid(),
  leverId: z.uuid(),
  reason: z.string(),
  status: z.enum(['proposed', 'chosen', 'dismissed']),
});

export const strategyAssessmentSchema = z.object({
  canEdit: z.boolean(),
  items: z.array(swotItemSchema),
  choices: z.array(leverChoiceSchema),
  levers: z.array(strategyLeverSchema),
  dimensions: z.array(z.object({ key: dimension, name: z.string() })),
});

export const swotRequestSchema = z.object({
  type: z.enum(swotTypes),
  text: z.string().trim().min(1).max(300),
  originStep: z.number().int().min(1).max(10).nullable().default(null),
  originView: z.string().trim().max(60).nullable().default(null),
});

export const leverChoiceRequestSchema = z
  .object({
    internalItemId: z.uuid(),
    externalItemId: z.uuid(),
    leverId: z.uuid(),
    reason: z.string().trim().max(1000).default(''),
    status: z.enum(['proposed', 'chosen', 'dismissed']).default('chosen'),
  })
  .refine((value) => value.status !== 'chosen' || value.reason.length > 0, {
    path: ['reason'],
    message: 'reason_required',
  });

/** Eigener Hebel des Teams: landet mit Begründung im Katalog des Kunden. */
export const customLeverRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  dimensions: z.array(dimension).min(1).max(5),
  reason: z.string().trim().min(1).max(1000),
});

/** Admin pflegt den Katalog. */
export const strategyLeverUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  dimensions: z.array(dimension).min(1).max(5).optional(),
  active: z.boolean().optional(),
});

export type SwotItem = z.infer<typeof swotItemSchema>;
export type StrategyLever = z.infer<typeof strategyLeverSchema>;
export type LeverChoice = z.infer<typeof leverChoiceSchema>;
export type StrategyAssessment = z.infer<typeof strategyAssessmentSchema>;
export type SwotRequest = z.input<typeof swotRequestSchema>;
export type LeverChoiceRequest = z.input<typeof leverChoiceRequestSchema>;
export type CustomLeverRequest = z.input<typeof customLeverRequestSchema>;
export type StrategyLeverUpdate = z.infer<typeof strategyLeverUpdateSchema>;
