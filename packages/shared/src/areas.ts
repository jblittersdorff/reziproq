/**
 * Die sechs Bereiche von Reziproq in fester Reihenfolge (PLT-11). Die Oberfläche baut daraus
 * Seitenleiste, Kacheln und Routen; das Prompt-Fenster (PLT-12) springt nur zu diesen Zielen.
 */
export const areas = [
  { key: 'suppliers', path: '/lieferanten', name: 'Lieferanten', release: '0.1' },
  { key: 'relationships', path: '/beziehungen', name: 'Beziehungen', release: '0.2' },
  { key: 'pulse', path: '/puls', name: 'Beziehungspuls', release: '0.2' },
  { key: 'jointBusinessPlans', path: '/jbp', name: 'Joint Business Plans', release: '0.3' },
  { key: 'qbrs', path: '/qbr', name: 'QBRs und Maßnahmen', release: '0.3' },
  { key: 'pnlImpact', path: '/pnl', name: 'P&L-Impact', release: '0.3' },
] as const;

export type AreaKey = (typeof areas)[number]['key'];
export type AreaPath = (typeof areas)[number]['path'];

export const areaKeys = areas.map((area) => area.key) as [AreaKey, ...AreaKey[]];
