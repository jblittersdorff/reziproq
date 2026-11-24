import { sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { withDemoClock } from './clock.js';

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
  /**
   * ZA-01 Regel 3: Lauf von Reziproq, für den die Transaktion arbeitet. Mit gesetztem Lauf wechselt
   * ein Objekt nur mit confirmToken in die Mitte (Trigger app_guard_shared, Migration 0130).
   */
  runId?: string | null;
  /** Bestätigungs-Token eines Menschen für genau ein Objekt (confirm_token) */
  confirmToken?: string | null;
}

/**
 * Mandanten-Session: Jeder Zugriff auf Fachdaten läuft hier hindurch (CLAUDE.md, PLT-02).
 * Die Transaktion wechselt auf die Rolle reziproq_app, für die Row-Level Security gilt, und setzt
 * app.user_id, app.org_id und app.customer_org_id, nach denen die Policies filtern (PLT-04), dazu
 * app.run_id und app.confirm_token für den Token-Schutz der Mitte (ZA-01). Alles
 * endet mit der Transaktion. Mit readOnly scheitert jeder Schreibversuch, z. B. für Seiten, die
 * nur lesen und nichts speichern dürfen (NAV-06).
 */
export function withTenant<T>(
  db: Database,
  session: TenantSession,
  work: (tx: TenantTransaction) => Promise<T>,
  options: { readOnly?: boolean } = {},
): Promise<T> {
  return db.transaction(
    async (tx) => {
      await tx.execute(sql`set local role reziproq_app`);
      // Eine Abfrage für alle Werte der Session, damit jede Transaktion nur einen Umlauf mehr hat;
      // sie liefert zugleich die Demo-Uhr der Organisation (DM-01, app_demo_now nach set_config).
      const result = await tx.execute<{ demo_now: string | Date | null }>(sql`select
        set_config('app.user_id', ${session.userId}, true),
        set_config('app.org_id', ${session.organizationId ?? ''}, true),
        set_config('app.customer_org_id', ${session.customerOrganizationId ?? ''}, true),
        set_config('app.run_id', ${session.runId ?? ''}, true),
        set_config('app.confirm_token', ${session.confirmToken ?? ''}, true),
        app_org_demo_now(${session.organizationId ?? null}::uuid) as demo_now`);
      const demoNow = result.rows[0]?.demo_now ?? null;
      return withDemoClock(demoNow === null ? null : new Date(demoNow), () => work(tx));
    },
    options.readOnly ? { accessMode: 'read only' } : undefined,
  );
}
