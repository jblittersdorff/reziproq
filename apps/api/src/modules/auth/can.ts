import type { Action, OrgRole, TeamRole } from '@reziproq/shared';
import { permissions } from './permissions.js';

/** Wer handelt: Rolle in der Organisation (aus der Datenbank), Controlling und Betreiber. */
export interface Subject {
  /** null ohne Organisation; in der Betreiber-Ansicht viewer (PLT-05) */
  orgRole: OrgRole | null;
  isControlling: boolean;
  isOperator: boolean;
}

/** Wobei gehandelt wird, z. B. an einer Beziehung mit der Teamrolle der Person (PLT-05b). */
export interface Resource {
  teamRole?: TeamRole | null;
}

/**
 * Die einzige Stelle, an der Rechte entschieden werden (PLT-05). Die Matrix steht in
 * permissions.ts. Mit resource gelten Rechte je Objekt: Die Teamrolle Leser macht eine Beziehung
 * schreibgeschützt (PLT-05b). Die Oberfläche zeigt nur das Ergebnis.
 */
export function can(subject: Subject, action: Action, resource?: Resource): boolean {
  const permission = permissions[action];
  if (permission.notForTeamViewer && resource?.teamRole === 'viewer') return false;
  if (permission.operator && subject.isOperator) return true;
  return subject.orgRole !== null && permission.roles.includes(subject.orgRole);
}
