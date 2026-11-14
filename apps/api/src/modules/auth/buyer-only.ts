import type { Action } from '@reziproq/shared';

/**
 * Aktionen, die nur Organisationen mit Käuferfunktionen haben (PLT-02). Der Lieferant sieht weder
 * Strategie noch Portfolio, Runden oder Bewertungen des Käufers (LIF-02).
 */
export const buyerOnlyActions: readonly Action[] = [
  'lieferanten.sehen',
  'lieferanten.bearbeiten',
  'lieferanten.einladen',
  'prompt.nutzen',
  'stammdaten.verwalten',
  'zuordnung.bearbeiten',
  'segmentmodell.sehen',
  'segmentmodell.verwalten',
  'runden.sehen',
  'runden.verwalten',
  'runden.nachnominieren',
  'bewertungen.sehen',
  'bewertungen.abgeben',
  'segmentierung.konsolidieren',
  'portfolio.sehen',
  'fokus.setzen',
  'zyklus.starten',
  'lieferantenplan.bearbeiten',
  'jbp.anlegen',
  'spielregeln.sehen',
  'spielregeln.verwalten',
  'spielregeln.festlegen',
  'wirkung.sehen',
  'wirkung.bearbeiten',
  'wirkung.freigeben',
];
