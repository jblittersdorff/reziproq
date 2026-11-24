import type { SupplierDetail, WorkspaceArea } from '@reziproq/shared';
import type { ReactNode } from 'react';
import { PagePath } from '@/features/shell/page-path';
import { workspacePath } from '@/features/workspace/areas';
import { useT } from '@/lib/i18n';
import { useSupplier } from './use-supplier';

/**
 * Pfad für die Seiten eines Lieferanten im Arbeitsbereich (NAV-06): Lieferanten › Name › Bereich ›
 * weitere Ebenen, mit Zurück-Pfeil. Lade-, Fehler- und Nicht-gefunden-Zustand zeigt schon der
 * Arbeitsbereich; hier ist der Lieferant also geladen.
 */
export function SupplierFrame({
  relationshipId,
  area,
  trail = () => [],
  current,
  header,
  children,
}: {
  relationshipId: string;
  area: WorkspaceArea;
  /** Ebenen unter dem Bereich, z. B. Profil vor Bearbeiten */
  trail?: (supplier: SupplierDetail) => { label: string; href: string }[];
  /** Titel der aktuellen Seite */
  current: string;
  /** Titelzeile der Seite; steht in jedem Zustand, auch beim Laden und bei Fehlern. */
  header?: ReactNode;
  children: (supplier: SupplierDetail) => ReactNode;
}) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
  if (!supplier.data) return null;

  const data = supplier.data;
  return (
    <>
      <PagePath
        trail={[
          { label: t.suppliers.title, href: '/beziehungen' },
          { label: data.name, href: workspacePath(relationshipId) },
          { label: t.workspace.areas[area], href: workspacePath(relationshipId, area) },
          ...trail(data),
        ]}
        current={current}
      />
      {header}
      {children(data)}
    </>
  );
}
