import { z } from 'zod';

// ZYK-05: Nächster Zyklus. Er baut auf dem freigegebenen Lieferantenplan und den laufenden
// Initiativen auf; der alte Zyklus wird geschlossen und bleibt lesbar.

/** Ab so vielen Monaten nach dem JBP zeigt der Überblick „Nächsten Zyklus starten“. */
export const nextCycleAfterMonths = 11;

export const nextCyclePreviewSchema = z.object({
  current: z.object({
    label: z.string(),
    startedAt: z.iso.datetime({ offset: true }),
    jbpDate: z.iso.date().nullable(),
  }),
  /** Vorschlag für den Namen des neuen Zyklus */
  nextLabel: z.string(),
  /** Wird als Entwurf übernommen; null, wenn es noch keinen freigegebenen gibt */
  approvedPlan: z.object({ version: z.number().int(), objectives: z.number().int() }).nullable(),
  /** Gemeinsamer Plan: läuft als neue Version weiter, wenn er freigegeben ist */
  jointPlan: z.object({ version: z.number().int(), approved: z.boolean() }).nullable(),
  runningInitiatives: z.number().int(),
  openCommitments: z.number().int(),
  openActions: z.number().int(),
  canStart: z.boolean(),
});
export type NextCyclePreview = z.infer<typeof nextCyclePreviewSchema>;

export const startNextCycleSchema = z
  .object({
    jbpDate: z.iso.date(),
    label: z.string().trim().min(1).max(40),
  })
  .strict();
export type StartNextCycle = z.infer<typeof startNextCycleSchema>;

export const archivedCycleSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  startedAt: z.iso.datetime({ offset: true }),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
  jbpDate: z.iso.date().nullable(),
  supplierPlans: z.array(
    z.object({
      id: z.uuid(),
      version: z.number().int(),
      status: z.string(),
      summary: z.string(),
      objectives: z.array(
        z.object({ category: z.string(), text: z.string(), targetYear: z.number().int() }),
      ),
      topics: z.array(z.string()),
    }),
  ),
  /** Freigegebene Versionen des Gemeinsamen Plans in diesem Zyklus, eingefroren (JBP-06) */
  jointPlans: z.array(
    z.object({
      version: z.number().int(),
      approvedAt: z.iso.datetime({ offset: true }),
      topics: z.array(z.string()),
      initiatives: z.array(
        z.object({ title: z.string(), startsOn: z.string(), endsOn: z.string() }),
      ),
      commitments: z.array(
        z.object({ title: z.string(), ownerName: z.string(), dueOn: z.string() }),
      ),
    }),
  ),
  scorecards: z.array(
    z.object({
      version: z.number().int(),
      status: z.string(),
      kpis: z.array(z.object({ name: z.string(), target: z.string(), unit: z.string() })),
    }),
  ),
  feedback: z.array(
    z.object({
      id: z.uuid(),
      kind: z.string(),
      dueDate: z.iso.date(),
      revealed: z.boolean(),
    }),
  ),
});
export type ArchivedCycle = z.infer<typeof archivedCycleSchema>;

export const cycleArchiveSchema = z.object({ cycles: z.array(archivedCycleSchema) });
export type CycleArchive = z.infer<typeof cycleArchiveSchema>;
