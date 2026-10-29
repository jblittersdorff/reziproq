import { afterEach, describe, expect, it } from 'vitest';
import { databaseUrl } from './env.js';

describe('databaseUrl', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it('liefert eine gültige Postgres-URL', () => {
    process.env.DATABASE_URL = 'postgres://user:pw@localhost:5432/app';
    expect(databaseUrl()).toBe('postgres://user:pw@localhost:5432/app');
  });

  it('meldet einen klaren Fehler bei ungültiger URL', () => {
    process.env.DATABASE_URL = 'mysql://localhost';
    expect(() => databaseUrl()).toThrow(/DATABASE_URL/);
  });
});
