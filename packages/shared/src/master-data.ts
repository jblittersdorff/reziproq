import { z } from 'zod';

// PLT-06: Business Units und Warengruppen je Organisation und ihre Zuordnung zu Lieferanten.
// Dieselben Schemas prüfen die Formularseiten und die API; Fehler sind Codes.

/** Fehlercodes für Felder und Konflikte; die Oberfläche übersetzt sie. */
export const masterDataErrors = [
  'required',
  'too_long',
  'invalid_code',
  'code_taken',
  'too_deep',
  'inactive',
  'in_use',
  'primary_required',
  'foreign_entry',
  // WG-01: Lead oder Team nur aus der eigenen Organisation
  'foreign_user',
] as const;
export type MasterDataError = (typeof masterDataErrors)[number];

const name = z.string().trim().min(1, 'required').max(100, 'too_long');
/** Kurz und ohne Leerzeichen, z. B. EL-SE; eindeutig je Organisation ohne Groß und klein. */
const code = z
  .string()
  .trim()
  .min(1, 'required')
  .max(20, 'too_long')
  .regex(/^[\p{L}\p{N}._-]+$/u, 'invalid_code');

export const businessUnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  active: z.boolean(),
  /** Lieferanten mit dieser Zuordnung, auch beendete; über 0 nur deaktivieren, nicht löschen */
  supplierCount: z.number().int(),
});
export type BusinessUnit = z.infer<typeof businessUnitSchema>;

export const materialGroupSchema = businessUnitSchema.extend({
  /** Oberebene; Warengruppen haben höchstens zwei Ebenen */
  parentId: z.string().nullable(),
  /** Untergruppen; eine Oberebene mit Untergruppen gilt als benutzt */
  childCount: z.number().int(),
  /** WG-01 */
  description: z.string().nullable().default(null),
  leadUserId: z.string().nullable().default(null),
  commodityManagerUserId: z.string().nullable().default(null),
});
export type MaterialGroup = z.infer<typeof materialGroupSchema>;

export const businessUnitsResponseSchema = z.object({ businessUnits: z.array(businessUnitSchema) });
export const materialGroupsResponseSchema = z.object({
  materialGroups: z.array(materialGroupSchema),
});

/** POST und PATCH für Business Units; active nur beim Ändern (Deaktivieren, Aktivieren). */
export const businessUnitRequestSchema = z.object({ name, code, active: z.boolean().optional() });
export type BusinessUnitRequest = z.infer<typeof businessUnitRequestSchema>;

export const materialGroupRequestSchema = businessUnitRequestSchema.extend({
  parentId: z.uuid().nullable().default(null),
  /** WG-01: Beschreibung, Lead und optional Commodity Manager */
  description: z.string().trim().max(1000, 'too_long').nullable().optional(),
  leadUserId: z.string().min(1).nullable().optional(),
  commodityManagerUserId: z.string().min(1).nullable().optional(),
});
export type MaterialGroupRequest = z.input<typeof materialGroupRequestSchema>;

/** Ein zugeordneter Eintrag am Lieferanten; deaktivierte bleiben sichtbar und markiert. */
const assignedEntry = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  active: z.boolean(),
});

/** GET /api/suppliers/:id/zuordnung */
export const assignmentResponseSchema = z.object({
  businessUnits: z.array(assignedEntry),
  materialGroups: z.array(assignedEntry.extend({ isPrimary: z.boolean() })),
  /** Darf diese Person die Zuordnung ändern (Rolle, Teamrolle Leser)? */
  canEdit: z.boolean(),
});
export type AssignmentResponse = z.infer<typeof assignmentResponseSchema>;

/** PUT /api/suppliers/:id/zuordnung: alles auf einmal; genau eine Haupt-Warengruppe. */
export const assignmentRequestSchema = z
  .object({
    businessUnitIds: z.array(z.uuid()),
    materialGroupIds: z.array(z.uuid()),
    primaryMaterialGroupId: z.uuid().nullable(),
  })
  .refine(
    (value) =>
      value.materialGroupIds.length === 0
        ? value.primaryMaterialGroupId === null
        : value.primaryMaterialGroupId !== null &&
          value.materialGroupIds.includes(value.primaryMaterialGroupId),
    { message: 'primary_required', path: ['primaryMaterialGroupId'] },
  );
export type AssignmentRequest = z.infer<typeof assignmentRequestSchema>;
