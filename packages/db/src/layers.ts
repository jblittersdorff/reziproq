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
  /** Sichtbarkeit der Zeile bei geteilten Tabellen (PLB-04: eine Person je Zeile und Seite) */
  visibility?: 'internal' | 'shared' | undefined;
  /** Organisation der Zeile bei org_private, z. B. für eine Person derselben Organisation */
  org?: string | undefined;
  /** Eine Person der Organisation der Zeile (WG-01: Team je Warengruppe) */
  orgUser?: string | undefined;
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
  user_setting: { kind: 'org_private', manual: 'Private Startseite je Person und Organisation' },
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
  // PUL-02: Welle geteilt; Teilnehmende geteilt, aber immer intern (Dienst und app_survey_*).
  survey_wave: {
    kind: 'shared',
    testValues: {
      template_id: '00000000-0000-7000-8000-000000000000',
      template_version: 1,
      kind: 'pulse',
      due_date: '2099-01-01',
      created_by: 'demo-test-oem-1',
      created_by_name: 'Probe',
    },
  },
  survey_participant: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      wave_id: buyer && probe('survey_wave', buyer),
      side: 'buyer',
      email: 'probe@example.com',
      function: 'purchasing',
      token_hash: 'probe',
      invited_by: 'demo-test-oem-1',
    }),
  },
  // PUL-02b: Antworten privat bei der antwortenden Seite; nur anfügbar, ohne Bezug zur Person.
  survey_response: {
    kind: 'org_private',
    appendOnly: true,
    testValues: ({ buyer, probe }) => ({
      wave_id: buyer && probe('survey_wave', buyer),
      side: 'buyer',
      function: 'purchasing',
      answers: '{}',
    }),
  },
  // LIF-03: Eigene Sicht des Lieferanten; der Käufer sieht nichts davon.
  supplier_account_plan: {
    kind: 'supplier_private',
    testValues: { updated_by: 'probe', updated_by_name: 'Probe' },
  },
  supplier_account_objective: {
    kind: 'supplier_private',
    testValues: { text: 'Probe', target_year: 2027 },
  },
  // PUL-03: Ergebnis und Freitexte entstehen nur bei der Aufdeckung (app_survey_reveal).
  survey_result: {
    kind: 'shared',
    computed: true,
    testValues: ({ buyer, probe }) => ({
      wave_id: buyer && probe('survey_wave', buyer),
      side: 'buyer',
      dimension: 'trust',
      n: 3,
    }),
  },
  survey_free_text: {
    kind: 'shared',
    computed: true,
    testValues: ({ buyer, probe }) => ({
      wave_id: buyer && probe('survey_wave', buyer),
      side: 'buyer',
      text: 'Probe',
      position: 1,
    }),
  },
  // PUL-01: Fragebogen je Organisation; Versionen nur anfügbar.
  survey_template: {
    kind: 'org_private',
    appendOnly: true,
    testValues: { kind: 'pulse', version: 99, questions: '[]' },
  },
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
  // PLB-04: Rollenbeschreibung je Organisation (Standard im Code).
  role_description: {
    kind: 'org_private',
    testValues: {
      role: 'sro',
      does: '[]',
      does_not: '[]',
      updated_by: 'probe',
      updated_by_name: 'Probe',
    },
  },
  // PLB-04: geteilt mit Sichtbarkeit je Person; je Seite eine Person je Zeile (eindeutig).
  relationship_member: {
    kind: 'shared',
    testValues: ({ visibility }) => ({
      user_id: visibility === 'shared' ? 'demo-test-oem-2' : 'demo-test-oem-1',
    }),
  },
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
  // KI-17: Notizen nach dem Termin, nur die eigene Organisation
  meeting_capture: {
    kind: 'org_private',
    testValues: ({ buyer, probe }) => ({
      meeting_id: buyer && probe('meeting', buyer),
      source: 'typed',
      text: 'Probe',
      created_by: 'demo-test-oem-1',
      created_by_name: 'Probe',
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
  // QBR-04: was jede Seite zu einer Frist schon verschickt hat, und Einstellungen je Organisation.
  action_notification: {
    kind: 'org_private',
    appendOnly: true,
    testValues: ({ buyer, probe }) => ({
      action_id: buyer && probe('action', buyer),
      kind: 'reminder',
      due_date: '2099-01-01',
    }),
  },
  org_setting: {
    kind: 'org_private',
    testValues: { key: 'action_reminder_days', value: '3', updated_by: 'probe' },
  },
  // SPL-05: Profil und Finanzen, nur für den Käufer.
  supplier_profile: {
    kind: 'buyer_private',
    testValues: { updated_by: 'probe', updated_by_name: 'Probe' },
  },
  supplier_executive: {
    kind: 'buyer_private',
    testValues: { name: 'Probe', role: 'CEO', position: 1 },
  },
  supplier_financial: {
    kind: 'buyer_private',
    testValues: {
      year: 2025,
      metric: 'ebit_margin',
      value: 850,
      unit: 'basis_points',
      source: 'Geschäftsbericht',
      updated_by: 'probe',
    },
  },
  // PLB-06: Kontaktpunkte geteilt, Standard intern; „geprüft“ je Zyklus käuferprivat.
  touchpoint: {
    kind: 'shared',
    testValues: {
      buyer_name: 'Probe',
      buyer_level: 'executive',
      supplier_name: 'Probe',
      supplier_level: 'executive',
      format: 'Probe',
      cadence: 'quarterly',
      created_by: 'probe',
    },
  },
  touchpoint_review: {
    kind: 'buyer_private',
    appendOnly: true,
    testValues: ({ buyer, probe }) => ({
      cycle_id: buyer && probe('cycle', buyer),
      reviewed_by: 'probe',
      reviewed_by_name: 'Probe',
    }),
  },
  // QS-02: Kommentare, geteilt oder intern; Erwähnungen gehören der Organisation der erwähnten
  // Person und entstehen nur über app_kommentar_erwaehnen.
  comment: {
    kind: 'shared',
    testValues: {
      object_type: 'action',
      object_id: '0190a0a0-0000-7000-8000-000000000001',
      author_id: 'demo-test-oem-1',
      author_name: 'Probe',
      body: 'Probe',
    },
  },
  comment_mention: {
    kind: 'org_private',
    testValues: ({ buyer, probe }) => ({
      comment_id: buyer && probe('comment', buyer),
      // Eine Erwähnung je Person und Kommentar: jede Probe-Zeile mit eigener Person
      user_id: `probe-${randomUUID()}`,
    }),
  },
  // QS-03: Gesamtexport der Organisation; die Datei sieht nur die eigene Organisation.
  data_export: { kind: 'org_private', testValues: { requested_by: 'demo-test-oem-1' } },
  // SEG-11: Entwürfe der KI; nur die eigene Organisation sieht sie, der Lieferant nie.
  ai_draft: {
    kind: 'org_private',
    testValues: {
      kind: 'deviation_explanation',
      object_type: 'segmentation_round',
      object_id: '0190a0a0-0000-7000-8000-000000000002',
      content: 'Probe',
      model: 'test',
      created_by: 'demo-test-oem-1',
    },
  },
  // WG-09 (WG-23): Quellen eines KI-Entwurfs
  ai_source: {
    kind: 'org_private',
    testValues: {
      target_type: 'material_group_strategy',
      target_id: '0190a0a0-0000-7000-8000-000000000002',
      kind: 'own_data',
      title: 'Probe',
    },
  },
  // FS-01: Hinweise; nur die eigene Organisation sieht sie, der Lieferant nie.
  hint: { kind: 'org_private', testValues: { rule_key: 'no_feedback', fingerprint: 'probe' } },
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
  // PNL-07: Teilung geteilt, eigener Nutzen nur beim Lieferanten, Savings-Verweis nur beim Käufer.
  initiative_share: {
    kind: 'shared',
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      buyer_share_pct: 60,
      supplier_share_pct: 40,
      proposed_by: 'probe',
      proposed_by_name: 'Probe',
    }),
  },
  supplier_benefit: {
    kind: 'supplier_private',
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      month: '2027-01-01',
      amount_cents: 100,
      created_by: 'probe',
    }),
  },
  savings_reference: {
    kind: 'buyer_private',
    testValues: ({ buyer, probe }) => ({
      initiative_id: buyer && probe('initiative', buyer),
      system: 'Coupa',
      reference: 'S-1',
      created_by: 'probe',
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
  // WG-01: Produktgruppen und Team je Warengruppe; nur die eigene Organisation sieht sie.
  material_group_product_group: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      material_group_id: org && probe('material_group', org),
      name: `Probe ${randomUUID()}`,
    }),
  },
  material_group_member: {
    kind: 'org_private',
    testValues: ({ org, orgUser, probe }) => ({
      material_group_id: org && probe('material_group', org),
      user_id: orgUser,
      role: 'buyer',
    }),
  },
  // WG-04, WG-06: Strategie je Warengruppe; nur die eigene Organisation sieht sie.
  material_group_strategy: {
    kind: 'org_private',
    testValues: ({ org, orgUser, probe }) => ({
      material_group_id: org && probe('material_group', org),
      year: 2000 + Math.floor(Math.random() * 100),
      created_by: orgUser,
    }),
  },
  material_group_question: {
    kind: 'org_private',
    testValues: { step: 1, text: 'Probe', position: 1 },
  },
  material_group_note: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      strategy_id: org && probe('material_group_strategy', org),
      step: 1,
      view: `probe-${randomUUID()}`,
      updated_by: 'probe',
    }),
  },
  material_group_milestone: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      strategy_id: org && probe('material_group_strategy', org),
      title: 'Probe',
      due_on: '2099-01-01',
    }),
  },
  material_group_kpi: {
    kind: 'org_private',
    testValues: { dimension: 'cost', name: `Probe ${randomUUID()}` },
  },
  material_group_goal: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      strategy_id: org && probe('material_group_strategy', org),
      kpi_id: org && probe('material_group_kpi', org),
      text: 'Probe',
    }),
  },
  // WG-07: Analysen und weitere verfügbare Lieferanten je Strategie
  material_group_analysis: {
    kind: 'org_private',
    testValues: ({ org, orgUser, probe }) => ({
      strategy_id: org && probe('material_group_strategy', org),
      view: 'volume',
      data: '{}',
      updated_by: orgUser,
    }),
  },
  material_group_candidate: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      strategy_id: org && probe('material_group_strategy', org),
      name: 'Probe',
    }),
  },
  // WG-09: Marktkräfte je Strategie
  material_group_market_force: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      strategy_id: org && probe('material_group_strategy', org),
      force: 'rivalry',
    }),
  },
  // WG-10: Profil, Hebelkatalog und Paarungen
  material_group_swot_item: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      strategy_id: org && probe('material_group_strategy', org),
      type: 'strength',
      code: `S${Math.floor(Math.random() * 1_000_000)}`,
      text: 'Probe',
    }),
  },
  lever: {
    kind: 'org_private',
    testValues: () => ({ name: `Probe ${randomUUID()}` }),
  },
  material_group_lever_choice: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      strategy_id: org && probe('material_group_strategy', org),
      internal_item_id: org && probe('material_group_swot_item', org),
      external_item_id: org && probe('material_group_swot_item', org),
      lever_id: org && probe('lever', org),
      reason: 'Probe',
    }),
  },
  // NAV-10: Notizen an Lieferanten; private sieht nur die Autorin (Policy note_private_author)
  note: {
    kind: 'org_private',
    testValues: ({ orgUser }) => ({
      author_user_id: orgUser,
      visibility: 'team',
      kind: 'note',
      text: 'Probe',
    }),
  },
  // IN-01: Integrationsschicht, je Organisation
  connection: {
    kind: 'org_private',
    testValues: { connector_key: 'files', scope: 'org', connected_by: 'probe' },
  },
  connection_secret: {
    kind: 'org_private',
    testValues: ({ probe, org }) => ({
      connection_id: probe('connection', org ?? ''),
      kind: 'api_key',
      ciphertext: 'x',
      key_ref: 'probe',
    }),
  },
  sync_job: {
    kind: 'org_private',
    testValues: ({ probe, org }) => ({
      connection_id: probe('connection', org ?? ''),
      kind: 'probe',
    }),
  },
  sync_event: {
    kind: 'org_private',
    testValues: ({ probe, org }) => ({
      connection_id: probe('connection', org ?? ''),
      direction: 'in',
      kind: 'probe',
      status: 'ignored',
    }),
  },
  inbound_hook: {
    kind: 'org_private',
    testValues: ({ probe, org }) => ({
      connection_id: probe('connection', org ?? ''),
      path_token: `probe-${Math.random()}`,
      secret_ref: '0190a0a0-0000-7000-8000-000000000001',
    }),
  },
  // IN-03: Termine aus Outlook, Eingangsadresse und Kalender, je Käufer privat
  meeting_attendee: {
    kind: 'org_private',
    testValues: ({ buyer, probe }) => ({
      meeting_id: buyer && probe('meeting', buyer),
      email: 'probe@example.com',
      side: 'unknown',
    }),
  },
  supplier_domain: {
    kind: 'org_private',
    testValues: () => ({
      domain: `probe-${Math.random().toString(36).slice(2)}.example`,
      source: 'manual',
    }),
  },
  inbound_item: {
    kind: 'org_private',
    testValues: {
      source: 'inbound_mail',
      subject: 'Probe',
      details: {},
      suggestion_kind: 'none',
      status: 'needs_review',
    },
  },
  addin_registration: {
    kind: 'org_private',
    testValues: {
      user_id: 'probe',
      organizer_email: 'probe@example.com',
      subject: 'Probe',
      start_at: '2026-01-01T08:00:00Z',
      meeting_type: 'other',
    },
  },
  // IN-02: Anmeldung über Microsoft und Google, je Organisation
  org_sso: {
    kind: 'org_private',
    testValues: { provider: 'google', hosted_domain: 'probe.example', updated_by: 'probe' },
  },
  user_identity: {
    kind: 'global',
    manual: 'Externe Identität je Person; nur die Anmelde-Funktionen lesen und schreiben (IN-02)',
  },
  // IN-07: Schlüssel der Import-API, je Organisation
  api_key: {
    kind: 'org_private',
    testValues: () => ({
      name: 'Probe',
      prefix: 'probe',
      hash: `probe-${Math.random().toString(36).slice(2)}`,
      created_by: 'probe',
    }),
  },
  // IN-04: abgelegte Mails; „Nur ich“ sieht nur, wer sie abgelegt hat (filed_mail_private_owner)
  filed_mail: {
    kind: 'org_private',
    testValues: ({ orgUser }) => ({
      filed_by: orgUser,
      visibility: 'team',
      message_id: `<probe-${Math.random().toString(36).slice(2)}@example.com>`,
      from_email: 'probe@example.com',
      sent_at: '2026-01-01T08:00:00Z',
      subject: 'Probe',
      body_text: 'Probe',
      source: 'addin',
    }),
  },
  filed_mail_attachment: {
    kind: 'org_private',
    testValues: ({ org, orgUser, probe }) => ({
      filed_mail_id: org && probe('filed_mail', org),
      filed_by: orgUser,
      visibility: 'team',
      file_name: 'probe.pdf',
      mime: 'application/pdf',
      size: 1,
    }),
  },
  // IN-06: Benachrichtigungen; Einstellungen und Teams-Verbindung nur für die Person selbst
  notification_pref: {
    kind: 'org_private',
    testValues: ({ orgUser }) => ({
      user_id: orgUser,
      channel: 'mail',
      kind: `hint_high`,
      mode: 'now',
    }),
  },
  notification_channel: {
    kind: 'org_private',
    testValues: ({ orgUser }) => ({
      user_id: orgUser,
      channel: 'teams',
      conversation_ref: 'probe',
    }),
  },
  notification: {
    kind: 'org_private',
    testValues: ({ orgUser }) => ({
      user_id: orgUser,
      channel: 'mail',
      kind: 'hint_high',
      object_type: 'hint',
      object_id: 'probe',
      bundle_key: 'probe',
      delivery: 'now',
      status: 'queued',
      title: 'Probe',
      href: '/hinweise',
    }),
  },
  // AW-01: Aussage von Reziproq je Person und Seite
  insight_summary: {
    kind: 'org_private',
    testValues: {
      user_id: 'probe',
      page_key: 'overview',
      scope_type: 'org',
      period: '2026',
      facts: '[]',
      facts_hash: 'probe',
      status: 'suppressed',
    },
  },
  // KI-11: Wertpotenziale, Marktsignale und Datenlücken je Beziehung, nur die eigene Organisation
  value_opportunity: {
    kind: 'org_private',
    testValues: {
      template_key: 'index_clause',
      template_version: 1,
      title: 'Probe',
      reason: 'Probe',
      impact_type: 'ebit',
      buyer_low_cents: 1,
      buyer_high_cents: 2,
      confidence: 'medium',
      confidence_reason: 'template_assumption',
      inputs: '{}',
    },
  },
  value_market_signal: {
    kind: 'org_private',
    testValues: {
      kind: 'technology',
      title: 'Probe',
      summary: 'Probe',
      direction: 'neutral',
      sources:
        '[{"title":"Probe","url":"https://example.test","publishedOn":"2026-01-01","excerpt":"Probe"}]',
      outcome: 'no_effect',
      outcome_reason: 'Probe',
    },
  },
  value_data_gap: {
    kind: 'org_private',
    testValues: { data_key: 'probe', description: 'Probe', templates_blocked: '[]' },
  },
  // KI-01: Modellaufrufe über das Gateway, je Organisation
  agent: {
    kind: 'org_private',
    testValues: { key: 'probe', name: 'Probe', description: 'Probe', kind: 'system' },
  },
  agent_version: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      agent_id: org && probe('agent', org),
      version: 1,
      instructions: 'Probe',
      tools: '[]',
      trigger: 'manual',
      output_target: 'probe',
      reviewer_rule: 'starter',
      model_class: 'standard',
      budget_cents: 100,
      max_steps: 2,
    }),
  },
  agent_org_state: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({ agent_id: org && probe('agent', org) }),
  },
  agent_run: {
    kind: 'org_private',
    testValues: ({ org, orgUser, probe }) => ({
      agent_version_id: org && probe('agent_version', org),
      acting_user_id: orgUser ?? 'probe',
      started_by: orgUser ?? 'probe',
      trigger: 'manual',
    }),
  },
  agent_step: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      run_id: org && probe('agent_run', org),
      seq: 1,
      kind: 'plan',
      title: 'Probe',
    }),
  },
  agent_outbound_query: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      run_id: org && probe('agent_run', org),
      step_id: org && probe('agent_step', org),
      text: 'Probe',
      provider: 'fake',
    }),
  },
  model_call: {
    kind: 'org_private',
    testValues: {
      feature: 'probe',
      model_class: 'small',
      provider: 'fake',
      model_id: 'fake-small',
      region: 'eu-local',
      outcome: 'ok',
    },
  },
  // AW-01: EBIT-Ziel je Lieferant
  relationship_ebit_target: {
    kind: 'org_private',
    testValues: () => ({
      year: 2000 + Math.floor(Math.random() * 100),
      ebit_target_cents: 100,
      proposed_by: 'probe',
    }),
  },
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
  // KI-15: Import und Zuordnung, je Käufer privat
  import_batch: {
    kind: 'org_private',
    testValues: {
      kind: 'spend',
      file_name: 'probe.csv',
      file_hash: 'probe',
      created_by: 'demo-test-oem-1',
      created_by_name: 'Probe',
    },
  },
  import_row: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      batch_id: org && probe('import_batch', org),
      row_no: 1,
      raw: {},
      status: 'review',
    }),
  },
  // IN-07: Spend je Monat aus der Import-API
  spend_period: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      period: '2026-01',
      amount_cents: 1,
      delivery_id: '0190a0a0-0000-7000-8000-000000000001',
      batch_id: org && probe('import_batch', org),
    }),
  },
  supplier_alias: {
    kind: 'org_private',
    // Mehrere Probe-Zeilen je Organisation: jede mit eigener Nummer (Nummer je Quellsystem eindeutig)
    testValues: () => ({
      external_number: `probe-${Math.random().toString(36).slice(2)}`,
      created_by: 'demo-test-oem-1',
    }),
  },
  category_rule: {
    kind: 'org_private',
    testValues: ({ org, probe }) => ({
      material_group_id: org && probe('material_group', org),
      field: 'account',
      pattern: `probe-${Math.random().toString(36).slice(2)}`,
      created_by: 'demo-test-oem-1',
    }),
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
