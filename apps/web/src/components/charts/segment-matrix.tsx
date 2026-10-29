import type { EChartsCoreOption } from 'echarts/core';

import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { echartsBase, useChartTheme } from './chart-theme';
import { EChart } from './echart';

export interface MatrixSupplier {
  name: string;
  /** Einkaufsvolumen in Cent – bestimmt die Punktgröße */
  volumeCents: number;
  /** Position im Raster 0–3 je Achse */
  current: { x: number; y: number };
  target?: { x: number; y: number };
}

/** Segmentierung: 3x3-Matrix mit festen Feldern, Punkte = Lieferanten, Pfeil von Ist zu Soll. */
export function SegmentMatrix({
  title,
  description,
  suppliers,
  axes,
  levels,
  formatVolume,
  empty,
}: {
  title: string;
  description?: string;
  suppliers: MatrixSupplier[];
  axes: { x: string; y: string };
  /** Beschriftung der drei Stufen je Achse, z. B. niedrig, mittel, hoch */
  levels: [string, string, string];
  formatVolume: (cents: number) => string;
  empty: ChartEmptyText;
}) {
  const theme = useChartTheme();
  if (!theme) return null;
  const { colors, fontSize } = theme;

  const maxVolume = Math.max(1, ...suppliers.map((s) => s.volumeCents));
  const size = (cents: number) => 10 + Math.sqrt(cents / maxVolume) * 30;
  const axisLevel = (value: number) => (value % 1 === 0.5 ? levels[Math.floor(value)] : '');
  const axis = (name: string, nameGap: number) => ({
    type: 'value',
    min: 0,
    max: 3,
    interval: 0.5,
    name,
    nameLocation: 'middle',
    nameGap,
    nameTextStyle: { color: colors.axis, fontSize: fontSize.sm },
    axisLabel: { formatter: axisLevel, color: colors.axis, fontSize: fontSize.sm },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
  });

  const fields = [0, 1, 2].flatMap((x) =>
    [0, 1, 2].map((y) => [
      { xAxis: x, yAxis: y },
      { xAxis: x + 1, yAxis: y + 1 },
    ]),
  );

  const option: EChartsCoreOption = {
    ...echartsBase(theme),
    // Rechts Platz für die direkte Beschriftung der Punkte
    grid: { left: 72, right: 112, top: 8, bottom: 56 },
    xAxis: axis(axes.x, 32),
    yAxis: axis(axes.y, 56),
    tooltip: {
      ...echartsBase(theme).tooltip,
      formatter: (params: { data?: { name?: string; volumeCents?: number } }) =>
        params.data?.name && params.data.volumeCents !== undefined
          ? `${params.data.name}<br/>${formatVolume(params.data.volumeCents)}`
          : '',
    },
    series: [
      {
        type: 'scatter',
        silent: true,
        data: [],
        // Feste Felder; Gruppen entstehen über die Lücken, nicht über Linien.
        markArea: {
          silent: true,
          itemStyle: { color: colors.field, borderColor: colors.background, borderWidth: 4 },
          data: fields,
        },
      },
      {
        type: 'lines',
        coordinateSystem: 'cartesian2d',
        silent: true,
        symbol: ['none', 'arrow'],
        symbolSize: 8,
        lineStyle: { color: colors.accent, width: 1.5, opacity: 1 },
        data: suppliers
          .filter((s) => s.target)
          .map((s) => ({
            coords: [
              [s.current.x, s.current.y],
              [s.target?.x, s.target?.y],
            ],
          })),
      },
      {
        type: 'scatter',
        data: suppliers.map((s) => ({
          name: s.name,
          volumeCents: s.volumeCents,
          value: [s.current.x, s.current.y],
          symbolSize: size(s.volumeCents),
          // Grau für Kontext, Akzent für Lieferanten mit Ziel
          itemStyle: { color: s.target ? colors.accent : colors.context, opacity: 0.9 },
          label: {
            show: true,
            formatter: s.name,
            position: 'right',
            distance: 6,
            color: colors.label,
            fontSize: fontSize.sm,
          },
        })),
      },
    ],
  };

  return (
    <ChartFrame
      title={title}
      description={description}
      isEmpty={suppliers.length === 0}
      empty={empty}
    >
      <EChart option={option} height={400} label={title} />
    </ChartFrame>
  );
}
