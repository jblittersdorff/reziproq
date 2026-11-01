import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';

/** Alle Schlüsselpfade eines Textkatalogs, z. B. "areas.pulse.title". */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function leaf(catalog: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], catalog);
}

describe('Übersetzungen', () => {
  it('de und en haben genau dieselben Schlüssel', () => {
    expect(keyPaths(en)).toEqual(keyPaths(de));
  });

  it.each([
    ['de', de],
    ['en', en],
  ] as const)('enthalten in %s keine leeren Texte', (_locale, catalog) => {
    const empty = keyPaths(catalog).filter((path) => {
      const value = leaf(catalog, path);
      const text = typeof value === 'function' ? value('x') : value;
      return typeof text !== 'string' || text.trim() === '';
    });
    expect(empty).toEqual([]);
  });

  it('Ein Test scheitert bei jedem fehlenden oder überzähligen Schlüssel', () => {
    const { notFound: _, ...withoutNotFound } = de;
    expect(keyPaths(withoutNotFound)).not.toEqual(keyPaths(de));
    const withExtra = { ...en, extra: { only: 'only in en' } };
    expect(keyPaths(withExtra)).not.toEqual(keyPaths(de));
  });
});
