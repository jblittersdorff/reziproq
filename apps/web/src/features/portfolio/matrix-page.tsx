import type { PortfolioPoint } from '@reziproq/shared';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ChartScatterIcon } from 'lucide-react';
import { useId } from 'react';
import { SegmentMatrix } from '@/components/charts/segment-matrix';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { linkClass } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { usePortfolioMatrix } from './use-portfolio';

const cell = (levels: { impactLevel: number; qualityLevel: number }) =>
  `${levels.impactLevel}-${levels.qualityLevel}`;

/** Punkte einer Zelle verteilen sich gleichmäßig im Feld (Raster 0–3 je Achse). */
export function spread<T>(
  items: T[],
  key: (item: T) => { impactLevel: number; qualityLevel: number },
) {
  const groups = new Map<string, number[]>();
  items.forEach((item, index) => {
    const id = cell(key(item));
    groups.set(id, [...(groups.get(id) ?? []), index]);
  });
  const positions: { x: number; y: number }[] = [];
  for (const indexes of groups.values()) {
    const columns = Math.ceil(Math.sqrt(indexes.length));
    const rows = Math.ceil(indexes.length / columns);
    indexes.forEach((itemIndex, order) => {
      const { impactLevel, qualityLevel } = key(items[itemIndex] as T);
      const column = order % columns;
      const row = Math.floor(order / columns);
      positions[itemIndex] = {
        x: qualityLevel - 1 + 0.15 + 0.7 * ((column + 0.5) / columns),
        y: impactLevel - 1 + 0.15 + 0.7 * ((row + 0.5) / rows),
      };
    });
  }
  return positions;
}

export const segmentationPath = (relationshipId: string) =>
  `/lieferanten/${relationshipId}/strategie/segmentierung`;

/** Portfolio › Matrix (SEG-07): alle konsolidierten Lieferanten, Pfeil von Ist zu Soll, Filter in der Adresse. */
export function MatrixPage() {
  const t = useT();
  const text = t.portfolio.matrix;
  const { locale } = useLocale();
  const search = useSearch({ from: '/_app/portfolio/matrix' });
  const navigate = useNavigate({ from: '/portfolio/matrix' });
  const query = usePortfolioMatrix({
    businessUnitId: search.bu,
    materialGroupId: search.wg,
  });
  const unitId = useId();
  const groupId = useId();
  const points = query.data?.points ?? [];
  const update = (next: { bu?: string | undefined; wg?: string | undefined }) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });

  const current = spread(points, (point) => point.ist);
  const targets = spread(points, (point) => point.soll);
  const crowded = new Set(points.map((point) => cell(point.ist))).size < points.length;
  const money = (cents: number, currency: string) =>
    formatMoney({ amountCents: cents, currency }, locale, { compact: true });
  const label = (point: PortfolioPoint) =>
    [point.name, search.bu ? null : point.businessUnit?.name, point.materialGroup?.name]
      .filter(Boolean)
      .join(' · ');

  return (
    <>
      <PagePath trail={[{ label: t.portfolio.title, href: '/portfolio' }]} current={text.title} />
      <PageHeader size="list" title={text.title} purpose={text.purpose} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={unitId} className="text-muted-foreground text-sm">
            {text.businessUnit}
          </label>
          <NativeSelect
            id={unitId}
            value={search.bu ?? ''}
            onChange={(event) => update({ bu: event.target.value || undefined })}
          >
            <option value="">{text.all}</option>
            {query.data?.businessUnits.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={groupId} className="text-muted-foreground text-sm">
            {text.materialGroup}
          </label>
          <NativeSelect
            id={groupId}
            value={search.wg ?? ''}
            onChange={(event) => update({ wg: event.target.value || undefined })}
          >
            <option value="">{text.all}</option>
            {query.data?.materialGroups.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : points.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<ChartScatterIcon aria-hidden />}
          title={text.emptyTitle}
          description={text.emptyDescription}
        />
      ) : (
        <>
          <SegmentMatrix
            title={text.chartTitle(points.length)}
            description={text.chartDescription(query.data.spendYear)}
            suppliers={points.map((point, index) => ({
              name: label(point),
              volumeCents: point.spendCents,
              current: current[index] as { x: number; y: number },
              ...(cell(point.ist) !== cell(point.soll) && {
                target: targets[index] as { x: number; y: number },
              }),
            }))}
            axes={{ x: t.ratings.qualityAxis, y: t.ratings.impactAxis }}
            levels={t.ratings.levels as [string, string, string]}
            formatVolume={(cents) => money(cents, points[0]?.currency ?? 'EUR')}
            empty={{ title: text.emptyTitle, description: text.emptyDescription }}
            labels={!crowded}
            onSelect={(index) => {
              const point = points[index];
              if (point) {
                void navigate({
                  to: '/lieferanten/$id/strategie/segmentierung',
                  params: { id: point.relationshipId },
                });
              }
            }}
          />
          <section aria-labelledby="pf-list" className="space-y-2">
            <h2 id="pf-list" className="font-semibold text-lg">
              {text.list}
            </h2>
            <ul className="divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
              {points.map((point) => (
                <li
                  key={`${point.relationshipId}:${point.businessUnit?.id ?? ''}:${point.materialGroup?.id ?? ''}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3"
                >
                  {routerLink({
                    href: segmentationPath(point.relationshipId),
                    className: linkClass,
                    children: label(point),
                  })}
                  <span className="text-sm">
                    {point.ist.typeName} → {point.soll.typeName}
                    {point.spendCents > 0 && ` · ${money(point.spendCents, point.currency)}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
