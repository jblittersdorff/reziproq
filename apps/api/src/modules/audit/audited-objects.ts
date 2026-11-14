import { type AuditedObject, auditedObject } from '@reziproq/db';

// PLT-08: Objekte mit Verlauf. Ein Objekt bekommt Verlauf, indem es hier mit auditedObject()
// eingetragen wird; seine Änderungen laufen dann über auditedChange() (@reziproq/db).
// Bei geteilten Objekten nur geteilte Felder eintragen; den Test dafür hat audit.test.ts.

/** Die Beziehung selbst (PLT-03): Beide Seiten sehen nur den Status. */
export const relationshipAudit = auditedObject({
  type: 'relationship',
  visibility: 'shared',
  fields: ['status'],
});

/** Eigene Werte einer Seite (PLT-03): nur die eigene Organisation sieht den Verlauf. */
export const relationshipSideAudit = auditedObject({
  type: 'relationship_side',
  visibility: 'internal',
  fields: ['display_name', 'external_ref', 'notes', 'is_focus', 'focus_reason'],
});

/** Spend je Jahr (PLT-03): käuferprivat, Verlauf nur intern. */
export const relationshipSpendAudit = auditedObject({
  type: 'relationship_spend',
  visibility: 'internal',
  fields: ['year', 'amount_cents'],
});

/** Rolle, Controlling und Funktion einer Person (PLT-05): Verlauf nur intern. */
export const userRoleAudit = auditedObject({
  type: 'app_user_role',
  visibility: 'internal',
  fields: ['org_role', 'is_controlling', 'default_function'],
});

/** Internes Team einer Beziehung (PLT-05b): das ganze Team vorher und nachher. */
export const relationshipTeamAudit = auditedObject({
  type: 'relationship_member',
  visibility: 'internal',
  fields: ['team'],
});

/** Business Units und Warengruppen eines Lieferanten (PLT-06): käuferprivat, Verlauf intern. */
export const relationshipAssignmentAudit = auditedObject({
  type: 'relationship_assignment',
  visibility: 'internal',
  fields: ['business_units', 'material_groups', 'primary_material_group'],
});

/** Bewertungsrunde (SEG-03): Verlauf nur intern, die Runde sieht der Lieferant nie. */
export const segmentationRoundAudit = auditedObject({
  type: 'segmentation_round',
  visibility: 'internal',
  fields: ['name', 'due_date', 'status', 'model_version'],
});

/** Einladung zur Bewertung (SEG-03): je bewertender Person ein Eintrag samt Mail. */
export const ratingInvitationAudit = auditedObject({
  type: 'rating_invitation',
  visibility: 'internal',
  fields: ['round'],
});

/** Einladung einer Person des Lieferanten (LIF-01): nur die einladende Organisation sieht sie. */
export const supplierInvitationAudit = auditedObject({
  type: 'invitation',
  visibility: 'internal',
  fields: ['email', 'status'],
});

/** Mit dem Lieferanten geteilter Beziehungstyp (SEG-10): beide Seiten sehen, dass geteilt wurde. */
export const relationshipTargetAudit = auditedObject({
  type: 'relationship_target',
  visibility: 'shared',
  fields: ['type_name', 'rule_set_version'],
});

/** Termine (QBR-01): geteilt, beide Seiten sehen den Verlauf. */
export const meetingAudit = auditedObject({
  type: 'meeting',
  visibility: 'shared',
  fields: ['title', 'starts_at', 'status'],
});

/** Freigabe-Anfrage an SRO oder Sponsor (SPL-07): je Person ein Eintrag mit Mail, intern. */
export const planApprovalRequestAudit = auditedObject({
  type: 'plan_approval_request',
  visibility: 'internal',
  fields: ['recipient', 'round'],
});

/** Gemeinsamer Plan (JBP-01): geteilt, beide Seiten sehen den Verlauf. */
export const jbpAudit = auditedObject({
  type: 'jbp',
  visibility: 'shared',
  fields: ['version', 'status'],
});

/** Thema einer Seite im Gemeinsamen Plan (JBP-02): geteilt. */
export const jbpTopicAudit = auditedObject({
  type: 'jbp_topic',
  visibility: 'shared',
  fields: ['title', 'description', 'status', 'priority'],
});

/** Gemeinsame Initiative (JBP-03): geteilt, beide Seiten sehen jede Änderung. */
export const initiativeAudit = auditedObject({
  type: 'initiative',
  visibility: 'shared',
  fields: [
    'title',
    'goal',
    'benefit_buyer',
    'benefit_supplier',
    'owner_buyer_name',
    'owner_supplier_name',
    'starts_on',
    'ends_on',
    'status',
    'milestones',
  ],
});

/** Anfrage zur Prüfung des Gemeinsamen Plans an eine Person des Lieferanten (JBP-06), mit Mail. */
export const jbpReviewRequestAudit = auditedObject({
  type: 'jbp_review_request',
  visibility: 'internal',
  fields: ['recipient', 'version'],
});

/** Scorecard (JBP-07): Version, Status und wer unterschrieben hat; beide Seiten sehen den Verlauf. */
export const scorecardAudit = auditedObject({
  type: 'scorecard',
  visibility: 'shared',
  fields: ['version', 'status', 'signed_by'],
});

/** Kennzahl der Scorecard (JBP-07): geteilt. */
export const scorecardKpiAudit = auditedObject({
  type: 'scorecard_kpi',
  visibility: 'shared',
  fields: [
    'name',
    'unit',
    'direction',
    'baseline',
    'target',
    'target_date',
    'owner_name',
    'benefit_for',
  ],
});

/** Wirkung einer Initiative (PNL-01): käuferprivat, Verlauf nur intern. */
export const initiativeImpactAudit = auditedObject({
  type: 'initiative_impact',
  visibility: 'internal',
  fields: ['lever', 'lever_template_version', 'pnl_line_key', 'effect_type', 'effective_from'],
});

/** Eingefrorene Baseline (PNL-03): käuferprivat, je Version ein Eintrag. */
export const baselineAudit = auditedObject({
  type: 'initiative_baseline',
  visibility: 'internal',
  fields: ['version', 'inputs', 'change_reason'],
});

/** Reifegrad (PNL-03): geteilt, beide Seiten sehen Stufe und Nachweis. */
export const maturityAudit = auditedObject({
  type: 'maturity',
  visibility: 'shared',
  fields: ['level', 'evidence'],
});

/** Monatswerte einer Wirkung (PNL-05): käuferprivat; Objekt ist die Initiative. */
export const impactMonthAudit = auditedObject({
  type: 'initiative_input_month',
  visibility: 'internal',
  fields: ['month', 'kind', 'inputs', 'source'],
});

/** Freigabe durch Controlling (PNL-06): käuferprivat, je Anfrage und Entscheidung. */
export const validationAudit = auditedObject({
  type: 'initiative_validation',
  visibility: 'internal',
  fields: ['status', 'period', 'comment'],
});

/** GuV-Zeilen der Organisation (PNL-01): Verlauf nur intern. */
export const pnlLineAudit = auditedObject({
  type: 'pnl_line',
  visibility: 'internal',
  fields: ['key', 'name', 'position', 'active'],
});

/** Fragebogen der Organisation (PUL-01): jede Änderung eine Version; Verlauf nur intern. */
export const surveyAudit = auditedObject({
  type: 'survey_template',
  visibility: 'internal',
  fields: ['kind', 'version', 'question', 'text_de', 'text_en', 'active'],
});

/** Rollenbeschreibung der Organisation (PLB-04): Verlauf nur intern. */
export const roleDescriptionAudit = auditedObject({
  type: 'role_description',
  visibility: 'internal',
  fields: ['role', 'does', 'does_not'],
});

/** Eigene Sicht des Lieferanten (LIF-03): nur intern, der Käufer sieht keinen Verlauf. */
export const accountPlanAudit = auditedObject({
  type: 'supplier_account_plan',
  visibility: 'internal',
  fields: ['summary', 'own_view', 'importance', 'objective', 'target_year'],
});

/** Feedback-Welle (PUL-02): Start, Frist und Abschluss je Seite, für beide Seiten sichtbar. */
export const surveyWaveAudit = auditedObject({
  type: 'survey_wave',
  visibility: 'shared',
  fields: ['kind', 'due_date', 'buyer_closed', 'supplier_closed'],
});

/** Einladung zu einer Welle (PUL-02): nur die einladende Seite; ohne Antworten. */
export const surveyParticipantAudit = auditedObject({
  type: 'survey_participant',
  visibility: 'internal',
  fields: ['side', 'function'],
});

/** Ist-Werte einer Kennzahl (JBP-09): je Monat, geteilt; Objekt ist die Kennzahl. */
export const kpiValueAudit = auditedObject({
  type: 'kpi_value',
  visibility: 'shared',
  fields: ['period', 'value', 'source'],
});

/** Toleranz „knapp“ des Kunden (JBP-09): Verlauf nur intern. */
export const scorecardSettingAudit = auditedObject({
  type: 'scorecard_setting',
  visibility: 'internal',
  fields: ['tolerance_percent'],
});

/** Bitte um Unterschrift an eine Person des Lieferanten (JBP-07), mit Mail; käuferprivat. */
export const scorecardSignRequestAudit = auditedObject({
  type: 'scorecard_sign_request',
  visibility: 'internal',
  fields: ['recipient', 'version'],
});

/** Zusage einer Seite (JBP-05): geteilt, beide Seiten sehen jede Änderung. */
export const commitmentAudit = auditedObject({
  type: 'commitment',
  visibility: 'shared',
  fields: ['title', 'owner_name', 'due_on', 'status', 'initiative'],
});

/** Geschäftsupdate einer Seite im JBP (JBP-01): geteilt. */
export const jbpBusinessUpdateAudit = auditedObject({
  type: 'jbp_business_update',
  visibility: 'shared',
  fields: ['text'],
});

/** Geteilte Maßnahmen (QBR-03): beide Seiten sehen den Verlauf. */
export const actionAudit = auditedObject({
  type: 'action',
  visibility: 'shared',
  fields: ['title', 'owner_name', 'due_date', 'status'],
});

/** Interne Maßnahmen (QBR-03): Verlauf nur für die eigene Seite. */
export const actionInternalAudit = auditedObject({
  type: 'action_internal',
  visibility: 'internal',
  fields: ['title', 'owner_name', 'due_date', 'status'],
});

/** Kataloge für Spielregeln und Formate (PLB-01): intern beim Käufer. */
export const ruleCatalogAudit = auditedObject({
  type: 'rule_catalog_item',
  visibility: 'internal',
  fields: ['kind', 'group', 'title', 'counterpart_id', 'min_impact_level'],
});
export const formatCatalogAudit = auditedObject({
  type: 'format_catalog_item',
  visibility: 'internal',
  fields: ['name', 'level', 'cadence', 'min_impact_level', 'for_quality_levels'],
});

/** Spielregeln einer Beziehung (PLB-03): intern, bis SEG-10 sie teilt. */
export const ruleSetAudit = auditedObject({
  type: 'rule_set',
  visibility: 'internal',
  fields: ['version', 'status', 'type_name'],
});

/** Interner Lieferantenplan, Ziele und Kategorien (SPL-01). */
export const supplierPlanAudit = auditedObject({
  type: 'supplier_plan',
  visibility: 'internal',
  fields: ['version', 'status', 'summary'],
});
export const planObjectiveAudit = auditedObject({
  type: 'plan_objective',
  visibility: 'internal',
  fields: [
    'category_key',
    'business_unit_id',
    'material_group_id',
    'text',
    'owner_user_id',
    'target_year',
  ],
});
/** Angeforderter Beitrag zum Lieferantenplan (SPL-03); die Anfrage-Mail hängt am Verlaufseintrag. */
export const planContributionAudit = auditedObject({
  type: 'plan_contribution',
  visibility: 'internal',
  fields: ['business_unit_id', 'material_group_id', 'assignee_user_id', 'due_date', 'status'],
});
/** Strategisches Thema (SPL-06); objective_ids hält die verknüpften Ziele als Liste. */
export const strategicTopicAudit = auditedObject({
  type: 'strategic_topic',
  visibility: 'internal',
  fields: ['title', 'reason', 'priority', 'objective_ids'],
});
export const objectiveCategoryAudit = auditedObject({
  type: 'objective_category',
  visibility: 'internal',
  fields: ['name', 'position', 'active'],
});

export const auditedObjects: readonly AuditedObject[] = [
  objectiveCategoryAudit,
  planContributionAudit,
  planObjectiveAudit,
  strategicTopicAudit,
  supplierPlanAudit,
  segmentationRoundAudit,
  ratingInvitationAudit,
  supplierInvitationAudit,
  ruleSetAudit,
  relationshipTargetAudit,
  meetingAudit,
  actionAudit,
  jbpAudit,
  jbpBusinessUpdateAudit,
  jbpTopicAudit,
  initiativeAudit,
  commitmentAudit,
  jbpReviewRequestAudit,
  scorecardAudit,
  scorecardKpiAudit,
  scorecardSignRequestAudit,
  kpiValueAudit,
  initiativeImpactAudit,
  baselineAudit,
  maturityAudit,
  pnlLineAudit,
  surveyAudit,
  accountPlanAudit,
  roleDescriptionAudit,
  surveyWaveAudit,
  surveyParticipantAudit,
  impactMonthAudit,
  validationAudit,
  scorecardSettingAudit,
  planApprovalRequestAudit,
  actionInternalAudit,
  ruleCatalogAudit,
  formatCatalogAudit,
  relationshipAssignmentAudit,
  relationshipTeamAudit,
  userRoleAudit,
  relationshipAudit,
  relationshipSideAudit,
  relationshipSpendAudit,
];

export function auditedObjectByType(type: string): AuditedObject | undefined {
  return auditedObjects.find((object) => object.type === type);
}
