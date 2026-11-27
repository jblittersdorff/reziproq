import { and, currentTime, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import { type UndoPayload, workers } from '@reziproq/shared';

// HE-01 Dienst 3 (K1-e.3): Jede Handlung von Reziproq auf Stufe Erledigen wird ein Lauf der Aufgabe
// (MA-01) mit undo_payload, bevor sie wirkt. Die Aufgabe ist ein Systemagent je Organisation; er
// entsteht beim ersten Lauf. Erledigt liest die Läufe der Person, die Triage macht daraus Fokus-Themen
// der Stufe done.

/** Namen der Aufgaben (MA-01); die Oberfläche übersetzt über den Schlüssel */
const workerNames: Record<string, { name: string; description: string }> = {
  inbox: { name: 'Postfach', description: 'Ordnet Mails und Termine Beziehungen zu.' },
  commitment_followup: {
    name: 'Zusagen nachhalten',
    // K2-b.6: erinnern wirkt; als gehalten buchen mit Beleg kommt mit seinem Paket
    description: 'Erinnert Lieferanten an fällige Zusagen, als Nachricht von Reziproq.',
  },
  import_assign: { name: 'Import zuordnen', description: 'Ordnet Zeilen eines Imports zu.' },
};

/** Version des Systemagenten einer Aufgabe; legt Agent und Version beim ersten Mal an */
export async function workerVersion(
  tx: TenantTransaction,
  orgId: string,
  workerKey: string,
): Promise<string> {
  const worker = workers.find((entry) => entry.key === workerKey);
  if (!worker) throw new Error(`Unbekannte Aufgabe ${workerKey}`);
  const names = workerNames[workerKey] ?? { name: workerKey, description: workerKey };
  await tx
    .insert(schema.agent)
    .values({
      orgId,
      key: workerKey,
      name: names.name,
      description: names.description,
      kind: 'system',
      status: 'active',
    })
    .onConflictDoNothing({ target: [schema.agent.orgId, schema.agent.key] });
  const [agent] = await tx
    .select({ id: schema.agent.id })
    .from(schema.agent)
    .where(and(eq(schema.agent.orgId, orgId), eq(schema.agent.key, workerKey)));
  if (!agent) throw new Error(`Agent ${workerKey} fehlt`);
  await tx
    .insert(schema.agentVersion)
    .values({
      orgId,
      agentId: agent.id,
      version: 1,
      instructions: names.description,
      tools: worker.tools.map((tool) => tool.key),
      trigger: 'event',
      eventKey: workerKey,
      outputTarget: 'erledigt',
      reviewerRule: 'none',
      modelClass: 'small',
      budgetCents: 1,
      maxSteps: 1,
    })
    .onConflictDoNothing({
      target: [schema.agentVersion.orgId, schema.agentVersion.agentId, schema.agentVersion.version],
    });
  const [version] = await tx
    .select({ id: schema.agentVersion.id })
    .from(schema.agentVersion)
    .where(
      and(
        eq(schema.agentVersion.orgId, orgId),
        eq(schema.agentVersion.agentId, agent.id),
        eq(schema.agentVersion.version, 1),
      ),
    );
  if (!version) throw new Error(`Version von ${workerKey} fehlt`);
  return version.id;
}

/**
 * Hält eine Handlung auf Stufe Erledigen als Lauf fest, mit undo_payload, mit den Rechten der
 * Person, für die Reziproq handelt.
 */
export async function recordDone(
  tx: TenantTransaction,
  input: {
    orgId: string;
    userId: string;
    workerKey: string;
    relationshipId: string | null;
    contextType: string;
    contextId: string;
    undo: UndoPayload;
  },
): Promise<string> {
  const versionId = await workerVersion(tx, input.orgId, input.workerKey);
  const now = currentTime();
  const [run] = await tx
    .insert(schema.agentRun)
    .values({
      orgId: input.orgId,
      agentVersionId: versionId,
      actingUserId: input.userId,
      startedBy: `system:${input.workerKey}`,
      trigger: 'event',
      contextRelationshipId: input.relationshipId,
      contextType: input.contextType,
      contextId: input.contextId,
      status: 'done',
      startedAt: now,
      finishedAt: now,
      undoPayload: input.undo,
    })
    .returning({ id: schema.agentRun.id });
  if (!run) throw new Error('Lauf nicht angelegt');
  return run.id;
}

type MeetingSnapshot = Extract<UndoPayload, { kind: 'inbound_assign' }>['meetings'][number];

/** Stand von Terminen beim Anlegen, damit die Rücknahme Änderungen erkennt */
export async function meetingSnapshots(
  tx: TenantTransaction,
  ids: string[],
): Promise<MeetingSnapshot[]> {
  if (ids.length === 0) return [];
  const rows = await tx.execute<{
    id: string;
    title: string;
    starts_at: Date | string;
    duration_minutes: number;
    location: string | null;
    status: string;
    type: string;
    visibility: string;
    participants: number;
    agenda_items: number;
  }>(sql`
    select m.id, m.title, m.starts_at, m.duration_minutes, m.location, m.status, m.type,
      m.visibility,
      (select count(*)::int from meeting_participant p where p.meeting_id = m.id) as participants,
      (select count(*)::int from meeting_agenda_item a where a.meeting_id = m.id) as agenda_items
    from meeting m
    where m.id = any(${sql`${`{${ids.join(',')}}`}::uuid[]`})`);
  return rows.rows.map((row) => ({
    id: row.id,
    snapshot: {
      title: row.title,
      startsAt: new Date(row.starts_at).toISOString(),
      durationMinutes: row.duration_minutes,
      location: row.location,
      status: row.status,
      type: row.type,
      visibility: row.visibility,
      participants: row.participants,
      agendaItems: row.agenda_items,
    },
  }));
}
