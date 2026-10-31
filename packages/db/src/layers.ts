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
export const privateKinds: readonly LayerKind[] = ['buyer_private', 'supplier_private', 'org_private'];

export interface LayerEntry {
  kind: LayerKind;
  /**
   * Policies von Hand statt über app_apply_layer, mit Begründung. Für Stammdaten (global) und
   * für Tabellen aus der Zeit vor PLT-04, die eine spätere Spec ablöst.
   */
  manual?: string;
  /** Werte für Pflichtspalten außer den Ebenen-Spalten, damit die Prüfungen Zeilen anlegen können. */
  testValues?: Record<string, unknown>;
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
  beziehung: {
    kind: 'global',
    manual: 'Die Beziehung selbst sehen beide Seiten; wird mit PLT-03a zu relationship',
  },
  beziehung_kaeufer: {
    kind: 'buyer_private',
    manual: 'Spalte beziehung_id; entfällt mit UMB-03',
  },
  betreiber_zugriff: {
    kind: 'global',
    manual: 'Protokoll nur für den Betrieb, über die Session nie lesbar; UMB-01 benennt es um',
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
  db: Database,
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
      problems.push(`${key.source}: Fremdschlüssel ${key.name} zeigt auf private Tabelle ${key.target}`);
    }
  }
  return problems;
}
