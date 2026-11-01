import { z } from 'zod';
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
  /** Personen im internen Team (PLT-05b) */
  z.object({
    tile: z.literal('relationship'),
    kind: z.literal('team_size'),
    count: z.number().int(),
  }),
]);

export type OverviewMetric = z.infer<typeof overviewMetricSchema>;

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
});

export type WorkspaceHead = z.infer<typeof workspaceHeadSchema>;

/** GET /api/suppliers/:id/overview */
export const supplierOverviewSchema = z.object({
  head: workspaceHeadSchema,
  metrics: z.array(overviewMetricSchema),
});

export type SupplierOverview = z.infer<typeof supplierOverviewSchema>;
