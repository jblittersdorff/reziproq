import type { EChartsCoreOption } from 'echarts/core';

import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { echartsBase, useChartTheme } from './chart-theme';
import { EChart } from './echart';
import { sequentialStep } from './sequential-scale';

/** Abweichungen zwischen Business Units: eine Farbskala von hell nach dunkel, Zahl im Feld. */
export function Heatmap({
  title,
  description,
  columns,
  rows,
  values,
  scale,
  format,
  empty,
}: {
  title: string;
  description?: string;
  columns: string[];
  rows: string[];
  /** values[zeile][spalte] */
  values: number[][];
  scale: { min: number; max: number };
  format: (value: number) => string;
  empty: ChartEmptyText;
}) {
  const theme = useChartTheme();
  if (!theme) return null;
  const { colors, fontSize, sequential } = theme;

  const data = values.flatMap((row, y) =>
    row.map((value, x) => {
      const step = sequential[sequentialStep(value, scale.min, scale.max, sequential.length)];
      return {
        value: [x, y, value],
        itemStyle: { color: step?.fill },
        label: { color: step?.label },
      };
    }),
  );

  const categoryAxis = (names: string[]) => ({
    type: 'category',
    data: names,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: colors.axis, fontSize: fontSize.sm },
    splitLine: { show: false },
  });

  const option: EChartsCoreOption = {
    ...echartsBase(theme),
    grid: { left: 128, right: 8, top: 32, bottom: 8 },
    xAxis: { ...categoryAxis(columns), position: 'top' },
    yAxis: { ...categoryAxis(rows), inverse: true },
    tooltip: { show: false },
    // Pflicht für Heatmaps in ECharts; dieselben Stufen wie sequentialStep, ohne eigene Legende
    visualMap: {
      show: false,
      type: 'piecewise',
      dimension: 2,
      pieces: sequential.map((step, i) => {
        const width = (scale.max - scale.min) / sequential.length;
        const last = i === sequential.length - 1;
        return {
          gte: i === 0 ? Number.NEGATIVE_INFINITY : scale.min + i * width,
          ...(last ? {} : { lt: scale.min + (i + 1) * width }),
          color: step.fill,
        };
      }),
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: {
          show: true,
          fontSize: fontSize.base,
          formatter: (params: { value: [number, number, number] }) => format(params.value[2]),
        },
        itemStyle: { borderColor: colors.background, borderWidth: 4, borderRadius: 4 },
        emphasis: { disabled: true },
      },
    ],
  };

  return (
    <ChartFrame
      title={title}
      description={description}
      isEmpty={values.length === 0 || columns.length === 0}
      empty={empty}
    >
      <EChart option={option} height={rows.length * 48 + 40} label={title} />
    </ChartFrame>
  );
}
