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
  await db.execute(sql`delete from comment_mention where relationship_id in ${ids}`);
  await db.execute(sql`delete from comment where relationship_id in ${ids}`);
  // ZQ-01 (K2-a): Zusagen hängen an der Beziehung und gehen nicht mehr mit dem Plan (E-K0-16)
  await db.execute(sql`delete from commitment where relationship_id in ${ids}`);
  await db.execute(sql`delete from task where relationship_id in ${ids}`);
  await db.execute(sql`delete from relationship_target where relationship_id in ${ids}`);
  await db.execute(sql`delete from rule_set_note where relationship_id in ${ids}`);
  await db.execute(sql`delete from rule_set_item where relationship_id in ${ids}`);
  await db.execute(sql`delete from rule_set where relationship_id in ${ids}`);
  await db.execute(sql`delete from invitation where relationship_id in ${ids}`);
  await db.execute(sql`delete from survey_participant where relationship_id in ${ids}`);
  await db.execute(sql`delete from survey_wave where relationship_id in ${ids}`);
  await db.execute(sql`delete from segment_decision where relationship_id in ${ids}`);
  await db.execute(
    sql`delete from material_group_supplier_map_row where relationship_id in ${ids}`,
  );
  await db.execute(sql`delete from material_group_award_supplier where relationship_id in ${ids}`);
  await db.execute(sql`delete from material_group_conflict where relationship_id in ${ids}`);
  await db.execute(sql`delete from rating where relationship_id in ${ids}`);
  await db.execute(sql`delete from rating_assignment where relationship_id in ${ids}`);
  await db.execute(sql`delete from segmentation_round where org_id in ${orgIds}`);
  await db.execute(sql`delete from relationship_spend where relationship_id in ${ids}`);
  await db.execute(sql`delete from relationship_side where relationship_id in ${ids}`);
  await db.execute(sql`delete from relationship_member where relationship_id in ${ids}`);
  await db.execute(sql`delete from relationship_business_unit where relationship_id in ${ids}`);
  await db.execute(sql`delete from relationship_material_group where relationship_id in ${ids}`);
  await db.execute(sql`delete from cycle where relationship_id in ${ids}`);
  await db.execute(
    sql`delete from relationship where buyer_org_id in ${orgIds} or supplier_org_id in ${orgIds}`,
  );
  // Business Units und Warengruppen der Organisationen (PLT-06), Untergruppen zuerst.
  // WG-01: Team und Produktgruppen hängen an Warengruppe und Business Unit.
  // WG-10: Paarungen und Hebelkatalog der Organisationen (Startbestand kommt beim ersten Aufruf)
  await db.execute(sql`delete from material_group_lever_choice where org_id in ${orgIds}`);
  await db.execute(sql`delete from lever where org_id in ${orgIds}`);
  await db.execute(sql`delete from material_group_member where org_id in ${orgIds}`);
  await db.execute(sql`delete from material_group_product_group where org_id in ${orgIds}`);
  await db.execute(sql`delete from business_unit where org_id in ${orgIds}`);
  await db.execute(
    sql`delete from material_group where org_id in ${orgIds} and parent_id is not null`,
  );
  await db.execute(sql`delete from material_group where org_id in ${orgIds}`);
}
