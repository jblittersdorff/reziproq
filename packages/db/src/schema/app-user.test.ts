import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { appUser } from './app-user.js';

describe('app_user', () => {
  const config = getTableConfig(appUser);

  it('hat die Spalten id, name, given_name, email, organization_id, created_at und updated_at', () => {
    expect(config.name).toBe('app_user');
    expect(config.columns.map((column) => column.name)).toEqual([
      'id',
      'name',
      'given_name',
      'email',
      'organization_id',
      'created_at',
      'updated_at',
    ]);
  });

  it('erlaubt einen leeren Vornamen', () => {
    const givenName = config.columns.find((column) => column.name === 'given_name');
    expect(givenName?.notNull).toBe(false);
  });

  it('gehört zu höchstens einer Organisation, darf aber auch keiner angehören', () => {
    const organizationId = config.columns.find((column) => column.name === 'organization_id');
    expect(organizationId?.notNull).toBe(false);
    expect(config.foreignKeys).toHaveLength(1);
  });

  it('nutzt sub aus dem Token als Primärschlüssel', () => {
    const id = config.columns.find((column) => column.name === 'id');
    expect(id?.primary).toBe(true);
    expect(id?.getSQLType()).toBe('text');
    expect(id?.hasDefault).toBe(false);
  });
});
