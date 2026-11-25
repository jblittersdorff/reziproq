import { and, eq, schema, type TenantTransaction } from '@reziproq/db';
import {
  type AiFeature,
  orgWorkerState,
  resolveLevel,
  type WorkerLevel,
  workerByKey,
  workerOfFeature,
} from '@reziproq/shared';
import { readAiSettings } from '../ai-gateway/ai-settings.js';

// MA-01 (K1-f): An oder aus je Aufgabe (KI-Einstellungen) und die Stufe, mit der Reziproq für eine
// Person arbeitet. Jede Aufgabe fragt hier, bevor sie einen Lauf startet oder ein Modell aufruft.

/** Ist die Aufgabe für die Organisation an? Unbekannte Aufgaben sind aus. */
export async function workerEnabled(
  tx: TenantTransaction,
  orgId: string,
  key: string,
): Promise<boolean> {
  const worker = workerByKey(key);
  if (!worker) return false;
  const settings = await readAiSettings(tx, orgId);
  return orgWorkerState(settings.workers, worker).enabled;
}

/** Darf das Gateway die Funktion aufrufen? Funktionen ohne Aufgabe sind immer an. */
export async function featureEnabled(
  tx: TenantTransaction,
  orgId: string,
  feature: AiFeature,
): Promise<boolean> {
  const worker = workerOfFeature(feature);
  return worker ? workerEnabled(tx, orgId, worker.key) : true;
}

/**
 * Stufe für eine Person; null heißt: Die Aufgabe ist aus und es entsteht kein Lauf (T1-MA4). Die
 * Wahl der Person liest nur ihre eigene Session (Row Level Security auf worker_setting): Dienste,
 * die für eine andere Person handeln, öffnen dafür eine Session dieser Person.
 */
export async function workerLevelFor(
  tx: TenantTransaction,
  person: { orgId: string; userId: string },
  key: string,
): Promise<WorkerLevel | null> {
  const worker = workerByKey(key);
  if (!worker) return null;
  const settings = await readAiSettings(tx, person.orgId);
  const state = orgWorkerState(settings.workers, worker);
  const [row] = await tx
    .select({ level: schema.workerSetting.level })
    .from(schema.workerSetting)
    .where(
      and(
        eq(schema.workerSetting.orgId, person.orgId),
        eq(schema.workerSetting.userId, person.userId),
        eq(schema.workerSetting.agentKey, key),
      ),
    );
  return resolveLevel(worker, {
    personal: row?.level ?? null,
    enabled: state.enabled,
    orgCap: state.cap,
  });
}
