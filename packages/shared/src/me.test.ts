import { describe, expect, it } from 'vitest';
import { meResponseSchema } from './me.js';

const ada = {
  name: 'Ada Lovelace',
  firstName: 'Ada',
  email: 'ada@example.com',
  organization: null,
  supportView: false,
  orgRole: null,
  isControlling: false,
  isOperator: true,
  pendingApproval: false,
  locale: 'en',
  categoryLabel: { singular: 'Warengruppe', plural: 'Warengruppen' },
  permissions: {
    viewOrganizationSettings: false,
    viewBuyerAreas: false,
    viewSuppliers: false,
    viewCustomers: false,
    switchCustomer: true,
  },
};

describe('meResponseSchema', () => {
  it('akzeptiert eine vollständige Antwort', () => {
    expect(meResponseSchema.parse(ada)).toEqual(ada);
    const withOrg = { ...ada, organization: { id: 'org-1', name: 'Beispiel-OEM' } };
    expect(meResponseSchema.parse(withOrg)).toEqual(withOrg);
  });

  it('PLT-09: kennt nur die Sprachen de und en; ohne Angabe Deutsch', () => {
    const { locale: _, ...withoutLocale } = ada;
    expect(meResponseSchema.parse(withoutLocale).locale).toBe('de');
    expect(meResponseSchema.safeParse({ ...ada, locale: 'fr' }).success).toBe(false);
  });

  it('kennt nur die Rollen admin, member und viewer (PLT-05)', () => {
    expect(meResponseSchema.parse({ ...ada, orgRole: 'member' }).orgRole).toBe('member');
    expect(meResponseSchema.safeParse({ ...ada, orgRole: 'nutzer' }).success).toBe(false);
  });

  it('lehnt fehlende oder ungültige Werte ab', () => {
    expect(meResponseSchema.safeParse({ ...ada, name: '' }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...ada, email: 'keine-mail' }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...ada, firstName: undefined }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...ada, permissions: undefined }).success).toBe(false);
  });
});
