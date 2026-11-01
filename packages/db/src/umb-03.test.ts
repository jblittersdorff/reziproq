import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generatedLayerTables, layerRegister } from './layers.js';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// Tests zu docs/specs/UMB-03.md: Bestandsdaten aus beziehung_kaeufer stehen an ihrem neuen Ort.
// Überführt hat sie PLT-03a (Migrationen 0009 und 0010); hier wird das festgehalten. Der Freitext
// Warengruppe entfällt bewusst (Entscheidung zu PLT-03a); Warengruppen pflegt PLT-06 als Liste.

const ids = {
  buyer: '00000000-0000-7000-8000-000000000001',
  zweit: '00000000-0000-7000-8000-000000000004',
  supplierA: '00000000-0000-7000-8000-000000000002',
  supplierB: '00000000-0000-7000-8000-000000000003',
};
const rel = (n: number) => `00000000-0000-7000-8000-0000000000a${n}`;

/** Stand vor PLT-03a: Spend und Freitext-Warengruppe je Beziehung in beziehung_kaeufer. */
const before = [
  {
    id: rel(1),
    buyer: ids.buyer,
    supplier: ids.supplierA,
    warengruppe: 'Guss',
    cent: 482_000_000,
    year: 2025,
    currency: 'EUR',
  },
  {
    id: rel(2),
    buyer: ids.buyer,
    supplier: ids.supplierB,
    warengruppe: 'Logistik',
    cent: 12_345,
    year: 2024,
    currency: 'USD',
  },
  {
    id: rel(3),
    buyer: ids.zweit,
    supplier: ids.supplierA,
    warengruppe: 'Guss',
    cent: 1,
    year: 2025,
    currency: 'EUR',
  },
  {
    id: rel(4),
    buyer: ids.zweit,
    supplier: ids.supplierB,
    warengruppe: 'Kunststoff',
    cent: 0,
    year: 2023,
    currency: 'EUR',
  },
];

describe('UMB-03: Bestandsdaten in den neuen Tabellen', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  const spend = async () =>
    (
      await temp.db.execute<{
        id: string;
        year: number;
        cent: number;
        currency: string;
        source: string;
      }>(sql`
        select relationship_id::text as id, year, amount_cents::int as cent, currency, source
        from relationship_spend order by relationship_id, year
      `)
    ).rows;

  /** Prüfsumme über alle Zeilen der betroffenen Tabellen und die Liste der Migrationen. */
  const fingerprint = async () =>
    (
      await temp.db.execute<{ value: string }>(sql`
        select concat_ws('|',
          (select md5(coalesce(string_agg(t::text, ',' order by t.id), '')) from relationship t),
          (select md5(coalesce(string_agg(t::text, ',' order by t.id), '')) from relationship_spend t),
          (select md5(coalesce(string_agg(t::text, ',' order by t.id), '')) from material_group t),
          (select count(*) from drizzle.__drizzle_migrations)
        ) as value
      `)
    ).rows[0]?.value;

  beforeAll(async () => {
    temp = await createTempDatabase();
    // Stand nach PLT-04 (0008), vor dem neuen Beziehungsmodell.
    await migrateTo(temp.db, 9);
    await temp.db.execute(sql`
      insert into organization (id, name) values
        (${ids.buyer}, 'Käufer (Demo)'), (${ids.zweit}, 'Zweit (Demo)'),
        (${ids.supplierA}, 'Lieferant A (Demo)'), (${ids.supplierB}, 'Lieferant B (Demo)')
    `);
    for (const row of before) {
      await temp.db.execute(sql`
        insert into beziehung (id, kaeufer_org_id, lieferant_org_id) values (${row.id}, ${row.buyer}, ${row.supplier})
      `);
      await temp.db.execute(sql`
        insert into beziehung_kaeufer (beziehung_id, warengruppe, jahresspend_cent, spend_jahr, waehrung)
        values (${row.id}, ${row.warengruppe}, ${row.cent}, ${row.year}, ${row.currency})
      `);
    }
    await migrateTo(temp.db);
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('Ein Test füllt den Stand vor der Migration, migriert und vergleicht: Keine Warengruppe und kein Spend fehlt.', async () => {
    // Jeder Spend steht genau einmal in relationship_spend, als Import.
    expect(await spend()).toEqual(
      before.map((row) => ({
        id: row.id,
        year: row.year,
        cent: row.cent,
        currency: row.currency,
        source: 'import',
      })),
    );
    // Jede Beziehung ist da, beim richtigen Käufer.
    const relationships = await temp.db.execute<{ id: string; buyer: string }>(
      sql`select id::text, buyer_org_id::text as buyer from relationship order by id`,
    );
    expect(relationships.rows).toEqual(before.map((row) => ({ id: row.id, buyer: row.buyer })));
    // Der Freitext Warengruppe entfällt bewusst: keine erfundenen Warengruppen, keine Zuordnung.
    const groups = await temp.db.execute(sql`select * from material_group`);
    const assigned = await temp.db.execute(sql`select * from relationship_material_group`);
    expect([groups.rows, assigned.rows]).toEqual([[], []]);
  });

  it('beziehung_kaeufer existiert danach nicht mehr, und kein Code liest sie.', async () => {
    const tables = await temp.db.execute(
      sql`select table_name from information_schema.tables where table_name in ('beziehung', 'beziehung_kaeufer')`,
    );
    expect(tables.rows).toEqual([]);

    // Nur alte Migrationen und die Tests, die sie nachstellen, nennen die Tabelle noch.
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const allowed = [
      /^packages\/db\/drizzle\//,
      /^packages\/db\/src\/migrations\.test\.ts$/,
      /^packages\/db\/src\/umb-03\.test\.ts$/,
    ];
    const skip = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', '.turbo']);
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        if (skip.has(name)) return [];
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return files(path);
        return /\.(ts|tsx|sql|js)$/.test(name) ? [path] : [];
      });
    const readers = [...files(join(root, 'apps')), ...files(join(root, 'packages'))]
      .map((path) => relative(root, path))
      .filter((path) => !allowed.some((pattern) => pattern.test(path)))
      .filter((path) => readFileSync(join(root, path), 'utf8').includes('beziehung_kaeufer'));
    expect(readers).toEqual([]);
  });

  it('Die Prüfungen aus PLT-04 laufen für alle betroffenen Tabellen.', async () => {
    const affected = [
      'relationship',
      'relationship_spend',
      'material_group',
      'relationship_material_group',
    ];
    for (const table of affected) expect(layerRegister[table], table).toBeDefined();
    // Das Gerüst prüft jede davon außer relationship, dessen Policies das Register begründet.
    const generated = generatedLayerTables().map((entry) => entry.table);
    expect(generated).toEqual(
      expect.arrayContaining([
        'relationship_spend',
        'material_group',
        'relationship_material_group',
      ]),
    );
    expect(layerRegister.relationship?.manual).toBeTruthy();
    const rls = await temp.db.execute<{ relname: string }>(sql`
      select relname from pg_class
      where relname in ${affected} and relrowsecurity and relforcerowsecurity
      order by relname
    `);
    expect(rls.rows.map((row) => row.relname)).toEqual([...affected].sort());
  });

  it('Ein zweiter Lauf ändert nichts.', async () => {
    const first = await fingerprint();
    await migrateTo(temp.db);
    expect(await fingerprint()).toBe(first);
    expect(await spend()).toHaveLength(before.length);
  });
});
