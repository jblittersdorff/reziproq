import { z } from 'zod';
import { workerLevelSchema } from './workers.js';

// MA-01 Mein Agent (K1-f): je Aufgabe die Stufe der Person, die Übernahmequote der letzten acht
// Wochen und die Zahlen der Woche. Jede Zahl kommt aus Daten (G-6).

export const adoptionSchema = z.object({
  /** Übernommen ohne Änderung (bei Zuordnungen: selbst zugeordnet oder Vorschlag übernommen) */
  unchanged: z.number().int().min(0),
  /** Alle entschiedenen: übernommen, geändert oder verworfen */
  decided: z.number().int().min(0),
});
export type Adoption = z.infer<typeof adoptionSchema>;

export const myAgentTaskSchema = z.object({
  key: z.string().min(1),
  allowedLevels: z.array(workerLevelSchema),
  /** Was die Person wählen kann: erlaubt, heute wirksam und unter der Obergrenze der Organisation */
  selectable: z.array(workerLevelSchema),
  defaultLevel: workerLevelSchema,
  /** Eigene Wahl in Mein Agent; null heißt Startstufe */
  chosen: workerLevelSchema.nullable(),
  /** Stufe, mit der Reziproq für die Person arbeitet; null, wenn die Aufgabe aus ist */
  level: workerLevelSchema.nullable(),
  /** Aufgabe für die Organisation an (KI-Einstellungen) */
  enabled: z.boolean(),
  /** Obergrenze der Organisation; null ohne Grenze */
  cap: workerLevelSchema.nullable(),
  /** Übernahmequote der letzten acht Wochen; null, wenn die Aufgabe keine Entwürfe zählt */
  adoption: adoptionSchema.nullable(),
});
export type MyAgentTask = z.infer<typeof myAgentTaskSchema>;

export const myAgentSchema = z.object({
  week: z.object({
    /** Montag 00:00 in Berlin nach der Uhr des Mandanten */
    since: z.iso.datetime({ offset: true }),
    /** Handlungen auf Stufe Erledigen (Läufe mit Rücknahme) */
    done: z.number().int().min(0),
    /** Entwürfe und Zuordnungen, die Reziproq vorbereitet hat */
    prepared: z.number().int().min(0),
  }),
  /** Übernahmequote über alle Aufgaben, letzte acht Wochen */
  adoption: adoptionSchema,
  tasks: z.array(myAgentTaskSchema),
  /** Darf eigene Stufen ändern (nicht Leser) */
  canEdit: z.boolean(),
  /** Admin: Verweis auf die KI-Einstellungen */
  canManage: z.boolean(),
});
export type MyAgent = z.infer<typeof myAgentSchema>;

export const setWorkerLevelSchema = z.object({ level: workerLevelSchema }).strict();
export type SetWorkerLevel = z.infer<typeof setWorkerLevelSchema>;
