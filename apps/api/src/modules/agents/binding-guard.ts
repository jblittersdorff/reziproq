import { and, currentTime, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { WorkerTool } from '@reziproq/shared';

// MA-01 Leitplanken, G-5 (K1-f.2): Zusagen im Namen des Käufers, Freigaben, Bestätigung von Wert,
// Teilen in die Mitte, Deal senden oder bestätigen und Mandatsänderungen geschehen nie
// automatisch, auf keiner Stufe. Jedes Werkzeug läuft durch runTool: Ein bindendes Werkzeug
// (binding = true in der Registry) braucht das Bestätigungs-Token eines Menschen für genau dieses
// Werkzeug und dieses Objekt. Ohne gültiges Token führt runTool nichts aus, legt einen Entwurf
// „binding_request“ an, den ein Mensch im Fokus bestätigt, und beendet den Lauf.
// Für das Teilen in die Mitte setzt die Datenbank das zusätzlich durch (app_guard_shared, ZA-01).

export interface ToolCall {
  orgId: string;
  /** Person, in deren Namen der Lauf handelt; das Token muss ihr gehören */
  userId: string;
  runId: string | null;
  relationshipId: string | null;
  tool: WorkerTool;
  /** Tabelle und Objekt, auf das das Werkzeug wirkt */
  objectType: string;
  objectId: string;
  /** Was ein Mensch bestätigt, z. B. „Zusage ‚Musterteile bis KW 50‘ an Rheintal senden“ */
  summary: string;
  /** Token aus der Bestätigung eines Menschen (confirm_token), sonst null */
  token: string | null;
}

export type ToolOutcome<T> = { status: 'done'; value: T } | { status: 'draft'; draftId: string };

/** Titel des Schritts, mit dem ein Lauf an einer Leitplanke endet (Warum zum Lauf) */
export const bindingStepTitle = 'Bindende Handlung: wartet auf die Bestätigung eines Menschen';

/**
 * Führt ein Werkzeug aus. Ein bindendes Werkzeug läuft nur, wenn die Datenbank das Token verbraucht
 * (app_use_confirm_token, Migration 0135): einmal, für dieses Werkzeug und Objekt, von der Person des
 * Laufs, nicht abgelaufen. Scheitert das Werkzeug selbst, bleibt das Token mit der Transaktion
 * unverbraucht.
 */
export async function runTool<T>(
  tx: TenantTransaction,
  call: ToolCall,
  perform: (tx: TenantTransaction) => Promise<T>,
): Promise<ToolOutcome<T>> {
  if (!call.tool.binding) return { status: 'done', value: await perform(tx) };
  const [confirmed] = (
    await tx.execute<{ used: boolean }>(sql`
      select app_use_confirm_token(${call.token}::uuid, ${call.tool.key}, ${call.objectType},
        ${call.objectId}::uuid) as used`)
  ).rows;
  if (confirmed?.used === true) return { status: 'done', value: await perform(tx) };

  const [draft] = await tx
    .insert(schema.aiDraft)
    .values({
      orgId: call.orgId,
      relationshipId: call.relationshipId,
      kind: 'binding_request',
      objectType: call.objectType,
      objectId: call.objectId,
      subject: call.tool.key,
      content: call.summary,
      runId: call.runId,
      model: 'none',
      createdBy: call.userId,
    })
    .returning({ id: schema.aiDraft.id });
  if (!draft) throw new Error('Entwurf wurde nicht angelegt');
  if (call.runId) await stopRun(tx, call.runId, call.tool.key);
  return { status: 'draft', draftId: draft.id };
}

/** Der Lauf bricht ab: ein letzter Schritt nennt den Grund, der Lauf endet mit „cancelled“. */
async function stopRun(tx: TenantTransaction, runId: string, toolKey: string) {
  const [last] = (
    await tx.execute<{ seq: number | null }>(
      sql`select max(seq) as seq from agent_step where run_id = ${runId}`,
    )
  ).rows;
  const [run] = await tx
    .select({ orgId: schema.agentRun.orgId })
    .from(schema.agentRun)
    .where(eq(schema.agentRun.id, runId));
  if (!run) return;
  const now = currentTime();
  await tx.insert(schema.agentStep).values({
    orgId: run.orgId,
    runId,
    seq: Number(last?.seq ?? 0) + 1,
    kind: 'check',
    title: bindingStepTitle,
    toolKey,
    status: 'failed',
    startedAt: now,
    finishedAt: now,
  });
  await tx
    .update(schema.agentRun)
    .set({ status: 'cancelled', finishedAt: now })
    .where(
      and(
        eq(schema.agentRun.id, runId),
        inArray(schema.agentRun.status, ['queued', 'running', 'waiting_input']),
      ),
    );
}
