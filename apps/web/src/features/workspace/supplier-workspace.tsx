import type { SupplierCycle } from '@reziproq/shared';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { Chain } from '@/components/ui/chain';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { LocalBar, LocalBarProgress } from '@/components/ui/local-bar';
import { Monogram } from '@/components/ui/monogram';
import { InLocalBarSlot } from '@/features/shell/local-bar-slot';
import { routerLink } from '@/features/shell/navigation';
import { PagePath } from '@/features/shell/page-path';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { useT } from '@/lib/i18n';
import { areaOf, builtAreas, builtPages, sectionHref, workspacePath } from './areas';
import { CycleAction } from './cycle-action';
import { useOverview } from './use-overview';
import { WorkspaceHead } from './workspace-head';

/**
 * Arbeitsbereich eines Lieferanten (NAV-06, UMB-05): lokale Leiste unter der globalen Leiste mit
 * Name und den Bereichen, die schon Unterseiten haben – ein Klick springt zum Abschnitt auf dem
 * Überblick. Darunter auf allen Seiten außer dem Überblick der Kopf als schmale Zeile.
 * Hier liegen auch Lade-, Fehler- und Nicht-gefunden-Zustand für alle Seiten eines Lieferanten.
 */
export function SupplierWorkspace({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
  const overview = useOverview(relationshipId);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const area = areaOf(pathname);
  const root = { label: t.suppliers.title, href: '/lieferanten' };

  if (supplier.notFound) {
    return (
      <>
        <PagePath trail={[root]} current={t.suppliers.notFoundTitle} />
        <EmptyState
          size="lg"
          icon={<SearchXIcon aria-hidden />}
          title={t.suppliers.notFoundTitle}
          description={t.suppliers.notFoundDescription}
        />
      </>
    );
  }
  if (supplier.isError) {
    return (
      <>
        <PagePath trail={[root]} current={t.suppliers.detailFailed} />
        <ErrorState title={t.suppliers.detailFailed} />
      </>
    );
  }
  if (!supplier.data) return <LoadingState label={t.suppliers.detailLoading} />;

  const items = builtAreas.map((key) => ({
    key,
    label: t.workspace.areas[key],
    href: sectionHref(relationshipId, key),
  }));
  // Unterseiten des aktiven Bereichs als Pillen (Designsprache „Lieferanten-Leiste“).
  const subItems = area
    ? builtPages(area).map((page) => ({
        key: page.segment,
        label: t.workspace.pages[page.key].title,
        href: `${workspacePath(relationshipId, area)}/${page.segment}`,
      }))
    : [];

  return (
    <>
      <InLocalBarSlot>
        <LocalBar
          label={t.workspace.label}
          name={supplier.data.name}
          nameIcon={<Monogram name={supplier.data.name} size="lg" ring />}
          nameHref={workspacePath(relationshipId)}
          subtitle={area && overview.data && <WorkspaceHead head={overview.data.head} size="bar" />}
          progress={overview.data?.cycle && <CycleProgress cycle={overview.data.cycle} />}
          items={items}
          activeKey={area}
          subItems={subItems}
          subLabel={t.workspace.pagesLabel}
          activeSubKey={pathname.split('/')[4]}
          action={
            overview.data && (
              <CycleAction relationshipId={relationshipId} overview={overview.data} />
            )
          }
          renderLink={routerLink}
        />
      </InLocalBarSlot>
      <Outlet />
    </>
  );
}

/** Kette des Jahreszyklus mit Schritt n von m, rechts in der Leiste. */
function CycleProgress({ cycle }: { cycle: SupplierCycle }) {
  const t = useT();
  const currentIndex = cycle.steps.findIndex((step) =>
    ['open', 'in_progress', 'overdue'].includes(step.status),
  );
  const current = cycle.steps[currentIndex];
  const text = current
    ? t.workspace.cycle.position(
        currentIndex + 1,
        cycle.steps.length,
        t.workspace.cycle.steps[current.key],
      )
    : t.workspace.cycle.title(cycle.label);
  return (
    <LocalBarProgress>
      <Chain
        surface="paper"
        label={text}
        steps={cycle.steps.map((step, index) =>
          step.status === 'completed' ? 'done' : index === currentIndex ? 'current' : 'open',
        )}
      />
      <span aria-hidden>{text}</span>
    </LocalBarProgress>
  );
}
