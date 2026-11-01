import type { WorkspaceArea } from '@reziproq/shared';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { useT } from '@/lib/i18n';
import { areaPages, workspacePath } from './areas';
import { InternalBadge } from './internal-badge';
import { TileGrid, WorkspaceTile } from './workspace-tile';

/**
 * Bereichsseite im Arbeitsbereich (NAV-06): die Unterseiten als große Kacheln, keine zweite
 * Menüzeile. Fehlt eine Unterseite noch, zeigt die Kachel den Release-Hinweis ohne Knopf.
 */
export function AreaPage({
  relationshipId,
  area,
}: {
  relationshipId: string;
  area: WorkspaceArea;
}) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
  if (!supplier.data) return null;
  const title = t.workspace.areas[area];

  return (
    <>
      <PagePath
        trail={[
          { label: t.suppliers.title, href: '/lieferanten' },
          { label: supplier.data.name, href: workspacePath(relationshipId) },
        ]}
        current={title}
      />
      <PageHeader
        title={title}
        purpose={t.workspace.areaPurposes[area]}
        badge={area === 'strategy' ? <InternalBadge /> : undefined}
      />
      <TileGrid label={title}>
        {areaPages[area].map((page) => {
          const texts = t.workspace.pages[page.key];
          return (
            <WorkspaceTile
              key={page.key}
              title={texts.title}
              text={texts.text}
              coming={'coming' in page ? page.coming : null}
              href={
                'segment' in page
                  ? `${workspacePath(relationshipId, area)}/${page.segment}`
                  : undefined
              }
            />
          );
        })}
      </TileGrid>
    </>
  );
}
