import { z } from 'zod';

// QS-03: Gesamtexport der eigenen Organisation als ZIP (je Tabelle eine CSV, dazu eine
// JSON-Beschreibung der Spalten). Läuft als Job; der Link gilt 24 Stunden.

export const dataExportValidHours = 24;

export const dataExportSchema = z.object({
  id: z.uuid(),
  status: z.enum(['pending', 'running', 'done', 'failed']),
  createdAt: z.iso.datetime({ offset: true }),
  finishedAt: z.iso.datetime({ offset: true }).nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  fileName: z.string().nullable(),
  /** Fertig und noch keine 24 Stunden alt */
  downloadable: z.boolean(),
});
export type DataExport = z.infer<typeof dataExportSchema>;

export const dataExportListSchema = z.object({
  exports: z.array(dataExportSchema),
});
export type DataExportList = z.infer<typeof dataExportListSchema>;
