import { z } from 'zod';

/**
 * LIF-02: Bereiche im Arbeitsbereich eines Kunden für die Lieferantenseite, mit dem Adressteil unter
 * /kunden/<beziehung>. Der Überblick ist /kunden/<beziehung> selbst. Kein Bereich Strategie: der
 * gehört dem Käufer allein.
 */
export const customerAreas = [
  { key: 'relationship', segment: 'beziehung' },
  { key: 'plan', segment: 'plan' },
  { key: 'execution', segment: 'umsetzung' },
  { key: 'impact', segment: 'wirkung' },
  { key: 'own', segment: 'eigene-sicht' },
] as const;

export type CustomerArea = (typeof customerAreas)[number]['key'];

export const customerCardSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  /** Nächster gemeinsamer Termin (QBR-01); bis dahin leer */
  nextMeeting: z.iso.date().nullable(),
});

export const customerListSchema = z.object({ customers: z.array(customerCardSchema) });

/** Kopf des Arbeitsbereichs: nur, was der Kunde mit dem Lieferanten teilt. */
export const customerWorkspaceSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  /** Vom Käufer freigegebener Beziehungstyp (SEG-10); bis dahin leer */
  relationshipType: z.string().nullable(),
  nextMeeting: z.iso.date().nullable(),
});

export type CustomerCard = z.infer<typeof customerCardSchema>;
export type CustomerList = z.infer<typeof customerListSchema>;
export type CustomerWorkspace = z.infer<typeof customerWorkspaceSchema>;
