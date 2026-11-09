import { Outlet, useRouterState } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { LocalBar } from '@/components/ui/local-bar';
import { Monogram } from '@/components/ui/monogram';
import { InLocalBarSlot } from '@/features/shell/local-bar-slot';
import { routerLink } from '@/features/shell/navigation';
import { PagePath } from '@/features/shell/page-path';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { useT } from '@/lib/i18n';
import { areaOf, builtAreas, sectionHref, workspacePath } from './areas';
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
  const area = useRouterState({ select: (state) => areaOf(state.location.pathname) });
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

  return (
    <>
      <InLocalBarSlot>
        <LocalBar
          label={t.workspace.label}
          name={supplier.data.name}
          nameIcon={
            <Monogram
              name={supplier.data.name}
              size="sm"
              emphasis={Boolean(overview.data?.head.isFocus)}
            />
          }
          nameHref={workspacePath(relationshipId)}
          items={items}
          activeKey={area}
          action={
            overview.data && (
              <CycleAction relationshipId={relationshipId} overview={overview.data} />
            )
          }
          renderLink={routerLink}
        />
      </InLocalBarSlot>
      {area && <HeadLine relationshipId={relationshipId} />}
      <Outlet />
    </>
  );
}

/** Schmale Kopfzeile; lädt still nach und entfällt, wenn sie nicht lädt. */
function HeadLine({ relationshipId }: { relationshipId: string }) {
  const overview = useOverview(relationshipId);
  if (!overview.data) return null;
  return <WorkspaceHead head={overview.data.head} size="line" />;
}
