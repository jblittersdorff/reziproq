import { z } from 'zod';

// SEG-07: Portfolio der Käuferorganisation. Die Matrix liest die Konsolidierung (SEG-06).

const namedSchema = z.object({ id: z.uuid(), name: z.string() });
const levelsSchema = z.object({
  impactLevel: z.number().int().min(1).max(3),
  qualityLevel: z.number().int().min(1).max(3),
  typeName: z.string(),
});

export const portfolioSchema = z.object({
  matrixCount: z.number().int(),
  openCount: z.number().int(),
  openRounds: z.number().int(),
  focusCount: z.number().int(),
});

export const portfolioMatrixQuerySchema = z.object({
  businessUnitId: z.uuid().optional(),
  materialGroupId: z.uuid().optional(),
});

export const portfolioPointSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  // Spend des letzten vollen Jahres in Cent; 0, wenn keiner erfasst ist
  spendCents: z.number().int().nonnegative(),
  currency: z.string(),
  businessUnit: namedSchema.nullable(),
  materialGroup: namedSchema.nullable(),
  ist: levelsSchema,
  soll: levelsSchema,
});

export const portfolioMatrixSchema = z.object({
  spendYear: z.number().int(),
  businessUnits: z.array(namedSchema),
  materialGroups: z.array(namedSchema),
  points: z.array(portfolioPointSchema),
});

export const openReasons = ['ratings_open', 'not_consolidated', 'deviation'] as const;

export const openItemSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  submitted: z.number().int(),
  total: z.number().int(),
  // Größte Abweichung eines Kriteriums in Punkten; null, solange Bewertungen fehlen
  deviation: z.number().nullable(),
});

export const portfolioOpenSchema = z.object({
  deviationThreshold: z.number().int(),
  groups: z.object({
    ratings_open: z.array(openItemSchema),
    not_consolidated: z.array(openItemSchema),
    deviation: z.array(openItemSchema),
  }),
});

export type PortfolioMatrixQuery = z.infer<typeof portfolioMatrixQuerySchema>;
export type Portfolio = z.infer<typeof portfolioSchema>;
export type PortfolioPoint = z.infer<typeof portfolioPointSchema>;
export type PortfolioMatrix = z.infer<typeof portfolioMatrixSchema>;
export type PortfolioOpen = z.infer<typeof portfolioOpenSchema>;
export type OpenItem = z.infer<typeof openItemSchema>;
