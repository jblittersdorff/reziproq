import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedBuyers, seedSupplierOrg } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// Tests zu docs/specs/PLT-06.md direkt in der Datenbank: Business Units, Warengruppen, Zuordnung.

const testOem = seedBuyers.testOem.id;
const zweitOem = seedBuyers.zweitOem.id;
const id = (n: number) => `de300000-0000-7000-8000-${String(n).padStart(12, '0')}`;
// Rheintal Elektronik beim Test-OEM; Haupt-Warengruppe Elektronik (601), BUs Pkw und Ersatzteile
const rheintal = id(201);

describe('PLT-06: Business Units und Warengruppen in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  /** Als Person einer Organisation in der Mandanten-Session; Fehler kommen als Wert zurück. */
  const as = (organizationId: string, statement: ReturnType<typeof sql>) =>
    withTenant(temp.db, { userId: 'demo-test-oem-1', organizationId }, (tx) =>
      tx.execute(statement),
    ).catch((caught: unknown) => caught as Error);
  const failure = (result: unknown) => String((result as Error).cause ?? result);

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'seeded' });
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('Beispieldaten: drei BUs und sechs Warengruppen in zwei Ebenen, jeder Demo-Lieferant zugeordnet mit genau einer Haupt-Warengruppe', async () => {
    const counts = await temp.db.execute<{ units: number; groups: number; children: number }>(sql`
      select
        (select count(*)::int from business_unit where org_id = ${testOem}) as units,
        (select count(*)::int from material_group where org_id = ${testOem}) as groups,
        (select count(*)::int from material_group where org_id = ${testOem} and parent_id is not null) as children
    `);
    expect(counts.rows[0]).toEqual({ units: 3, groups: 6, children: 2 });
    const unassigned = await temp.db.execute(sql`
      select r.id from relationship r where r.buyer_org_id = ${testOem} and (
        not exists (select 1 from relationship_business_unit b where b.relationship_id = r.id)
        or (select count(*) from relationship_material_group g
            where g.relationship_id = r.id and g.is_primary) <> 1
      )
    `);
    expect(unassigned.rows).toEqual([]);
    // Der Zweit-OEM hat eigene, andere Werte.
    const zweit = await temp.db.execute<{ code: string }>(
      sql`select code from business_unit where org_id = ${zweitOem} order by code`,
    );
    expect(zweit.rows.map((row) => row.code)).toEqual(['BM', 'LT']);
  });

  it('Codes sind je Organisation eindeutig. Mehr als zwei Ebenen werden abgelehnt.', async () => {
    const duplicate = await as(
      testOem,
      sql`insert into business_unit (org_id, name, code) values (${testOem}, 'Doppelt', 'pkw')`,
    );
    expect(failure(duplicate)).toMatch(/business_unit_code/);
    // Derselbe Code bei einer anderen Organisation ist erlaubt.
    expect(
      await as(
        zweitOem,
        sql`insert into business_unit (org_id, name, code) values (${zweitOem}, 'Pkw', 'PKW')`,
      ),
    ).not.toBeInstanceOf(Error);

    // Dritte Ebene: Untergruppe unter Sensorik (selbst schon Ebene zwei).
    const third = await as(
      testOem,
      sql`insert into material_group (org_id, name, code, parent_id) values (${testOem}, 'Drucksensoren', 'EL-SE-DR', ${id(602)})`,
    );
    expect(failure(third)).toMatch(/too_deep/);
    // Eine Oberebene mit Untergruppen bekommt selbst keine Oberebene.
    const moved = await as(
      testOem,
      sql`update material_group set parent_id = ${id(604)} where id = ${id(601)}`,
    );
    expect(failure(moved)).toMatch(/too_deep/);
    // Die Oberebene einer anderen Organisation ist nicht wählbar.
    const foreignParent = await as(
      zweitOem,
      sql`insert into material_group (org_id, name, code, parent_id) values (${zweitOem}, 'X', 'X', ${id(601)})`,
    );
    expect(failure(foreignParent)).toMatch(/foreign_entry/);
  });

  it('Mehrere BUs und Warengruppen je Lieferant, genau eine Haupt-Warengruppe', async () => {
    const units = await as(
      testOem,
      sql`select business_unit_id from relationship_business_unit where relationship_id = ${rheintal}`,
    );
    expect((units as { rows: unknown[] }).rows).toHaveLength(2);
    // Eine zweite Haupt-Warengruppe scheitert.
    const second = await as(
      testOem,
      sql`insert into relationship_material_group (relationship_id, material_group_id, is_primary) values (${rheintal}, ${id(603)}, true)`,
    );
    expect(failure(second)).toMatch(/relationship_material_group_primary/);
    // Keine Haupt-Warengruppe scheitert am Ende der Transaktion.
    const none = await as(
      testOem,
      sql`update relationship_material_group set is_primary = false where relationship_id = ${rheintal}`,
    );
    expect(failure(none)).toMatch(/primary_required/);
    // Wechsel der Haupt-Warengruppe in einer Transaktion geht.
    const swapped = await withTenant(
      temp.db,
      { userId: 'demo-test-oem-1', organizationId: testOem },
      async (tx) => {
        await tx.execute(
          sql`update relationship_material_group set is_primary = false where relationship_id = ${rheintal}`,
        );
        await tx.execute(
          sql`insert into relationship_material_group (relationship_id, material_group_id, is_primary) values (${rheintal}, ${id(603)}, true)`,
        );
        return 'ok';
      },
    );
    expect(swapped).toBe('ok');
  });

  it('Deaktivierte Einträge sind für neue Zuordnungen nicht wählbar. Bestehende bleiben sichtbar.', async () => {
    await as(testOem, sql`update business_unit set active = false where id = ${id(503)}`);
    const added = await as(
      testOem,
      sql`insert into relationship_business_unit (relationship_id, business_unit_id) values (${id(202)}, ${id(503)})`,
    );
    expect(failure(added)).toMatch(/inactive/);
    // Rheintal behält die deaktivierte BU Ersatzteile.
    const kept = await as(
      testOem,
      sql`select 1 from relationship_business_unit where relationship_id = ${rheintal} and business_unit_id = ${id(503)}`,
    );
    expect((kept as { rows: unknown[] }).rows).toHaveLength(1);
    await as(testOem, sql`update business_unit set active = true where id = ${id(503)}`);
  });

  it('Ein benutzter Eintrag lässt sich nicht löschen', async () => {
    const unit = await as(testOem, sql`delete from business_unit where id = ${id(501)}`);
    expect(failure(unit)).toMatch(/foreign key|violates/);
    const group = await as(testOem, sql`delete from material_group where id = ${id(604)}`);
    expect(failure(group)).toMatch(/foreign key|violates/);
    // Eine Oberebene mit Untergruppen ist ebenfalls benutzt.
    const parent = await as(testOem, sql`delete from material_group where id = ${id(601)}`);
    expect(failure(parent)).toMatch(/foreign key|violates/);
    // Unbenutzte lassen sich löschen.
    await as(
      testOem,
      sql`insert into business_unit (id, org_id, name, code) values (${id(599)}, ${testOem}, 'Tippfehler', 'TPF')`,
    );
    expect(
      await as(testOem, sql`delete from business_unit where id = ${id(599)}`),
    ).not.toBeInstanceOf(Error);
  });

  it('Nur eigene BUs und Warengruppen sind zuordenbar', async () => {
    const foreign = await as(
      testOem,
      sql`insert into relationship_business_unit (relationship_id, business_unit_id) values (${rheintal}, ${id(511)})`,
    );
    expect(failure(foreign)).toMatch(/foreign_entry/);
  });

  it('Der Zweit-OEM und der Test-Lieferant sehen keine BU und keine Warengruppe des Test-OEM (PLT-04)', async () => {
    const testOemRelationships = new Set(
      (
        await temp.db.execute<{ id: string }>(
          sql`select id from relationship where buyer_org_id = ${testOem}`,
        )
      ).rows.map((row) => row.id),
    );
    for (const viewer of [zweitOem, seedSupplierOrg.id]) {
      for (const table of [
        'business_unit',
        'material_group',
        'relationship_business_unit',
        'relationship_material_group',
      ]) {
        const seen = await withTenant(
          temp.db,
          { userId: 'probe', organizationId: viewer, customerOrganizationId: testOem },
          async (tx) =>
            (await tx.execute(sql`select * from ${sql.identifier(table)}`)).rows as {
              org_id?: string;
              relationship_id?: string;
            }[],
        );
        const ofTestOem = seen.filter(
          (row) => row.org_id === testOem || testOemRelationships.has(row.relationship_id ?? ''),
        );
        expect(ofTestOem, `${viewer} in ${table}`).toEqual([]);
      }
    }
    // Der Test-Lieferant sieht überhaupt keine Zuordnung, auch nicht die des Zweit-OEM.
    const supplierView = await withTenant(
      temp.db,
      { userId: 'probe', organizationId: seedSupplierOrg.id, customerOrganizationId: zweitOem },
      async (tx) => (await tx.execute(sql`select * from relationship_business_unit`)).rows,
    );
    expect(supplierView).toEqual([]);
  });
});
