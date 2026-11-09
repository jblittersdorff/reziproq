import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { rechartsAxis, useChartTheme } from './chart-theme';

export interface KpiChartPoint {
  /** Zeitpunkt in Millisekunden */
  time: number;
  actual?: number;
  plan?: number;
}

/**
 * JBP-09: Verlauf einer Kennzahl. Ist-Werte als Linie in der Akzentfarbe, die Linie von der Basis
 * zum Ziel gestrichelt im Kontext-Grau; Tooltip je Monat, Legende über der Fläche.
 */
export function KpiLineChart({
  title,
  description,
  points,
  names,
  formatValue,
  formatTime,
  empty,
}: {
  title: string;
  description?: string;
  points: KpiChartPoint[];
  names: { actual: string; plan: string };
  formatValue: (value: number) => string;
  formatTime: (time: number) => string;
  empty: ChartEmptyText;
}) {
  const theme = useChartTheme();
  const hasActual = points.some((point) => point.actual !== undefined);
  // Drei feste Marken (Start, Mitte, Termin), damit sich Monatsnamen auch schmal nie überlagern.
  const times = points.map((point) => point.time);
  const [first, last] = [Math.min(...times), Math.max(...times)];
  const ticks = first === last ? [first] : [first, Math.round((first + last) / 2), last];
  return (
    <ChartFrame title={title} description={description} isEmpty={!hasActual} empty={empty}>
      <ul aria-hidden className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground text-sm">
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-[var(--chart-accent)]" />
          {names.actual}
        </li>
        <li className="flex items-center gap-2">
          <span className="w-5 border-[var(--chart-context)] border-t-2 border-dashed" />
          {names.plan}
        </li>
      </ul>
      <div data-slot="kpi-chart" className="h-64 w-full">
        {theme && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={theme.colors.grid} vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatTime}
                ticks={ticks}
                interval={0}
                padding={{ left: 8, right: 24 }}
                {...rechartsAxis(theme)}
              />
              {/* Achse um die Werte, nicht ab null: Abweichungen von der Linie sollen sichtbar sein. */}
              <YAxis
                width={64}
                domain={['auto', 'auto']}
                tickFormatter={formatValue}
                {...rechartsAxis(theme)}
              />
              <Tooltip
                labelFormatter={(time) => formatTime(Number(time))}
                formatter={(value, key) => [
                  formatValue(Number(value)),
                  key === 'actual' ? names.actual : names.plan,
                ]}
                contentStyle={{
                  background: theme.colors.tooltip,
                  color: theme.colors.tooltipForeground,
                  borderStyle: 'solid',
                  borderWidth: 1,
                  borderColor: theme.colors.tooltipBorder,
                  borderRadius: 8,
                  fontFamily: theme.fontFamily,
                  fontSize: theme.fontSize.sm,
                }}
                cursor={{ stroke: theme.colors.axis, strokeWidth: 1 }}
              />
              <Line
                dataKey="plan"
                stroke={theme.colors.context}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
                isAnimationActive={!theme.reducedMotion}
              />
              <Line
                dataKey="actual"
                stroke={theme.colors.accent}
                strokeWidth={2}
                dot={{
                  r: 4,
                  fill: theme.colors.accent,
                  stroke: theme.colors.surface,
                  strokeWidth: 2,
                }}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={!theme.reducedMotion}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
