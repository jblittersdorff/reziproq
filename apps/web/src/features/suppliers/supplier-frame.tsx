import type { SupplierDetail } from '@reziproq/shared';
import { SearchXIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PagePath } from '@/features/shell/page-path';
import { useT } from '@/lib/i18n';
import { useSupplier } from './use-supplier';

/**
 * Lade-, Fehler- und Nicht-gefunden-Zustand für alle Seiten eines Lieferanten (PLT-03b). Den
 * Rahmen mit lokaler Leiste baut NAV-06; bis dahin führt der Pfad zurück.
 */
export function SupplierFrame({
  relationshipId,
  trail = () => [],
  current,
  children,
}: {
  relationshipId: string;
  /** Ebenen unter „Lieferanten“; mit dem Lieferanten, damit sein Name im Pfad steht */
  trail?: (supplier: SupplierDetail) => { label: string; href: string }[];
  /** Titel der aktuellen Seite; ohne ihn der Name des Lieferanten */
  current?: string;
  children: (supplier: SupplierDetail) => ReactNode;
}) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
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

  const data = supplier.data;
  return (
    <>
      <PagePath trail={[root, ...trail(data)]} current={current ?? data.name} />
      {children(data)}
    </>
  );
}
