import { describe, expect, it } from 'vitest';
import { can } from './can.js';
import { rolesFromToken } from './roles.js';

describe('can', () => {
  it('erlaubt nur Betreibern, den Kunden zu wechseln', () => {
    expect(can({ roles: ['betreiber'] }, 'kunden.wechseln')).toBe(true);
    for (const role of ['admin', 'nutzer', 'leser', 'controlling'] as const) {
      expect(can({ roles: [role] }, 'kunden.wechseln')).toBe(false);
    }
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

describe('can kunden.wechseln', () => {
  it('erlaubt den Wechsel in Kunden nur Betreibern, auch keinem Admin eines Kunden', () => {
    expect(can({ roles: ['betreiber'] }, 'kunden.wechseln')).toBe(true);
    for (const role of ['admin', 'nutzer', 'leser', 'controlling'] as const) {
      expect(can({ roles: [role] }, 'kunden.wechseln')).toBe(false);
    }
  });

  it('lässt Betreiber in einem Kunden Lieferanten und Prompt-Fenster nutzen', () => {
    expect(can({ roles: ['betreiber'] }, 'lieferanten.sehen')).toBe(true);
    expect(can({ roles: ['betreiber'] }, 'prompt.nutzen')).toBe(true);
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

describe('can einstellungen.verwalten', () => {
  it('PLT-11: gibt den Weg zu allen Einstellungen nur Admins frei', () => {
    expect(can({ roles: ['admin'] }, 'einstellungen.verwalten')).toBe(true);
    for (const role of ['nutzer', 'leser', 'controlling', 'betreiber'] as const) {
      expect(can({ roles: [role] }, 'einstellungen.verwalten')).toBe(false);
    }
  });
});
