import type { SurveySide, SurveyTrend } from '@reziproq/shared';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

// PUL-06: Verlauf je Art ab zwei aufgedeckten Wellen. Je Dimension ein kleines Diagramm mit beiden
// Seiten; Käufer durchgezogen mit Punkt, Lieferant gestrichelt mit Ring, alle Werte auch als Text.

const width = 200;
const height = 80;
const y = (value: number) => height - ((value - 1) / 4) * height;

function Line({ values, side }: { values: (number | null)[]; side: SurveySide }) {
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((value, index) => (value === null ? null : `${index * step},${y(value)}`))
    .filter((point): point is string => point !== null);
  const color = side === 'buyer' ? 'var(--chart-buyer)' : 'var(--chart-supplier)';
  return (
    <g>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={side === 'supplier' ? '5 4' : undefined}
        vectorEffect="non-scaling-stroke"
      />
      {values.map((value, index) =>
        value === null ? null : (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: feste Reihenfolge der Wellen
            key={index}
            cx={index * step}
            cy={y(value)}
            r={3}
            fill={side === 'buyer' ? color : 'var(--chart-surface)'}
            stroke={color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
    </g>
  );
}

export function TrendSection({ trend, side }: { trend: SurveyTrend; side: SurveySide }) {
  const t = useT();
  const text = t.feedback;
  const format = useFormat();
  const { locale } = useLocale();
  const labels = side === 'buyer' ? text.sides : text.sidesSupplier;
  const month = new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' });
  const id = `verlauf-${trend.kind}`;
  return (
    <section aria-labelledby={id} data-trend={trend.kind} className="flex flex-col gap-3">
      <h2 id={id} className="font-bold text-xl tracking-title">
        {text.trendTitle(text.kinds[trend.kind] ?? '')}
      </h2>
      <p className="text-muted-foreground text-sm">{text.trendPurpose}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground text-sm" aria-hidden>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5" style={{ background: 'var(--chart-buyer)' }} />
          {labels.buyer}
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-0 w-5 border-t-2 border-dashed"
            style={{ borderColor: 'var(--chart-supplier)' }}
          />
          {labels.supplier}
        </span>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trend.dimensions.map((entry) => (
          <li
            key={entry.dimension}
            data-dimension={entry.dimension}
            className="flex flex-col gap-2 rounded-xl bg-card p-4"
          >
            <span className="font-semibold">{t.settings.survey.dimensions[entry.dimension]}</span>
            <svg
              viewBox={`-6 -6 ${width + 12} ${height + 12}`}
              className="h-24 w-full"
              role="img"
              aria-label={text.trendAria(
                t.settings.survey.dimensions[entry.dimension] ?? '',
                entry.buyer
                  .map((value) => (value === null ? '–' : format.number(value)))
                  .join(', '),
                entry.supplier
                  .map((value) => (value === null ? '–' : format.number(value)))
                  .join(', '),
              )}
            >
              <line x1={0} x2={width} y1={y(3)} y2={y(3)} stroke="var(--chart-grid)" />
              <Line values={entry.buyer} side="buyer" />
              <Line values={entry.supplier} side="supplier" />
            </svg>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="text-left font-normal">
                    <span className="sr-only">{text.side}</span>
                  </th>
                  {trend.waves.map((wave) => (
                    <th key={wave.id} scope="col" className="text-right font-normal">
                      {month.format(new Date(wave.revealedAt))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['buyer', 'supplier'] as const).map((rowSide) => (
                  <tr key={rowSide}>
                    <th scope="row" className="text-left font-normal">
                      {labels[rowSide]}
                    </th>
                    {entry[rowSide].map((value, index) => (
                      <td
                        // biome-ignore lint/suspicious/noArrayIndexKey: feste Reihenfolge der Wellen
                        key={index}
                        className="text-right"
                      >
                        {value === null ? '–' : format.number(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </section>
  );
}
