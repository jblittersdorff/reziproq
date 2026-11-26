import { randomUUID } from 'node:crypto';
import { type SQL, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './client.js';
import {
  checkLayers,
  generatedLayerTables,
  type LayerEntry,
  type LayerKind,
  layerRegister,
} from './layers.js';
import { seedBuyers, seedSupplierOrg } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// Tests zu docs/specs/PLT-04.md gegen eine echte PostgreSQL-Datenbank.
//
// Test-Gerüst: Für jede Tabelle, deren Policies aus app_apply_layer stammen, laufen dieselben
// Prüfungen. Vor PLT-03 gibt es noch keine solche Fachtabelle; deshalb legt der Test je Art eine
// Probe-Tabelle an, ebenfalls nur über app_apply_layer. Neue Tabellen im Register kommen ohne
// zusätzlichen Testcode dazu.

const testOem = seedBuyers.testOem.id;
const zweitOem = seedBuyers.zweitOem.id;
const supplier = seedSupplierOrg.id;
/** Je Organisation eine Person aus den Beispieldaten (WG-01: Team je Warengruppe) */
const orgUsers: Record<string, string> = {
  [testOem]: 'demo-test-oem-1',
  [zweitOem]: 'demo-zweit-oem-1',
  [supplier]: 'demo-test-lieferant-1',
};

/** Test-OEM und Zweit-OEM haben beide eine Beziehung zum Test-Lieferanten. */
const relationships = {
  a: { id: randomUUID(), buyer: testOem, supplier },
  b: { id: randomUUID(), buyer: zweitOem, supplier },
};
type RelationshipKey = keyof typeof relationships;
const ended = new Set<RelationshipKey>();

const probes: Record<string, { kind: LayerKind; columns: string }> = {
  probe_buyer_private: { kind: 'buyer_private', columns: 'relationship_id uuid not null' },
  probe_supplier_private: { kind: 'supplier_private', columns: 'relationship_id uuid not null' },
  probe_org_private: { kind: 'org_private', columns: 'org_id uuid not null, relationship_id uuid' },
  probe_shared: {
    kind: 'shared',
    columns: 'relationship_id uuid not null, owner_org_id uuid not null, visibility text not null',
  },
};

const register: Record<string, LayerEntry> = {
  ...layerRegister,
  ...Object.fromEntries(Object.entries(probes).map(([table, { kind }]) => [table, { kind }])),
};
const tables = generatedLayerTables(register);

/** Was eine Testzeile ist: zu welcher Beziehung sie gehört, wem und wie sichtbar. */
interface RowMeta {
  table: string;
  kind: LayerKind;
  relationship: RelationshipKey | null;
  org?: string;
  owner?: string;
  visibility?: 'internal' | 'shared';
}

interface Viewer {
  name: string;
  org: string;
  customer: string | null;
}

const viewers: Viewer[] = [
  { name: 'Test-OEM', org: testOem, customer: null },
  { name: 'Zweit-OEM', org: zweitOem, customer: null },
  { name: 'Test-Lieferant ohne Kunde', org: supplier, customer: null },
  { name: 'Test-Lieferant bei Test-OEM', org: supplier, customer: testOem },
  { name: 'Test-Lieferant bei Zweit-OEM', org: supplier, customer: zweitOem },
];
const viewer = (name: string) => viewers.find((candidate) => candidate.name === name) as Viewer;

/** Die Seite, auf der der Betrachter in dieser Beziehung steht, oder null. */
function side(who: Viewer, key: RelationshipKey): 'buyer' | 'supplier' | null {
  const relationship = relationships[key];
  if (who.org === relationship.buyer) return 'buyer';
  if (who.org === relationship.supplier && who.customer === relationship.buyer) return 'supplier';
  return null;
}

/** Lieferantennutzer nur im Kontext ihres Kunden. */
function customerOk(who: Viewer, key: RelationshipKey) {
  const relationship = relationships[key];
  return !(who.org === relationship.supplier && who.customer !== relationship.buyer);
}

/** Die Regeln aus PLT-04 als Modell: Darf dieser Betrachter diese Zeile sehen? */
function mayRead(who: Viewer, row: RowMeta): boolean {
  const key = row.relationship;
  switch (row.kind) {
    case 'buyer_private':
      return key !== null && side(who, key) === 'buyer';
    case 'supplier_private':
      return key !== null && side(who, key) === 'supplier';
    case 'org_private':
      return row.org === who.org && (key === null || customerOk(who, key));
    case 'shared':
      if (key === null || !customerOk(who, key)) return false;
      if (row.owner === who.org) return true;
      return row.visibility === 'shared' && side(who, key) !== null && !ended.has(key);
    default:
      return false;
  }
}

/** Tabellen, in denen relationship_id Pflicht ist; dort gibt es keine Zeilen ohne Beziehung. */
const relationshipRequired = new Set<string>();
/** Tabellen ohne relationship_id (z. B. Stammdaten je Organisation, PLT-06): nur Zeilen ohne Beziehung. */
const withoutRelationship = new Set<string>();

/** Die Zeilen, die das Gerüst je Art anlegt: von jeder Seite, freigegeben und nicht. */
function rowsFor(kind: LayerKind, table: string): Omit<RowMeta, 'table' | 'kind'>[] {
  const keys = Object.keys(relationships) as RelationshipKey[];
  switch (kind) {
    case 'buyer_private':
    case 'supplier_private':
      return keys.map((relationship) => ({ relationship }));
    case 'org_private':
      return [testOem, zweitOem, supplier].flatMap((org) => [
        ...(relationshipRequired.has(table) ? [] : [{ relationship: null, org }]),
        ...(withoutRelationship.has(table) ? [] : keys)
          .filter((key) => [relationships[key].buyer, relationships[key].supplier].includes(org))
          .map((relationship) => ({ relationship, org })),
      ]);
    case 'shared':
      return keys.flatMap((relationship) =>
        [relationships[relationship].buyer, relationships[relationship].supplier].flatMap((owner) =>
          (['internal', 'shared'] as const).map((visibility) => ({
            relationship,
            owner,
            visibility,
          })),
        ),
      );
    default:
      return [];
  }
}

/** Spaltenwerte einer Zeile: Testwerte aus dem Register plus die Ebenen-Spalten. */
function columnsOf(
  table: string,
  entry: LayerEntry,
  row: Omit<RowMeta, 'table' | 'kind'>,
  id: string,
  probe: (table: string, org: string) => string,
) {
  const testValues =
    typeof entry.testValues === 'function'
      ? entry.testValues({
          buyer: row.relationship === null ? null : relationships[row.relationship].buyer,
          probe,
          visibility: row.visibility,
          org: row.org,
          orgUser: row.org ? orgUsers[row.org] : undefined,
        })
      : entry.testValues;
  const values: Record<string, unknown> = { ...testValues, id };
  if (row.relationship !== null) values.relationship_id = relationships[row.relationship].id;
  else if (entry.kind === 'org_private' && !withoutRelationship.has(table)) {
    values.relationship_id = null;
  }
  if (row.org) values.org_id = row.org;
  if (row.owner) values.owner_org_id = row.owner;
  if (row.visibility) values.visibility = row.visibility;
  return values;
}

function insertSql(table: string, values: Record<string, unknown>): SQL {
  const columns = Object.keys(values);
  return sql`insert into ${sql.identifier(table)} (${sql.join(
    columns.map((column) => sql.identifier(column)),
    sql`, `,
  )}) values (${sql.join(
    columns.map((column) => sql`${values[column]}`),
    sql`, `,
  )})`;
}

describe('PLT-04: Drei Datenebenen', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  const rows = new Map<string, RowMeta>();

  // NAV-10: als Person der eigenen Organisation, damit „anlegen nur als man selbst“ (note) greift
  const session = (who: Viewer) => ({
    userId: (who.org && orgUsers[who.org]) || 'test-nutzer',
    organizationId: who.org,
    customerOrganizationId: who.customer,
  });

  /** Alle Zeilen-IDs, die der Betrachter in einer Tabelle sieht. */
  const visible = (who: Viewer, table: string) =>
    withTenant(temp.db, session(who), async (tx) => {
      const result = await tx.execute<{ id: string }>(
        sql`select id::text from ${sql.identifier(table)}`,
      );
      return result.rows.map((row) => row.id).sort();
    });

  const expected = (who: Viewer, table: string) =>
    [...rows.entries()]
      .filter(([, meta]) => meta.table === table && mayRead(who, meta))
      .map(([id]) => id)
      .sort();

  const metaOf = (ids: string[]) => ids.map((id) => rows.get(id) as RowMeta);

  /** ID der Gerüst-Zeile ohne Beziehung, die eine Organisation in einer Tabelle hat. */
  const probe = (table: string, org: string) => {
    const inTable = [...rows.entries()].filter(
      ([, meta]) =>
        meta.table === table &&
        (meta.org === org || (meta.relationship && relationships[meta.relationship].buyer === org)),
    );
    // Tabellen mit Beziehung haben keine Zeile ohne Beziehung; dann genügt irgendeine des Käufers.
    const found = inTable.find(([, meta]) => meta.relationship === null) ?? inTable[0];
    if (!found) throw new Error(`Keine Probe-Zeile in ${table} für ${org}`);
    return found[0];
  };

  const setEnded = async (key: RelationshipKey, value: boolean) => {
    await temp.db.execute(
      sql`update relationship set status = ${value ? 'ended' : 'active'} where id = ${relationships[key].id}`,
    );
    if (value) ended.add(key);
    else ended.delete(key);
  };

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'seeded' });
    // Nur die Beziehungen des Gerüsts, damit jede sichtbare Zeile aus dem Gerüst stammt.
    await temp.db.execute(sql`delete from segment_decision`);
    await temp.db.execute(sql`delete from rating`);
    await temp.db.execute(sql`delete from rating_assignment`);
    await temp.db.execute(sql`delete from segmentation_round`);
    await temp.db.execute(sql`delete from segment_model`);
    await temp.db.execute(sql`delete from relationship_target`);
    await temp.db.execute(sql`delete from rule_set_note`);
    // Termine aus den Beispieldaten (QBR-01); die Kaskade nimmt Agenda, Beschlüsse und Stand mit.
    await temp.db.execute(sql`delete from jbp`);
    // ZQ-01 (K2-a.3): Zusagen hängen an der Beziehung (nicht mehr am Plan), Aufgaben an der Seite
    await temp.db.execute(sql`delete from commitment_private_source`);
    await temp.db.execute(sql`delete from commitment`);
    await temp.db.execute(sql`delete from task`);
    await temp.db.execute(sql`delete from meeting_note`);
    await temp.db.execute(sql`delete from meeting`);
    await temp.db.execute(sql`delete from rule_set_item`);
    await temp.db.execute(sql`delete from rule_set`);
    await temp.db.execute(sql`delete from invitation`);
    await temp.db.execute(sql`delete from relationship_spend`);
    await temp.db.execute(sql`delete from relationship_side`);
    await temp.db.execute(sql`delete from relationship_member`);
    await temp.db.execute(sql`delete from relationship_business_unit`);
    await temp.db.execute(sql`delete from relationship_material_group`);
    await temp.db.execute(sql`delete from cycle`);
    await temp.db.execute(sql`delete from rule_catalog_item`);
    await temp.db.execute(sql`delete from format_catalog_item`);
    await temp.db.execute(sql`delete from catalog_setup`);
    await temp.db.execute(sql`delete from business_unit`);
    await temp.db.execute(sql`delete from material_group_strategy`);
    await temp.db.execute(sql`delete from material_group_member`);
    await temp.db.execute(sql`delete from material_group_product_group`);
    await temp.db.execute(sql`delete from material_group where parent_id is not null`);
    await temp.db.execute(sql`delete from material_group`);
    await temp.db.execute(sql`delete from relationship`);
    for (const relationship of Object.values(relationships)) {
      await temp.db.execute(sql`
        insert into relationship (id, buyer_org_id, supplier_org_id, status)
        values (${relationship.id}, ${relationship.buyer}, ${relationship.supplier}, 'active')
      `);
    }
    // Probe-Tabellen nur über die Hilfsfunktion, wie jede neue Fachtabelle.
    for (const [table, probe] of Object.entries(probes)) {
      await temp.db.execute(
        sql.raw(`create table ${table} (id uuid primary key, ${probe.columns})`),
      );
      await temp.db.execute(sql`select app_apply_layer(${table}::regclass, ${probe.kind})`);
    }
    const required = await temp.db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'relationship_id' and is_nullable = 'NO'
    `);
    for (const row of required.rows) relationshipRequired.add(row.table_name);
    const missing = await temp.db.execute<{ table_name: string }>(sql`
      select t.table_name from information_schema.tables t
      where t.table_schema = 'public' and not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.table_name
          and c.column_name = 'relationship_id'
      )
    `);
    for (const row of missing.rows) withoutRelationship.add(row.table_name);
    for (const entry of tables) {
      for (const row of rowsFor(entry.kind, entry.table)) {
        const id = randomUUID();
        await temp.db.execute(
          insertSql(entry.table, columnsOf(entry.table, entry, row, id, probe)),
        );
        rows.set(id, { table: entry.table, kind: entry.kind, ...row });
      }
    }
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('das Gerüst prüft jede Art mit Policies aus der Hilfsfunktion', () => {
    expect(new Set(tables.map((entry) => entry.kind))).toEqual(
      new Set(['buyer_private', 'supplier_private', 'org_private', 'shared']),
    );
  });

  // AK-01 T2-S01 (K2-a.4): Der Raum einer Zeile ist keine Spalte, sondern abgeleitet (ZA-01,
  // E-K0-03): app_row_space aus Ebene, Beziehung, besitzender Organisation und Sichtbarkeit.
  // Geprüft wird jede Zeile, die eine Abfrage der Käuferseite in irgendeiner Tabelle liefert.
  it('T2-S01: Keine Abfrage der Käuferseite liefert Zeilen mit space = supplier_private', async () => {
    const spaces = new Map<string, string | null>();
    const spaceOf = async (meta: RowMeta) => {
      const relationshipId = meta.relationship ? relationships[meta.relationship].id : null;
      const owner = meta.owner ?? meta.org ?? null;
      const key = [meta.kind, relationshipId, owner, meta.visibility].join('|');
      if (!spaces.has(key)) {
        const result = await withTenant(temp.db, session(viewer('Test-OEM')), (tx) =>
          tx.execute<{ space: string | null }>(sql`
            select app_row_space(${meta.kind}, ${relationshipId}::uuid, ${owner}::uuid,
              ${meta.visibility ?? null}) as space`),
        );
        spaces.set(key, result.rows[0]?.space ?? null);
      }
      return spaces.get(key);
    };
    const supplierPrivate = new Set<string>();
    for (const [id, meta] of rows) {
      if ((await spaceOf(meta)) === 'supplier_private') supplierPrivate.add(id);
    }
    const offenders: string[] = [];
    for (const { table } of tables) {
      for (const who of [viewer('Test-OEM'), viewer('Zweit-OEM')]) {
        for (const id of await visible(who, table)) {
          if (supplierPrivate.has(id)) offenders.push(`${table} (${who.name})`);
        }
      }
    }
    expect(offenders).toEqual([]);
    // Gegenprobe: Lieferantenprivate Zeilen gibt es in vielen Tabellen, sonst prüfte der Test nichts
    const tablesWith = new Set([...supplierPrivate].map((id) => rows.get(id)?.table));
    expect(tablesWith.size).toBeGreaterThan(20);
  });

  describe.each(tables)('$table ($kind)', ({ table, kind }) => {
    it.each(viewers)('$name sieht genau, was die Regeln erlauben', async (who) => {
      expect(await visible(who, table)).toEqual(expected(who, table));
    });

    it('Ein Lieferantennutzer sieht von geteilten Tabellen nur freigegebene Zeilen aktiver Beziehungen und nichts aus käuferprivaten Tabellen', async () => {
      for (const who of [
        viewer('Test-Lieferant bei Test-OEM'),
        viewer('Test-Lieferant bei Zweit-OEM'),
      ]) {
        for (const meta of metaOf(await visible(who, table))) {
          expect(meta.kind).not.toBe('buyer_private');
          if (kind === 'shared' && meta.owner !== supplier) {
            expect(meta.visibility).toBe('shared');
            expect(meta.relationship && ended.has(meta.relationship)).toBeFalsy();
          }
        }
      }
      if (kind === 'buyer_private') {
        expect(await visible(viewer('Test-Lieferant bei Test-OEM'), table)).toEqual([]);
      }
    });

    it('Ein Nutzer des Zweit-OEM sieht beim selben Test-Lieferanten nichts vom Test-OEM, in keiner Ebene. Umgekehrt genauso.', async () => {
      const zweit = metaOf(await visible(viewer('Zweit-OEM'), table));
      expect(zweit.filter((meta) => meta.relationship === 'a' || meta.org === testOem)).toEqual([]);
      const test = metaOf(await visible(viewer('Test-OEM'), table));
      expect(test.filter((meta) => meta.relationship === 'b' || meta.org === zweitOem)).toEqual([]);
    });

    it('Der Käufer sieht nichts aus lieferantenprivaten Tabellen', async () => {
      for (const who of [viewer('Test-OEM'), viewer('Zweit-OEM')]) {
        const seen = metaOf(await visible(who, table));
        expect(seen.filter((meta) => meta.kind === 'supplier_private')).toEqual([]);
        expect(
          seen.filter(
            (meta) =>
              meta.org === supplier || (meta.owner === supplier && meta.visibility === 'internal'),
          ),
        ).toEqual([]);
      }
    });

    it('Nach dem Beenden einer Beziehung sieht die andere Seite ihre freigegebenen Zeilen nicht mehr', async () => {
      const buyerView = viewer('Test-OEM');
      const supplierView = viewer('Test-Lieferant bei Test-OEM');
      const before = metaOf(await visible(supplierView, table));
      await setEnded('a', true);
      try {
        for (const who of [buyerView, supplierView]) {
          const seen = metaOf(await visible(who, table));
          expect(await visible(who, table)).toEqual(expected(who, table));
          // Geteilte Zeilen der anderen Seite sind weg, die eigenen bleiben.
          expect(
            seen.filter(
              (meta) =>
                meta.kind === 'shared' && meta.relationship === 'a' && meta.owner !== who.org,
            ),
          ).toEqual([]);
        }
        if (kind === 'shared') {
          expect(before.some((meta) => meta.owner === testOem)).toBe(true);
          expect(
            metaOf(await visible(supplierView, table)).some((meta) => meta.owner === supplier),
          ).toBe(true);
        }
      } finally {
        await setEnded('a', false);
      }
    });

    it('Ein Lieferantennutzer mit gesetztem app.customer_org_id sieht nur Zeilen dieses Kunden', async () => {
      for (const [who, key] of [
        [viewer('Test-Lieferant bei Test-OEM'), 'a'],
        [viewer('Test-Lieferant bei Zweit-OEM'), 'b'],
      ] as const) {
        const seen = metaOf(await visible(who, table));
        expect(
          seen.filter((meta) => meta.relationship !== null && meta.relationship !== key),
        ).toEqual([]);
      }
      // Ohne gewählten Kunden: nichts Beziehungsbezogenes.
      const without = metaOf(await visible(viewer('Test-Lieferant ohne Kunde'), table));
      expect(without.filter((meta) => meta.relationship !== null)).toEqual([]);
    });

    it('Schreiben in eine fremde Zeile (anlegen, ändern, löschen) scheitert genauso wie Lesen', async () => {
      const entry = register[table] as LayerEntry;
      for (const who of viewers) {
        // Nur anfügen: Ändern und Löschen scheitern für jeden, auch für eigene Zeilen.
        if (entry.appendOnly || entry.computed) {
          for (const statement of [
            sql`update ${sql.identifier(table)} set id = id`,
            sql`delete from ${sql.identifier(table)}`,
          ]) {
            const outcome = await withTenant(temp.db, session(who), (tx) => tx.execute(statement))
              .then(() => 'erlaubt')
              .catch(() => 'abgelehnt');
            expect(outcome, `${who.name} ändert oder löscht in ${table}`).toBe('abgelehnt');
          }
        }
        // Ändern und Löschen treffen nur Zeilen, die der Betrachter auch schreiben darf.
        const touched =
          entry.appendOnly || entry.computed
            ? []
            : await withTenant(temp.db, session(who), async (tx) => {
                const updated = await tx.execute<{ id: string }>(
                  sql`update ${sql.identifier(table)} set id = id returning id::text`,
                );
                // Zeilen, auf die noch ein Fremdschlüssel zeigt (z. B. eine zugeordnete BU,
                // PLT-06), lassen sich nicht löschen; dann löscht der Betrachter dort nichts.
                const deleted = await tx
                  .transaction((inner) =>
                    inner.execute<{ id: string }>(
                      sql`delete from ${sql.identifier(table)} returning id::text`,
                    ),
                  )
                  .catch((error: unknown) => {
                    if ((error as { cause?: { code?: string } }).cause?.code === '23503') {
                      return { rows: [] as { id: string }[] };
                    }
                    throw error;
                  });
                throw new Rollback([...updated.rows, ...deleted.rows].map((row) => row.id));
              }).catch((error: unknown) => {
                if (error instanceof Rollback) return error.ids;
                throw error;
              });
        for (const meta of metaOf(touched)) {
          expect(mayRead(who, meta), `${who.name} ändert fremde Zeile`).toBe(true);
          if (kind === 'shared')
            expect(meta.owner, `${who.name} ändert Zeile der anderen Seite`).toBe(who.org);
        }

        // Anlegen für eine fremde Seite oder Organisation scheitert.
        for (const row of rowsFor(kind, table)) {
          const meta: RowMeta = { table, kind, ...row };
          const own =
            kind === 'shared' ? meta.owner === who.org && mayRead(who, meta) : mayRead(who, meta);
          const insert = withTenant(temp.db, session(who), async (tx) => {
            await tx.execute(insertSql(table, columnsOf(table, entry, row, randomUUID(), probe)));
            throw new Rollback([]);
          }).catch((error: unknown) => {
            if (error instanceof Rollback) return 'angelegt';
            // Eine Dublette (23505) hat die Policies schon passiert; abgelehnt heißt nur 42501.
            const code = (error as { cause?: { code?: string } }).cause?.code;
            if (code === '23505') return 'angelegt';
            if (code === '42501') return 'abgelehnt';
            throw error;
          });
          expect(await insert, `${who.name} legt ${JSON.stringify(row)} an`).toBe(
            own && !entry.computed ? 'angelegt' : 'abgelehnt',
          );
        }
      }
    });
  });

  describe('Ein Test scheitert, wenn eine Tabelle nicht im Register steht, kein RLS mit FORCE hat oder ein Fremdschlüssel von einer geteilten auf eine private Tabelle zeigt', () => {
    /** Baut etwas in einer Transaktion, prüft und rollt alles zurück. */
    const problemsAfter = async (build: SQL, extra: Record<string, LayerEntry> = {}) =>
      temp.db
        .transaction(async (tx) => {
          await tx.execute(build);
          throw new Rollback(
            await checkLayers(tx as unknown as Database, { ...register, ...extra }),
          );
        })
        .catch((error: unknown) => {
          if (error instanceof Rollback) return error.ids;
          throw error;
        });

    it('meldet für die migrierte Datenbank samt Proben nichts', async () => {
      expect(await checkLayers(temp.db, register)).toEqual([]);
    });

    it('meldet eine Tabelle, die nicht im Register steht', async () => {
      const problems = await problemsAfter(
        sql`create table ohne_eintrag (id uuid primary key, org_id uuid not null); select app_apply_layer('ohne_eintrag', 'org_private')`,
      );
      expect(problems).toEqual(['ohne_eintrag: steht nicht im Register der Datenebenen']);
    });

    it('meldet eine Tabelle ohne RLS mit FORCE', async () => {
      const problems = await problemsAfter(
        sql`create table ohne_force (id uuid primary key); alter table ohne_force enable row level security`,
        { ohne_force: { kind: 'global', manual: 'Test' } },
      );
      expect(problems).toEqual(['ohne_force: hat kein RLS mit FORCE']);
    });

    it('meldet einen Fremdschlüssel von einer geteilten auf eine private Tabelle', async () => {
      const problems = await problemsAfter(
        sql`create table geteilt_mit_verweis (
              id uuid primary key, relationship_id uuid not null, owner_org_id uuid not null,
              visibility text not null, privat_id uuid references probe_buyer_private (id)
            );
            select app_apply_layer('geteilt_mit_verweis', 'shared')`,
        { geteilt_mit_verweis: { kind: 'shared' } },
      );
      expect(problems).toEqual([
        'geteilt_mit_verweis: Fremdschlüssel geteilt_mit_verweis_privat_id_fkey zeigt auf private Tabelle probe_buyer_private',
      ]);
    });

    it('meldet einen Eintrag im Register ohne Tabelle', async () => {
      expect(
        await checkLayers(temp.db, { ...register, gibt_es_nicht: { kind: 'shared' } }),
      ).toEqual(['gibt_es_nicht: steht im Register, gibt es aber nicht']);
    });

    it('Private Tabellen dürfen auf geteilte verweisen', async () => {
      const problems = await problemsAfter(
        sql`create table privat_mit_verweis (
              id uuid primary key, relationship_id uuid not null,
              geteilt_id uuid references probe_shared (id)
            );
            select app_apply_layer('privat_mit_verweis', 'buyer_private')`,
        { privat_mit_verweis: { kind: 'buyer_private' } },
      );
      expect(problems).toEqual([]);
    });
  });

  describe('Neue Tabellen bekommen ihre Policies über die Hilfsfunktionen, und die Prüfungen laufen für sie ohne zusätzlichen Testcode', () => {
    it('app_apply_layer schaltet RLS mit FORCE ein und legt die Policies je Art an', async () => {
      const result = await temp.db.execute<{
        table: string;
        policies: string[];
        force: boolean;
      }>(sql`
        select c.relname as table, c.relforcerowsecurity as force,
          array(select polname::text from pg_policy where polrelid = c.oid order by polname) as policies
        from pg_class c where c.relname like 'probe\\_%' and c.relkind = 'r' order by c.relname
      `);
      expect(result.rows).toEqual([
        {
          table: 'probe_buyer_private',
          force: true,
          policies: ['probe_buyer_private_buyer_private', 'probe_buyer_private_customer'],
        },
        {
          table: 'probe_org_private',
          force: true,
          policies: ['probe_org_private_customer', 'probe_org_private_org_private'],
        },
        {
          table: 'probe_shared',
          force: true,
          policies: [
            'probe_shared_customer',
            'probe_shared_shared_delete',
            'probe_shared_shared_insert',
            'probe_shared_shared_read',
            'probe_shared_shared_update',
          ],
        },
        {
          table: 'probe_supplier_private',
          force: true,
          policies: ['probe_supplier_private_customer', 'probe_supplier_private_supplier_private'],
        },
      ]);
    });

    it('lehnt Tabellen ohne die nötigen Spalten und unbekannte Arten ab', async () => {
      await expect(
        temp.db.transaction(async (tx) => {
          await tx.execute(sql`create table ohne_spalten (id uuid primary key)`);
          await tx.execute(sql`select app_apply_layer('ohne_spalten', 'shared')`);
        }),
      ).rejects.toMatchObject({
        cause: {
          // Die Reihenfolge der fehlenden Spalten legt Postgres fest.
          message: expect.stringMatching(
            /braucht für shared die Spalten: (?=.*relationship_id)(?=.*owner_org_id)(?=.*visibility)/,
          ),
        },
      });
      await expect(
        temp.db.execute(sql`select app_apply_layer('probe_shared', 'oeffentlich')`),
      ).rejects.toMatchObject({
        cause: { message: expect.stringMatching(/Unbekannte Datenebene/) },
      });
    });

    it('die API-Rolle darf die Hilfsfunktion nicht aufrufen', async () => {
      await expect(
        withTenant(temp.db, session(viewer('Test-OEM')), (tx) =>
          tx.execute(sql`select app_apply_layer('probe_shared', 'global')`),
        ),
      ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/permission denied/) } });
    });

    it('jede Tabelle im Register mit Policies aus der Hilfsfunktion steht im Gerüst', () => {
      expect(tables.map((entry) => entry.table).sort()).toEqual(
        Object.entries(register)
          .filter(([, entry]) => !entry.manual && entry.kind !== 'global')
          .map(([table]) => table)
          .sort(),
      );
    });
  });

  describe('Tabellen mit Policies von Hand', () => {
    it('Stammdaten einer Organisation sieht jede Organisation, die mit ihr in Beziehung steht, in beide Richtungen', async () => {
      const names = (who: Viewer) =>
        withTenant(temp.db, session(who), async (tx) => {
          const result = await tx.execute<{ id: string }>(sql`select id::text from organization`);
          return result.rows.map((row) => row.id);
        });
      // Der Lieferant sieht seine Kunden, auch ohne gewählten Kunden.
      expect(await names(viewer('Test-Lieferant ohne Kunde'))).toEqual(
        expect.arrayContaining([supplier, testOem, zweitOem]),
      );
      expect(await names(viewer('Zweit-OEM'))).not.toContain(testOem);
    });

    it('die Beziehung selbst sieht der Lieferant nur im Kontext dieses Kunden', async () => {
      const ids = (who: Viewer) =>
        withTenant(temp.db, session(who), async (tx) => {
          const result = await tx.execute<{ id: string }>(
            sql`select id::text from relationship where supplier_org_id = ${supplier}`,
          );
          return result.rows.map((row) => row.id);
        });
      expect(await ids(viewer('Test-Lieferant ohne Kunde'))).toEqual([]);
      expect(await ids(viewer('Test-Lieferant bei Test-OEM'))).toEqual([relationships.a.id]);
      expect(await ids(viewer('Test-OEM'))).toEqual([relationships.a.id]);
    });
  });
});

/** Rollt eine Transaktion zurück und trägt dabei ein Ergebnis heraus. */
class Rollback extends Error {
  constructor(readonly ids: string[]) {
    super('rollback');
  }
}
