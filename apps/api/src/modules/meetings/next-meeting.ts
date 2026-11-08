import { and, asc, gte, inArray, ne, schema, type TenantTransaction } from '@reziproq/db';

/**
 * Termin-Quelle (QBR-01b) für Start und den Kopf: der nächste offene Termin dieser Beziehungen.
 * Läuft in der Mandanten-Session; Row-Level Security entscheidet, welche Termine sichtbar sind.
 */
export async function nextMeetingOf(tx: TenantTransaction, relationshipIds: string[]) {
  if (relationshipIds.length === 0) return null;
  const [row] = await tx
    .select({
      id: schema.meeting.id,
      relationshipId: schema.meeting.relationshipId,
      title: schema.meeting.title,
      startsAt: schema.meeting.startsAt,
      location: schema.meeting.location,
    })
    .from(schema.meeting)
    .where(
      and(
        inArray(schema.meeting.relationshipId, relationshipIds),
        ne(schema.meeting.status, 'closed'),
        gte(schema.meeting.startsAt, new Date()),
      ),
    )
    .orderBy(asc(schema.meeting.startsAt))
    .limit(1);
  return row ?? null;
}

/** Nur das Datum (JJJJ-MM-TT) für Felder wie nextMeeting in Kopf und Kundenliste. */
export const meetingDate = (startsAt: Date) => startsAt.toISOString().slice(0, 10);
