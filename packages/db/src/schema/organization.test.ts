import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { organization } from './organization.js';

describe('organization', () => {
  const config = getTableConfig(organization);

  it('hat genau die Spalten id, name und created_at', () => {
    expect(config.name).toBe('organization');
    expect(config.columns.map((column) => column.name)).toEqual(['id', 'name', 'created_at']);
  });

  it('erzeugt id und created_at in der Datenbank', () => {
    const [id, name, createdAt] = config.columns;
    expect(id?.primary).toBe(true);
    expect(id?.getSQLType()).toBe('uuid');
    expect(id?.hasDefault).toBe(true);
    expect(name?.notNull).toBe(true);
    expect(createdAt?.getSQLType()).toBe('timestamp with time zone');
    expect(createdAt?.notNull).toBe(true);
    expect(createdAt?.hasDefault).toBe(true);
  });
});
