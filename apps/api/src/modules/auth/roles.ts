import type { JWTPayload } from 'jose';

/**
 * Projektrollen aus dem Zitadel-Access-Token. Seit PLT-05 zählen Rollen nur noch in der
 * Datenbank; das Token liefert sie einmalig für die Übernahme beim Login. Betreiber stehen seit
 * UMB-01 nur in der Datenbank (is_operator); die Rolle betreiber wird ignoriert wie jede unbekannte.
 */
export const tokenRoles = ['admin', 'nutzer', 'leser', 'controlling'] as const;
export type TokenRole = (typeof tokenRoles)[number];

export function rolesFromToken(payload: JWTPayload, projectId: string): TokenRole[] {
  const claim =
    payload[`urn:zitadel:iam:org:project:${projectId}:roles`] ??
    payload['urn:zitadel:iam:org:project:roles'];
  if (typeof claim !== 'object' || claim === null || Array.isArray(claim)) return [];
  return tokenRoles.filter((role) => Object.hasOwn(claim, role));
}
