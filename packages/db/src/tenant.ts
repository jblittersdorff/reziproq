import { sql } from 'drizzle-orm';
import type { Database } from './client.js';

export type TenantTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Für wen eine Transaktion arbeitet: die Person und ihre Organisation (leer ohne Organisation). */
export interface TenantSession {
  userId: string;
  organizationId: string | null;
  /**
   * Der Kunde, in dessen Kontext ein Lieferantennutzer arbeitet (PLT-04). Gesetzt ab LIF-02;
   * leer sieht die Lieferantenseite nichts Beziehungsbezogenes.
   */
  customerOrganizationId?: string | null;
}

/**
 * Mandanten-Session: Jeder Zugriff auf Fachdaten läuft hier hindurch (CLAUDE.md, PLT-02).
 * Die Transaktion wechselt auf die Rolle reziproq_app, für die Row-Level Security gilt, und setzt
 * app.user_id, app.org_id und app.customer_org_id, nach denen die Policies filtern (PLT-04). Alles
 * endet mit der Transaktion.
 */
export function withTenant<T>(
  db: Database,
  session: TenantSession,
  work: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role reziproq_app`);
    await tx.execute(sql`select set_config('app.user_id', ${session.userId}, true)`);
    await tx.execute(sql`select set_config('app.org_id', ${session.organizationId ?? ''}, true)`);
    await tx.execute(
      sql`select set_config('app.customer_org_id', ${session.customerOrganizationId ?? ''}, true)`,
    );
    return work(tx);
  });
}
