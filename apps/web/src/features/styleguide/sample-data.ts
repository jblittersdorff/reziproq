import type { MatrixSupplier } from '@/components/charts/segment-matrix';

// Frei erfundene Beispieldaten für den Styleguide. Geldbeträge in Cent.

export const currency = 'EUR';

export const matrixSuppliers: MatrixSupplier[] = [
  {
    name: 'Nordstahl',
    volumeCents: 1_840_000_00,
    current: { x: 2.4, y: 1.6 },
    target: { x: 2.5, y: 2.5 },
  },
  { name: 'Elbe Kunststoff', volumeCents: 620_000_00, current: { x: 0.6, y: 0.5 } },
  {
    name: 'Präzision Süd',
    volumeCents: 1_150_000_00,
    current: { x: 1.5, y: 1.4 },
    target: { x: 1.6, y: 2.4 },
  },
  { name: 'Westfracht', volumeCents: 380_000_00, current: { x: 0.7, y: 1.6 } },
  { name: 'Elektronik Ost', volumeCents: 2_300_000_00, current: { x: 2.75, y: 2.65 } },
];

/** Bewertung je Dimension, Reihenfolge wie messages.dimensions */
export const perceptionGap = [
  { buyer: 4.1, supplier: 3.6 },
  { buyer: 2.4, supplier: 4.2 },
  { buyer: 3.2, supplier: 3.5 },
  { buyer: 4.4, supplier: 4.0 },
  { buyer: 3.0, supplier: 3.9 },
];

/** values[dimension][business unit] */
export const businessUnitScores = [
  [4.2, 4.0, 3.1],
  [3.4, 3.6, 2.2],
  [3.8, 3.1, 2.6],
  [4.5, 4.3, 3.4],
  [3.9, 3.7, 2.9],
];

export const bridgeBaselineCents = 8_400_000_00;
/** EBIT-Wirkung je Hebel, Reihenfolge wie messages.levers */
export const bridgeLeverCents = [900_000_00, 600_000_00, 300_000_00, -400_000_00];

export const tableRows = [
  { supplier: 'Elektronik Ost', commodity: 2, volumeCents: 2_300_000_00, status: 'ok' },
  { supplier: 'Nordstahl', commodity: 0, volumeCents: 1_840_000_00, status: 'watch' },
  { supplier: 'Präzision Süd', commodity: 0, volumeCents: 1_150_000_00, status: 'ok' },
  { supplier: 'Elbe Kunststoff', commodity: 1, volumeCents: 620_000_00, status: 'risk' },
] as const;
