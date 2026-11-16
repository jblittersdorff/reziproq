/**
 * Die Ziele der globalen Leiste in fester Reihenfolge (PLT-11). Die Oberfläche baut daraus Leiste
 * und Menüseite; das Prompt-Werkzeug (PLT-12) verlinkt nur auf freigegebene Ziele.
 */
export const areas = [
  { key: 'start', path: '/start', name: 'Start' },
  { key: 'suppliers', path: '/lieferanten', name: 'Lieferanten' },
  // WG-01: Warengruppen; in der Oberfläche mit der Bezeichnung des Kunden
  { key: 'materialGroups', path: '/warengruppen', name: 'Warengruppen' },
  { key: 'portfolio', path: '/portfolio', name: 'Portfolio' },
  { key: 'impact', path: '/wirkung', name: 'Wirkung' },
] as const;

export type AreaKey = (typeof areas)[number]['key'];
export type AreaPath = (typeof areas)[number]['path'];

export const areaKeys = areas.map((area) => area.key) as [AreaKey, ...AreaKey[]];
