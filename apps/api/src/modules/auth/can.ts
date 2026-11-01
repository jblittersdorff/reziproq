import type { Action, OrgRole } from '@reziproq/shared';
import { permissions } from './permissions.js';

/** Wer handelt: Rolle in der Organisation (aus der Datenbank), Controlling und Betreiber. */
export interface Subject {
  /** null ohne Organisation; in der Betreiber-Ansicht viewer (PLT-05) */
  orgRole: OrgRole | null;
  isControlling: boolean;
  isOperator: boolean;
}

/**
 * Die einzige Stelle, an der Rechte entschieden werden (PLT-05). Die Matrix steht in
 * permissions.ts. resource ist für Rechte je Objekt da, z. B. die Teamrolle Leser (PLT-05b).
 * Die Oberfläche zeigt nur das Ergebnis.
 */
export function can(subject: Subject, action: Action, _resource?: unknown): boolean {
  const permission = permissions[action];
  if (permission.operator && subject.isOperator) return true;
  return subject.orgRole !== null && permission.roles.includes(subject.orgRole);
}
