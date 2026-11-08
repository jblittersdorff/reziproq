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
