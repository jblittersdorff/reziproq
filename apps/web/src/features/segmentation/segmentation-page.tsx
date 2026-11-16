import type { Segmentation } from '@reziproq/shared';
import { GridIcon } from 'lucide-react';
import { Heatmap } from '@/components/charts/heatmap';
import { SegmentMatrix } from '@/components/charts/segment-matrix';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { HistoryList } from '@/components/ui/history-list';
import { LoadingState } from '@/components/ui/loading-state';
import { linkClass } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { InternalBadge } from '@/features/workspace/internal-badge';
import { useLocale, useT } from '@/lib/i18n';
import { DeviationExplanationsSection } from './deviation-explanations';
import { useDecisions } from './use-decisions';
import { useSegmentation } from './use-segmentation';

type Data = NonNullable<Segmentation['segmentation']>;

export const criterionPath = (relationshipId: string, key: string) =>
  `/lieferanten/${relationshipId}/strategie/segmentierung/kriterium/${key}`;

/** Zeilenbeschriftung der Heatmap; gleiche Beschriftungen bekommen ein Suffix, damit jede Zeile eigen bleibt. */
export function rowLabels(rows: Data['rows'], functionName: (fn: string) => string) {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const label = [row.businessUnit.name, row.materialGroup?.name, functionName(row.function)]
      .filter(Boolean)
      .join(' · ');
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return count > 1 ? `${label} (${count})` : label;
  });
}

/** Strategie › Segmentierung (SEG-05): Ist und Soll aus den Bewertungen, Abweichungen je Kriterium. */
export function SegmentationPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const { locale } = useLocale();
  const query = useSegmentation(relationshipId);
  const decisions = useDecisions(relationshipId);
  const text = t.segmentation;

  return (
    <SupplierFrame relationshipId={relationshipId} area="strategy" current={text.title}>
      {(supplier) => {
        const data = query.data?.segmentation;
        const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
        return (
          <>
            <PageHeader title={text.title} purpose={text.purpose} badge={<InternalBadge />} />
            {data && decisions.data?.canConsolidate && (
              <div>
                {routerLink({
                  href: `/lieferanten/${relationshipId}/strategie/segmentierung/konsolidieren`,
                  className: buttonVariants(),
                  children: text.consolidateAction,
                })}
              </div>
            )}
            {query.isError ? (
              <ErrorState title={text.failed} />
            ) : !query.data ? (
              <LoadingState label={text.loading} />
            ) : !data ? (
              <EmptyState
                size="lg"
                icon={<GridIcon aria-hidden />}
                title={text.emptyTitle}
                description={text.emptyDescription}
                action={routerLink({
                  href: '/bewertungen',
                  className: linkClass,
                  children: text.toRatings,
                })}
              />
            ) : (
              <>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={data.status === 'consolidated' ? 'success' : 'neutral'}>
                    {text.status[data.status]}
                  </Badge>
                  <span>{text.round(data.roundName, data.overall.count)}</span>
                </p>
                <SegmentMatrix
                  title={
                    data.overall.ist
                      ? text.matrixTitle(
                          supplier.name,
                          data.overall.ist.typeName,
                          data.overall.soll?.typeName ?? null,
                        )
                      : text.matrixTitleOpen
                  }
                  suppliers={
                    data.overall.ist
                      ? [
                          {
                            name: supplier.name,
                            volumeCents: 1,
                            current: position(data.overall.ist),
                            ...(data.overall.soll && { target: position(data.overall.soll) }),
                          },
                        ]
                      : []
                  }
                  axes={{ x: t.ratings.qualityAxis, y: t.ratings.impactAxis }}
                  levels={t.ratings.levels as [string, string, string]}
                  formatVolume={() => ''}
                  empty={{ title: text.emptyTitle, description: text.emptyDescription }}
                />
                <section aria-labelledby="seg-groups" className="space-y-2">
                  <h2 id="seg-groups" className="font-semibold text-lg">
                    {text.groups}
                  </h2>
                  <ul className="divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
                    {data.groups.map((group) => (
                      <li
                        key={`${group.businessUnit.id}:${group.materialGroup?.id ?? ''}`}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3"
                      >
                        <span className="min-w-0 break-words font-medium">
                          {[group.businessUnit.name, group.materialGroup?.name]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span>
                            {text.ist}: {group.ist?.typeName ?? '–'}
                          </span>
                          <span>
                            {text.soll}: {group.soll?.typeName ?? '–'}
                          </span>
                          <span>{text.count(group.count)}</span>
                          <Badge variant={group.status === 'consolidated' ? 'success' : 'neutral'}>
                            {text.status[group.status]}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
                <Heatmap
                  title={text.heatmapTitle}
                  description={text.heatmapDescription}
                  columns={data.model.criteria.map((criterion) => criterion.name)}
                  rows={rowLabels(data.rows, (fn) => t.roles.functions[fn as 'quality'])}
                  values={data.rows.map((row) =>
                    data.model.criteria.map((criterion) => {
                      const ist = row.values.find((v) => v.criterionKey === criterion.key)?.ist;
                      const mean = data.stats.find((s) => s.criterionKey === criterion.key)?.mean;
                      return ist == null || mean == null ? 0 : Math.round(Math.abs(ist - mean));
                    }),
                  )}
                  scale={{ min: 0, max: Math.max(1, ...data.rows.map((row) => row.deviation)) }}
                  format={(value) => number.format(value)}
                  empty={{ title: text.emptyTitle, description: text.emptyDescription }}
                />
                <DeviationExplanationsSection relationshipId={relationshipId} stats={data.stats} />
                <section aria-labelledby="seg-criteria" className="space-y-2">
                  <h2 id="seg-criteria" className="font-semibold text-lg">
                    {text.criteria}
                  </h2>
                  <ul className="divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
                    {data.model.criteria.map((criterion) => {
                      const stat = data.stats.find((s) => s.criterionKey === criterion.key);
                      return (
                        <li
                          key={criterion.key}
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3"
                        >
                          {routerLink({
                            href: criterionPath(relationshipId, criterion.key),
                            className: linkClass,
                            children: criterion.name,
                          })}
                          {stat && (
                            <span className="text-sm tabular-nums">
                              {text.spread(
                                number.format(stat.min),
                                number.format(stat.max),
                                number.format(stat.mean),
                              )}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
                <section aria-labelledby="seg-history" className="space-y-2">
                  <h2 id="seg-history" className="font-semibold text-lg">
                    {text.historyTitle}
                  </h2>
                  <HistoryList
                    loading={decisions.isPending}
                    loadingLabel={text.loading}
                    empty={{ title: text.historyEmpty, description: text.historyEmptyDescription }}
                    entries={(decisions.data?.versions ?? []).map((version) => {
                      const total = version.entries.find((entry) => entry.scope === 'total');
                      return {
                        id: String(version.version),
                        when: new Intl.DateTimeFormat(locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(version.decidedAt)),
                        actor: version.decidedBy.name,
                        organization: text.version(version.version),
                        change: [
                          total && text.consolidated(total.ist.typeName, total.soll.typeName),
                          total?.reason,
                        ]
                          .filter(Boolean)
                          .join(' – '),
                      };
                    })}
                  />
                </section>
              </>
            )}
          </>
        );
      }}
    </SupplierFrame>
  );
}

/** Position im Raster 0–3 je Achse aus den Werten 0–100. */
function position(outcome: { impactScore: number; qualityScore: number }) {
  return { x: (outcome.qualityScore / 100) * 3, y: (outcome.impactScore / 100) * 3 };
}
