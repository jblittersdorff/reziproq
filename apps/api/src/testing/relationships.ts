import { type Database, schema, sql } from '@reziproq/db';

// Testdaten für Beziehungen (PLT-03): Beziehung, eigene Nummer der Käuferseite und Spend je Jahr.
// Die Tests schreiben über die Eigentümer-Verbindung, nicht über die API-Rolle.

export interface TestRelationship {
  id: string;
  buyer: string;
  supplier: string;
  status?: 'draft' | 'active' | 'ended';
  externalRef?: string;
  notes?: string;
  spend?: { year: number; amountCents: number; currency?: string }[];
}

export async function insertRelationships(db: Database, relationships: TestRelationship[]) {
  const { relationship, relationshipSide, relationshipSpend } = schema;
  await db.insert(relationship).values(
    relationships.map((entry) => ({
      id: entry.id,
      buyerOrgId: entry.buyer,
      supplierOrgId: entry.supplier,
      status: entry.status ?? 'active',
      endedAt: entry.status === 'ended' ? new Date() : null,
    })),
  );
  const sides = relationships.filter((entry) => entry.externalRef || entry.notes);
  if (sides.length > 0) {
    await db.insert(relationshipSide).values(
      sides.map((entry) => ({
        relationshipId: entry.id,
        orgId: entry.buyer,
        externalRef: entry.externalRef ?? null,
        notes: entry.notes ?? null,
      })),
    );
  }
  const spend = relationships.flatMap((entry) =>
    (entry.spend ?? []).map((value) => ({
      relationshipId: entry.id,
      year: value.year,
      amountCents: value.amountCents,
      currency: value.currency ?? 'EUR',
    })),
  );
  if (spend.length > 0) await db.insert(relationshipSpend).values(spend);
}

/** Löscht alle Beziehungen, an denen eine der Organisationen beteiligt ist, samt Seiten und Spend. */
export async function deleteRelationships(db: Database, orgIds: string[]) {
  const ids = sql`(select id from relationship where buyer_org_id in ${orgIds} or supplier_org_id in ${orgIds})`;
  await db.execute(sql`delete from relationship_spend where relationship_id in ${ids}`);
  await db.execute(sql`delete from relationship_side where relationship_id in ${ids}`);
  await db.execute(sql`delete from relationship_member where relationship_id in ${ids}`);
  await db.execute(
    sql`delete from relationship where buyer_org_id in ${orgIds} or supplier_org_id in ${orgIds}`,
  );
}
