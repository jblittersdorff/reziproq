import type { SpendYearTotal } from '@reziproq/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  type XAxisTickContentProps,
  YAxis,
} from 'recharts';

import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { type ChartTheme, rechartsAxis, useChartTheme } from './chart-theme';

/** Höchstens so viele benannte Anteile; der Rest fasst „Weitere“ zusammen. */
const namedSeries = 4;

export interface SpendSeries {
  key: string;
  name: string;
  /** named: Business Unit oder Warengruppe; more: Weitere; unassigned: ohne Zuordnung */
  role: 'named' | 'more' | 'unassigned';
}

export interface SpendChartRow {
  label: string;
  year: number;
  kind: 'actual' | 'plan';
  total: number;
  [series: string]: number | string;
}

/**
 * SPL-04: je Jahr eine Säule, gestapelt nach Business Unit oder Warengruppe. Die größten Anteile
 * über alle Jahre bekommen eine feste Reihenfolge (Farbe folgt dem Eintrag, nicht dem Rang im
 * Jahr); der Rest heißt „Weitere“, Zeilen ohne Zuordnung stehen zuoberst. Ist ein Jahr nur geplant,
 * zeigt es den Plan; sonst das Ist.
 */
export function spendChartData(
  years: SpendYearTotal[],
  by: 'bu' | 'warengruppe',
  labels: { unassigned: string; more: string; year: (year: number, kind: string) => string },
): { rows: SpendChartRow[]; series: SpendSeries[] } {
  const actualYears = new Set(years.filter((y) => y.kind === 'actual').map((y) => y.year));
  const shown = years.filter((y) => y.kind === 'actual' || !actualYears.has(y.year));
  const partsOf = (year: SpendYearTotal) =>
    by === 'bu' ? year.byBusinessUnit : year.byMaterialGroup;
  const totals = new Map<string, { name: string; amount: number }>();
  for (const year of shown) {
    for (const part of partsOf(year)) {
      if (part.id === null) continue;
      const entry = totals.get(part.id) ?? { name: part.name ?? '', amount: 0 };
      entry.amount += part.amountCents;
      totals.set(part.id, entry);
    }
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1].amount - a[1].amount);
  const named = ranked.slice(0, namedSeries).map(([id, value]) => ({ id, name: value.name }));
  const hasMore = ranked.length > namedSeries;
  const hasUnassigned = shown.some((year) => partsOf(year).some((part) => part.id === null));
  const series: SpendSeries[] = [
    ...named.map((entry) => ({ key: `s-${entry.id}`, name: entry.name, role: 'named' as const })),
    ...(hasMore ? [{ key: 'more', name: labels.more, role: 'more' as const }] : []),
    ...(hasUnassigned
      ? [{ key: 'unassigned', name: labels.unassigned, role: 'unassigned' as const }]
      : []),
  ];
  const rows = shown.map((year) => {
    const row: SpendChartRow = {
      label: labels.year(year.year, year.kind),
      year: year.year,
      kind: year.kind,
      total: year.amountCents,
    };
    for (const entry of series) row[entry.key] = 0;
    for (const part of partsOf(year)) {
      const key =
        part.id === null
          ? 'unassigned'
          : named.some((entry) => entry.id === part.id)
            ? `s-${part.id}`
            : 'more';
      row[key] = Number(row[key] ?? 0) + part.amountCents;
    }
    return row;
  });
  return { rows, series };
}

function fillOf(theme: ChartTheme, series: SpendSeries, index: number) {
  if (series.role === 'unassigned') return theme.colors.context;
  if (series.role === 'more') return theme.colors.negative;
  // Benannte Anteile: vom dunkelsten Schritt der Skala an, in fester Reihenfolge.
  return theme.sequential[4 - index]?.fill ?? theme.colors.accent;
}

export function SpendChart({
  title,
  rows,
  series,
  formatMoney,
  formatAxis,
  empty,
  kindNames,
}: {
  title: string;
  rows: SpendChartRow[];
  series: SpendSeries[];
  formatMoney: (cents: number) => string;
  /** Kurz für die Achse, z. B. „5 Mio. €“ */
  formatAxis: (cents: number) => string;
  empty: ChartEmptyText;
  kindNames: { actual: string; plan: string };
}) {
  const theme = useChartTheme();
  return (
    <ChartFrame title={title} isEmpty={rows.length === 0} empty={empty}>
      {series.length > 1 && (
        <ul aria-hidden className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground text-sm">
          {series.map((entry, index) => (
            <li key={entry.key} className="flex items-center gap-2">
              <span
                className="size-3 rounded-sm"
                style={theme ? { background: fillOf(theme, entry, index) } : undefined}
              />
              {entry.name}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-sm border border-muted-foreground border-dashed" />
            {kindNames.plan}
          </li>
        </ul>
      )}
      <div data-slot="spend-chart" className="h-64 w-full">
        {theme && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={theme.colors.grid} vertical={false} />
              <XAxis
                dataKey="label"
                interval={0}
                height={40}
                {...rechartsAxis(theme)}
                tick={(props: XAxisTickContentProps) => {
                  const x = Number(props.x);
                  const y = Number(props.y);
                  const row = rows[props.payload.index];
                  // Jahr, darunter „Plan“: auch schmal lesbar und nicht nur über Farbe.
                  return (
                    <text
                      x={x}
                      y={y + 12}
                      textAnchor="middle"
                      fill={theme.colors.axis}
                      fontSize={theme.fontSize.sm}
                      fontFamily={theme.fontFamily}
                    >
                      <tspan x={x}>{row?.year}</tspan>
                      {row?.kind === 'plan' && (
                        <tspan x={x} dy={14}>
                          {kindNames.plan}
                        </tspan>
                      )}
                    </text>
                  );
                }}
              />
              <YAxis
                width={76}
                tickFormatter={(value) => formatAxis(Number(value))}
                {...rechartsAxis(theme)}
              />
              <Tooltip
                formatter={(value, key) => [
                  formatMoney(Number(value)),
                  series.find((entry) => entry.key === key)?.name ?? String(key),
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
              {series.map((entry, index) => {
                const fill = fillOf(theme, entry, index);
                return (
                  <Bar
                    key={entry.key}
                    dataKey={entry.key}
                    stackId="spend"
                    fill={fill}
                    isAnimationActive={!theme.reducedMotion}
                  >
                    {rows.map((row) =>
                      row.kind === 'plan' ? (
                        // Plan: hell, gestrichelt umrandet – nicht nur über Farbe erkennbar.
                        <Cell
                          key={row.label}
                          fill={fill}
                          fillOpacity={0.35}
                          stroke={fill}
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                        />
                      ) : (
                        // Ist: 2 Pixel Abstand in der Flächenfarbe zwischen den Anteilen.
                        <Cell
                          key={row.label}
                          fill={fill}
                          stroke={theme.colors.surface}
                          strokeWidth={2}
                        />
                      ),
                    )}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
