// Welche Farb-Tokens aufeinander vorkommen. Der Test in tokens.node.test.ts prüft jedes Paar
// nach WCAG AA, der Styleguide zeigt sie mit dem gemessenen Kontrast (PLT-10).

/** [Vordergrund, Hintergrund] – normaler Text braucht 4,5:1 */
export const textPairs: [string, string][] = [
  ['foreground', 'background'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'secondary'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['primary', 'background'],
  ['primary-foreground', 'primary'],
  ['primary-soft-foreground', 'primary-soft'],
  ['success', 'background'],
  ['warning', 'background'],
  ['destructive', 'background'],
  ['destructive-foreground', 'destructive'],
  ['success-soft-foreground', 'success-soft'],
  ['warning-soft-foreground', 'warning-soft'],
  ['destructive-soft-foreground', 'destructive-soft'],
  ['muted-foreground', 'card'],
  ['primary', 'card'],
  ['muted-foreground', 'primary-soft'],
  ['foreground', 'primary-soft'],
  // Bühne (Handschrift Bühne, PLT-10)
  ['stage-foreground', 'stage'],
  ['stage-muted', 'stage'],
  ['stage-accent', 'stage'],
  ['stage-accent-foreground', 'stage-accent'],
  ['stage-foreground', 'stage-raised'],
  ['stage-muted', 'stage-raised'],
  ['chart-label', 'background'],
  ['chart-axis', 'background'],
  ['chart-label', 'chart-field'],
  ['chart-label', 'chart-surface'],
  ['chart-tooltip-foreground', 'chart-tooltip'],
  ...[1, 2, 3, 4, 5].map((n): [string, string] => [`chart-seq-label-${n}`, `chart-seq-${n}`]),
];

/** Großer Text, Symbole, Bedienelemente und bedeutungstragende Grafik brauchen 3:1 */
export const graphicPairs: [string, string][] = [
  ['input', 'background'],
  ['ring', 'background'],
  ['chart-accent', 'background'],
  ['chart-buyer', 'background'],
  ['chart-supplier', 'background'],
  ['chart-strong', 'background'],
  ['stage-input', 'stage'],
];
