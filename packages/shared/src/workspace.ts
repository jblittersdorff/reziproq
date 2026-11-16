import { z } from 'zod';
import { cycleDeadlineSchema } from './cycle.js';
import { moneySchema } from './money.js';

/**
 * Die Bereiche im Arbeitsbereich eines Lieferanten (NAV-06) in fester Reihenfolge, mit dem
 * Adressteil unter /lieferanten/<id>. Der Überblick ist /lieferanten/<id> selbst.
 */
export const workspaceAreas = [
  { key: 'strategy', segment: 'strategie' },
  { key: 'relationship', segment: 'beziehung' },
  { key: 'plan', segment: 'plan' },
  { key: 'execution', segment: 'umsetzung' },
  { key: 'impact', segment: 'wirkung' },
] as const;

export type WorkspaceArea = (typeof workspaceAreas)[number]['key'];

/** Kacheln des Überblicks: die fünf Bereiche und die Hinweise (FS-01). */
export const overviewTiles = [...workspaceAreas.map((area) => area.key), 'hints'] as const;
export type OverviewTile = (typeof overviewTiles)[number];

/**
 * Genau eine Kennzahl je Modul und Lieferant (NAV-06). Die Module melden sie über eine
 * Schnittstelle im Backend; der Überblick speichert nichts selbst.
 */
export const overviewMetricSchema = z.discriminatedUnion('kind', [
  /** Spend des letzten Jahres mit Daten (PLT-03) */
  z.object({
    tile: z.literal('strategy'),
    kind: z.literal('spend'),
    year: z.number().int(),
    amount: moneySchema,
  }),
  /** Soll-Typ aus den abgegebenen Bewertungen (SEG-05); vorläufig bis zur Konsolidierung */
  z.object({
    tile: z.literal('strategy'),
    kind: z.literal('segment_target'),
    typeName: z.string(),
    provisional: z.boolean(),
  }),
  /** Personen im internen Team (PLT-05b) */
  z.object({
    tile: z.literal('relationship'),
    kind: z.literal('team_size'),
    count: z.number().int(),
  }),
  /** Geteilte Spielregeln (SEG-10): Typ, Version und seit wann geteilt */
  z.object({
    tile: z.literal('relationship'),
    kind: z.literal('rules'),
    typeName: z.string(),
    version: z.number().int(),
    sharedAt: z.string(),
  }),
  /** Gemeinsamer Plan (JBP-01 bis JBP-03): Stand, Termin, Themen und Initiativen */
  z.object({
    tile: z.literal('plan'),
    kind: z.literal('jbp'),
    status: z.enum(['draft', 'in_review', 'approved']),
    meetingDate: z.string().nullable(),
    topics: z.number().int(),
    initiatives: z.number().int(),
  }),
  /** Offene und davon überfällige Maßnahmen (QBR-03) */
  z.object({
    tile: z.literal('execution'),
    kind: z.literal('actions'),
    open: z.number().int(),
    overdue: z.number().int(),
  }),
]);

export type OverviewMetric = z.infer<typeof overviewMetricSchema>;

export const cycleStepKeys = [
  'segment',
  'feedback',
  'touchpoints',
  'supplierPlan',
  'jbp',
  'scorecard',
  'execution',
] as const;
export type CycleStepKey = (typeof cycleStepKeys)[number];

export const cycleStepStatusSchema = z.enum([
  'open',
  'in_progress',
  'completed',
  'overdue',
  'unavailable',
]);
export type CycleStepStatus = z.infer<typeof cycleStepStatusSchema>;

export const cycleStepSchema = z.object({
  key: z.enum(cycleStepKeys),
  status: cycleStepStatusSchema,
  href: z.string().nullable(),
  dueDate: z.iso.date().nullable(),
});

export const cycleSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  startedAt: z.string(),
  jbpDate: z.string().nullable(),
  schedule: z.array(cycleDeadlineSchema).length(5),
  steps: z.array(cycleStepSchema).length(cycleStepKeys.length),
});
export type SupplierCycle = z.infer<typeof cycleSchema>;

/**
 * Kopf des Arbeitsbereichs: liest jeden Wert an seinem Ort. null heißt „noch offen“ (Segment, SRO)
 * oder die Angabe entfällt (Termin).
 */
export const workspaceHeadSchema = z.object({
  /** Segment Ist → Soll aus der Konsolidierung (SEG-06); bis dahin null */
  segment: z.object({ current: z.string(), target: z.string() }).nullable(),
  /** SRO aus dem Team (PLT-05b) */
  sro: z.object({ userId: z.string(), name: z.string() }).nullable(),
  /** Nächster Termin (QBR-01); bis dahin null */
  nextMeeting: z.object({ date: z.string() }).nullable(),
  /** Fokuslieferant (SEG-02) */
  isFocus: z.boolean().optional(),
});

export type WorkspaceHead = z.infer<typeof workspaceHeadSchema>;

/** GET /api/suppliers/:id/overview */
export const supplierOverviewSchema = z.object({
  head: workspaceHeadSchema,
  metrics: z.array(overviewMetricSchema),
  cycle: cycleSchema.nullable(),
  canStartCycle: z.boolean(),
  canSetJbpDate: z.boolean(),
  /** ZYK-05: Elf Monate nach dem JBP darf SRO oder Admin den nächsten Zyklus starten. */
  canStartNextCycle: z.boolean().optional(),
  /** FS-01: offene Hinweise zu dieser Beziehung, nur beim Käufer */
  openHints: z.number().int().optional(),
});

export type SupplierOverview = z.infer<typeof supplierOverviewSchema>;
