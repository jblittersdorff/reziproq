import { randomBytes, randomUUID } from 'node:crypto';
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
  /**
   * Nur berechnet (z. B. Beträge der Wirkung, PNL-05): Eine Funktion schreibt die Zeilen; Anlegen,
   * Ändern und Löschen über die App-Rolle scheitern für jeden, Lesen folgt der Ebene.
   */
  computed?: boolean;
}

let nextSegmentLayerTestVersion = 0;
let nextRuleSetLayerTestVersion = 0;

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
  cycle: { kind: 'buyer_private', testValues: { label: 'Probe' } },
  cycle_setting: {
    kind: 'org_private',
    testValues: { step: 'feedback', weeks_relative_to_jbp: -8 },
  },
  // PNL-01: GuV-Zeilen je Organisation.
  pnl_line: { kind: 'org_private', testValues: { key: 'probe', name: 'Probe', position: 99 } },
  // JBP-09: Toleranz „knapp“ je Kunde.
  scorecard_setting: { kind: 'org_private', testValues: { tolerance_percent: 10 } },
  cycle_reminder_sent: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      cycle_id: buyer && probe('cycle', buyer),
      step: 'feedback',
      due_date: '2099-01-01',
    }),
  },
  objective_category: {
    kind: 'org_private',
    testValues: { key: 'probe', name: 'Probe', position: 99 },
  },
  relationship_spend: { kind: 'buyer_private', testValues: { year: 2025, amount_cents: 100 } },
  relationship_member: { kind: 'org_private', testValues: { user_id: 'demo-test-oem-1' } },
  // QBR-01a: Termine sind geteilt; jede Seite ändert nur ihre Zeilen. Notizen gehören einer Seite.
  meeting: {
    kind: 'shared',
    testValues: {
      type: 'other',
      title: 'Probe',
      starts_at: new Date('2099-01-01T09:00:00Z'),
      created_by: 'demo-test-oem-1',
      created_by_name: 'Probe',
    },
  },
  meeting_participant: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      meeting_id: buyer && probe('meeting', buyer),
      name: 'Probe',
      position: 1,
    }),
  },
  meeting_agenda_item: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      meeting_id: buyer && probe('meeting', buyer),
      title: 'Probe',
      position: 1,
    }),
  },
  meeting_decision: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      meeting_id: buyer && probe('meeting', buyer),
      text: 'Probe',
      position: 1,
    }),
  },
  meeting_note: {
    kind: 'org_private',
    testValues: ({ buyer, probe }) => ({
      meeting_id: buyer && probe('meeting', buyer),
      text: 'Probe',
    }),
  },
  // QBR-03: Maßnahmen, geteilt oder intern; private Quellen gehören einer Seite.
  action: {
    kind: 'shared',
    testValues: {
      title: 'Probe',
      owner_side: 'buyer',
      owner_name: 'Probe',
      due_date: '2099-01-01',
      source_type: 'manual',
      created_by: 'demo-test-oem-1',
      created_by_name: 'Probe',
    },
  },
  action_private_source: {
    kind: 'org_private',
    testValues: ({ buyer, probe }) => ({
      action_id: buyer && probe('action', buyer),
      source_type: 'hint',
      source_id: '0190a0a0-0000-7000-8000-000000000001',
    }),
  },
  // JBP-01: Gemeinsamer Plan, geteilt; der Zyklus-Verweis ist käuferprivat.
  jbp: {
    kind: 'shared',
    testValues: { created_by: 'demo-test-oem-1', created_by_name: 'Probe' },
  },
  jbp_cycle_link: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      jbp_id: buyer && probe('jbp', buyer),
      cycle_id: buyer && probe('cycle', buyer),
    }),
  },
  // JBP-02: Themen beider Seiten, geteilt; die Herkunft aus dem Lieferantenplan bleibt beim Käufer.
  jbp_topic: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      jbp_id: buyer && probe('jbp', buyer),
      side: 'buyer',
      title: 'Probe',
      priority: 1,
      created_by: 'demo-test-oem-1',
      created_by_name: 'Probe',
    }),
  },
  // JBP-03: Initiativen mit Meilensteinen und Herkunfts-Themen.
  initiative: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      jbp_id: buyer && probe('jbp', buyer),
      title: 'Probe',
      goal: 'Probe',
      benefit_buyer: 'Probe',
      benefit_supplier: 'Probe',
      owner_buyer_name: 'Probe',
      owner_supplier_name: 'Probe',
      starts_on: '2027-01-01',
      ends_on: '2027-12-31',
      created_by: 'demo-test-oem-1',
      created_by_name: 'Probe',
    }),
  },
  initiative_topic: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      jbp_topic_id: buyer && probe('jbp_topic', buyer),
    }),
  },
  initiative_milestone: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      title: 'Probe',
      due_on: '2027-06-30',
    }),
  },
  // JBP-06: Entscheidungen und freigegebene Versionen des Gemeinsamen Plans, nur anfügbar.
  jbp_approval: {
    kind: 'shared',
    appendOnly: true,
    testValues: ({ buyer, probe }) => ({
      jbp_id: buyer && probe('jbp', buyer),
      version: 1,
      side: 'buyer',
      user_id: 'demo-test-oem-1',
      user_name: 'Probe',
      decision: 'approved',
    }),
  },
  jbp_version: {
    kind: 'shared',
    appendOnly: true,
    testValues: ({ buyer, probe }) => ({
      jbp_id: buyer && probe('jbp', buyer),
      version: 1,
      content: JSON.stringify({ topics: [], initiatives: [], commitments: [] }),
    }),
  },
  // JBP-07: Scorecard mit Kennzahlen und Unterschriften.
  scorecard: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({ jbp_id: buyer && probe('jbp', buyer) }),
  },
  scorecard_kpi: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      scorecard_id: buyer && probe('scorecard', buyer),
      name: 'Probe',
      unit: '%',
      direction: 'higher',
      target: '95',
      target_date: '2027-12-31',
      owner_side: 'buyer',
      owner_name: 'Probe',
      benefit_for: 'both',
    }),
  },
  scorecard_signature: {
    kind: 'shared',
    appendOnly: true,
    testValues: ({ buyer, probe }) => ({
      scorecard_id: buyer && probe('scorecard', buyer),
      version: 1,
      side: 'buyer',
      user_id: 'demo-test-oem-1',
      user_name: 'Probe',
    }),
  },
  // PNL-01, PNL-03: Wirkung, Baseline (käuferprivat) und Reifegrad (geteilt) je Initiative.
  initiative_impact: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      lever: 'price',
      lever_template_version: 1,
      pnl_line_key: 'material',
      effect_type: 'ebit',
      created_by: 'demo-test-oem-1',
    }),
  },
  initiative_baseline: {
    kind: 'buyer_private',
    appendOnly: true,
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      version: 1,
      lever_template_version: 1,
      inputs: JSON.stringify({ price_old: '1000' }),
      frozen_by: 'demo-test-oem-1',
      frozen_by_name: 'Probe',
    }),
  },
  maturity_step: {
    kind: 'shared',
    appendOnly: true,
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      from_level: 1,
      to_level: 2,
      evidence: 'Probe',
      decided_by: 'demo-test-oem-1',
      decided_by_name: 'Probe',
    }),
  },
  // PNL-05, PNL-06: Monatswerte (käuferprivat), berechnete Beträge (nur durch die Rechnung) und
  // Freigaben durch Controlling (käuferprivat).
  initiative_input_month: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      month: '2027-01-01',
      kind: 'actual',
      inputs: JSON.stringify({ price_new: '1200', quantity: '10' }),
      source: 'manual',
      entered_by: 'demo-test-oem-1',
      entered_by_name: 'Probe',
    }),
  },
  initiative_value: {
    kind: 'shared',
    computed: true,
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      month: '2027-01-01',
      kind: 'actual',
      value_cents: 1000,
      effect_type: 'ebit',
    }),
  },
  initiative_validation: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      period_from: '2027-01-01',
      period_to: '2027-03-01',
      requested_by: 'demo-test-oem-1',
      requested_by_name: 'Probe',
    }),
  },
  // JBP-09: Ist-Werte je Kennzahl und Monat.
  kpi_value: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      kpi_id: buyer && probe('scorecard_kpi', buyer),
      period: '2027-01-01',
      value: '95',
      source: 'manual',
      entered_by: 'demo-test-oem-1',
      entered_by_name: 'Probe',
    }),
  },
  // JBP-05: Zusagen einer Seite.
  commitment: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      jbp_id: buyer && probe('jbp', buyer),
      side: 'buyer',
      title: 'Probe',
      owner_name: 'Probe',
      due_on: '2027-03-31',
      created_by: 'demo-test-oem-1',
      created_by_name: 'Probe',
    }),
  },
  jbp_business_update: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      jbp_id: buyer && probe('jbp', buyer),
      side: 'buyer',
      text: 'Probe',
    }),
  },
  // QBR-01b: eingefrorener Stand beim Abschließen, geteilt wie der Termin.
  meeting_snapshot: {
    kind: 'shared',
    appendOnly: true,
    testValues: ({ buyer, probe }) => ({
      meeting_id: buyer && probe('meeting', buyer),
      content: JSON.stringify({ sections: [] }),
    }),
  },
  // PLB-03: Spielregeln je Beziehung, geteilt angelegt, intern bis SEG-10.
  rule_set: {
    kind: 'shared',
    testValues: () => ({
      version: ++nextRuleSetLayerTestVersion,
      target_impact_level: 2,
      target_quality_level: 2,
      type_name: 'Probe',
      created_by: 'demo-test-oem-1',
    }),
  },
  rule_set_item: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      rule_set_id: buyer && probe('rule_set', buyer),
      kind: 'right',
      group: 'cost',
      title: JSON.stringify({ de: 'Probe', en: 'Probe' }),
      description: JSON.stringify({ de: 'Probe', en: 'Probe' }),
      origin: 'custom',
      position: 1,
    }),
  },
  relationship_target: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      type_name: 'Probe',
      type_description: 'Probe',
      rule_set_id: buyer && probe('rule_set', buyer),
      rule_set_version: 1,
      shared_by: 'demo-test-oem-1',
      shared_by_name: 'Probe',
    }),
  },
  rule_set_note: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      rule_set_id: buyer && probe('rule_set', buyer),
      catalog_item_id: randomUUID(),
      deviation_reason: 'Probe',
    }),
  },
  // PLB-01: Kataloge für Spielregeln und Formate je Käuferorganisation.
  rule_catalog_item: {
    kind: 'org_private',
    testValues: () => ({
      kind: 'right',
      group: 'cost',
      title: JSON.stringify({ de: 'Probe', en: 'Probe' }),
      description: JSON.stringify({ de: 'Probe', en: 'Probe' }),
      min_impact_level: 1,
      position: 1,
    }),
  },
  format_catalog_item: {
    kind: 'org_private',
    testValues: () => ({
      name: JSON.stringify({ de: 'Probe', en: 'Probe' }),
      purpose: JSON.stringify({ de: 'Probe', en: 'Probe' }),
      level: 'management',
      cadence: 'annual',
      min_impact_level: 1,
      position: 1,
    }),
  },
  catalog_setup: {
    kind: 'org_private',
    manual:
      'Eine Zeile je Organisation (org_id ist der Schlüssel); geschützt wie jede org_private-Tabelle',
  },
  // LIF-01a: Einladung einer Person des Lieferanten; nur die einladende Organisation sieht sie.
  invitation: {
    kind: 'org_private',
    testValues: () => ({
      email: 'probe@example.com',
      token_hash: randomBytes(32).toString('hex'),
      invited_by: 'demo-test-oem-1',
      expires_at: new Date('2099-01-01T00:00:00Z'),
    }),
  },
  segment_model: {
    kind: 'org_private',
    testValues: () => ({
      version: ++nextSegmentLayerTestVersion,
      status: 'retired',
      low_max: 33,
      mid_max: 66,
      activated_at: new Date(0),
    }),
  },
  segment_criterion: {
    kind: 'org_private',
    manual: 'Über segment_model geschützt; der Eltern-Datensatz erzwingt die Organisation',
  },
  segment_type: {
    kind: 'org_private',
    manual: 'Über segment_model geschützt; der Eltern-Datensatz erzwingt die Organisation',
  },
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
  supplier_plan: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      cycle_id: buyer && probe('cycle', buyer),
      version: 1,
      status: 'draft',
    }),
  },
  plan_objective: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      plan_id: buyer && probe('supplier_plan', buyer),
      category_key: 'cost',
      business_unit_id: buyer && probe('business_unit', buyer),
      material_group_id: null,
      text: 'Probe-Ziel',
      owner_user_id: 'demo-test-oem-1',
      target_year: 2099,
    }),
  },
  plan_contribution: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      plan_id: buyer && probe('supplier_plan', buyer),
      business_unit_id: buyer && probe('business_unit', buyer),
      material_group_id: null,
      assignee_user_id: 'demo-test-oem-1',
      due_date: '2099-01-01',
      status: 'open',
    }),
  },
  // SPL-07: Entscheidungen über den eingereichten Plan, nur beim Käufer.
  plan_approval: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      plan_id: buyer && probe('supplier_plan', buyer),
      round: 1,
      user_id: `demo-test-oem-${Math.random().toString(36).slice(2, 8)}`,
      user_name: 'Probe',
      role: 'sro',
      decision: 'approved',
    }),
  },
  strategic_topic: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      plan_id: buyer && probe('supplier_plan', buyer),
      title: 'Thema',
      reason: 'Begründung',
      priority: 1,
    }),
  },
  // JBP-02: Herkunft eines Themas aus dem Lieferantenplan, nach strategic_topic angelegt.
  jbp_topic_origin: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      jbp_topic_id: buyer && probe('jbp_topic', buyer),
      strategic_topic_id: buyer && probe('strategic_topic', buyer),
    }),
  },
  strategic_topic_objective: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      topic_id: buyer && probe('strategic_topic', buyer),
      objective_id: buyer && probe('plan_objective', buyer),
    }),
  },
  // SEG-03: Bewertungsrunden der Käuferorganisation und ihre Zuordnungen je Beziehung.
  segmentation_round: {
    kind: 'org_private',
    testValues: { name: 'Probe', due_date: '2099-01-01', created_by: 'demo-test-oem-1' },
  },
  rating_assignment: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      round_id: buyer && probe('segmentation_round', buyer),
      business_unit_id: buyer && probe('business_unit', buyer),
      function: 'quality',
    }),
  },
  rating: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      assignment_id: buyer && probe('rating_assignment', buyer),
      criterion_key: 'probe',
      model_version: 1,
    }),
  },
  // SEG-06: Konsolidierung; nur anfügen, frühere Stände bleiben lesbar.
  segment_decision: {
    kind: 'buyer_private',
    appendOnly: true,
    testValues: {
      scope: 'total',
      ist_impact_level: 1,
      ist_quality_level: 1,
      soll_impact_level: 2,
      soll_quality_level: 2,
      reason: 'Probe',
      model_version: 1,
      decided_by: 'demo-test-oem-1',
      version: 1,
    },
  },
  supplier_contact: {
    kind: 'buyer_private',
    testValues: { name: 'Probe', email: 'probe@example.com' },
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
  email_log: {
    kind: 'global',
    manual: 'Versandprotokoll ohne Mailinhalt, nur für den E-Mail-Job (QS-01)',
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
 * Spalten, die nur in privaten Tabellen vorkommen (PLT-08), damit gleichnamige geteilte Felder
 * nicht fälschlich als private Verlaufsdaten gelten.
 */
export async function privateColumns(
  db: Pick<Database, 'execute'>,
  register: Record<string, LayerEntry> = layerRegister,
): Promise<Map<string, string[]>> {
  const privateTables = Object.entries(register)
    .filter(([, entry]) => privateKinds.includes(entry.kind))
    .map(([table]) => table);
  const nonPrivateTables = Object.entries(register)
    .filter(([, entry]) => !privateKinds.includes(entry.kind))
    .map(([table]) => table);
  const nonPrivateColumnClause = nonPrivateTables.length
    ? sql`and not exists (
        select 1 from information_schema.columns as visible_column
        where visible_column.table_schema = 'public'
          and visible_column.table_name in ${nonPrivateTables}
          and visible_column.column_name = private_column.column_name
      )`
    : sql``;
  const result = await db.execute<{ table_name: string; column_name: string }>(sql`
    select private_column.table_name, private_column.column_name
    from information_schema.columns as private_column
    where private_column.table_schema = 'public'
      and private_column.table_name in ${privateTables}
      ${nonPrivateColumnClause}
  `);
  const columns = new Map<string, string[]>();
  for (const row of result.rows) {
    if (layerColumns.has(row.column_name)) continue;
    columns.set(row.column_name, [...(columns.get(row.column_name) ?? []), row.table_name]);
  }
  return columns;
}
