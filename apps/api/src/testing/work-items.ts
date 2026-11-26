import { type Database, schema } from '@reziproq/db';

// ZQ-01 (K2-a.3): Testdaten in der Form der früheren Maßnahmen (QBR-03). insertWorkItems legt sie so
// an, wie die Migration 0143 sie abbildet (T2-ZQ1): geteilt als Zusage, intern als Aufgabe, auch
// wenn die interne Maßnahme einer Person der anderen Seite zugeschrieben war.

export interface LegacyActionRow {
  id?: string;
  relationshipId: string;
  ownerOrgId: string;
  visibility?: 'internal' | 'shared';
  title: string;
  description?: string | null;
  ownerSide: 'buyer' | 'supplier';
  ownerUserId?: string | null;
  ownerName: string;
  dueDate: string;
  status?: 'open' | 'in_progress' | 'done' | 'cancelled';
  sourceType: 'meeting' | 'feedback_gap' | 'initiative' | 'manual';
  sourceId?: string | null;
  createdBy: string;
  createdByName: string;
  /** Erledigt-Zeitpunkt, z. B. für „heute erledigt“ */
  doneAt?: Date | null;
}

export interface WorkItemRef {
  kind: 'commitment' | 'task';
  id: string;
  title: string;
}

const chunk = <T>(rows: T[], size = 500) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  );

/** Legt die Zeilen als Zusagen bzw. Aufgaben an; die Reihenfolge der Rückgabe folgt der Eingabe */
export async function insertWorkItems(
  db: Database,
  rows: LegacyActionRow[],
): Promise<WorkItemRef[]> {
  const isTask = (row: LegacyActionRow) => (row.visibility ?? 'shared') === 'internal';
  const now = new Date();
  const tasks = rows.filter(isTask).map((row) => {
    const status = row.status ?? 'open';
    return {
      ...(row.id ? { id: row.id } : {}),
      relationshipId: row.relationshipId,
      orgId: row.ownerOrgId,
      title: row.title,
      description: row.description ?? null,
      ownerUserId: row.ownerUserId ?? null,
      ownerName: row.ownerName,
      dueDate: row.dueDate,
      status,
      sourceType: row.sourceType,
      sourceId: row.sourceType === 'manual' ? null : (row.sourceId ?? null),
      doneAt: row.doneAt !== undefined ? row.doneAt : status === 'done' ? now : null,
      createdBy: row.createdBy,
      createdByName: row.createdByName,
    };
  });
  const commitments = rows
    .filter((row) => !isTask(row))
    .map((row) => {
      const status = row.status ?? 'open';
      return {
        ...(row.id ? { id: row.id } : {}),
        relationshipId: row.relationshipId,
        ownerOrgId: row.ownerOrgId,
        visibility: row.visibility ?? 'shared',
        side: row.ownerSide,
        title: row.title,
        description: row.description ?? null,
        ownerUserId: row.ownerUserId ?? null,
        ownerName: row.ownerName,
        dueOn: row.dueDate,
        status:
          status === 'done'
            ? ('kept' as const)
            : status === 'cancelled'
              ? ('withdrawn' as const)
              : ('open' as const),
        fulfilledEvidence: status === 'done' ? { kind: 'legacy' } : null,
        doneAt:
          row.doneAt !== undefined
            ? row.doneAt
            : status === 'done' || status === 'cancelled'
              ? now
              : null,
        sourceType: row.sourceType === 'feedback_gap' ? ('feedback' as const) : row.sourceType,
        sourceRef: row.sourceType === 'manual' ? null : (row.sourceId ?? null),
        createdBy: row.createdBy,
        createdByName: row.createdByName,
      };
    });
  const created = new Map<string, WorkItemRef>();
  const remember = (kind: WorkItemRef['kind'], list: { id: string; title: string }[]) => {
    for (const entry of list) created.set(`${kind}:${entry.title}:${entry.id}`, { kind, ...entry });
  };
  for (const part of chunk(tasks)) {
    remember(
      'task',
      await db
        .insert(schema.task)
        .values(part)
        .returning({ id: schema.task.id, title: schema.task.title }),
    );
  }
  for (const part of chunk(commitments)) {
    remember(
      'commitment',
      await db
        .insert(schema.commitment)
        .values(part)
        .returning({ id: schema.commitment.id, title: schema.commitment.title }),
    );
  }
  // In Eingabereihenfolge: je Zeile der erste noch freie Eintrag mit Art und Titel
  const pool = [...created.values()];
  return rows.map((row) => {
    const kind = isTask(row) ? 'task' : 'commitment';
    const index = pool.findIndex(
      (entry) =>
        entry.kind === kind && entry.title === row.title && (!row.id || entry.id === row.id),
    );
    const [entry] = pool.splice(index, 1);
    return entry as WorkItemRef;
  });
}
