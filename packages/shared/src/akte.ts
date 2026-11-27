import { z } from 'zod';
import { jbpPlanStatuses } from './jbp.js';
import { moneySchema } from './money.js';
import { meetingSides } from './meetings.js';
import { teamRoles } from './permissions.js';
import { sideQuoteSchema } from './relationships.js';
import { ruleSetStatuses } from './rule-sets.js';
import { kpiTracks } from './scorecard.js';
import { relationshipStatuses } from './suppliers.js';
import { surveyKinds } from './survey.js';

// AK-01 (K2-c): Akte einer Beziehung unter /beziehungen/<id> mit drei Sichten: Gemeinsam (ohne
// Parameter), Nur für dich (?sicht=privat) und Von <Gegenüber> (?sicht=geteilt). Die Seite des
// Käufers; die Akte des Lieferanten kommt mit LP-01.

export const akteViews = ['gemeinsam', 'privat', 'geteilt'] as const;
export type AkteView = (typeof akteViews)[number];

const side = z.enum(meetingSides);

/**
 * Kopf der Akte (Baustein AkteKopf, AK-01): Name, Segment, Warengruppen mit Lead der
 * Haupt-Warengruppe, Spend des laufenden Jahres und Fokus. Den Schritt im Jahreszyklus liest die
 * Seite aus dem Überblick.
 */
export const akteHeadSchema = z.object({
  relationshipId: z.uuid(),
  /** Name der Organisation des Gegenübers; den Anzeigenamen bildet die Seite */
  name: z.string(),
  status: z.enum(relationshipStatuses),
  segment: z.object({ key: z.string(), name: z.string() }).nullable(),
  isFocus: z.boolean(),
  /** Warengruppen der Zuordnung, die Haupt-Warengruppe zuerst */
  materialGroups: z.array(z.string()),
  /** Lead der Haupt-Warengruppe (WG-01) */
  lead: z.string().nullable(),
  year: z.number().int(),
  spend: moneySchema.nullable(),
  /** Nächster wichtiger geteilter Termin (nicht „Sonstiges“), für die Aktion „Briefing JBP“ */
  nextMeeting: z
    .object({
      id: z.uuid(),
      type: z.string(),
      title: z.string(),
      startsAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
});
export type AkteHead = z.infer<typeof akteHeadSchema>;

/** Herkunft einer Zusage (ZQ-01 Regel 6); plan: aus einem Gemeinsamen Plan ohne eigene Herkunft */
export const akteCommitmentOrigins = [
  'mail',
  'meeting',
  'feedback',
  'hint',
  'manual',
  'deal',
  'initiative',
  'plan',
] as const;

/**
 * Stand einer offenen Zusage in Gemeinsam: offen, überfällig (Frist verstrichen) oder wartet auf
 * die Bestätigung einer Seite (ZA-01); die Bestätigung geht vor der Frist
 */
export const akteCommitmentStates = [
  'open',
  'overdue',
  'awaiting_counterpart',
  'awaiting_own',
] as const;

/** Zusage in Gemeinsam (ZQ-01): Seite, Person, Frist, Herkunft und Stand */
export const akteCommitmentSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  side,
  ownerName: z.string(),
  dueOn: z.iso.date(),
  /** Woran Erfüllung gemessen wird, z. B. „monatlich ab 15.12.“ */
  measure: z.string().nullable(),
  origin: z.enum(akteCommitmentOrigins).nullable(),
  /** Jahr des Gemeinsamen Plans bei Herkunft plan, nach seiner Anlage */
  planYear: z.number().int().nullable(),
  /** Wer die Zusage eingetragen hat; trägt der Käufer eine des Lieferanten ein: „von euch eingetragen“ */
  enteredBy: side,
  state: z.enum(akteCommitmentStates),
});
export type AkteCommitment = z.infer<typeof akteCommitmentSchema>;

/** Kennzahl der Scorecard mit letztem Wert und Stand (JBP-09) */
export const akteKpiSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  ownerSide: side,
  unit: z.string(),
  target: z.string(),
  latest: z.object({ period: z.iso.date(), value: z.string() }).nullable(),
  track: z.enum(kpiTracks).nullable(),
});
export type AkteKpi = z.infer<typeof akteKpiSchema>;

/** Eintrag in „Nächste Wochen“: Termin oder Frist einer Zusage */
export const akteWeekSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('meeting'),
    id: z.uuid(),
    startsAt: z.iso.datetime({ offset: true }),
    title: z.string(),
    location: z.string().nullable(),
  }),
  z.object({
    kind: z.literal('commitment'),
    id: z.uuid(),
    dueOn: z.iso.date(),
    title: z.string(),
    side,
    state: z.enum(akteCommitmentStates),
  }),
]);
export type AkteWeek = z.infer<typeof akteWeekSchema>;

/** Rücklauf einer Feedback-Welle je Seite */
const responseSchema = z.object({
  completed: z.number().int().min(0),
  invited: z.number().int().min(0),
});

export const akteSharedSchema = z.object({
  year: z.number().int(),
  /** Name der Organisation des Gegenübers; den Anzeigenamen bildet die Seite */
  counterpart: z.string(),
  /** Gehaltene Zusagen im laufenden Jahr je Seite (ZQ-01, beide Seiten sehen dieselben Zahlen) */
  quota: z.object({ own: sideQuoteSchema, counterpart: sideQuoteSchema }),
  /** Offene Zusagen beider Seiten, nach Frist */
  commitments: z.array(akteCommitmentSchema),
  /** Gehaltene Zusagen im laufenden Jahr, die zuletzt gehaltene mit Seite */
  kept: z.object({
    count: z.number().int().min(0),
    last: z.object({ title: z.string(), side }).nullable(),
  }),
  /** Scorecard des jüngsten Gemeinsamen Plans; null ohne Scorecard */
  scorecard: z
    .object({
      status: z.enum(['draft', 'signed']),
      signed: z.object({ own: z.boolean(), counterpart: z.boolean() }),
      /** Monat des jüngsten Werts, z. B. 2026-10-01 („Kennzahlen Oktober“) */
      period: z.iso.date().nullable(),
      kpis: z.array(akteKpiSchema),
    })
    .nullable(),
  /** Termine und Fristen der nächsten vier Wochen, nach Datum */
  weeks: z.array(akteWeekSchema),
  /** Jüngster Gemeinsamer Plan; null ohne Plan */
  plan: z
    .object({
      id: z.uuid(),
      status: z.enum(jbpPlanStatuses),
      version: z.number().int(),
      /** Jahr des Plans: angelegt ab Oktober gilt er fürs Folgejahr („Gemeinsamer Plan 2027“) */
      year: z.number().int(),
    })
    .nullable(),
  /** Spielregeln der Beziehung (PLB-01); null ohne Spielregeln */
  rules: z
    .object({
      typeName: z.string(),
      status: z.enum(ruleSetStatuses),
      /** Seit wann die geteilte Fassung gilt */
      since: z.iso.datetime({ offset: true }).nullable(),
      /** Es gibt eine neuere Fassung, die noch nicht geteilt ist */
      unshared: z.boolean(),
    })
    .nullable(),
  /** Feedback-Wellen, die laufende oder jüngste zuerst, höchstens zwei */
  feedback: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(surveyKinds),
      dueDate: z.iso.date(),
      closed: z.boolean(),
      revealed: z.boolean(),
      own: responseSchema,
      counterpart: responseSchema,
    }),
  ),
  /** Team beider Seiten; vom Gegenüber nur die geteilten Mitglieder */
  team: z.object({
    own: z.array(z.object({ name: z.string(), teamRole: z.enum(teamRoles) })),
    counterpart: z.array(z.object({ name: z.string(), teamRole: z.enum(teamRoles) })),
  }),
});
export type AkteShared = z.infer<typeof akteSharedSchema>;

/**
 * Jahr eines Gemeinsamen Plans aus seiner Anlage: Pläne entstehen zum JBP im Herbst für das
 * Folgejahr. Angelegt ab Oktober gilt er fürs nächste Jahr, sonst fürs laufende.
 */
export function planYearOf(createdAt: string): number {
  const year = Number(createdAt.slice(0, 4));
  const month = Number(createdAt.slice(5, 7));
  return month >= 10 ? year + 1 : year;
}
