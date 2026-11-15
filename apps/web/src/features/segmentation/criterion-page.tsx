import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { InternalBadge } from '@/features/workspace/internal-badge';
import { useLocale, useT } from '@/lib/i18n';
import { rowLabels } from './segmentation-page';
import { useSegmentation } from './use-segmentation';

/** Segmentierung › Kriterium (SEG-05): Werte und Kommentare aller sichtbaren Bewertungen zu einem Kriterium. */
export function CriterionPage({
  relationshipId,
  criterionKey,
}: {
  relationshipId: string;
  criterionKey: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const query = useSegmentation(relationshipId);
  const text = t.segmentation;
  const data = query.data?.segmentation;
  const criterion = data?.model.criteria.find((entry) => entry.key === criterionKey);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      trail={() => [
        {
          label: text.title,
          href: `/lieferanten/${relationshipId}/strategie/segmentierung`,
        },
      ]}
      current={criterion?.name ?? text.criterion}
    >
      {() => (
        <>
          <PageHeader
            title={criterion?.name ?? text.criterion}
            purpose={text.criterionPurpose}
            badge={<InternalBadge />}
          />
          {query.isError ? (
            <ErrorState title={text.failed} />
          ) : !query.data ? (
            <LoadingState label={text.loading} />
          ) : !data || !criterion ? (
            <ErrorState title={text.criterionMissing} />
          ) : (
            <ul className="divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
              {data.rows.map((row, index) => {
                const value = row.values.find((entry) => entry.criterionKey === criterionKey);
                const label = rowLabels(data.rows, (fn) => t.roles.functions[fn as 'quality'])[
                  index
                ];
                return (
                  <li key={row.assignmentId} className="space-y-1 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="min-w-0 break-words font-medium">{label}</span>
                      <span className="text-sm tabular-nums">
                        {text.ist}: {value?.ist == null ? '–' : number.format(value.ist)} ·{' '}
                        {text.soll}: {value?.soll == null ? '–' : number.format(value.soll)}
                      </span>
                    </div>
                    {value?.comment && (
                      <p className="break-words text-muted-foreground text-sm">{value.comment}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </SupplierFrame>
  );
}
