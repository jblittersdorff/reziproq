import { useEffect, useState } from 'react';

// Diagramm-Theme für Recharts und ECharts – nur aus den Diagramm-Tokens (--chart-*) in
// src/styles/tokens.css, nie aus den Standardfarben der Bibliotheken (PLT-10). Beide Bibliotheken brauchen echte Farbwerte statt var(--…),
// daher werden die Tokens zur Laufzeit gelesen und bei jedem Moduswechsel neu bestimmt.

export const colorTokens = {
  context: '--chart-context',
  accent: '--chart-accent',
  strong: '--chart-strong',
  negative: '--chart-negative',
  grid: '--chart-grid',
  axis: '--chart-axis',
  label: '--chart-label',
  field: '--chart-field',
  buyer: '--chart-buyer',
  supplier: '--chart-supplier',
  surface: '--chart-surface',
  tooltip: '--chart-tooltip',
  tooltipForeground: '--chart-tooltip-foreground',
  tooltipBorder: '--chart-tooltip-border',
} as const;

export type ChartColor = keyof typeof colorTokens;

export interface ChartTheme {
  colors: Record<ChartColor, string>;
  /** Folgeskala von hell nach dunkel, je Stufe mit lesbarer Schriftfarbe */
  sequential: { fill: string; label: string }[];
  fontFamily: string;
  fontSize: { sm: number; base: number };
  reducedMotion: boolean;
}

function remToPx(value: string, rootPx: number): number {
  const number = Number.parseFloat(value);
  return value.trim().endsWith('rem') ? number * rootPx : number;
}

export function readChartTheme(root: HTMLElement = document.documentElement): ChartTheme {
  const style = getComputedStyle(root);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const rootPx = Number.parseFloat(style.fontSize) || 16;

  return {
    colors: Object.fromEntries(
      Object.entries(colorTokens).map(([key, name]) => [key, token(name)]),
    ) as Record<ChartColor, string>,
    sequential: [1, 2, 3, 4, 5].map((step) => ({
      fill: token(`--chart-seq-${step}`),
      label: token(`--chart-seq-label-${step}`),
    })),
    fontFamily: token('--font-family-sans'),
    fontSize: {
      sm: remToPx(token('--font-size-sm'), rootPx),
      base: remToPx(token('--font-size-base'), rootPx),
    },
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

/** Liefert das aktuelle Theme und aktualisiert es beim Wechsel zwischen Hell und Dunkel. */
export function useChartTheme(): ChartTheme | null {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    const update = () => setTheme(readChartTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/** Grundeinstellungen für jede ECharts-Grafik. */
export function echartsBase(theme: ChartTheme) {
  const { colors, fontFamily, fontSize } = theme;
  return {
    backgroundColor: 'transparent',
    animation: !theme.reducedMotion,
    animationDuration: 200,
    textStyle: { fontFamily, fontSize: fontSize.sm, color: colors.label },
    tooltip: {
      backgroundColor: colors.tooltip,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipForeground, fontFamily, fontSize: fontSize.sm },
    },
  };
}

/** Achsen-Einstellungen für Recharts. */
export function rechartsAxis(theme: ChartTheme) {
  return {
    stroke: theme.colors.grid,
    tickLine: false,
    tick: { fill: theme.colors.axis, fontSize: theme.fontSize.sm, fontFamily: theme.fontFamily },
  };
}
