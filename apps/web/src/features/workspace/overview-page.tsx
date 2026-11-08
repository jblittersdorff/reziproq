import { type OverviewMetric, type OverviewTile, overviewTiles } from '@reziproq/shared';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Stage } from '@/components/ui/stage';
import { TileMetric } from '@/components/ui/tile';
import { useDocumentTitle } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { InStageSlot } from '@/features/shell/stage-slot';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { overviewComing, workspacePath } from './areas';
import { CycleBar } from './cycle-bar';
import { useOverview } from './use-overview';
import { WorkspaceHead } from './workspace-head';
import { TileGrid, WorkspaceTile } from './workspace-tile';

/**
 * Überblick eines Lieferanten (NAV-06): Bühne mit Name und Kopf (PLT-10), Platz für die
 * Zyklus-Leiste (ZYK-01), sechs Kacheln mit je einer Kennzahl aus ihrem Modul. Speichert nichts selbst.
 */
export function OverviewPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
  const overview = useOverview(relationshipId);
  useDocumentTitle(
    supplier.data ? `${supplier.data.name} · ${t.workspace.overview}` : t.workspace.overview,
  );
  if (!supplier.data) return null;

  const metricOf = (tile: OverviewTile) =>
    overview.data?.metrics.find((metric) => metric.tile === tile);

  return (
    <>
      <InStageSlot>
        <Stage
          tone="light"
          path={
            <PagePath
              trail={[{ label: t.suppliers.title, href: '/lieferanten' }]}
              current={supplier.data.name}
            />
          }
          eyebrow={t.workspace.overview}
          title={supplier.data.name}
          text={t.workspace.overviewPurpose}
          aside={overview.data && <WorkspaceHead head={overview.data.head} size="lg" />}
        />
      </InStageSlot>
      {overview.isError ? (
        <ErrorState title={t.workspace.failed} />
      ) : !overview.data ? (
        <LoadingState label={t.workspace.loading} />
      ) : (
        <>
          {overview.data.cycle && (
            <CycleBar
              cycle={overview.data.cycle}
              relationshipId={relationshipId}
              canSetJbpDate={overview.data.canSetJbpDate}
            />
          )}
        </>
      )}
      <TileGrid label={t.workspace.overview}>
        {overviewTiles.map((tile) => (
          <WorkspaceTile
            key={tile}
            title={t.workspace.areas[tile]}
            text={t.workspace.areaPurposes[tile]}
            coming={overviewComing[tile]}
            metric={overview.data && <Metric metric={metricOf(tile)} />}
            // Die Hinweise bekommen ihre Seite erst mit FS-01.
            href={tile === 'hints' ? undefined : workspacePath(relationshipId, tile)}
          />
        ))}
      </TileGrid>
    </>
  );
}

function Metric({ metric }: { metric: OverviewMetric | undefined }) {
  const t = useT();
  const { locale } = useLocale();
  if (!metric) return <TileMetric value="–" label={t.workspace.metrics.noSpend} />;
  switch (metric.kind) {
    case 'spend':
      return (
        <TileMetric
          value={formatMoney(metric.amount, locale, { compact: true })}
          label={t.workspace.metrics.spend(metric.year)}
        />
      );
    case 'segment_target':
      return (
        <TileMetric
          value={metric.typeName}
          label={t.workspace.metrics.target(metric.provisional)}
        />
      );
    case 'team_size':
      return <TileMetric value={metric.count} label={t.workspace.metrics.teamSize(metric.count)} />;
  }
}
