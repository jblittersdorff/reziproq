import { useEffect, useState } from 'react';

// Welche Tokens der Styleguide zeigt (PLT-10). Dass jedes Farb-Token aus tokens.css hier
// vorkommt, prüft tokens.node.test.ts in diesem Ordner.

export const colorGroups = {
  /* Designsprache „Zwei Kreise“ */
  brand: [
    'ink',
    'text',
    'petrol',
    'petrol-dark',
    'mint',
    'mint-soft',
    'mint-line',
    'paper',
    'line',
    'line-soft',
    'muted-strong',
    'ring-open',
    'control',
    'row-line',
    'sidebar-line',
    'draft-line',
    'signal-amber',
    'input-border',
    'on-dark',
    'on-dark-muted',
    'dark-2',
    'status-neutral',
    'status-neutral-foreground',
    'status-shared',
    'status-shared-foreground',
    'status-ink',
    'status-ink-foreground',
  ],
  surfaces: [
    'background',
    'muted',
    'card',
    'popover',
    'secondary',
    'accent',
    'overlay',
    'border',
    'input',
  ],
  text: [
    'foreground',
    'muted-foreground',
    'card-foreground',
    'popover-foreground',
    'secondary-foreground',
    'accent-foreground',
  ],
  accent: ['primary', 'primary-foreground', 'primary-soft', 'primary-soft-foreground', 'ring'],
  stage: [
    'stage',
    'stage-foreground',
    'stage-muted',
    'stage-raised',
    'stage-border',
    'stage-input',
    'stage-accent',
    'stage-accent-foreground',
  ],
  status: [
    'success',
    'success-soft',
    'success-soft-foreground',
    'warning',
    'warning-soft',
    'warning-soft-foreground',
    'destructive',
    'destructive-foreground',
    'destructive-soft',
    'destructive-soft-foreground',
  ],
  chart: [
    'track',
    'risk',
    'chart-context',
    'chart-accent',
    'chart-strong',
    'chart-negative',
    'chart-grid',
    'chart-axis',
    'chart-label',
    'chart-field',
    'chart-surface',
    'chart-tooltip',
    'chart-tooltip-foreground',
    'chart-tooltip-border',
    'chart-buyer',
    'chart-supplier',
    'chart-seq-1',
    'chart-seq-2',
    'chart-seq-3',
    'chart-seq-4',
    'chart-seq-5',
    'chart-seq-label-1',
    'chart-seq-label-2',
    'chart-seq-label-3',
    'chart-seq-label-4',
    'chart-seq-label-5',
  ],
} as const;

export type ColorGroup = keyof typeof colorGroups;

/** Schriftstufen von groß nach klein, mit Tailwind-Klasse */
export const typeScale = [
  { key: 'display', className: 'text-display font-bold tracking-title' },
  { key: '2xl', className: 'text-2xl font-bold tracking-title' },
  { key: 'xl', className: 'text-xl font-bold tracking-title' },
  { key: 'lg', className: 'text-lg font-bold tracking-title' },
  { key: 'base', className: 'text-base' },
  { key: 'sm', className: 'text-sm' },
] as const;

/** Abstandsstufen; Tailwind-Klassen stehen ausgeschrieben, damit Tailwind sie findet. */
export const spacingSteps = [
  { step: 1, className: 'w-1' },
  { step: 2, className: 'w-2' },
  { step: 3, className: 'w-3' },
  { step: 4, className: 'w-4' },
  { step: 6, className: 'w-6' },
  { step: 8, className: 'w-8' },
  { step: 12, className: 'w-12' },
  { step: 16, className: 'w-16' },
  { step: 24, className: 'w-24' },
] as const;

export const radii = [
  { token: 'corner-sm', className: 'rounded-sm' },
  { token: 'corner-md', className: 'rounded-md' },
  { token: 'corner-lg', className: 'rounded-lg' },
  { token: 'corner-xl', className: 'rounded-xl' },
] as const;

export const shadows = [
  { token: 'elevation-xs', className: 'shadow-xs' },
  { token: 'elevation-sm', className: 'shadow-sm' },
  { token: 'elevation-md', className: 'shadow-md' },
  { token: 'elevation-lg', className: 'shadow-lg' },
  { token: 'elevation-xl', className: 'shadow-xl' },
] as const;

export const breakpoints = ['sm', 'md', 'lg', 'xl', 'sidebar'] as const;

export const motionTokens = ['motion-duration', 'motion-easing'] as const;

/** Alle Tokens, deren Wert der Styleguide anzeigt */
const shownTokens = [
  ...Object.values(colorGroups).flat(),
  ...radii.map((radius) => radius.token),
  ...shadows.map((shadow) => shadow.token),
  ...motionTokens,
  ...typeScale.flatMap((level) => [`font-size-${level.key}`, `line-height-${level.key}`]),
  ...breakpoints.map((name) => `breakpoint-${name}`),
  'font-family-sans',
  'spacing-unit',
];

function readTokens(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    shownTokens.map((name) => [name, style.getPropertyValue(`--${name}`).trim()]),
  );
}

/** Aktuelle Werte der Tokens; liest neu, sobald Hell oder Dunkel wechselt. */
export function useTokenValues(): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(readTokens());
    const observer = new MutationObserver(() => setValues(readTokens()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return values;
}
