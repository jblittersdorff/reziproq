import type { OverviewMetric, WorkspaceArea } from '@reziproq/shared';
import { workspaceAreas } from '@reziproq/shared';
import { useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { LinkList } from '@/components/ui/link-list';
import { LoadingState } from '@/components/ui/loading-state';
import { Stage } from '@/components/ui/stage';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { InStageSlot } from '@/features/shell/stage-slot';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { builtAreas, builtPages, type PageKey, workspacePath } from './areas';
import { CycleBar } from './cycle-bar';
import { InternalBadge } from './internal-badge';
import { useOverview } from './use-overview';
import { WorkspaceHead } from './workspace-head';

/**
 * Ein Lieferant auf einer Seite (NAV-06, UMB-05): helle Bühne mit Name und Kopf, darunter die
 * Zyklus-Leiste (ZYK-01) und je Bereich ein Abschnitt mit seinen gebauten Unterseiten als Zeilen.
 * Speichert nichts selbst; die Stände kommen aus den Kennzahlen der Module.
 */
export function OverviewPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
  const overview = useOverview(relationshipId);
  useDocumentTitle(
    supplier.data ? `${supplier.data.name} · ${t.workspace.overview}` : t.workspace.overview,
  );
  const hash = useRouterState({ select: (state) => state.location.hash });
  const ready = Boolean(supplier.data);
  // Der Abschnitt steht erst nach dem Laden auf der Seite; dann dorthin springen.
  useEffect(() => {
    if (!ready || !hash) return;
    const section = document.getElementById(hash);
    // Ältere Umgebungen wie jsdom kennen scrollIntoView nicht.
    if (typeof section?.scrollIntoView === 'function') section.scrollIntoView({ block: 'start' });
  }, [ready, hash]);
  if (!supplier.data) return null;

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
        overview.data.cycle && (
          <CycleBar
            cycle={overview.data.cycle}
            relationshipId={relationshipId}
            canSetJbpDate={overview.data.canSetJbpDate}
          />
        )
      )}
      {builtAreas.map((area) => (
        <AreaSection
          key={area}
          area={area}
          relationshipId={relationshipId}
          metrics={overview.data?.metrics ?? []}
        />
      ))}
    </>
  );
}

/** Abschnitt eines Bereichs: Titel mit Kennzeichen, darunter die Unterseiten als Liste. */
function AreaSection({
  area,
  relationshipId,
  metrics,
}: {
  area: WorkspaceArea;
  relationshipId: string;
  metrics: OverviewMetric[];
}) {
  const t = useT();
  const segment = workspaceAreas.find((entry) => entry.key === area)?.segment ?? area;
  const headingId = `abschnitt-${segment}`;
  return (
    <section
      id={segment}
      aria-labelledby={headingId}
      data-area={area}
      // Die klebenden Leisten verdecken sonst den Titel, wenn die Seite zum Abschnitt springt.
      className="flex scroll-mt-32 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={headingId} className="font-bold text-xl tracking-title">
          {t.workspace.areas[area]}
        </h2>
        {area === 'strategy' && <InternalBadge />}
      </div>
      <LinkList
        label={t.workspace.areas[area]}
        renderLink={routerLink}
        items={builtPages(area).map((page) => ({
          key: page.key,
          href: `${workspacePath(relationshipId, area)}/${page.segment}`,
          title: t.workspace.pages[page.key].title,
          status: <PageStatus page={page.key} metrics={metrics} />,
        }))}
      />
    </section>
  );
}

/** Stand einer Unterseite aus der Kennzahl ihres Moduls; ohne Kennzahl ihr Satz. */
function PageStatus({ page, metrics }: { page: PageKey; metrics: OverviewMetric[] }) {
  const t = useT();
  const { locale } = useLocale();
  const metric = (kind: OverviewMetric['kind']) => metrics.find((entry) => entry.kind === kind);
  const target = metric('segment_target');
  const spend = metric('spend');
  const team = metric('team_size');
  if (page === 'segmentation' && target?.kind === 'segment_target') {
    return `${t.workspace.metrics.target(target.provisional)}: ${target.typeName}`;
  }
  if (page === 'spend' && spend?.kind === 'spend') {
    return `${formatMoney(spend.amount, locale, { compact: true })} · ${t.workspace.metrics.spend(spend.year)}`;
  }
  if (page === 'team' && team?.kind === 'team_size') {
    return `${team.count} ${t.workspace.metrics.teamSize(team.count)}`;
  }
  return t.workspace.pages[page].text;
}
