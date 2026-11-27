import { z } from 'zod';
import { hintSeverities } from './hints.js';
import { moneySchema } from './money.js';
import { relationshipStatuses } from './suppliers.js';

// BZ-01 (K2-b): Seite Lieferanten `/beziehungen` mit den Linsen Liste und Segmente. Die Liste zeigt
// die aktiven Beziehungen, mit „Mehr Filter: Portfolio“ auch die importierten ohne Anbindung (Entwurf,
// E-K2-10); die Linse Segmente zeigt immer das ganze Portfolio. Beides nur für die Käuferseite: Der
// Lieferant sieht weder Bewertung noch Segment (T2-S04).

export const relationshipLenses = ['liste', 'segmente'] as const;
export type RelationshipLens = (typeof relationshipLenses)[number];

/** Filter-Chips der Liste */
export const relationshipChips = ['alle', 'meine', 'strategisch', 'offene-zusagen'] as const;
export type RelationshipChip = (typeof relationshipChips)[number];

/** Sortierung der Liste: nach Aufmerksamkeit (Standard) oder nach Spend */
export const relationshipSorts = ['aufmerksamkeit', 'spend'] as const;
export type RelationshipSort = (typeof relationshipSorts)[number];

/** Abfrage der Liste: `portfolio=1` nimmt die importierten Lieferanten ohne Anbindung dazu */
export const relationshipsQuerySchema = z.object({ portfolio: z.literal('1').optional() }).strict();
export type RelationshipsQuery = z.infer<typeof relationshipsQuerySchema>;

/**
 * Punkte für „nach Aufmerksamkeit“: der stärkste Grund einer Beziehung zählt, bei Gleichstand
 * entscheidet der Spend. Hinweise mit geringer Schwere stehen in der grauen Zeile, heben die
 * Beziehung aber nicht an (Vorlage Lieferanten: Moravia steht nach Spend).
 */
export const attentionWeights = {
  overdue: 5,
  hint: { high: 4, medium: 3, low: 0 },
  disputed: 3,
  unrated: 2,
} as const;

/** Gehaltene je fällige Zusagen einer Seite im Jahr (ZQ-01 Regel 2, Sicht commitment_rate) */
export const sideQuoteSchema = z.object({
  kept: z.number().int().min(0),
  due: z.number().int().min(0),
  /** Gerundet; null ohne fällige Zusage */
  percent: z.number().int().min(0).max(100).nullable(),
});
export type SideQuote = z.infer<typeof sideQuoteSchema>;

/** Offener oder übernommener Hinweis (KI-16), den die Person sehen darf */
export const relationshipHintSchema = z.object({
  id: z.uuid(),
  ruleKey: z.string(),
  severity: z.enum(hintSeverities),
  status: z.enum(['open', 'in_progress']),
  title: z.string().nullable(),
  /** Kennzahl und letzter Wert aus dem Beleg, z. B. „Liefertreue“ und „86 %“ (performance_drop) */
  metric: z.string().nullable(),
  value: z.string().nullable(),
});
export type RelationshipHint = z.infer<typeof relationshipHintSchema>;

/** Wichtigster Grund für die graue Zeile, der stärkste nach `attentionWeights` */
export const relationshipReasonSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('overdue'),
    /** Offene Zusagen mit Frist vor heute, beide Seiten */
    count: z.number().int().positive(),
    /** Die am längsten überfällige */
    title: z.string(),
  }),
  z.object({ kind: z.literal('hint'), hint: relationshipHintSchema }),
  z.object({ kind: z.literal('disputed') }),
  z.object({ kind: z.literal('unrated') }),
]);
export type RelationshipReason = z.infer<typeof relationshipReasonSchema>;

export const relationshipSegmentSchema = z.object({
  /** „Impact-Qualität“, z. B. „2-2“ */
  key: z.string(),
  name: z.string(),
});

/** Zeile der Liste: Monogramm und Name, graue Zeile, Segment-Chip, Mini-Spiegel */
export const relationshipRowSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  status: z.enum(relationshipStatuses),
  /** ISO-3166-1-Code, z. B. DE */
  country: z.string().nullable(),
  /** Haupt-Warengruppe (PLT-06); null ohne Zuordnung */
  materialGroup: z.string().nullable(),
  /** Spend des Jahres `year` der Antwort */
  spend: moneySchema.nullable(),
  reason: relationshipReasonSchema.nullable(),
  attention: z.number().int().min(0),
  /** Segment aus der jüngsten Gesamtentscheidung; null ohne Bewertung */
  segment: relationshipSegmentSchema.nullable(),
  /** Bewertungen der laufenden Runde liegen weit auseinander (SEG-07, gelber Rand) */
  disputed: z.boolean(),
  /** Mini-Spiegel (ZQ-01): eure Seite und der Lieferant; null, solange keine Zusage fällig war */
  quota: z.object({ own: sideQuoteSchema, counterpart: sideQuoteSchema }).nullable(),
  isMine: z.boolean(),
  /** Fokuslieferant (E-K0-09), Chip „Strategisch“ */
  isFocus: z.boolean(),
  openCommitments: z.number().int().min(0),
});
export type RelationshipRow = z.infer<typeof relationshipRowSchema>;

/** Ab so vielen Punkten Abstand haltet ihr eure Zusagen „deutlich besser“ als der Lieferant */
export const keptBetterPoints = 10;

/** „Das Wichtigste“ der Liste: belegte Zahlen, den Satz bildet die Seite (G-6) */
export const relationshipsSummaryRowSchema = z.discriminatedUnion('kind', [
  /** Hakt: der Lieferant mit der niedrigsten Quote, mit seinem wichtigsten Hinweis */
  z.object({
    kind: z.literal('counterpart_low'),
    relationshipId: z.uuid(),
    name: z.string(),
    kept: z.number().int().min(0),
    due: z.number().int().positive(),
    hint: relationshipHintSchema.nullable(),
  }),
  /** Fehlt: der größte Lieferant ohne Segment */
  z.object({
    kind: z.literal('unrated'),
    relationshipId: z.uuid(),
    name: z.string(),
    spend: moneySchema.nullable(),
  }),
  /** Info: der größte Abstand der Quoten zugunsten eurer Seite, mit überfälliger Zusage */
  z.object({
    kind: z.literal('quota_gap'),
    relationshipId: z.uuid(),
    name: z.string(),
    own: z.number().int().min(0).max(100),
    counterpart: z.number().int().min(0).max(100),
    overdue: z.object({ count: z.number().int().positive(), title: z.string() }).nullable(),
  }),
]);
export type RelationshipsSummaryRow = z.infer<typeof relationshipsSummaryRowSchema>;

export const relationshipsSummarySchema = z.object({
  /** Beziehungen, in denen ihr um mindestens `keptBetterPoints` Punkte besser haltet */
  keptBetter: z.number().int().min(0),
  /** Größter Lieferant ohne Segment; `largest`, wenn er zugleich der größte überhaupt ist */
  unrated: z
    .object({
      relationshipId: z.uuid(),
      name: z.string(),
      spend: moneySchema.nullable(),
      largest: z.boolean(),
    })
    .nullable(),
  rows: z.array(relationshipsSummaryRowSchema).max(3),
});
export type RelationshipsSummary = z.infer<typeof relationshipsSummarySchema>;

export const relationshipsResponseSchema = z.object({
  /** Jahr von Spend und Quoten, nach der Uhr des Mandanten */
  year: z.number().int(),
  /** Kopf: „16 Beziehungen · 30,1 Mio. € Spend 2026 · 46 Lieferanten im Portfolio“ */
  head: z.object({
    active: z.number().int().min(0),
    spend: z.array(moneySchema),
    portfolio: z.number().int().min(0),
  }),
  /** Zahlen an den Filter-Chips, über die gezeigten Zeilen */
  counts: z.object({
    alle: z.number().int().min(0),
    meine: z.number().int().min(0),
    strategisch: z.number().int().min(0),
    offeneZusagen: z.number().int().min(0),
  }),
  /** Nach Aufmerksamkeit, dann nach Spend */
  rows: z.array(relationshipRowSchema),
  summary: relationshipsSummarySchema,
});
export type RelationshipsResponse = z.infer<typeof relationshipsResponseSchema>;

/** Lieferant in einem Feld der Matrix oder ohne Bewertung */
export const segmentSupplierSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  status: z.enum(relationshipStatuses),
  spend: moneySchema.nullable(),
  disputed: z.boolean(),
});
export type SegmentSupplier = z.infer<typeof segmentSupplierSchema>;

/** Feld der Matrix: Segmenttyp des aktiven Modells */
export const segmentFieldSchema = z.object({
  key: z.string(),
  impactLevel: z.number().int().min(1).max(3),
  qualityLevel: z.number().int().min(1).max(3),
  name: z.string(),
  count: z.number().int().min(0),
  spend: z.array(moneySchema),
  /** Aktive Beziehungen zuerst, dann nach Spend */
  suppliers: z.array(segmentSupplierSchema),
});
export type SegmentField = z.infer<typeof segmentFieldSchema>;

/** Klären: strittiger Lieferant mit dem Kriterium der größten Spanne */
export const disputedSegmentSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  criterion: z.object({ key: z.string(), name: z.string() }),
  /** Niedrigster und höchster Ist-Wert der Bewertenden, in Punkten von 0 bis 100 */
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
  /** Mit dem niedrigsten Wert ergäbe sich ein anderes Segment als mit dem höchsten */
  decidesSegment: z.boolean(),
});
export type DisputedSegment = z.infer<typeof disputedSegmentSchema>;

export const relationshipSegmentsSchema = z.object({
  year: z.number().int(),
  /** Aktives Segmentmodell; null, solange keins aktiv ist */
  model: z
    .object({
      id: z.uuid(),
      version: z.number().int().positive(),
      gridSize: z.union([z.literal(2), z.literal(3)]),
      impactLabel: z.string(),
      qualityLabel: z.string(),
    })
    .nullable(),
  /** Kopf: „46 Lieferanten im Portfolio · 38 bewertet · Bewertungsrunde 2027 läuft bis …“ */
  portfolio: z.number().int().min(0),
  rated: z.number().int().min(0),
  ratedSpend: z.array(moneySchema),
  round: z.object({ id: z.uuid(), name: z.string(), dueDate: z.iso.date().nullable() }).nullable(),
  /** Höchste Stufe beider Achsen zuerst: Zeilen nach Impact absteigend, Spalten aufsteigend */
  fields: z.array(segmentFieldSchema),
  unrated: z.object({
    count: z.number().int().min(0),
    spend: z.array(moneySchema),
    /** Größter zuerst */
    suppliers: z.array(segmentSupplierSchema),
  }),
  summary: z.object({
    /** Feld mit beiden höchsten Stufen, mit Anteil am bewerteten Spend in Prozent */
    top: z
      .object({
        key: z.string(),
        name: z.string(),
        count: z.number().int().min(0),
        spend: z.array(moneySchema),
        share: z.number().int().min(0).max(100).nullable(),
      })
      .nullable(),
    disputed: z.array(disputedSegmentSchema),
  }),
});
export type RelationshipSegments = z.infer<typeof relationshipSegmentsSchema>;
