import { z } from 'zod';

// WG-01: Warengruppen mit Lead, Team, Produktgruppen, eigener Bezeichnung, Import, Zusammenlegen
// und Teilen. Die Warengruppe heißt im Schema material_group (PLT-06), in den Specs „category“.

/** Eigene Bezeichnung je Kunde statt „Warengruppe“, z. B. „Werkstoffgruppe“ */
export const categoryLabelSchema = z
  .object({
    singular: z.string().trim().min(2).max(40),
    plural: z.string().trim().min(2).max(40),
  })
  .strict();
export type CategoryLabel = z.infer<typeof categoryLabelSchema>;

export const defaultCategoryLabel: CategoryLabel = {
  singular: 'Warengruppe',
  plural: 'Warengruppen',
};

const englishDefault = { singular: 'material group', plural: 'material groups' };

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const capitalize = (value: string) =>
  value.length === 0 ? value : value[0]?.toLocaleUpperCase('de') + value.slice(1);

/**
 * Ersetzt „Warengruppe(n)“ (auch in Zusammensetzungen wie „Haupt-Warengruppe“) und das englische
 * „material group(s)“ durch die Bezeichnung des Kunden. Ohne eigene Bezeichnung bleibt der Text.
 */
export function applyCategoryLabel(text: string, label: CategoryLabel | null | undefined): string {
  if (
    !label ||
    (label.singular === defaultCategoryLabel.singular &&
      label.plural === defaultCategoryLabel.plural)
  ) {
    return text;
  }
  const pairs: [string, string][] = [
    [defaultCategoryLabel.plural, label.plural],
    [defaultCategoryLabel.singular, label.singular],
    [capitalize(englishDefault.plural), label.plural],
    [capitalize(englishDefault.singular), label.singular],
    [englishDefault.plural, label.plural],
    [englishDefault.singular, label.singular],
  ];
  let result = text;
  // Zuerst die längeren Formen, dann wird aus „Warengruppen“ nicht „Werkstoffgruppen“ + „n“.
  const pattern = new RegExp(pairs.map(([from]) => escapeRegExp(from)).join('|'), 'g');
  result = result.replace(pattern, (match) => pairs.find(([from]) => from === match)?.[1] ?? match);
  return result;
}

export const materialGroupMemberRoles = ['lead', 'commodity_manager', 'buyer', 'function'] as const;
export type MaterialGroupMemberRole = (typeof materialGroupMemberRoles)[number];
/** Im Team gepflegt; Lead und Commodity Manager stehen an der Warengruppe selbst */
export const teamMemberRoles = ['buyer', 'function'] as const;

const person = z.object({ userId: z.string(), name: z.string() });

export const materialGroupSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  code: z.string(),
  parentId: z.uuid().nullable(),
  active: z.boolean(),
  lead: person.nullable(),
  productGroupCount: z.number().int(),
  memberCount: z.number().int(),
  supplierCount: z.number().int(),
});
export type MaterialGroupSummary = z.infer<typeof materialGroupSummarySchema>;

/** GET /api/warengruppen */
export const materialGroupOverviewSchema = z.object({
  label: categoryLabelSchema,
  groups: z.array(materialGroupSummarySchema),
  /** Spend-Zeilen ohne Warengruppe (gelten für den ganzen Lieferanten) */
  unassignedSpendRows: z.number().int(),
  /** Admin: anlegen, importieren, zusammenlegen, teilen */
  canManage: z.boolean(),
});
export type MaterialGroupOverview = z.infer<typeof materialGroupOverviewSchema>;

export const productGroupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
});
export type ProductGroup = z.infer<typeof productGroupSchema>;

export const categoryTeamMemberSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  name: z.string(),
  role: z.enum(materialGroupMemberRoles),
  businessUnit: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  region: z.string().nullable(),
  task: z.string().nullable(),
});
export type CategoryTeamMember = z.infer<typeof categoryTeamMemberSchema>;

/** GET /api/warengruppen/:id */
export const materialGroupDetailSchema = z.object({
  label: categoryLabelSchema,
  group: z.object({
    id: z.uuid(),
    name: z.string(),
    code: z.string(),
    description: z.string().nullable(),
    active: z.boolean(),
    lead: person.nullable(),
    commodityManager: person.nullable(),
  }),
  parent: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  children: z.array(
    z.object({ id: z.uuid(), name: z.string(), code: z.string(), active: z.boolean() }),
  ),
  productGroups: z.array(productGroupSchema),
  members: z.array(categoryTeamMemberSchema),
  suppliers: z.array(
    z.object({
      relationshipId: z.uuid(),
      name: z.string(),
      source: z.enum(['spend', 'manual']),
      isPrimary: z.boolean(),
    }),
  ),
  /** Admin oder Lead: Team und Produktgruppen pflegen */
  canEdit: z.boolean(),
  /** Für die Auswahl im Team: Personen und Business Units der Organisation */
  people: z.array(person),
  businessUnits: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export type MaterialGroupDetail = z.infer<typeof materialGroupDetailSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

export const productGroupRequestSchema = z
  .object({ name: z.string().trim().min(1).max(100), description: optionalText(500) })
  .strict();
export type ProductGroupRequest = z.input<typeof productGroupRequestSchema>;

export const teamRequestSchema = z
  .object({
    members: z
      .array(
        z
          .object({
            userId: z.string().min(1),
            role: z.enum(teamMemberRoles),
            businessUnitId: z.uuid().nullable().optional(),
            region: optionalText(100),
            task: optionalText(200),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type TeamRequest = z.input<typeof teamRequestSchema>;

/** Import der Warengruppen: Kennung, Name, übergeordnete Kennung, Lead (E-Mail) */
export const materialGroupImportErrors = [
  'code_missing',
  'name_missing',
  'code_invalid',
  'code_duplicate',
  'code_taken',
  'parent_unknown',
  'too_deep',
  'lead_unknown',
] as const;
export type MaterialGroupImportError = (typeof materialGroupImportErrors)[number];

export const materialGroupImportPreviewSchema = z.object({
  rows: z.array(
    z.object({
      row: z.number().int(),
      code: z.string(),
      name: z.string(),
      parentCode: z.string().nullable(),
      leadEmail: z.string().nullable(),
      errors: z.array(z.enum(materialGroupImportErrors)),
    }),
  ),
  /** Nur ohne Fehler wird importiert */
  valid: z.boolean(),
});
export type MaterialGroupImportPreview = z.infer<typeof materialGroupImportPreviewSchema>;

export const materialGroupImportResultSchema = z.object({ created: z.number().int() });

/** Zusammenlegen: Diese Warengruppe geht in der Ziel-Warengruppe auf. */
export const mergeMaterialGroupSchema = z
  .object({
    targetId: z.uuid(),
    /** Spend dieser Warengruppe: zur Ziel-Warengruppe verschieben oder ohne Warengruppe lassen */
    spend: z.enum(['move', 'unassign']),
  })
  .strict();
export type MergeMaterialGroup = z.infer<typeof mergeMaterialGroupSchema>;

/** Teilen: neue Warengruppen auf derselben Ebene, Produktgruppen ziehen mit um. */
export const splitMaterialGroupSchema = z
  .object({
    groups: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            code: z.string().trim().min(1).max(20),
            productGroupIds: z.array(z.uuid()).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    /** Spend: bleibt an dieser Warengruppe oder zieht mit seiner Produktgruppe um */
    spend: z.enum(['keep', 'by_product_group']),
  })
  .strict();
export type SplitMaterialGroup = z.infer<typeof splitMaterialGroupSchema>;
