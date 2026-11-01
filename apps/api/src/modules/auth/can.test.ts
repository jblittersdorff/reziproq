import { actions, orgRoles } from '@reziproq/shared';
import { describe, expect, it } from 'vitest';
import { can, type Subject } from './can.js';
import { permissions } from './permissions.js';
import { rolesFromToken } from './roles.js';

// PLT-05: can() liest nur die Rolle aus der Datenbank, das Controlling-Kennzeichen und ob jemand
// Betreiber ist. Was die API damit macht, prüft permissions.test.ts gegen echte Endpunkte.

const as = (orgRole: Subject['orgRole'], extra: Partial<Subject> = {}): Subject => ({
  orgRole,
  isControlling: false,
  isOperator: false,
  ...extra,
});

describe('can', () => {
  it('folgt für jede Aktion und Rolle genau der Matrix in permissions.ts', () => {
    for (const action of actions) {
      for (const role of orgRoles) {
        expect(can(as(role), action), `${role} ${action}`).toBe(
          permissions[action].roles.includes(role),
        );
      }
    }
  });

  it('erlaubt ohne Organisation nichts außer Betreiber-Aktionen', () => {
    expect(actions.filter((action) => can(as(null), action))).toEqual([]);
    expect(actions.filter((action) => can(as(null, { isOperator: true }), action))).toEqual([
      'kunden.wechseln',
    ]);
  });

  it('erlaubt den Wechsel in Kunden nur Betreibern, auch keinem Admin eines Kunden', () => {
    expect(can(as('admin'), 'kunden.wechseln')).toBe(false);
    expect(can(as('viewer', { isOperator: true }), 'kunden.wechseln')).toBe(true);
  });

  it('Controlling gibt bisher keine zusätzlichen Rechte (Freigaben kommen mit PNL-06)', () => {
    for (const action of actions) {
      expect(can(as('viewer', { isControlling: true }), action)).toBe(can(as('viewer'), action));
    }
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
