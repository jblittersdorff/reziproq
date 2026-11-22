import { z } from 'zod';
import { moneySchema } from './money.js';
import { teamRoles, userFunctions } from './permissions.js';

/** Status einer Beziehung (PLT-03): angelegt, aktiv mit dem Lieferanten, beendet. */
export const relationshipStatuses = ['draft', 'active', 'ended'] as const;
export type RelationshipStatus = (typeof relationshipStatuses)[number];

/** Ein Lieferant aus Sicht eines Käufers, mit dessen eigenen Werten (PLT-03). */
export const supplierSchema = z.object({
  relationshipId: z.string(),
  /** Eigener Anzeigename der Käuferseite, sonst der Name der Organisation */
  name: z.string(),
  /** ISO-3166-1-Code, z. B. DE */
  country: z.string().nullable(),
  /** Eigene Lieferantennummer des Käufers */
  externalRef: z.string().nullable(),
  status: z.enum(relationshipStatuses),
  /** Spend des Jahres spendYear aus der Antwort; null, wenn dafür nichts erfasst ist */
  spend: moneySchema.nullable(),
  /** Name der Haupt-Warengruppe (PLT-06); null ohne Zuordnung */
  primaryMaterialGroup: z.string().nullable().default(null),
  /** Namen aller zugeordneten Warengruppen, damit die Suche sie findet (PLT-06) */
  materialGroups: z.array(z.string()).default([]),
  /** Zugeordnete Business Units, damit die Suche sie findet (PLT-06). */
  businessUnits: z.array(z.string()).optional(),
  /** Fokuslieferant (SEG-02); nur die Käuferseite kennt das Feld */
  isFocus: z.boolean().optional(),
  /** Ids der zugeordneten Business Units und Warengruppen, für die Filter (NAV-12) */
  businessUnitIds: z.array(z.string()).optional(),
  materialGroupIds: z.array(z.string()).optional(),
  /** Soll-Typ aus der Konsolidierung als „Impact-Qualität“, z. B. „3-3“ (SEG-06); sonst null */
  targetType: z.string().nullable().optional(),
  /** LS-01: Warengruppe mit dem größten Spend des Jahres */
  topMaterialGroup: z.string().optional(),
  /** LS-01: SRO aus dem Team */
  sroName: z.string().optional(),
  /** WG-18: Segment Ist gesamt und je Warengruppe als „Impact-Qualität“ */
  segmentType: z.string().nullable().optional(),
  categorySegments: z.array(z.object({ materialGroupId: z.string(), type: z.string() })).optional(),
  /** Die Person ist im Team der Beziehung (NAV-12) */
  isMine: z.boolean().optional(),
});

export type Supplier = z.infer<typeof supplierSchema>;

export const suppliersResponseSchema = z.object({
  /** Alle Beziehungen der eigenen Organisation, auch beendete; die Oberfläche filtert. */
  suppliers: z.array(supplierSchema),
  /** Anzahl der nicht beendeten Beziehungen */
  count: z.number().int(),
  /** Das letzte volle Kalenderjahr, auf das sich spend und totalSpend beziehen */
  spendYear: z.number().int(),
  /**
   * Gesamtspend des Jahres spendYear je Währung, über alle nicht beendeten Beziehungen.
   * Verschiedene Währungen werden nie zusammengezählt.
   */
  totalSpend: z.array(moneySchema),
  /** Auswahl für die Filter der Liste (NAV-12) */
  filters: z
    .object({
      businessUnits: z.array(z.object({ id: z.string(), name: z.string() })),
      materialGroups: z.array(
        z.object({ id: z.string(), name: z.string(), parentId: z.string().nullable() }),
      ),
      targetTypes: z.array(z.object({ key: z.string(), name: z.string() })),
    })
    .optional(),
});

export type SuppliersResponse = z.infer<typeof suppliersResponseSchema>;

/** Fehlercodes für 403-Antworten, damit die Oberfläche den passenden Hinweis zeigt. */
export const forbiddenCodes = ['keine_organisation', 'keine_berechtigung'] as const;
export type ForbiddenCode = (typeof forbiddenCodes)[number];

/** Das letzte volle Kalenderjahr; Geschäftsjahre kommen mit PNL-10. */
export const lastFullYear = (now: Date = new Date()) => now.getFullYear() - 1;

// PLT-03b: Lieferanten anlegen, ändern, beenden. Dieselben Schemas prüfen die Formularseiten und
// die API. Fehlermeldungen sind Codes; die Oberfläche übersetzt sie.

/** Fehlercodes an einzelnen Feldern */
export const fieldErrors = [
  'required',
  'too_long',
  'invalid_country',
  'invalid_vat_id',
  'invalid_duns',
  'invalid_amount',
  'invalid_year',
] as const;
export type FieldError = (typeof fieldErrors)[number];

// Kürzel, die keine Länder sind (Regionen und frei vergebene Codes).
const notCountries = new Set(['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ']);

/** Alle ISO-3166-1-Ländercodes, die Intl kennt, z. B. DE, PL, US. */
export const countryCodes: readonly string[] = (() => {
  const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const codes: string[] = [];
  for (const first of letters) {
    for (const second of letters) {
      const code = first + second;
      if (!notCountries.has(code) && names.of(code) !== code) codes.push(code);
    }
  }
  return codes;
})();

/** Leere Eingaben zählen als „nicht angegeben“. */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const nameSchema = z
  .string({ error: 'required' })
  .trim()
  .min(1, { error: 'required' })
  .max(200, { error: 'too_long' });

/** USt-IdNr.: zwei Buchstaben und 2–12 Zeichen; Leerzeichen, Punkte und Striche fallen weg. */
export const vatIdSchema = z
  .string()
  .transform((value) => value.replace(/[\s.-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}[A-Z0-9]{2,12}$/, { error: 'invalid_vat_id' }));

/** D-U-N-S: genau neun Ziffern; Leerzeichen und Striche fallen weg. */
export const dunsSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\d{9}$/, { error: 'invalid_duns' }));

const externalRefSchema = z.preprocess(
  blankToUndefined,
  z.string().trim().max(50, { error: 'too_long' }).optional(),
);

/** Jahre mit Spend: ab 2000 bis zum nächsten Jahr (Planwerte). */
export const spendYearSchema = z
  .number({ error: 'invalid_year' })
  .int({ error: 'invalid_year' })
  .min(2000, { error: 'invalid_year' })
  .refine((year) => year <= new Date().getFullYear() + 1, { error: 'invalid_year' });

/** Betrag in ganzen Cent, nie negativ (CLAUDE.md: Geld als Ganzzahl in Cent). */
export const amountCentsSchema = z
  .number({ error: 'invalid_amount' })
  .int({ error: 'invalid_amount' })
  .min(0, { error: 'invalid_amount' })
  .max(1_000_000_000_000_00, { error: 'invalid_amount' });

export const createSupplierRequestSchema = z.object({
  name: nameSchema,
  country: z.enum(countryCodes as [string, ...string[]], { error: 'invalid_country' }),
  vatId: z.preprocess(blankToUndefined, vatIdSchema.optional()),
  duns: z.preprocess(blankToUndefined, dunsSchema.optional()),
  externalRef: externalRefSchema,
  spend: z.object({ year: spendYearSchema, amountCents: amountCentsSchema }).optional(),
});
export type CreateSupplierRequest = z.input<typeof createSupplierRequestSchema>;

export const createSupplierResponseSchema = z.object({
  relationshipId: z.string(),
  /** true: Die Organisation gab es schon, es entstand nur eine neue Beziehung. */
  linked: z.boolean(),
});
export type CreateSupplierResponse = z.infer<typeof createSupplierResponseSchema>;

export const supplierLookupQuerySchema = z.object({
  ust: z.preprocess(blankToUndefined, vatIdSchema.optional()),
  duns: z.preprocess(blankToUndefined, dunsSchema.optional()),
});
export type SupplierLookupQuery = z.infer<typeof supplierLookupQuerySchema>;

/** Nur ja oder nein, nie Name oder Land einer fremden Organisation. */
export const supplierLookupResponseSchema = z.object({ known: z.boolean() });
export type SupplierLookupResponse = z.infer<typeof supplierLookupResponseSchema>;

export const updateSupplierRequestSchema = z.object({
  displayName: nameSchema,
  externalRef: externalRefSchema,
  notes: z.preprocess(blankToUndefined, z.string().max(2000, { error: 'too_long' }).optional()),
});
export type UpdateSupplierRequest = z.input<typeof updateSupplierRequestSchema>;

export const spendRequestSchema = z.object({ amountCents: amountCentsSchema });
export type SpendRequest = z.infer<typeof spendRequestSchema>;

/** Ein Lieferant mit allem, was die Käuferseite sehen darf (Profil- und Spend-Seite). */
export const supplierDetailSchema = z.object({
  relationshipId: z.string(),
  /** Eigener Anzeigename, sonst der Name der Organisation */
  name: z.string(),
  /** Stammdaten der Organisation (global) */
  organizationName: z.string(),
  country: z.string().nullable(),
  vatId: z.string().nullable(),
  duns: z.string().nullable(),
  externalRef: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(relationshipStatuses),
  createdAt: z.string(),
  endedAt: z.string().nullable(),
  /** Spend je Jahr, neuestes zuerst */
  spend: z.array(z.object({ year: z.number().int(), amount: moneySchema })),
  /** Was die Person an dieser Beziehung darf, aus can() mit Teamrolle (PLT-05b) */
  permissions: z.object({ edit: z.boolean(), editTeam: z.boolean() }),
  /** Fokuslieferant (SEG-02); für Lieferanten immer false */
  isFocus: z.boolean().optional(),
  /** Warengruppen (PLT-06), die Haupt-Warengruppe zuerst */
  materialGroups: z.array(z.string()).optional(),
});
export type SupplierDetail = z.infer<typeof supplierDetailSchema>;

/**
 * Euro-Betrag aus einem Eingabefeld in ganze Cent, im Format der Sprache (PLT-09):
 * Deutsch „1.234.567,89“, Englisch „1,234,567.89“, in beiden auch ohne Trennzeichen „4820000“.
 * null, wenn die Eingabe kein Betrag mit höchstens zwei Nachkommastellen ist.
 */
export function parseEuroToCents(text: string, locale: 'de' | 'en' = 'de'): number | null {
  const [group, decimal] = locale === 'en' ? [',', '.'] : ['.', ','];
  const compact = text.replace(/[\s€]/g, '');
  const g = `\\${group}`;
  const d = `\\${decimal}`;
  const pattern = new RegExp(`^\\d{1,3}(${g}\\d{3})*(${d}\\d{1,2})?$|^\\d+(${d}\\d{1,2})?$`);
  if (!pattern.test(compact)) return null;
  const [whole = '0', fraction = ''] = compact.replaceAll(group, '').split(decimal);
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

// PLT-05b, PLB-04: Team je Beziehung. Jede Seite pflegt ihr Team und legt je Person fest, ob die
// andere Seite sie sieht (geteilt) oder nicht (intern).

export const teamVisibilities = ['internal', 'shared'] as const;
export type TeamVisibility = (typeof teamVisibilities)[number];

/** Standard: SRO bzw. Key Account Manager und Sponsoren geteilt, alle anderen intern. */
export const defaultTeamVisibility = (teamRole: (typeof teamRoles)[number]): TeamVisibility =>
  teamRole === 'sro' || teamRole === 'sponsor' ? 'shared' : 'internal';

export const teamMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  teamRole: z.enum(teamRoles),
  function: z.enum(userFunctions).nullable(),
  visibility: z.enum(teamVisibilities),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const roleDescriptionSchema = z.object({
  role: z.string(),
  does: z.array(z.string()),
  doesNot: z.array(z.string()),
  /** null = Standard von Reziproq */
  updatedByName: z.string().nullable(),
});
export type RoleDescription = z.infer<typeof roleDescriptionSchema>;

export const teamResponseSchema = z.object({
  /** Seite der lesenden Person; auf der Lieferantenseite heißt „sro“ Key Account Manager */
  side: z.enum(['buyer', 'supplier']),
  members: z.array(teamMemberSchema),
  /** Geteilte Mitglieder der anderen Seite (ohne interne) */
  counterpart: z.array(
    z.object({
      name: z.string(),
      teamRole: z.enum(teamRoles),
      function: z.enum(userFunctions).nullable(),
    }),
  ),
  /** Personen der eigenen Organisation, die ins Team kommen können, mit Standardfunktion */
  candidates: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      defaultFunction: z.enum(userFunctions).nullable(),
    }),
  ),
  canEdit: z.boolean(),
  /** Nur beim Käufer: Rollenbeschreibung des SRO (PLB-04) */
  sroDescription: roleDescriptionSchema.nullable(),
});
export type TeamResponse = z.infer<typeof teamResponseSchema>;

/** Grenzen eines Teams als Fehlercodes für Seite und API */
export const teamErrors = ['duplicate_person', 'too_many_sro', 'too_many_sponsors'] as const;
export type TeamError = (typeof teamErrors)[number];

/** PUT …/team: das eigene Team auf einmal (Käufer: Admin oder SRO; Lieferant: Admin oder KAM). */
export const updateTeamRequestSchema = z
  .object({
    members: z.array(
      z.object({
        userId: z.string().min(1),
        teamRole: z.enum(teamRoles),
        function: z.enum(userFunctions).nullable(),
        /** Ohne Angabe gilt der Standard der Rolle */
        visibility: z.enum(teamVisibilities).optional(),
      }),
    ),
  })
  .superRefine(({ members }, context) => {
    const ids = members.map((member) => member.userId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', path: ['members'], message: 'duplicate_person' });
    }
    if (members.filter((member) => member.teamRole === 'sro').length > 1) {
      context.addIssue({ code: 'custom', path: ['members'], message: 'too_many_sro' });
    }
    if (members.filter((member) => member.teamRole === 'sponsor').length > 2) {
      context.addIssue({ code: 'custom', path: ['members'], message: 'too_many_sponsors' });
    }
  });
export type UpdateTeamRequest = z.infer<typeof updateTeamRequestSchema>;

/** Standardbeschreibung des SRO (PLB-04). */
export const defaultSroDescription = {
  does: [
    'Strategie',
    'Interne Abstimmung',
    'Gesamtblick',
    'Langfristige Begleitung von Eskalationen',
  ],
  doesNot: ['Verhandlungen', 'Engpässe', 'Claims'],
};

export const saveRoleDescriptionSchema = z
  .object({
    does: z.array(z.string().trim().min(1).max(200)).max(20),
    doesNot: z.array(z.string().trim().min(1).max(200)).max(20),
  })
  .strict();
export type SaveRoleDescription = z.infer<typeof saveRoleDescriptionSchema>;
