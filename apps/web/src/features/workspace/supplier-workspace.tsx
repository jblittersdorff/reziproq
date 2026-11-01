import { workspaceAreas } from '@reziproq/shared';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { LocalBar } from '@/components/ui/local-bar';
import { InLocalBarSlot } from '@/features/shell/local-bar-slot';
import { routerLink } from '@/features/shell/navigation';
import { PagePath } from '@/features/shell/page-path';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { useT } from '@/lib/i18n';
import { areaOf, workspacePath } from './areas';
import { useOverview } from './use-overview';
import { WorkspaceHead } from './workspace-head';

/**
 * Arbeitsbereich eines Lieferanten (NAV-06): lokale Leiste unter der globalen Leiste mit Name und
 * den sechs Bereichen, darunter auf allen Seiten außer dem Überblick der Kopf als schmale Zeile.
 * Hier liegen auch Lade-, Fehler- und Nicht-gefunden-Zustand für alle Seiten eines Lieferanten.
 */
export function SupplierWorkspace({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
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

  const items = [
    { key: 'overview', label: t.workspace.overview, href: workspacePath(relationshipId) },
    ...workspaceAreas.map(({ key }) => ({
      key,
      label: t.workspace.areas[key],
      href: workspacePath(relationshipId, key),
    })),
  ];

  return (
    <>
      <InLocalBarSlot>
        <LocalBar
          label={t.workspace.label}
          name={supplier.data.name}
          nameHref={workspacePath(relationshipId)}
          items={items}
          activeKey={area ?? 'overview'}
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
