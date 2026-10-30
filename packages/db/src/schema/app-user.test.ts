import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { appUser } from './app-user.js';

describe('app_user', () => {
  const config = getTableConfig(appUser);

  it('hat die Spalten id, name, email, created_at und updated_at', () => {
    expect(config.name).toBe('app_user');
    expect(config.columns.map((column) => column.name)).toEqual([
      'id',
      'name',
      'email',
      'created_at',
      'updated_at',
    ]);
  });

  it('nutzt sub aus dem Token als Primärschlüssel', () => {
    const id = config.columns.find((column) => column.name === 'id');
    expect(id?.primary).toBe(true);
    expect(id?.getSQLType()).toBe('text');
    expect(id?.hasDefault).toBe(false);
  });
});
