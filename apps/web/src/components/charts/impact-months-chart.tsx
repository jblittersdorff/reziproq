import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { rechartsAxis, useChartTheme } from './chart-theme';

export interface ImpactMonthPoint {
  month: string;
  plan: number | null;
  actual: number | null;
}

/**
 * PNL-05: Plan und Ist je Monat als Balkenpaar. Plan im Kontext-Grau, Ist in der Akzentfarbe;
 * Legende über der Fläche, Tooltip je Monat. Die Jahressumme steht im Titel.
 */
export function ImpactMonthsChart({
  title,
  points,
  names,
  formatMoney,
  formatMonth,
  empty,
}: {
  title: string;
  points: ImpactMonthPoint[];
  names: { plan: string; actual: string };
  formatMoney: (cents: number) => string;
  formatMonth: (month: string) => string;
  empty: ChartEmptyText;
}) {
  const theme = useChartTheme();
  const isEmpty = points.every((point) => point.plan === null && point.actual === null);
  return (
    <ChartFrame title={title} isEmpty={isEmpty} empty={empty}>
      <ul aria-hidden className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground text-sm">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-[var(--chart-context)]" />
          {names.plan}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-[var(--chart-accent)]" />
          {names.actual}
        </li>
      </ul>
      <div data-slot="impact-chart" className="h-56 w-full">
        {theme && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={theme.colors.grid} vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonth} {...rechartsAxis(theme)} />
              <YAxis
                width={72}
                tickFormatter={(value) => formatMoney(Number(value))}
                {...rechartsAxis(theme)}
              />
              <Tooltip
                labelFormatter={(month) => formatMonth(String(month))}
                formatter={(value, key) => [
                  formatMoney(Number(value)),
                  key === 'plan' ? names.plan : names.actual,
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
                cursor={{ fill: theme.colors.field }}
              />
              <Bar
                dataKey="plan"
                fill={theme.colors.context}
                radius={[4, 4, 0, 0]}
                isAnimationActive={!theme.reducedMotion}
              />
              <Bar
                dataKey="actual"
                fill={theme.colors.accent}
                radius={[4, 4, 0, 0]}
                isAnimationActive={!theme.reducedMotion}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
