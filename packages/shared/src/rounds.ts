import { z } from 'zod';
import { userFunctions } from './permissions.js';

// SEG-03: Bewertungsrunden. Eine Runde sammelt Zuordnungen „Person bewertet Lieferant für BU,
// Warengruppe und Funktion“; die Bewertung selbst ist SEG-04.

export const roundStatuses = ['draft', 'open', 'closed'] as const;
export const assignmentStatuses = ['open', 'in_progress', 'submitted'] as const;

const dateSchema = z.iso.date();

export const createRoundSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dueDate: dateSchema,
});

export const extendRoundSchema = z.object({ dueDate: dateSchema });

export const setRoundSuppliersSchema = z.object({
  relationshipIds: z.array(z.uuid()).max(500),
});

export const updateAssignmentSchema = z.object({ raterUserId: z.string().min(1).nullable() });

export const addAssignmentSchema = z.object({
  relationshipId: z.uuid(),
  businessUnitId: z.uuid(),
  materialGroupId: z.uuid().nullable(),
  function: z.enum(userFunctions),
  raterUserId: z.string().min(1),
});

const namedSchema = z.object({ id: z.uuid(), name: z.string() });

export const roundSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  dueDate: dateSchema,
  status: z.enum(roundStatuses),
  modelVersion: z.number().int().positive().nullable(),
  total: z.number().int().nonnegative(),
  submitted: z.number().int().nonnegative(),
});

export const roundAssignmentSchema = z.object({
  id: z.uuid(),
  businessUnit: namedSchema,
  materialGroup: namedSchema.nullable(),
  function: z.enum(userFunctions),
  rater: z.object({ id: z.string(), name: z.string() }).nullable(),
  status: z.enum(assignmentStatuses),
});

export const roundSupplierSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  total: z.number().int().nonnegative(),
  submitted: z.number().int().nonnegative(),
  canNominate: z.boolean(),
  // Auswahl für die Nachnominierung; leer, wenn die Person nicht nachnominieren darf.
  businessUnits: z.array(namedSchema),
  materialGroups: z.array(namedSchema),
  assignments: z.array(roundAssignmentSchema),
});

export const roundDetailSchema = roundSummarySchema.extend({
  canManage: z.boolean(),
  suppliers: z.array(roundSupplierSchema),
});

export const roundListSchema = z.object({ rounds: z.array(roundSummarySchema) });

export const roundCandidateSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  businessUnits: z.array(namedSchema),
  materialGroups: z.array(namedSchema),
  selected: z.boolean(),
});

export const roundCandidatesSchema = z.object({ candidates: z.array(roundCandidateSchema) });

export const roundRaterSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultFunction: z.enum(userFunctions).nullable(),
});

export const roundRatersSchema = z.object({ raters: z.array(roundRaterSchema) });

export type RoundStatus = (typeof roundStatuses)[number];
export type AssignmentStatus = (typeof assignmentStatuses)[number];
export type CreateRound = z.infer<typeof createRoundSchema>;
export type ExtendRound = z.infer<typeof extendRoundSchema>;
export type SetRoundSuppliers = z.infer<typeof setRoundSuppliersSchema>;
export type UpdateAssignment = z.infer<typeof updateAssignmentSchema>;
export type AddAssignment = z.infer<typeof addAssignmentSchema>;
export type RoundSummary = z.infer<typeof roundSummarySchema>;
export type RoundAssignment = z.infer<typeof roundAssignmentSchema>;
export type RoundSupplier = z.infer<typeof roundSupplierSchema>;
export type RoundDetail = z.infer<typeof roundDetailSchema>;
export type RoundList = z.infer<typeof roundListSchema>;
export type RoundCandidate = z.infer<typeof roundCandidateSchema>;
export type RoundCandidates = z.infer<typeof roundCandidatesSchema>;
export type RoundRater = z.infer<typeof roundRaterSchema>;
export type RoundRaters = z.infer<typeof roundRatersSchema>;
