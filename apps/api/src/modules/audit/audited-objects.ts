import type { AuditedObject } from '@reziproq/db';

// PLT-08: Objekte mit Verlauf. Ein Objekt bekommt Verlauf, indem es hier mit auditedObject()
// eingetragen wird; seine Änderungen laufen dann über auditedChange() (@reziproq/db).
// Bei geteilten Objekten nur geteilte Felder eintragen; den Test dafür hat audit.test.ts.
// Das erste Objekt ist die Beziehung (PLT-03b).

export const auditedObjects: readonly AuditedObject[] = [];

export function auditedObjectByType(type: string): AuditedObject | undefined {
  return auditedObjects.find((object) => object.type === type);
}
