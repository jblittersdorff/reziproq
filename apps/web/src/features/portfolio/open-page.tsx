import type { OpenItem } from '@reziproq/shared';
import { CircleCheckIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { linkClass } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { useLocale, useT } from '@/lib/i18n';
import { segmentationPath } from './matrix-page';
import { usePortfolioOpen } from './use-portfolio';

const reasons = ['ratings_open', 'not_consolidated', 'deviation'] as const;

/** Portfolio › Offene Entscheidungen (SEG-07): Lieferanten nach dem Grund, warum noch etwas fehlt. */
export function OpenPage() {
  const t = useT();
  const text = t.portfolio.open;
  const { locale } = useLocale();
  const query = usePortfolioOpen();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const total = Object.values(query.data?.groups ?? {}).reduce(
    (sum, items) => sum + items.length,
    0,
  );
  const detail = (reason: (typeof reasons)[number], item: OpenItem) =>
    reason === 'ratings_open'
      ? text.progress(item.submitted, item.total)
      : item.deviation === null
        ? ''
        : text.deviation(number.format(item.deviation));

  return (
    <>
      <PagePath trail={[{ label: t.portfolio.title, href: '/portfolio' }]} current={text.title} />
      <PageHeader size="list" title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : total === 0 ? (
        <EmptyState
          size="lg"
          icon={<CircleCheckIcon aria-hidden />}
          title={text.emptyTitle}
          description={text.emptyDescription}
        />
      ) : (
        reasons.map((reason) => {
          const items = query.data.groups[reason];
          return (
            <section key={reason} aria-labelledby={`open-${reason}`} className="space-y-2">
              <h2 id={`open-${reason}`} className="font-semibold text-lg">
                {text.reasons[reason]} ({items.length})
              </h2>
              <p className="text-muted-foreground text-sm">
                {reason === 'deviation'
                  ? text.reasonHints.deviation(query.data.deviationThreshold)
                  : text.reasonHints[reason]}
              </p>
              {items.length === 0 ? (
                <p className="text-sm">{text.none}</p>
              ) : (
                <ul className="divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
                  {items.map((item) => (
                    <li
                      key={item.relationshipId}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3"
                    >
                      {routerLink({
                        href: segmentationPath(item.relationshipId),
                        className: linkClass,
                        children: item.name,
                      })}
                      <span className="text-sm">{detail(reason, item)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
