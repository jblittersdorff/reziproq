import { ArrowRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { type DraftSource, SourcePill } from './ai-draft';
import { BrandMark } from './brand-mark';
import { Button } from './button';
import { Card } from './card';
import { ListRow, ListRowText } from './list-card';

/** Aufrufende Seiten übergeben nur eine gegen ihre sichtbaren Fakten geprüfte Aussage. */
export function InsightHeading({
  attribution,
  headline,
  explanation,
  sources,
  action,
}: {
  attribution: string;
  headline: string | null;
  explanation: string;
  sources: DraftSource[];
  /** z. B. „Stimmt nicht“ */
  action?: ReactNode;
}) {
  if (!headline || !sources.length) return null;
  return (
    <header className="flex max-w-190 flex-col items-start gap-3">
      <p className="flex items-center gap-2 font-semibold text-petrol-dark text-sm">
        <BrandMark />
        {attribution}
      </p>
      <h3 className="text-balance font-display font-semibold text-title-work tracking-title-work sm:text-insight">
        {headline}
      </h3>
      <p className="text-pretty text-lg text-muted-strong">{explanation}</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <SourcePill key={source.key} source={source} />
        ))}
        {action}
      </div>
    </header>
  );
}

export function EvidenceCard({
  title,
  source,
  children,
}: {
  title: string;
  source: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-evidence p-5 sm:p-8">
      <figure className="flex flex-col gap-5">
        <figcaption className="font-display font-semibold text-section tracking-section">
          {title}
        </figcaption>
        {children}
        <p className="text-chip text-muted-foreground">{source}</p>
      </figure>
    </Card>
  );
}

export function EvidenceRow({
  href,
  title,
  detail,
  value,
}: {
  href: string;
  title: string;
  detail: string;
  value: string;
}) {
  return (
    <ListRow asChild className="min-h-18">
      <a href={href}>
        <ListRowText title={title} detail={detail} />
        <span className="font-display font-semibold text-section tabular-nums">{value}</span>
        <ArrowRightIcon aria-hidden className="size-5 text-petrol-dark" />
      </a>
    </ListRow>
  );
}

export function QuestionSuggestions({
  title,
  questions,
}: {
  title: string;
  questions: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="flex items-center gap-2 font-semibold text-petrol-dark">
        <BrandMark />
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((question) => (
          <Button
            key={question.href}
            variant="secondary"
            asChild
            className="h-auto min-h-11 max-w-full shrink whitespace-normal py-2 shadow-inset-mint"
          >
            <a href={question.href}>{question.label}</a>
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Vergleich nichtnegativer Größen, direkt beschriftet und absteigend sortiert. */
export function RankedBars({
  rows,
  format,
}: {
  rows: { label: string; value: number }[];
  format: (value: number) => string;
}) {
  const sorted = rows.toSorted((left, right) => right.value - left.value);
  const largest = sorted[0]?.value ?? 0;
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map(({ label, value }, index) => (
        <li key={label} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          <span>{label}</span>
          <strong className="tabular-nums">{format(value)}</strong>
          <span
            aria-hidden
            className={
              index === 0
                ? 'col-span-2 h-2.5 rounded-full bg-petrol'
                : 'col-span-2 h-2.5 rounded-full bg-ring-open'
            }
            style={{ width: `${largest > 0 ? Math.max(0, (100 * value) / largest) : 0}%` }}
          />
        </li>
      ))}
    </ul>
  );
}
