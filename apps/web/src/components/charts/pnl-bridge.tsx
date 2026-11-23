import type { EChartsCoreOption } from 'echarts/core';
import { useSyncExternalStore } from 'react';

import type { BridgeStep } from './bridge';
import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { echartsBase, useChartTheme } from './chart-theme';
import { EChart } from './echart';

/** Schmal heißt: unter dem Breakpoint sm aus den Design-Tokens (wie in der Heatmap). */
const narrowQuery = () => {
  const sm = getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-sm');
  return sm ? `(width < ${sm.trim()})` : 'not all';
};
const subscribeNarrow = (notify: () => void) => {
  const media = window.matchMedia(narrowQuery());
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

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
  // Schmal liegt der Wasserfall waagerecht: Namen untereinander, Werte rechts am Balken (PNL-10).
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(narrowQuery()).matches,
    () => false,
  );
  if (!theme) return null;
  const { colors, fontSize } = theme;

  // PNL-10: nach Reifegrad auf der Skala von hell (früh) nach dunkel (umgesetzt); R1 und R2 teilen
  // sich die hellste noch gut sichtbare Stufe, die Beschriftung nennt die Stufe.
  const maturityStep = [1, 1, 2, 3, 4];
  const color = (step: BridgeStep) =>
    step.maturity !== undefined && step.kind !== 'total'
      ? (theme.sequential[maturityStep[step.maturity - 1] ?? 4]?.fill ?? colors.accent)
      : step.kind === 'total'
        ? colors.strong
        : step.kind === 'increase'
          ? colors.accent
          : colors.negative;

  const option: EChartsCoreOption = {
    ...echartsBase(theme),
    grid: { left: 64, right: 8, top: 32, bottom: 32 },
    tooltip: { show: false },
    ...(narrow
      ? {
          grid: { left: 8, right: 104, top: 8, bottom: 8, containLabel: true },
          yAxis: {
            type: 'category',
            inverse: true,
            data: steps.map((s) => s.label),
            axisLine: { lineStyle: { color: colors.grid } },
            axisTick: { show: false },
            axisLabel: { color: colors.axis, fontSize: fontSize.sm, width: 120, overflow: 'break' },
          },
          xAxis: { type: 'value', show: false },
        }
      : {
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
        }),
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
            position: narrow ? 'right' : 'top',
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
      <EChart option={option} height={narrow ? steps.length * 44 + 24 : 320} label={title} />
    </ChartFrame>
  );
}
