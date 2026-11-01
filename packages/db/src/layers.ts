import { sql } from 'drizzle-orm';
import type { Database } from './client.js';

// PLT-04: Register der Datenebenen. Jede Tabelle steht hier mit genau einer Art; eine Tabelle
// ohne Eintrag lässt die Tests scheitern (checkLayers).
//
// Neue Tabelle: in der Migration nach CREATE TABLE `SELECT app_apply_layer('tabelle', 'art');`
// aufrufen und hier eintragen. Dann laufen alle Prüfungen aus layers.test.ts auch für sie.

export const layerKinds = [
  'buyer_private',
  'supplier_private',
  'org_private',
  'shared',
  'global',
] as const;
export type LayerKind = (typeof layerKinds)[number];

/** Arten, die nur eine Seite oder Organisation sehen darf; geteilte Tabellen verweisen nie darauf. */
export const privateKinds: readonly LayerKind[] = [
  'buyer_private',
  'supplier_private',
  'org_private',
];

/** Was die Testwerte über die Zeile wissen, die das Gerüst gerade anlegt. */
export interface TestRowContext {
  /** Käufer der Beziehung der Zeile; null ohne Beziehung */
  buyer: string | null;
  probe: (table: string, org: string) => string;
}

export interface LayerEntry {
  kind: LayerKind;
  /**
   * Policies von Hand statt über app_apply_layer, mit Begründung. Für Stammdaten (global) und
   * für Tabellen aus der Zeit vor PLT-04, die eine spätere Spec ablöst.
   */
  manual?: string;
  /**
   * Werte für Pflichtspalten außer den Ebenen-Spalten, damit die Prüfungen Zeilen anlegen können.
   * Als Funktion für Fremdschlüssel: probe(tabelle, org) liefert die ID der Probe-Zeile, die das
   * Gerüst in dieser Tabelle für die Organisation angelegt hat, z. B. die BU des Käufers.
   */
  testValues?: Record<string, unknown> | ((row: TestRowContext) => Record<string, unknown>);
  /** Nur anfügen (z. B. Verlauf, PLT-08): Ändern und Löschen scheitern für jeden. */
  appendOnly?: boolean;
}

export const layerRegister: Record<string, LayerEntry> = {
  organization: {
    kind: 'global',
    manual: 'Stammdaten: die eigene und jede Organisation, die mit ihr in Beziehung steht',
  },
  organization_feature: {
    kind: 'org_private',
    manual: 'Spalte organization_id; nur lesen, Freischaltungen setzt der Betrieb',
  },
  app_user: {
    kind: 'org_private',
    manual: 'Spalte organization_id; dazu sieht jede Person sich selbst, auch ohne Organisation',
  },
  relationship: {
    kind: 'shared',
    manual:
      'Anker aller Beziehungsdaten ohne relationship_id, owner_org_id und visibility: Der Käufer ' +
      'sieht alle seine Beziehungen, der Lieferant nur aktive im Kontext dieses Kunden (PLT-03)',
  },
  relationship_side: { kind: 'org_private' },
  relationship_spend: { kind: 'buyer_private', testValues: { year: 2025, amount_cents: 100 } },
  relationship_member: { kind: 'org_private', testValues: { user_id: 'demo-test-oem-1' } },
  // PLT-06: Stammdaten je Organisation und ihre Zuordnung zu Lieferanten.
  business_unit: { kind: 'org_private', testValues: { name: 'Probe', code: 'PROBE' } },
  material_group: { kind: 'org_private', testValues: { name: 'Probe', code: 'PROBE' } },
  relationship_business_unit: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      business_unit_id: buyer && probe('business_unit', buyer),
    }),
  },
  relationship_material_group: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      material_group_id: buyer && probe('material_group', buyer),
      is_primary: true,
    }),
  },
  audit_event: {
    kind: 'shared',
    appendOnly: true,
    testValues: {
      actor_user_id: 'test-nutzer',
      actor_name: 'Test Nutzer',
      object_type: 'probe',
      object_id: 'probe-1',
      action: 'updated',
    },
  },
  outbox_event: {
    kind: 'global',
    manual: 'Outbox nur für den Betrieb: Die API legt Einträge an und liest nichts (PLT-08)',
  },
  support_access_log: {
    kind: 'global',
    manual:
      'Protokoll des Betreiber-Zugangs nur für den Betrieb, über die Session nie lesbar (UMB-01)',
  },
};

/** Tabellen, deren Policies aus app_apply_layer stammen; für sie laufen alle Ebenen-Prüfungen. */
export function generatedLayerTables(register: Record<string, LayerEntry> = layerRegister) {
  return Object.entries(register)
    .filter(([, entry]) => !entry.manual && entry.kind !== 'global')
    .map(([table, entry]) => ({ table, ...entry }));
}

/**
 * Prüft die Datenbank gegen das Register und meldet jeden Verstoß als Satz:
 * Tabelle ohne Eintrag, Eintrag ohne Tabelle, RLS ohne FORCE und Fremdschlüssel von einer
 * geteilten auf eine private Tabelle (PostgreSQL umgeht bei Schlüsselprüfungen RLS).
 */
export async function checkLayers(
  db: Pick<Database, 'execute'>,
  register: Record<string, LayerEntry> = layerRegister,
): Promise<string[]> {
  const tables = await db.execute<{ name: string; rls: boolean; force: boolean }>(sql`
    select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as force
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);
  const foreignKeys = await db.execute<{ source: string; target: string; name: string }>(sql`
    select src.relname as source, dst.relname as target, con.conname as name
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class dst on dst.oid = con.confrelid
    join pg_namespace n on n.oid = src.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
  `);

  const problems: string[] = [];
  const present = new Set(tables.rows.map((row) => row.name));
  for (const row of tables.rows) {
    if (!register[row.name]) problems.push(`${row.name}: steht nicht im Register der Datenebenen`);
    if (!row.rls || !row.force) problems.push(`${row.name}: hat kein RLS mit FORCE`);
  }
  for (const table of Object.keys(register)) {
    if (!present.has(table)) problems.push(`${table}: steht im Register, gibt es aber nicht`);
  }
  for (const key of foreignKeys.rows) {
    const source = register[key.source]?.kind;
    const target = register[key.target]?.kind;
    if (source === 'shared' && target && privateKinds.includes(target)) {
      problems.push(
        `${key.source}: Fremdschlüssel ${key.name} zeigt auf private Tabelle ${key.target}`,
      );
    }
  }
  return problems;
}

/** Spalten, die jede Ebene trägt und die nichts Privates verraten. */
const layerColumns = new Set(['id', 'relationship_id', 'org_id', 'owner_org_id', 'visibility']);

/**
 * Fachspalten privater Tabellen (PLT-08): Solche Felder dürfen nie in einem geteilten
 * Verlaufseintrag stehen. Liefert je Spaltenname die Tabellen, in denen sie vorkommt.
 */
export async function privateColumns(
  db: Pick<Database, 'execute'>,
  register: Record<string, LayerEntry> = layerRegister,
): Promise<Map<string, string[]>> {
  const privateTables = Object.entries(register)
    .filter(([, entry]) => privateKinds.includes(entry.kind))
    .map(([table]) => table);
  const result = await db.execute<{ table_name: string; column_name: string }>(sql`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name in ${privateTables}
  `);
  const columns = new Map<string, string[]>();
  for (const row of result.rows) {
    if (layerColumns.has(row.column_name)) continue;
    columns.set(row.column_name, [...(columns.get(row.column_name) ?? []), row.table_name]);
  }
  return columns;
}
