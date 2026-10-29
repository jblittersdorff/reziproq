import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { type ChartTheme, rechartsAxis, useChartTheme } from './chart-theme';

export interface DumbbellRow {
  dimension: string;
  buyer: number;
  supplier: number;
}

interface ShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: DumbbellRow;
}

function DumbbellShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  payload,
  theme,
  names,
  format,
}: ShapeProps & {
  theme: ChartTheme;
  names: { buyer: string; supplier: string };
  format: (value: number) => string;
}) {
  if (!payload) return null;
  const middle = y + height / 2;
  const buyerLeft = payload.buyer <= payload.supplier;
  const ends = [
    {
      key: 'buyer',
      cx: buyerLeft ? x : x + width,
      color: theme.colors.buyer,
      value: payload.buyer,
    },
    {
      key: 'supplier',
      cx: buyerLeft ? x + width : x,
      color: theme.colors.supplier,
      value: payload.supplier,
    },
  ] as const;
  const text = { fontSize: theme.fontSize.sm, fontFamily: theme.fontFamily };

  return (
    <g>
      {/* Der Abstand zwischen den Punkten ist die Wahrnehmungslücke */}
      <line
        x1={x}
        x2={x + width}
        y1={middle}
        y2={middle}
        stroke={theme.colors.context}
        strokeWidth={2}
      />
      {ends.map((end) => (
        <g key={end.key}>
          <circle cx={end.cx} cy={middle} r={6} fill={end.color} />
          <text x={end.cx} y={middle - 10} textAnchor="middle" fill={theme.colors.label} {...text}>
            {/* Direkt beschriften statt Legende: in der ersten Zeile mit Namen */}
            {index === 0 ? `${names[end.key]} ${format(end.value)}` : format(end.value)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Wahrnehmungslücke: je Dimension Käufer- und Lieferantensicht, der Abstand ist die Lücke. */
export function DumbbellChart({
  title,
  description,
  rows,
  names,
  scale,
  format,
  empty,
}: {
  title: string;
  description?: string;
  rows: DumbbellRow[];
  names: { buyer: string; supplier: string };
  scale: { min: number; max: number };
  format: (value: number) => string;
  empty: ChartEmptyText;
}) {
  const theme = useChartTheme();
  if (!theme) return null;
  const axis = rechartsAxis(theme);
  const ticks = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);

  return (
    <ChartFrame title={title} description={description} isEmpty={rows.length === 0} empty={empty}>
      <div role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height={rows.length * 56 + 40}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 16, right: 32, bottom: 0, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={theme.colors.grid} />
            <XAxis
              type="number"
              domain={[scale.min, scale.max]}
              ticks={ticks}
              {...axis}
              axisLine={false}
            />
            <YAxis type="category" dataKey="dimension" width={128} {...axis} axisLine={false} />
            <Bar
              dataKey={(row: DumbbellRow) => [
                Math.min(row.buyer, row.supplier),
                Math.max(row.buyer, row.supplier),
              ]}
              isAnimationActive={false}
              shape={(props: ShapeProps) => (
                <DumbbellShape {...props} theme={theme} names={names} format={format} />
              )}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
