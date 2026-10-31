import { Badge } from '@/components/ui/badge';
import { contrast, minimumContrast } from '@/lib/contrast';
import { useLocale, useMessages } from '@/lib/i18n';
import { formatNumber } from '@/lib/money';
import { cn } from '@/lib/utils';
import { graphicPairs, textPairs } from '@/styles/token-pairs';
import { styleguideMessages } from './messages';
import { SourceFiles, Subsection } from './parts';
import {
  breakpoints,
  type ColorGroup,
  colorGroups,
  motionTokens,
  radii,
  shadows,
  spacingSteps,
  typeScale,
} from './tokens';

const tokenFile = 'src/styles/tokens.css';

/** Farben: jedes Token mit Name und Wert, dazu alle Text-Hintergrund-Paare mit Kontrast. */
export function Colors({ values }: { values: Record<string, string> }) {
  const t = useMessages(styleguideMessages);
  const groups: ColorGroup[] = ['surfaces', 'text', 'accent', 'status', 'chart'];

  return (
    <>
      <SourceFiles files={[tokenFile, 'src/styles/token-pairs.ts', 'src/lib/contrast.ts']} />
      {groups.map((group) => (
        <Subsection key={group} title={t.colors[group]}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {colorGroups[group].map((name) => (
              <li key={name} className="flex flex-col gap-2">
                <div
                  className="h-14 rounded-lg shadow-xs"
                  style={{ background: `var(--${name})` }}
                />
                <div className="flex flex-col">
                  <code className="text-sm">--{name}</code>
                  <code className="text-muted-foreground text-sm">{values[name]}</code>
                </div>
              </li>
            ))}
          </ul>
        </Subsection>
      ))}

      <Subsection title={t.colors.pairs}>
        <ContrastPairs
          title={t.colors.textRule}
          pairs={textPairs}
          min={minimumContrast.text}
          values={values}
        />
        <ContrastPairs
          title={t.colors.graphicRule}
          pairs={graphicPairs}
          min={minimumContrast.large}
          values={values}
          large
        />
      </Subsection>
    </>
  );
}

function ContrastPairs({
  title,
  pairs,
  min,
  values,
  large = false,
}: {
  title: string;
  pairs: [string, string][];
  min: number;
  values: Record<string, string>;
  large?: boolean;
}) {
  const t = useMessages(styleguideMessages);
  const { locale } = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{title}</p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pairs.map(([fg, bg]) => {
          const a = values[fg];
          const b = values[bg];
          const ratio = a && b ? contrast(a, b) : null;
          return (
            <li
              key={`${fg}-${bg}`}
              data-pair={`${fg} ${bg}`}
              className="flex min-w-0 items-center gap-3"
            >
              <span
                className={cn(
                  'flex h-12 w-28 shrink-0 items-center justify-center rounded-md shadow-xs',
                  large ? 'font-semibold text-lg' : 'text-base',
                )}
                style={{ background: `var(--${bg})`, color: `var(--${fg})` }}
              >
                {t.colors.sample}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <code className="truncate text-sm">
                  --{fg} / --{bg}
                </code>
                {ratio !== null && (
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {t.colors.contrast(formatNumber(ratio, locale, 2))}
                    </span>
                    <Badge variant={ratio >= min ? 'success' : 'danger'}>
                      {ratio >= min ? t.colors.pass : t.colors.fail}
                    </Badge>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Schrift: alle Stufen von Großtitel bis Fußnote mit Beispielsatz. */
export function Typography({ values }: { values: Record<string, string> }) {
  const t = useMessages(styleguideMessages);
  const px = (rem: string | undefined) => (rem ? Math.round(Number.parseFloat(rem) * 16) : '–');

  return (
    <>
      <SourceFiles files={[tokenFile]} />
      <p className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t.typography.family}</span>
        <code>{values['font-family-sans']}</code>
      </p>
      <ul className="flex flex-col gap-6">
        {typeScale.map(({ key, className }) => {
          const level = t.typography.levels[key];
          return (
            <li key={key} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="flex w-44 shrink-0 flex-col text-sm">
                <span className="font-medium">{level.name}</span>
                <code className="text-muted-foreground">
                  text-{key} · {px(values[`font-size-${key}`])} / {px(values[`line-height-${key}`])}
                </code>
              </span>
              <span className="flex flex-col gap-1">
                <span className={className}>{t.typography.sample}</span>
                <span className="text-muted-foreground text-sm">{level.use}</span>
              </span>
            </li>
          );
        })}
        <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
          <code className="w-44 shrink-0 text-muted-foreground text-sm">400 · 500 · 600</code>
          <p className="flex flex-wrap gap-4 text-base">
            <span className="font-normal">{t.typography.weights}</span>
            <span className="font-medium">{t.typography.weightSample}</span>
            <span className="font-semibold">{t.typography.weightSample}</span>
          </p>
        </li>
      </ul>
    </>
  );
}

/** Abstände, Radien, Schatten, Breakpoints und Bewegung als sichtbare Muster. */
export function Layout({ values }: { values: Record<string, string> }) {
  const t = useMessages(styleguideMessages);

  return (
    <>
      <SourceFiles files={[tokenFile]} />
      <Subsection title={t.layout.spacing} description={t.layout.spacingHint}>
        <ul className="flex flex-col gap-2">
          {spacingSteps.map(({ step, className }) => (
            <li key={step} className="flex items-center gap-4">
              <code className="w-12 shrink-0 text-muted-foreground text-sm">{step}</code>
              <span className={cn('h-4 rounded-sm bg-primary', className)} />
            </li>
          ))}
        </ul>
      </Subsection>

      <Subsection title={t.layout.radii}>
        <ul className="flex flex-wrap gap-6">
          {radii.map(({ token, className }) => (
            <li key={token} className="flex flex-col gap-2">
              <span className={cn('size-20 bg-muted', className)} />
              <code className="text-sm">{className}</code>
              <code className="text-muted-foreground text-sm">{values[token]}</code>
            </li>
          ))}
        </ul>
      </Subsection>

      <Subsection title={t.layout.shadows} description={t.layout.shadowsHint}>
        <ul className="flex flex-wrap gap-6">
          {shadows.map(({ token, className }) => (
            <li key={token} className="flex flex-col gap-3">
              <span className={cn('size-24 rounded-xl bg-card', className)} />
              <code className="text-sm">{className}</code>
            </li>
          ))}
        </ul>
      </Subsection>

      <Subsection title={t.layout.breakpoints}>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {breakpoints.map((name) => (
            <li key={name} className="flex flex-col text-sm">
              <code>{name}:</code>
              <code className="text-muted-foreground">{values[`breakpoint-${name}`]}</code>
            </li>
          ))}
        </ul>
      </Subsection>

      <Subsection title={t.layout.motion} description={t.layout.motionHint}>
        <ul className="flex flex-col gap-1 text-sm">
          {motionTokens.map((name) => (
            <li key={name} className="flex flex-wrap gap-x-4">
              <code>--{name}</code>
              <code className="text-muted-foreground">{values[name]}</code>
            </li>
          ))}
        </ul>
      </Subsection>
    </>
  );
}
