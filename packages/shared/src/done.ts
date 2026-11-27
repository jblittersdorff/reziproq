import { z } from 'zod';
import { workerLevelSchema } from './workers.js';

// HE-01 Erledigt im Hintergrund (K1-e.3): was Reziproq für die Person getan hat, aus ihren Läufen.
// Jede Handlung auf Stufe Erledigen hat einen undo_payload und lässt sich 30 Tage zurücknehmen,
// solange das Objekt unverändert ist (Dienst 3). Fehlgeschlagene Läufe stehen mit „fehlgeschlagen“.

/** Rücknahme bis 30 Tage nach der Handlung */
export const undoDays = 30;

/** Was eine Handlung rückgängig macht; je Art ein eigener Aufbau (in agent_run.undo_payload) */
export const undoPayloadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('inbound_assign'),
    inboundItemId: z.uuid(),
    subject: z.string(),
    relationshipId: z.uuid(),
    meetings: z.array(
      z.object({
        id: z.uuid(),
        /** Stand beim Anlegen; weicht er ab, ist die Rücknahme nicht mehr möglich */
        snapshot: z.object({
          title: z.string(),
          startsAt: z.string(),
          durationMinutes: z.number().int(),
          location: z.string().nullable(),
          status: z.string(),
          type: z.string(),
          visibility: z.string(),
          participants: z.number().int(),
          agendaItems: z.number().int(),
        }),
      }),
    ),
  }),
  // K1-g.2: Mail, die das Postfach auf Stufe Erledigen selbst abgelegt hat. Zurücknehmen legt sie
  // wieder an den Eingang („Zuordnen“), solange die abgelegte Mail unverändert beim Lieferanten liegt.
  z.object({
    kind: z.literal('mail_assign'),
    inboundItemId: z.uuid(),
    mailId: z.uuid(),
    subject: z.string(),
    /** Name des Absenders aus den Ansprechpartnern, sonst seine Adresse */
    sender: z.string(),
    relationshipId: z.uuid(),
  }),
  // ZQ-01 Regel 5 (K2-b.6): Erinnerung an eine Zusage des Lieferanten, als Nachricht von Reziproq
  // (E-K1-5). Eine gesendete Mail lässt sich nicht zurückholen: Erledigt zeigt sie ohne Rücknahme.
  z.object({
    kind: z.literal('commitment_remind'),
    commitmentId: z.uuid(),
    title: z.string(),
    relationshipId: z.uuid(),
    dueOn: z.iso.date(),
    /** Name der Person beim Lieferanten, die die Erinnerung bekam */
    recipient: z.string(),
  }),
]);
export type UndoPayload = z.infer<typeof undoPayloadSchema>;

/** Arten, die sich nicht zurücknehmen lassen; Erledigt nennt sie ohne Knopf (Grund „ohne“) */
export const doneWithoutUndo: readonly UndoPayload['kind'][] = ['commitment_remind'];

/** Warum eine Rücknahme nicht (mehr) geht */
export const undoBlockers = ['geaendert', 'abgelaufen', 'zurueckgenommen', 'ohne'] as const;
export type UndoBlocker = (typeof undoBlockers)[number];

export const doneRowSchema = z.object({
  /** Lauf (agent_run) */
  id: z.uuid(),
  at: z.iso.datetime({ offset: true }),
  /** Schlüssel der Aufgabe (MA-01) oder des Agenten */
  task: z.string(),
  /** Name der Aufgabe, wie der Lauf ihn führt */
  taskName: z.string(),
  status: z.enum(['done', 'failed', 'undone']),
  /**
   * Was getan wurde: Zuordnung von Termin oder Mail, Erinnerung an eine Zusage des Lieferanten,
   * vorbereiteter Entwurf oder ein anderer Lauf
   */
  action: z.enum(['inbound_assign', 'mail_assign', 'commitment_remind', 'prepared', 'run']),
  /** Titel des Objekts, z. B. Betreff des Termins */
  subject: z.string().nullable(),
  /** Absender einer zugeordneten Mail (K1-g.2) */
  sender: z.string().nullable().optional(),
  /** Wer beim Lieferanten an seine Zusage erinnert wurde (K2-b.6) */
  recipient: z.string().nullable().optional(),
  counterpart: z.string().nullable(),
  /** Ort zum Ansehen: Objekt oder Kurz prüfen; null ohne Ziel */
  href: z.string().nullable(),
  /** Offene Entwürfe des Laufs in Kurz prüfen */
  openDrafts: z.number().int().min(0),
  undo: z.object({
    possible: z.boolean(),
    blocker: z.enum(undoBlockers).nullable(),
  }),
});
export type DoneRow = z.infer<typeof doneRowSchema>;

/** Stufe je Aufgabe der Person, rechts auf Erledigt (Verweis auf Mein Agent) */
export const doneTaskSchema = z.object({
  key: z.string(),
  level: workerLevelSchema,
});

export const doneListSchema = z.object({
  /** Gestern 18:00 in Berlin: Beginn von „Erledigt im Hintergrund“ */
  since: z.iso.datetime({ offset: true }),
  /** Seit gestern 18:00 */
  recent: z.number().int().min(0),
  /** Läufe der letzten 30 Tage, neueste zuerst */
  rows: z.array(doneRowSchema),
  tasks: z.array(doneTaskSchema),
});
export type DoneList = z.infer<typeof doneListSchema>;

export const undoResultSchema = z.object({ state: z.literal('undone') });
