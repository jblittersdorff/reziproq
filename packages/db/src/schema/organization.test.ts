import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { organization } from './organization.js';

describe('organization', () => {
  const config = getTableConfig(organization);
  const column = (name: string) => config.columns.find((candidate) => candidate.name === name);

  it('hat die Spalten aus PLT-02, ohne festen Typ', () => {
    expect(config.name).toBe('organization');
    expect(config.columns.map((c) => c.name)).toEqual([
      'id',
      'name',
      'country',
      'vat_id',
      'duns',
      'zitadel_org_id',
      'created_at',
    ]);
  });

  it('erzeugt id und created_at in der Datenbank', () => {
    expect(column('id')?.primary).toBe(true);
    expect(column('id')?.getSQLType()).toBe('uuid');
    expect(column('id')?.hasDefault).toBe(true);
    expect(column('name')?.notNull).toBe(true);
    expect(column('created_at')?.getSQLType()).toBe('timestamp with time zone');
    expect(column('created_at')?.hasDefault).toBe(true);
  });

  it('hat Land, USt-IdNr., DUNS und Zitadel-Organisation als optionale, eindeutige Angaben', () => {
    expect(column('country')?.notNull).toBe(false);
    for (const name of ['vat_id', 'duns', 'zitadel_org_id']) {
      expect(column(name)?.notNull, name).toBe(false);
      expect(column(name)?.isUnique, name).toBe(true);
    }
  });
});
