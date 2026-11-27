import type { FocusItem } from '@reziproq/shared';
import { StarIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { linkClass } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useFocus } from './use-portfolio';
import { segmentsHref } from '@/features/relationships/lenses';

export const focusPath = (relationshipId: string) => `/portfolio/fokus/${relationshipId}`;

/** Portfolio › Fokuslieferanten (SEG-02): gesetzter Fokus mit Begründung, darunter Vorschläge mit Grund. */
export function FocusPage() {
  const t = useT();
  const text = t.portfolio.focusPage;
  const format = useFormat();
  const query = useFocus();
  const data = query.data;

  const row = (item: FocusItem, detail: string) => (
    <li
      key={item.relationshipId}
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-3"
    >
      <div className="flex flex-col gap-1">
        {routerLink({
          href: focusPath(item.relationshipId),
          className: linkClass,
          children: item.name,
        })}
        <span className="text-muted-foreground text-sm">{detail}</span>
      </div>
      <span className="text-sm tabular-nums">
        {item.spendCents > 0
          ? format.money(
              { amountCents: item.spendCents, currency: item.currency },
              { wholeUnits: true },
            )
          : '–'}
      </span>
    </li>
  );

  return (
    <>
      <PagePath
        trail={[{ label: t.portfolio.segmentsLabel, href: segmentsHref }]}
        current={text.title}
      />
      <PageHeader size="list" title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : data.focus.length === 0 && data.suggestions.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<StarIcon aria-hidden />}
          title={text.emptyTitle}
          description={text.emptyDescription}
        />
      ) : (
        <>
          <section aria-labelledby="focus-list" className="space-y-2">
            <h2 id="focus-list" className="font-semibold text-lg">
              {text.focusTitle} ({data.focus.length})
            </h2>
            {data.focus.length === 0 ? (
              <p className="text-sm">{text.noFocus}</p>
            ) : (
              <ul className="divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
                {data.focus.map((item) => row(item, item.reason))}
              </ul>
            )}
          </section>
          <section aria-labelledby="focus-suggestions" className="space-y-2">
            <h2 id="focus-suggestions" className="font-semibold text-lg">
              {text.suggestionsTitle} ({data.suggestions.length})
            </h2>
            <p className="text-muted-foreground text-sm">
              {text.suggestionsHint(data.spendShare, data.spendYear)}
            </p>
            {data.suggestions.length === 0 ? (
              <p className="text-sm">{text.noSuggestions}</p>
            ) : (
              <ul className="divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
                {data.suggestions.map((item) =>
                  row(
                    item,
                    item.reasons
                      .map((reason) =>
                        reason === 'spend_share'
                          ? text.reasons.spend_share(data.spendShare)
                          : text.reasons.target_type,
                      )
                      .join(' '),
                  ),
                )}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
