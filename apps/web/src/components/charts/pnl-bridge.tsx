import type { EChartsCoreOption } from 'echarts/core';

import type { BridgeStep } from './bridge';
import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { echartsBase, useChartTheme } from './chart-theme';
import { EChart } from './echart';

/** P&L-Brücke als Wasserfall von der Baseline über die Hebel zur realisierten Wirkung (nur EBIT). */
export function PnlBridge({
  title,
  description,
  steps,
  formatAxis,
  formatDelta,
  empty,
}: {
  title: string;
  description?: string;
  steps: BridgeStep[];
  formatAxis: (cents: number) => string;
  formatDelta: (step: BridgeStep) => string;
  empty: ChartEmptyText;
}) {
  const theme = useChartTheme();
  if (!theme) return null;
  const { colors, fontSize } = theme;

  const color = (step: BridgeStep) =>
    step.kind === 'total'
      ? colors.strong
      : step.kind === 'increase'
        ? colors.accent
        : colors.negative;

  const option: EChartsCoreOption = {
    ...echartsBase(theme),
    grid: { left: 64, right: 8, top: 32, bottom: 32 },
    tooltip: { show: false },
    xAxis: {
      type: 'category',
      data: steps.map((s) => s.label),
      axisLine: { lineStyle: { color: colors.grid } },
      axisTick: { show: false },
      axisLabel: { color: colors.axis, fontSize: fontSize.sm, interval: 0 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: colors.axis, fontSize: fontSize.sm, formatter: formatAxis },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    series: [
      {
        // Unsichtbarer Sockel, auf dem die Hebel stehen
        type: 'bar',
        stack: 'bridge',
        silent: true,
        itemStyle: { color: 'transparent' },
        data: steps.map((s) => Math.min(s.startCents, s.endCents)),
      },
      {
        type: 'bar',
        stack: 'bridge',
        barCategoryGap: '40%',
        data: steps.map((s) => ({
          value: Math.abs(s.endCents - s.startCents),
          itemStyle: { color: color(s), borderRadius: 2 },
          label: {
            show: true,
            position: 'top',
            color: colors.label,
            fontSize: fontSize.sm,
            formatter: formatDelta(s),
          },
        })),
      },
    ],
  };

  return (
    <ChartFrame title={title} description={description} isEmpty={steps.length === 0} empty={empty}>
      <EChart option={option} height={320} label={title} />
    </ChartFrame>
  );
}
