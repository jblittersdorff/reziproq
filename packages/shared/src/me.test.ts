import { describe, expect, it } from 'vitest';
import { meResponseSchema } from './me.js';

const ada = {
  name: 'Ada Lovelace',
  firstName: 'Ada',
  email: 'ada@example.com',
  organization: null,
  supportView: false,
  roles: ['betreiber'],
  permissions: {
    viewOrganizationSettings: false,
    viewBuyerAreas: false,
    viewSuppliers: false,
    switchCustomer: false,
    manageSettings: false,
  },
};

describe('meResponseSchema', () => {
  it('akzeptiert eine vollständige Antwort', () => {
    expect(meResponseSchema.parse(ada)).toEqual(ada);
    const withOrg = { ...ada, organization: { id: 'org-1', name: 'Beispiel-OEM' } };
    expect(meResponseSchema.parse(withOrg)).toEqual(withOrg);
  });

  it('nimmt ohne Rollen eine leere Liste an und lehnt unbekannte Rollen ab (PLT-01)', () => {
    expect(meResponseSchema.parse({ ...ada, roles: undefined }).roles).toEqual([]);
    expect(meResponseSchema.safeParse({ ...ada, roles: ['chef'] }).success).toBe(false);
  });

  it('lehnt fehlende oder ungültige Werte ab', () => {
    expect(meResponseSchema.safeParse({ ...ada, name: '' }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...ada, email: 'keine-mail' }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...ada, firstName: undefined }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...ada, permissions: undefined }).success).toBe(false);
  });
});
