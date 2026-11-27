import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { movedTo, normalizeRoute, routeMoveFor, routeMoves, routeMovesDoc } from '@reziproq/shared';
import { describe, expect, it } from 'vitest';

// NAV-10 TN-07, UX-20 TU-07 (K1-d): Jede Adresse des Routenbaums folgt genau einer Regel der Tabelle
// alt → neu; aktive Regeln zeigen auf bestehende Seiten. docs/weiterleitungen.md entsteht daraus
// (`pnpm weiterleitungen` schreibt sie neu).

const treeFile = fileURLToPath(new URL('../routeTree.gen.ts', import.meta.url));
const docFile = fileURLToPath(new URL('../../../../docs/weiterleitungen.md', import.meta.url));

/** Alle Adressen des Routenbaums, wie TanStack Router sie erzeugt */
function treeRoutes(): string[] {
  const source = readFileSync(treeFile, 'utf8');
  const block = /export interface FileRoutesByFullPath \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
  return [
    ...new Set([...block.matchAll(/'([^']+)':/g)].map((match) => normalizeRoute(match[1] ?? ''))),
  ];
}

describe('Weiterleitungen alt → neu (TN-07)', () => {
  const routes = treeRoutes();

  it('jede Route des Routenbaums folgt einer Regel', () => {
    expect(routes.length).toBeGreaterThan(200);
    expect(routes.filter((route) => !routeMoveFor(route))).toEqual([]);
  });

  it('jede aktive Regel zeigt auf eine bestehende Seite, und keine Seite des Baums wird umgeleitet', () => {
    const known = new Set(routes);
    for (const move of routeMoves.filter((entry) => entry.status === 'aktiv')) {
      const target = move.to?.split(/[?#]/)[0] ?? '';
      expect(known.has(normalizeRoute(target)), `${move.from} → ${move.to}`).toBe(true);
      expect(known.has(normalizeRoute(move.from)), `${move.from} hat noch eine eigene Seite`).toBe(
        false,
      );
    }
    expect(routes.filter((route) => movedTo(route))).toEqual([]);
  });

  it('die Adressen aus NAV-10 leiten weiter; der Suchteil bleibt erhalten', () => {
    expect(movedTo('/mein-tag')).toBe('/heute');
    expect(movedTo('/start/')).toBe('/heute');
    expect(movedTo('/uebersicht')).toBe('/wert');
    expect(movedTo('/wirkung', 'sicht=ebit&gj=2026')).toBe('/wert?sicht=ebit&gj=2026');
    expect(movedTo('/lieferanten', 'ansicht=matrix')).toBe('/beziehungen?ansicht=matrix');
    // BZ-01 (K2-b.5): Portfolio ist die Linse Segmente; Unterseiten folgen mit K2-e
    expect(movedTo('/portfolio')).toBe('/beziehungen?linse=segmente');
    expect(movedTo('/portfolio', 'warengruppe=g1')).toBe(
      '/beziehungen?linse=segmente&warengruppe=g1',
    );
    expect(movedTo('/portfolio/matrix')).toBeNull();
    expect(movedTo('/portfolio/runden/550e8400-e29b-41d4-a716-446655440050')).toBeNull();
    expect(movedTo('/agenten')).toBe('/mein-agent');
    expect(movedTo('/einstellungen/ki/agenten')).toBe('/mein-agent');
    // AK-01, E-K2-12 (K2-c.7, T2-15): Die Aktivitäten stehen im Verlauf der Akte; der Suchteil
    // bleibt, die Sprungmarke des Ziels steht am Ende
    const rel = '550e8400-e29b-41d4-a716-446655440010';
    expect(movedTo(`/lieferanten/${rel}/aktivitaeten`)).toBe(
      `/beziehungen/${rel}?sicht=privat#verlauf`,
    );
    expect(movedTo(`/lieferanten/${rel}/aktivitaeten`, 'filter=mails')).toBe(
      `/beziehungen/${rel}?sicht=privat&filter=mails#verlauf`,
    );
    // Die übrigen bleiben bis zu ihrem Paket: Überblick (Zielkarte, K4-c), Spielregeln (Freigabe,
    // K2-f), Pflege, Unterseiten
    for (const path of [
      '',
      '/plan',
      '/beziehung/spielregeln',
      '/beziehung/spielregeln/teilen',
      '/beziehung/team',
    ]) {
      expect(movedTo(`/lieferanten/${rel}${path}`), path).toBeNull();
    }
    expect(routeMoveFor(`/lieferanten/${rel}`)?.move.package).toBe('K4-c');
    expect(routeMoveFor(`/lieferanten/${rel}/beziehung/spielregeln`)?.move.package).toBe('K2-f');
    expect(routeMoveFor(`/lieferanten/${rel}/beziehung/team/einladen`)?.move.package).toBe('K2-f');
    expect(routeMoveFor(`/lieferanten/${rel}/strategie/spend`)?.move.package).toBe('offen');
    expect(movedTo('/heute')).toBeNull();
    // MA-01 T1-MA5 (K1-f.5): keine Seite Agenten mehr; ein Lauf steht im Warum
    expect(movedTo('/einstellungen/ki/agenten/neu')).toBe('/mein-agent');
    expect(movedTo('/einstellungen/ki/agenten/eigene/550e8400-e29b-41d4-a716-446655440040')).toBe(
      '/mein-agent',
    );
    expect(movedTo('/einstellungen/ki/agenten/550e8400-e29b-41d4-a716-446655440041')).toBe(
      '/mein-agent',
    );
    expect(movedTo('/einstellungen/ki/agenten/laeufe/550e8400-e29b-41d4-a716-446655440042')).toBe(
      '/warum/550e8400-e29b-41d4-a716-446655440042',
    );
    // HE-01 (K1-e.4): die Liste der Hinweise geht in Alles auf, ein Hinweis in Warum
    expect(movedTo('/hinweise')).toBe('/heute?ansicht=alles');
    expect(movedTo('/hinweise/550e8400-e29b-41d4-a716-446655440030')).toBe(
      '/warum/550e8400-e29b-41d4-a716-446655440030',
    );
    // HE-01 (K1-e.3): Neu eingegangen geht in Heute auf
    expect(movedTo('/mein-tag/eingang')).toBe('/heute?ansicht=alles');
  });

  it('docs/weiterleitungen.md ist aktuell', () => {
    const doc = routeMovesDoc(routes);
    if (process.env.WEITERLEITUNGEN_SCHREIBEN) writeFileSync(docFile, doc);
    expect(readFileSync(docFile, 'utf8')).toBe(doc);
  });
});
