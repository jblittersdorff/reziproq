import { describe, expect, it } from 'vitest';
import { databaseName, isVorschauDatabase, vorschauDir, vorschauUrl } from './vorschau-lib.mjs';

// Feste Vorschau (26.11.2026): eigener Ordner neben dem Repo und eigene Datenbank; gelöscht wird
// nur eine Datenbank der Vorschau, nie die Entwicklungs- oder Testdatenbank.

describe('Feste Vorschau', () => {
  it('liegt im Nachbarordner des Repos, außer VORSCHAU_DIR sagt etwas anderes', () => {
    expect(vorschauDir('/Users/x/Code/reziproq')).toBe('/Users/x/Code/reziproq-vorschau');
    expect(vorschauDir('/Users/x/Code/reziproq', '/tmp/vorschau/')).toBe('/tmp/vorschau');
  });

  it('nutzt denselben Server und dieselbe Rolle mit eigener Datenbank', () => {
    const url = vorschauUrl('postgres://reziproq:geheim@localhost:5433/reziproq');
    expect(url).toBe('postgres://reziproq:geheim@localhost:5433/reziproq_vorschau');
    expect(databaseName(url)).toBe('reziproq_vorschau');
    // Zweimal angewendet bleibt es dieselbe Datenbank
    expect(vorschauUrl(url)).toBe(url);
    expect(() => vorschauUrl('postgres://x@localhost/drop;table')).toThrow(/Ungültiger/);
  });

  it('löscht nur Datenbanken der Vorschau', () => {
    expect(isVorschauDatabase('reziproq_vorschau')).toBe(true);
    expect(isVorschauDatabase('reziproq')).toBe(false);
    expect(isVorschauDatabase('reziproq_test')).toBe(false);
    expect(isVorschauDatabase('vorschau')).toBe(false);
  });
});
