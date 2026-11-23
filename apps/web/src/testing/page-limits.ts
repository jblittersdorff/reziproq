import { expect } from 'vitest';

/**
 * AW-01 „Fertig, wenn“: Jede Auswertungsseite zeigt höchstens eine Aussage, eine Tinte-Karte, vier
 * Kennzahlen, ein Ringpaar oder zwei Diagramme und drei Fragevorschläge. Gezählt wird über die
 * data-slot-Marken der Bausteine.
 */
export function expectPageLimits(root: ParentNode = document) {
  const count = (selector: string) => root.querySelectorAll(selector).length;
  expect(count('[data-slot="insight"]'), 'Aussagen').toBeLessThanOrEqual(1);
  expect(count('[data-slot="next-step"]'), 'Tinte-Karten').toBeLessThanOrEqual(1);
  expect(count('[data-slot="metric"]'), 'Kennzahlen').toBeLessThanOrEqual(4);
  const rings = count('[data-slot="goal-rings"]');
  const charts = count('[data-slot="chart"], [data-slot="range-bars"]');
  if (rings > 0) {
    expect(rings, 'Ringpaare').toBe(1);
    expect(charts, 'Diagramme neben dem Ringpaar').toBe(0);
  } else {
    expect(charts, 'Diagramme').toBeLessThanOrEqual(2);
  }
  expect(count('[data-slot="question-suggestions"] a'), 'Fragevorschläge').toBeLessThanOrEqual(3);
}
