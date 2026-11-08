import type { EChartsCoreOption } from 'echarts/core';
import { useSyncExternalStore } from 'react';

import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { echartsBase, useChartTheme } from './chart-theme';
import { EChart } from './echart';
import { sequentialStep } from './sequential-scale';

/** Schmal heißt: unter dem Breakpoint sm aus den Design-Tokens. */
const narrowQuery = () => {
  const sm = getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-sm');
  return sm ? `(width < ${sm.trim()})` : 'not all';
};
const subscribeNarrow = (notify: () => void) => {
  const media = window.matchMedia(narrowQuery());
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

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
  // Schmal werden die Spaltenköpfe schräg gestellt, damit ECharts keinen ausblendet.
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(narrowQuery()).matches,
    () => false,
  );
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

  const categoryAxis = (names: string[], label: object = {}) => ({
    type: 'category',
    data: names,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: colors.axis, fontSize: fontSize.sm, ...label },
    splitLine: { show: false },
  });

  const option: EChartsCoreOption = {
    ...echartsBase(theme),
    grid: { left: 128, right: 8, top: narrow ? 72 : 32, bottom: 8 },
    xAxis: {
      ...categoryAxis(columns, { interval: 0, ...(narrow && { rotate: 40 }) }),
      position: 'top',
    },
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
        itemStyle: { borderColor: colors.surface, borderWidth: 4, borderRadius: 4 },
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
      <EChart option={option} height={rows.length * 48 + (narrow ? 80 : 40)} label={title} />
    </ChartFrame>
  );
}
