import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { organization } from './organization.js';

describe('organization', () => {
  const config = getTableConfig(organization);
  const column = (name: string) => config.columns.find((candidate) => candidate.name === name);

  it('hat die Spalten id, name, typ, land und created_at', () => {
    expect(config.name).toBe('organization');
    expect(config.columns.map((c) => c.name)).toEqual(['id', 'name', 'typ', 'land', 'created_at']);
  });

  it('erzeugt id und created_at in der Datenbank', () => {
    expect(column('id')?.primary).toBe(true);
    expect(column('id')?.getSQLType()).toBe('uuid');
    expect(column('id')?.hasDefault).toBe(true);
    expect(column('name')?.notNull).toBe(true);
    expect(column('created_at')?.getSQLType()).toBe('timestamp with time zone');
    expect(column('created_at')?.hasDefault).toBe(true);
  });

  it('unterscheidet Käufer und Lieferant als Pflichtangabe; das Land ist optional', () => {
    expect(column('typ')?.notNull).toBe(true);
    expect(column('typ')?.enumValues).toEqual(['kaeufer', 'lieferant']);
    expect(column('land')?.notNull).toBe(false);
  });
});
