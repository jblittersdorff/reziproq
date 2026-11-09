import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { TileMetric } from '@/components/ui/tile';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { TileGrid, WorkspaceTile } from '@/features/workspace/workspace-tile';
import { useT } from '@/lib/i18n';
import { usePortfolio } from './use-portfolio';

/** Portfolio (SEG-07): fünf Kacheln mit je einer Kennzahl. */
export function PortfolioPage() {
  const t = useT();
  const text = t.portfolio;
  const canSeeRounds = useCan('runden.sehen');
  const query = usePortfolio();

  return (
    <>
      <PageHeader title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <TileGrid label={text.title}>
          <WorkspaceTile
            title={text.matrix.title}
            text={text.tiles.matrix}
            metric={
              <TileMetric
                value={query.data.matrixCount}
                label={text.metrics.matrix(query.data.matrixCount)}
              />
            }
            href="/portfolio/matrix"
          />
          <WorkspaceTile
            title={text.open.title}
            text={text.tiles.open}
            metric={
              <TileMetric
                value={query.data.openCount}
                label={text.metrics.open(query.data.openCount)}
              />
            }
            href="/portfolio/offen"
          />
          <WorkspaceTile
            title={t.rounds.title}
            text={text.tiles.rounds}
            metric={
              <TileMetric
                value={query.data.openRounds}
                label={text.metrics.rounds(query.data.openRounds)}
              />
            }
            href={canSeeRounds ? '/portfolio/runden' : undefined}
          />
          <WorkspaceTile
            title={text.focus}
            text={text.tiles.focus}
            metric={
              <TileMetric
                value={query.data.focusCount}
                label={text.metrics.focus(query.data.focusCount)}
              />
            }
            href="/portfolio/fokus"
          />
        </TileGrid>
      )}
    </>
  );
}
