// NAV-10 2.0, TN-07, UX-20 TU-07 (K1-d): Tabelle alt → neu für jede Adresse der App. Grundlage ist
// der Routenbaum (apps/web/src/routeTree.gen.ts); ein Test prüft, dass jede Route genau einer Regel
// folgt, und erzeugt daraus docs/weiterleitungen.md.
//
// - aktiv: Die alte Adresse leitet weiter, mit 301 vom Server und in der App. Das Ziel besteht.
// - geplant: Das Paket, das das Ziel baut, schaltet die Regel ein (K0, B-13). Bis dahin bleibt die
//   alte Seite, wie sie ist.
// - bleibt: Die Adresse gilt auch nach NAV-10 2.0.
//
// Muster wie im Routenbaum: `$name` ist ein Abschnitt, `*` am Ende beliebig viele weitere (auch
// keiner). Die erste passende Regel gilt, deshalb stehen genaue Regeln vor allgemeinen.

export type RouteMoveStatus = 'aktiv' | 'geplant' | 'bleibt';

export interface RouteMove {
  from: string;
  /** Ziel mit denselben Parametern (`$name`, `*`); null, solange das Paket es noch festlegt */
  to: string | null;
  /** Paket, das die Regel einschaltet oder die Adresse gebaut hat */
  package: string;
  status: RouteMoveStatus;
  note?: string;
}

const move = (
  from: string,
  to: string | null,
  pkg: string,
  status: RouteMoveStatus,
  note?: string,
): RouteMove => ({ from, to, package: pkg, status, ...(note ? { note } : {}) });

export const routeMoves: readonly RouteMove[] = [
  // Neue Hauptadressen (K1-d); ihre Seiten kommen mit K1-e (Heute), K2-b, K4-b und K1-f.
  move('/heute', '/heute', 'K1-e', 'bleibt', 'Fokus und Alles'),
  move(
    '/beziehungen',
    '/beziehungen',
    'K1-d',
    'bleibt',
    'Seite Lieferanten mit Liste (K2-b.4) und Segmenten',
  ),
  move('/wert', '/wert', 'K1-d', 'bleibt', 'zeigt bis K4-b die Übersicht'),
  move('/mein-agent', '/mein-agent', 'K1-f.3', 'bleibt', 'Mein Agent'),
  // DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person, nur im Demo-Mandanten
  move('/demo/als/$person', '/demo/als/$person', 'K1-b.2', 'bleibt', 'Demo-Sitzung'),
  move('/demo', '/demo', 'K1-g.4', 'bleibt', 'Demo-Regie'),
  move('/kurz-pruefen', '/kurz-pruefen', 'K1-e.2', 'bleibt', 'Kurz prüfen'),
  move('/erledigt', '/erledigt', 'K1-e.3', 'bleibt', 'Erledigt im Hintergrund'),
  move('/warum/$id', '/warum/$id', 'K1-e.4', 'bleibt', 'Warum'),
  move('/mappe/$art/$id', '/mappe/$art/$id', 'K1-e.4', 'bleibt', 'Fokus-Mappe'),

  // Aktiv seit K1-d
  move('/mein-tag', '/heute', 'K1-d', 'aktiv'),
  move('/start', '/heute', 'K1-d', 'aktiv'),
  move('/uebersicht', '/wert', 'K1-d', 'aktiv'),
  move('/lieferanten', '/beziehungen', 'K1-d', 'aktiv'),
  move('/agenten', '/mein-agent', 'K1-d', 'aktiv'),
  move('/einstellungen/ki/agenten', '/mein-agent', 'K1-d', 'aktiv'),
  // Frag Reziproq ist eine Überlagerung (E-K0-01); ?frag öffnet sie, q, lieferant und kunde bleiben.
  move('/fragen', '/heute?frag=1', 'K1-d', 'aktiv', 'öffnet Frag Reziproq'),
  // Leitete schon in der App auf die Übersicht weiter (PNL-10); Sicht und Geschäftsjahr bleiben.
  move('/wirkung', '/wert', 'K1-d', 'aktiv'),

  // Heute (HE-01): Alle Aufgaben, Maßnahmen, Hinweise und Neu eingegangen gehen in die Ansicht Alles.
  // Neu eingegangen geht seit K1-e.3 in Heute auf: Zuordnungen in Kurz prüfen, „Heute selbst
  // zugeordnet“ in Erledigt, „Wie Termine ankommen“ unter Anbindungen. Die Hinweise gehen seit K1-e.4
  // in Alles (Liste) und Warum (ein Hinweis) auf. Alle
  // Aufgaben und Maßnahmen braucht der Start der Lieferantenseite bis K5-b; der Käufer erreicht sie
  // von Heute aus nicht mehr.
  move('/mein-tag/eingang', '/heute?ansicht=alles', 'K1-e.3', 'aktiv', 'Gruppe Zuordnen'),
  move('/start/faellig', '/heute?ansicht=alles', 'K5-b', 'geplant', 'beim Käufer schon Alles'),
  move('/start/massnahmen', '/heute?ansicht=alles', 'K5-b', 'geplant', 'Zusagen und Aufgaben'),
  move('/hinweise', '/heute?ansicht=alles', 'K1-e.4', 'aktiv', 'Gruppe Hinweise'),
  move('/hinweise/$id', '/warum/$id', 'K1-e.4', 'aktiv', 'Warum zum Hinweis'),

  // Mein Agent (MA-01); eigene Agenten entfallen (E-K0-13).
  // MA-01 T1-MA5 (K1-f.5): keine Seite Agenten mehr; der Lauf steht im Warum (K1-e.4), eigene
  // Agenten sind aus (E-K0-13)
  move('/einstellungen/ki/agenten/laeufe/$id', '/warum/$id', 'K1-f.5', 'aktiv', 'Warum zum Lauf'),
  move('/einstellungen/ki/agenten/*', '/mein-agent', 'K1-f.5', 'aktiv'),

  // Bausteine: eine Seite statt drei; eigener kleiner Schritt K1-d.3 (steht nicht im Paket K1-d)
  move('/bausteine', '/bausteine', 'UX-20', 'bleibt'),
  move('/design', '/bausteine', 'K1-d.3', 'geplant'),
  move('/styleguide', '/bausteine', 'K1-d.3', 'geplant'),

  // Beziehungen (BZ-01) und Akte (AK-01); Einzelregeln je Unterseite mit K2-c
  move('/lieferanten/neu', null, 'K2-b', 'geplant'),
  move('/lieferanten/importieren', null, 'K2-b', 'geplant'),
  move('/lieferanten/$id/umsetzung/termine/*', null, 'K3-a', 'geplant', 'Termin /termine/<id>'),
  // ZQ-01 (Gründer, 26.11.2026): Die alten Seiten zeigen Zusagen und Aufgaben, bis die Akte sie hat
  move(
    '/lieferanten/$id/umsetzung/massnahmen/*',
    '/beziehungen/$id',
    'K2-c',
    'geplant',
    'Zusagen und Aufgaben; bis dahin die alte Seite',
  ),
  move('/lieferanten/$id/plan/*', '/beziehungen/$id/plan', 'K4-e', 'geplant', 'Gemeinsamer Plan'),
  move('/lieferanten/$id/wirkung/*', '/beziehungen/$id/wert', 'K4-b', 'geplant', 'Wertkonto'),
  move('/lieferanten/$id/strategie/segmentierung/*', null, 'K2-e', 'geplant', 'Segment-Mappe'),
  move('/lieferanten/$id/beziehung/feedback/*', '/beziehungen/$id/feedback', 'K2-f', 'geplant'),
  move('/lieferanten/$id/*', '/beziehungen/$id', 'K2-c', 'geplant', 'Sichten und Blätter der Akte'),
  move('/portfolio', '/beziehungen?linse=segmente', 'K2-b', 'aktiv', 'Linse Segmente'),
  move('/portfolio/*', null, 'K2-e', 'geplant', 'Bewertungsrunden und Segmente'),
  move('/bewertungen/*', null, 'K2-e', 'geplant', 'Bewertung in Kurz prüfen'),
  move('/feedback/*', null, 'K2-f', 'geplant', 'Feedback als Objekt'),

  // Wert (WK-01, WB-01)
  move('/uebersicht/ergebnisse', '/wert', 'K4-b', 'geplant'),
  move('/uebersicht/wertpotenziale', null, 'K4-d', 'geplant', 'Wertfinder'),
  move('/wirkung/freigaben/*', null, 'K4-c', 'geplant', 'Mappe Wirkung freigeben'),

  // Warengruppen (ST-01, nach K5-g, G-9)
  move('/warengruppen', '/warengruppen', 'WG-01', 'bleibt'),
  move('/warengruppen/$id/strategie/*', '/warengruppen/$id/strategie', 'K6-a', 'geplant'),
  move('/warengruppen/$id/review/*', null, 'K6-a', 'geplant'),
  move('/warengruppen/$id/segmentierung', null, 'K6-f', 'geplant'),
  move('/warengruppen/$id', '/warengruppen/$id', 'WG-01', 'bleibt'),

  // Lieferantenseite (LP-01): Kunden und Akte des Kunden bleiben, Unterseiten folgen mit K5-b.
  move('/kunden', '/kunden', 'LIF-02', 'bleibt'),
  move('/kunden/$id', '/kunden/$id', 'LIF-02', 'bleibt'),
  move('/kunden/$id/*', null, 'K5-b', 'geplant', 'gespiegelte Akte'),

  // Ohne Änderung
  move('/', '/', 'NAV-10', 'bleibt', 'Startseite der Person'),
  move('/$', '/$', 'PLT-11', 'bleibt', 'Seite nicht gefunden'),
  move('/menu', '/menu', 'PLT-11', 'bleibt'),
  move('/einstellungen/*', '/einstellungen/*', 'NAV-10', 'bleibt'),
  move('/profil/*', '/profil/*', 'PLT-09', 'bleibt'),
  move('/betreiber/*', '/betreiber/*', 'PLT-13', 'bleibt'),
  move('/einladung/*', '/einladung/*', 'LP-01', 'bleibt', 'ohne Rahmen'),
  move('/umfrage/*', '/umfrage/*', 'PUL-01', 'bleibt', 'ohne Rahmen'),
  move('/auth/*', '/auth/*', 'PLT-01', 'bleibt', 'ohne Rahmen'),
  move('/addin/*', '/addin/*', 'IN-04', 'bleibt', 'ohne Rahmen'),
];

const segments = (path: string) => path.split('/').filter(Boolean);

/** Adresse ohne abschließenden Schrägstrich, wie der Routenbaum Seiten ohne Unterseite führt */
export function normalizeRoute(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Parameter, wenn `path` zum Muster passt; `*` hält den Rest. Sonst null. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const want = segments(pattern);
  const have = segments(normalizeRoute(path));
  const params: Record<string, string> = {};
  for (const [index, part] of want.entries()) {
    if (part === '*' && index === want.length - 1) {
      params['*'] = have.slice(index).join('/');
      return params;
    }
    const value = have[index];
    if (value === undefined) return null;
    // `$` allein ist die Fang-Route des Routenbaums und passt nur auf sich selbst.
    if (part.startsWith('$') && part.length > 1) params[part.slice(1)] = value;
    else if (part !== value) return null;
  }
  return have.length === want.length ? params : null;
}

/** Die Regel für eine Adresse; die erste passende gilt. */
export function routeMoveFor(
  path: string,
): { move: RouteMove; params: Record<string, string> } | null {
  for (const entry of routeMoves) {
    const params = matchRoute(entry.from, path);
    if (params) return { move: entry, params };
  }
  return null;
}

/**
 * Neue Adresse, wenn eine aktive Regel greift; der Suchteil der alten Adresse bleibt erhalten,
 * Angaben des Ziels gehen vor. Sonst null.
 */
export function movedTo(pathname: string, search = ''): string | null {
  const found = routeMoveFor(pathname);
  if (found?.move.status !== 'aktiv' || !found.move.to) return null;
  const [path = '', query = ''] = found.move.to.split('?');
  const target = segments(path)
    .map((part) =>
      part === '*'
        ? (found.params['*'] ?? '')
        : part.startsWith('$')
          ? (found.params[part.slice(1)] ?? '')
          : part,
    )
    .filter(Boolean)
    .join('/');
  const rest = mergeQuery(query, search);
  return `/${target}${rest ? `?${rest}` : ''}`;
}

/**
 * Suchteil des Ziels und der alten Adresse zusammen; Angaben des Ziels gehen vor. Die Teile bleiben,
 * wie sie kommen (kodiert), damit nichts doppelt kodiert wird. Ohne URLSearchParams, weil das Paket
 * weder Browser- noch Node-Typen kennt.
 */
function mergeQuery(own: string, search: string): string {
  const parts = (query: string) => query.replace(/^\?/, '').split('&').filter(Boolean);
  const keyOf = (part: string) => part.split('=')[0] ?? '';
  const ownParts = parts(own);
  const keys = new Set(ownParts.map(keyOf));
  return [...ownParts, ...parts(search).filter((part) => !keys.has(keyOf(part)))].join('&');
}

/**
 * Tabelle für docs/weiterleitungen.md aus allen Routen des Routenbaums und den alten Adressen mit
 * aktiver Regel (TN-07, TU-07)
 */
export function routeMovesDoc(routes: readonly string[]): string {
  // Alte Adressen mit aktiver Regel haben keine eigene Seite mehr im Routenbaum; sie gehören dazu.
  const moved = routeMoves.filter((entry) => entry.status === 'aktiv').map((entry) => entry.from);
  const rows = [...new Set([...routes, ...moved].map(normalizeRoute))]
    .sort((a, b) => a.localeCompare(b, 'de'))
    .map((route) => {
      const found = routeMoveFor(route);
      if (!found) return `| \`${route}\` | – | – | ohne Regel |`;
      const { move: entry } = found;
      const target = entry.status === 'bleibt' ? '–' : entry.to ? `\`${entry.to}\`` : 'offen';
      const note = entry.note ? ` (${entry.note})` : '';
      return `| \`${route}\` | ${target}${note} | ${entry.package} | ${entry.status} |`;
    });
  const count = (status: RouteMoveStatus) =>
    rows.filter((row) => row.endsWith(`| ${status} |`)).length;
  return [
    '# Weiterleitungen alt → neu',
    '',
    'Erzeugt aus `packages/shared/src/route-moves.ts` und dem Routenbaum der App (`pnpm weiterleitungen`); ein Test schlägt fehl, wenn die Datei veraltet ist. Grundlage: NAV-10 2.0, TN-07 und UX-20 TU-07.',
    '',
    `- **aktiv** (${count('aktiv')}): leitet mit 301 vom Server und in der App weiter.`,
    `- **geplant** (${count('geplant')}): Das genannte Paket baut das Ziel und schaltet die Regel ein; bis dahin bleibt die Seite.`,
    `- **bleibt** (${count('bleibt')}): Die Adresse gilt auch nach NAV-10 2.0.`,
    '',
    '| Adresse | Neue Adresse | Paket | Stand |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
