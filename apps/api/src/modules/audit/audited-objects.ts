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
  fields: ['display_name', 'external_ref', 'notes'],
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

export const auditedObjects: readonly AuditedObject[] = [
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
