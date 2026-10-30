import { sql } from 'drizzle-orm';
import type { Database } from './client.js';

export type TenantTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Mandanten-Session: Jeder Zugriff auf Fachdaten läuft hier hindurch (CLAUDE.md).
 * Die Transaktion wechselt auf die Rolle reziproq_app, für die Row-Level Security gilt, und setzt
 * die Organisation, nach der die Policies filtern. Beides endet mit der Transaktion.
 */
export function withTenant<T>(
  db: Database,
  organizationId: string,
  work: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role reziproq_app`);
    await tx.execute(sql`select set_config('app.organization_id', ${organizationId}, true)`);
    return work(tx);
  });
}
