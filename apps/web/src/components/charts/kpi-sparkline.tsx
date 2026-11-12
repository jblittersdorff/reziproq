// JBP-09: kleine Linie je Kennzahl in der Scorecard. Ist-Werte in der Akzentfarbe, die Linie von der
// Basis zum Ziel gestrichelt im Kontext-Grau. Nur Zierde neben dem Stand mit Symbol und Text; die
// Werte stehen auf der Kennzahl-Seite als Tabelle und Diagramm mit Tooltip.

export interface SparkPoint {
  /** Tage seit dem Start der Linie */
  x: number;
  y: number;
}

/** Punkte in das Feld 100 × 32 legen; ohne Spannweite in der Mitte. */
function scale(points: SparkPoint[], all: SparkPoint[]) {
  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => (maxX === minX ? 50 : ((x - minX) / (maxX - minX)) * 96 + 2);
  const sy = (y: number) => (maxY === minY ? 16 : 30 - ((y - minY) / (maxY - minY)) * 28);
  return points.map((point) => `${sx(point.x).toFixed(2)},${sy(point.y).toFixed(2)}`).join(' ');
}

export function KpiSparkline({ actual, plan }: { actual: SparkPoint[]; plan: SparkPoint[] }) {
  if (actual.length === 0) return null;
  const all = [...actual, ...plan];
  const last = scale(actual.slice(-1), all).split(',');
  return (
    <svg
      aria-hidden
      data-slot="sparkline"
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-8 w-24 shrink-0 overflow-visible"
    >
      <polyline
        points={scale(plan, all)}
        fill="none"
        stroke="var(--chart-context)"
        strokeWidth={1.5}
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={scale(actual, all)}
        fill="none"
        stroke="var(--chart-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={2.5}
        fill="var(--chart-accent)"
        stroke="var(--chart-surface)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
