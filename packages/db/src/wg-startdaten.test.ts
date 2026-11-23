import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadMaterialGroupDefaults } from './material-group-defaults.js';

// Schritt 21 (WG-startdaten): Der Startbestand im Seed entspricht der Spec, die der Gründer am
// 23.11.2026 bestätigt hat, einschließlich der Zieldimensionen je Hebel. Ändert sich eins von
// beiden, schlägt dieser Test an.

const spec = readFileSync(new URL('../../../docs/specs/WG-startdaten.md', import.meta.url), 'utf8');
const dimensionKeys: Record<string, string> = {
  Lieferkette: 'supply',
  Qualität: 'quality',
  Kosten: 'cost',
  Technologie: 'technology',
  Nachhaltigkeit: 'sustainability',
};

function section(title: string) {
  const start = spec.indexOf(`## ${title}`);
  if (start < 0) throw new Error(`Abschnitt ${title} fehlt`);
  const end = spec.indexOf('\n## ', start + 3);
  return spec.slice(start, end < 0 ? undefined : end);
}
const tableRows = (text: string) =>
  text
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.startsWith('|---'))
    .slice(1)
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

describe('WG-startdaten: Seed und Spec stimmen überein', () => {
  const defaults = loadMaterialGroupDefaults();

  it('Kennzahlen je Dimension mit Name und Beschreibung', () => {
    const rows = tableRows(section('Kennzahlen'));
    expect(defaults.kpis.map((kpi) => [kpi.dimension, kpi.name, kpi.description])).toEqual(
      rows.map(([dimension, name, description]) => [
        dimensionKeys[dimension ?? ''],
        name,
        description,
      ]),
    );
  });

  it('Hebelkatalog mit den bestätigten Zieldimensionen, die erste ist die Hauptwirkung', () => {
    const rows = tableRows(section('Hebelkatalog'));
    expect(rows).toHaveLength(23);
    expect(
      defaults.levers.map((lever) => [lever.name, lever.description, lever.dimensions]),
    ).toEqual(
      rows.map(([name, description, dimensions]) => [
        name,
        description,
        (dimensions ?? '').split(',').map((entry) => dimensionKeys[entry.trim()]),
      ]),
    );
  });

  it('Leitfragen je Schritt in der Reihenfolge der Spec', () => {
    const questions = section('Leitfragen');
    const fromSpec: { step: number; text: string }[] = [];
    let step = 0;
    for (const line of questions.split('\n')) {
      const heading = line.match(/^### Schritt (\d+)/);
      if (heading) step = Number(heading[1]);
      const item = line.match(/^\d+\. (.+)$/);
      if (item?.[1]) fromSpec.push({ step, text: item[1].trim() });
      // Prüffragen als Tabelle (Schritt 8): je Dimension mehrere Fragen in einer Zelle
      const row = line.match(/^\| [^|]+ \| (.+\?) \|$/);
      if (row?.[1]) {
        for (const text of row[1].split(/(?<=\?) /)) fromSpec.push({ step, text: text.trim() });
      }
    }
    expect(defaults.questions.map(({ step, text }) => ({ step, text }))).toEqual(fromSpec);
  });
});
