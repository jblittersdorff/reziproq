import { type Role, roles } from '@reziproq/shared';
import type { JWTPayload } from 'jose';

/**
 * Projektrollen aus dem Zitadel-Access-Token. Zitadel schreibt sie, wenn im Projekt
 * „Rollen bei Authentifizierung mitgeben“ eingeschaltet ist, als Objekt mit den Rollen als Schlüssel.
 * Unbekannte Rollen werden ignoriert.
 */
export function rolesFromToken(payload: JWTPayload, projectId: string): Role[] {
  const claim =
    payload[`urn:zitadel:iam:org:project:${projectId}:roles`] ??
    payload['urn:zitadel:iam:org:project:roles'];
  if (typeof claim !== 'object' || claim === null || Array.isArray(claim)) return [];
  return roles.filter((role) => Object.hasOwn(claim, role));
}
