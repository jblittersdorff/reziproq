import { sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { demoStory } from './demo-story.js';
import { seedBuyers, seedSupplierOrg } from './seed.js';

// pnpm demo:setup: Die lokalen Beispieldaten gehören danach deinen echten Konten statt erfundenen
// Personen. Nur für die Entwicklung; im Betrieb bricht der Befehl ab.

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DemoSetupResult {
  buyer: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  removedPeople: number;
  removedTestOrganizations: number;
  story: { created: boolean; relationships: string[] };
}

/** Testreste erkennt man am Namen: „Präfix 1a2b3c4d“ oder „test-präfix-1a2b3c4d“ aus Tests. */
const testOrgPattern = '[ -][0-9a-f]{8}$';

/** Das echte Konto einer Organisation: angemeldet über Zitadel, keine erfundene Person. */
async function realAccount(tx: Transaction, organizationId: string) {
  const result = await tx.execute<{ id: string; name: string }>(sql`
    select id, name from app_user
    where organization_id = ${organizationId} and id not like 'demo-%'
    order by last_login_at desc nulls last
    limit 1
  `);
  return result.rows[0] ?? null;
}

/** Hängt alles von erfundenen Personen einer Organisation auf das echte Konto um. */
async function takeOver(
  tx: Transaction,
  organizationId: string,
  account: { id: string; name: string },
) {
  const people = (
    await tx.execute<{ id: string; name: string }>(sql`
      select id, name from app_user where organization_id = ${organizationId} and id like 'demo-%'
    `)
  ).rows;
  const ids = people.map((person) => person.id);
  if (ids.length > 0) {
    // Fremdschlüssel auf app_user (außer dem Team, das unten neu gesetzt wird).
    await tx.execute(
      sql`update relationship_side set focus_set_by = ${account.id} where focus_set_by in ${ids}`,
    );
    await tx.execute(
      sql`update rating_assignment set rater_user_id = ${account.id} where rater_user_id in ${ids}`,
    );
    await tx.execute(
      sql`update segmentation_round set created_by = ${account.id} where created_by in ${ids}`,
    );
    await tx.execute(
      sql`update segment_decision set decided_by = ${account.id} where decided_by in ${ids}`,
    );
    await tx.execute(
      sql`update plan_objective set owner_user_id = ${account.id} where owner_user_id in ${ids}`,
    );
    await tx.execute(
      sql`update plan_contribution set assignee_user_id = ${account.id} where assignee_user_id in ${ids}`,
    );
    await tx.execute(
      sql`update invitation set invited_by = ${account.id} where invited_by in ${ids}`,
    );
    await tx.execute(
      sql`update invitation set accepted_user_id = ${account.id} where accepted_user_id in ${ids}`,
    );
    // ID und Name ohne Fremdschlüssel in geteilten Tabellen.
    await tx.execute(
      sql`update rule_set set created_by = ${account.id} where created_by in ${ids}`,
    );
    await tx.execute(sql`
      update rule_set set approved_by = ${account.id}, approved_by_name = ${account.name}
      where approved_by in ${ids}
    `);
    await tx.execute(sql`
      update relationship_target set shared_by = ${account.id}, shared_by_name = ${account.name}
      where shared_by in ${ids}
    `);
    // Abgeschlossene Termine sind gesperrt (QBR-01b, Trigger app_meeting_closed_unchanged); wer
    // sie angelegt hat, geht trotzdem auf das echte Konto über.
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.execute(sql`
      update meeting set created_by = ${account.id}, created_by_name = ${account.name}
      where created_by in ${ids}
    `);
    await tx.execute(sql`set local session_replication_role = origin`);
    // QBR-03, ZQ-01: verantwortliche Person und wer angelegt hat, bei Zusagen und Aufgaben
    for (const table of ['commitment', 'task'] as const) {
      await tx.execute(sql`
        update ${sql.identifier(table)} set owner_user_id = ${account.id}, owner_name = ${account.name}
        where owner_user_id in ${ids}
      `);
      await tx.execute(sql`
        update ${sql.identifier(table)} set created_by = ${account.id}, created_by_name = ${account.name}
        where created_by in ${ids}
      `);
    }
    // WG-01: Lead, Commodity Manager und Team der Warengruppen
    await tx.execute(
      sql`update material_group set lead_user_id = ${account.id} where lead_user_id in ${ids}`,
    );
    await tx.execute(sql`
      update material_group set commodity_manager_user_id = ${account.id}
      where commodity_manager_user_id in ${ids}
    `);
    await tx.execute(sql`
      update material_group_member m set user_id = ${account.id}
      where m.user_id in ${ids} and not exists (
        select 1 from material_group_member o
        where o.material_group_id = m.material_group_id and o.user_id = ${account.id} and o.role = m.role
      )
    `);
    await tx.execute(sql`delete from material_group_member where user_id in ${ids}`);
    await tx.execute(sql`delete from relationship_member where user_id in ${ids}`);
    await tx.execute(sql`delete from app_user where id in ${ids}`);
  }
  return ids.length;
}

/** Entfernt Organisationen, Beziehungen und Personen, die abgebrochene Testläufe hinterlassen haben. */
async function removeTestLeftovers(tx: Transaction) {
  const orgs = (
    await tx.execute<{ id: string }>(sql`
      select id from organization where name ~ ${testOrgPattern} and zitadel_org_id is null
    `)
  ).rows.map((row) => row.id);
  if (orgs.length === 0) return 0;
  const relationships = (
    await tx.execute<{ id: string }>(sql`
      select id from relationship where buyer_org_id in ${orgs} or supplier_org_id in ${orgs}
    `)
  ).rows.map((row) => row.id);
  // Ohne Trigger und Fremdschlüsselprüfung, damit die Reihenfolge der Tabellen keine Rolle spielt;
  // jede Tabelle mit Bezug auf diese Organisationen oder Beziehungen wird geleert.
  await tx.execute(sql`set local session_replication_role = replica`);
  const columns = (
    await tx.execute<{ table_name: string; column_name: string }>(sql`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public'
        and column_name in ('org_id', 'owner_org_id', 'organization_id', 'buyer_org_id',
                            'supplier_org_id', 'relationship_id')
        and table_name not in ('organization', 'relationship')
    `)
  ).rows;
  for (const { table_name, column_name } of columns) {
    const values = column_name === 'relationship_id' ? relationships : orgs;
    if (values.length === 0) continue;
    await tx.execute(
      sql`delete from ${sql.identifier(table_name)} where ${sql.identifier(column_name)} in ${values}`,
    );
  }
  if (relationships.length > 0) {
    await tx.execute(sql`delete from relationship where id in ${relationships}`);
  }
  await tx.execute(sql`delete from organization_feature where organization_id in ${orgs}`);
  await tx.execute(sql`delete from organization where id in ${orgs}`);
  // Personen ohne Organisation aus Tests (z. B. test-<uuid>, p05-operator-1a2b3c4d).
  await tx.execute(sql`
    delete from app_user
    where organization_id is null and (id like 'test-%' or id ~ '-[0-9a-f]{8}$')
  `);
  await tx.execute(sql`set local session_replication_role = origin`);
  return orgs.length;
}

/**
 * Richtet die lokalen Beispieldaten auf die echten Konten ein: Käufer mit allen Rechten (Admin,
 * Controlling, SRO in jeder Beziehung), Lieferant als Admin und Key Account Manager. Erfundene
 * Personen von Test-OEM und Test-Lieferant verschwinden, ihre Daten gehören danach den Konten.
 */
export async function demoSetup(
  db: Database,
  nodeEnv: string | undefined,
): Promise<DemoSetupResult> {
  if (nodeEnv === 'production') {
    throw new Error('demo:setup ist nur für die lokale Entwicklung und bricht im Betrieb ab.');
  }
  return db.transaction(async (tx) => {
    const removedTestOrganizations = await removeTestLeftovers(tx);
    const buyer = await realAccount(tx, seedBuyers.testOem.id);
    const supplier = await realAccount(tx, seedSupplierOrg.id);
    let removedPeople = 0;

    if (buyer) {
      removedPeople += await takeOver(tx, seedBuyers.testOem.id, buyer);
      await tx.execute(sql`
        update app_user set org_role = 'admin', is_controlling = true,
          default_function = 'purchasing', roles_imported_at = coalesce(roles_imported_at, now())
        where id = ${buyer.id}
      `);
      // SRO in jeder Beziehung des Test-OEM, damit jede Funktion erreichbar ist.
      await tx.execute(sql`
        insert into relationship_member (relationship_id, org_id, user_id, team_role, function)
        select r.id, r.buyer_org_id, ${buyer.id}, 'sro', 'purchasing'
        from relationship r where r.buyer_org_id = ${seedBuyers.testOem.id}
        on conflict (relationship_id, org_id, user_id) do update set team_role = 'sro'
      `);
    }
    if (supplier) {
      removedPeople += await takeOver(tx, seedSupplierOrg.id, supplier);
      await tx.execute(sql`
        update app_user set org_role = 'admin',
          roles_imported_at = coalesce(roles_imported_at, now())
        where id = ${supplier.id}
      `);
      // Key Account Manager (sro der Lieferantenseite) bei jedem aktiven Kunden.
      await tx.execute(sql`
        insert into relationship_member (relationship_id, org_id, user_id, team_role)
        select r.id, r.supplier_org_id, ${supplier.id}, 'sro'
        from relationship r where r.supplier_org_id = ${seedSupplierOrg.id}
        on conflict (relationship_id, org_id, user_id) do update set team_role = 'sro'
      `);
    }
    // Erfundene Personen des Zweit-OEM: Der Zweit-OEM bleibt als zweiter Kunde des Lieferanten,
    // braucht aber niemanden, der sich anmeldet. Was noch auf sie zeigt, verliert den Bezug.
    const zweit = (
      await tx.execute<{ id: string }>(sql`
        select id from app_user where organization_id = ${seedBuyers.zweitOem.id} and id like 'demo-%'
      `)
    ).rows.map((row) => row.id);
    if (zweit.length > 0) {
      await tx.execute(
        sql`update relationship_side set focus_set_by = null where focus_set_by in ${zweit}`,
      );
      await tx.execute(sql`delete from relationship_member where user_id in ${zweit}`);
      await tx.execute(sql`delete from app_user where id in ${zweit}`);
      removedPeople += zweit.length;
    }
    // Eine zusammenhängende Geschichte, damit jede Seite Inhalt hat (einmalig)
    const story = buyer ? await demoStory(tx, buyer) : { created: false, relationships: [] };
    return { buyer, supplier, removedPeople, removedTestOrganizations, story };
  });
}
