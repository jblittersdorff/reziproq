import { describe, expect, it } from 'vitest';
import { can } from './can.js';
import { rolesFromToken } from './roles.js';

describe('can', () => {
  it('erlaubt nur Admins, die Organisationseinstellungen zu sehen', () => {
    expect(can({ roles: ['admin'] }, 'organisation.einstellungen.sehen')).toBe(true);
    expect(can({ roles: ['leser', 'admin'] }, 'organisation.einstellungen.sehen')).toBe(true);
    for (const role of ['nutzer', 'leser', 'controlling'] as const) {
      expect(can({ roles: [role] }, 'organisation.einstellungen.sehen')).toBe(false);
    }
    expect(can({ roles: [] }, 'organisation.einstellungen.sehen')).toBe(false);
  });
});

describe('can lieferanten.sehen', () => {
  it('erlaubt allen Käufer-Rollen die Lieferantenliste, ohne Rolle niemandem', () => {
    for (const role of ['admin', 'nutzer', 'leser', 'controlling'] as const) {
      expect(can({ roles: [role] }, 'lieferanten.sehen')).toBe(true);
    }
    expect(can({ roles: [] }, 'lieferanten.sehen')).toBe(false);
  });
});

describe('rolesFromToken', () => {
  const grant = { '123': 'beispiel.zitadel.test' };

  it('liest die Rollen des Projekts aus dem Token', () => {
    expect(
      rolesFromToken({ 'urn:zitadel:iam:org:project:p1:roles': { admin: grant } }, 'p1'),
    ).toEqual(['admin']);
    expect(
      rolesFromToken(
        { 'urn:zitadel:iam:org:project:roles': { leser: grant, nutzer: grant } },
        'p1',
      ),
    ).toEqual(['nutzer', 'leser']);
  });

  it('ignoriert fehlende, kaputte und unbekannte Rollen', () => {
    expect(rolesFromToken({}, 'p1')).toEqual([]);
    expect(rolesFromToken({ 'urn:zitadel:iam:org:project:roles': 'admin' }, 'p1')).toEqual([]);
    expect(rolesFromToken({ 'urn:zitadel:iam:org:project:roles': ['admin'] }, 'p1')).toEqual([]);
    expect(
      rolesFromToken({ 'urn:zitadel:iam:org:project:roles': { superuser: grant } }, 'p1'),
    ).toEqual([]);
  });
});
