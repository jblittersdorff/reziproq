import { BarChart, HeatmapChart, LinesChart, ScatterChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  MarkAreaComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { type EChartsCoreOption, init, use } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

// Nur die Bausteine laden, die Matrix, Heatmap und Wasserfall brauchen.
use([
  BarChart,
  HeatmapChart,
  LinesChart,
  ScatterChart,
  AriaComponent,
  GridComponent,
  MarkAreaComponent,
  TooltipComponent,
  VisualMapComponent,
  SVGRenderer,
]);

export function EChart({
  option,
  height,
  label,
}: {
  option: EChartsCoreOption;
  height: number;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof init> | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const instance = init(element, null, { renderer: 'svg' });
    chart.current = instance;
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(element);
    return () => {
      resize.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    // Screenreader hören den Titelsatz statt der automatisch erzeugten Beschreibung.
    chart.current?.setOption(
      { ...option, aria: { enabled: true, label: { description: label } } },
      { notMerge: true },
    );
  }, [option, label]);

  return (
    <div ref={container} role="img" aria-label={label} className="w-full" style={{ height }} />
  );
}
