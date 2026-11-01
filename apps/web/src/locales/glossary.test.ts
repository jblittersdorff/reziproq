import { describe, expect, it } from 'vitest';
import { styleguideMessages } from '@/features/styleguide/messages';
import glossary from '../../../../docs/glossar.md?raw';
import { de } from './de';
import { en } from './en';

// PLT-09: Die Begriffe in en entsprechen dem Glossar. Liest docs/glossar.md und prüft jeden
// Begriff an den dort genannten Schlüsseln, im Deutschen wie im Englischen.

interface Term {
  de: string;
  en: string;
  keys: string[];
}

function readGlossary(): Term[] {
  return glossary
    .split('\n')
    .filter(
      (line) => line.startsWith('| ') && !line.startsWith('| Deutsch') && !line.startsWith('|---'),
    )
    .map((line) => {
      const [termDe = '', termEn = '', keys = ''] = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      return {
        de: termDe,
        en: termEn,
        keys: keys === '–' ? [] : keys.split(',').map((key) => key.trim()),
      };
    });
}

/** Text an einem Schlüssel; Funktionen werden mit einem Beispielwert aufgerufen. */
function textAt(catalog: unknown, path: string): string {
  const value = path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], catalog);
  const text = typeof value === 'function' ? (value as (x: unknown) => unknown)('x') : value;
  if (typeof text !== 'string') throw new Error(`Kein Text unter ${path}`);
  return text;
}

/** Schlüssel, an denen ein Begriff fehlt; enCatalog ersetzbar, um die Prüfung selbst zu prüfen. */
function deviations(term: Term, enCatalog: unknown = en): string[] {
  return term.keys.flatMap((key) => {
    const styleguide = key.startsWith('styleguide:');
    const path = styleguide ? key.slice('styleguide:'.length) : key;
    const [deText, enText] = styleguide
      ? [textAt(styleguideMessages.de, path), textAt(styleguideMessages.en, path)]
      : [textAt(de, path), textAt(enCatalog, path)];
    return [
      ...(deText.toLowerCase().includes(term.de.toLowerCase()) ? [] : [`${key} (de): ${deText}`]),
      ...(enText.toLowerCase().includes(term.en.toLowerCase()) ? [] : [`${key} (en): ${enText}`]),
    ];
  });
}

describe('Glossar', () => {
  const terms = readGlossary();

  it('enthält die Begriffe aus der Spec', () => {
    const pairs = Object.fromEntries(terms.map((term) => [term.de, term.en]));
    expect(pairs).toMatchObject({
      Lieferant: 'Supplier',
      Beziehung: 'Relationship',
      Beziehungspuls: 'Relationship Pulse',
      Warengruppe: 'Category',
      'Business Unit': 'Business Unit',
      SRO: 'SRO',
      JBP: 'JBP',
      QBR: 'QBR',
      Maßnahme: 'Action',
      Zusage: 'Commitment',
    });
  });

  it.each(terms.filter((term) => term.keys.length > 0).map((term) => [term.de, term] as const))(
    'Die Begriffe in en entsprechen dem Glossar: %s',
    (_name, term) => {
      expect(deviations(term)).toEqual([]);
    },
  );

  it('scheitert, wenn ein englischer Text vom Glossar abweicht', () => {
    const action = terms.find((term) => term.de === 'Maßnahme') as Term;
    const changed = {
      ...en,
      workspace: {
        ...en.workspace,
        pages: { ...en.workspace.pages, actions: { title: 'Measures', text: '' } },
      },
    };
    expect(deviations(action, changed)).toEqual(['workspace.pages.actions.title (en): Measures']);
  });
});
