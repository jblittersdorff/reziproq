import { describe, expect, it } from 'vitest';
import { meResponseSchema } from './me.js';

const ada = {
  name: 'Ada Lovelace',
  firstName: 'Ada',
  email: 'ada@example.com',
  organization: null,
  supportView: false,
  permissions: { viewOrganizationSettings: false, viewSuppliers: false, switchCustomer: false },
};

describe('meResponseSchema', () => {
  it('akzeptiert eine vollständige Antwort', () => {
    expect(meResponseSchema.parse(ada)).toEqual(ada);
    const withOrg = { ...ada, organization: { id: 'org-1', name: 'Beispiel-OEM' } };
    expect(meResponseSchema.parse(withOrg)).toEqual(withOrg);
  });

  it('lehnt fehlende oder ungültige Werte ab', () => {
    expect(meResponseSchema.safeParse({ ...ada, name: '' }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...ada, email: 'keine-mail' }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...ada, firstName: undefined }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...ada, permissions: undefined }).success).toBe(false);
  });
});
