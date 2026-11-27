import type { SupplierDetail, SupplierOverview } from '@reziproq/shared';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SupplierHeader } from '@/components/ui/entity-header';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { routerLink } from '@/features/shell/navigation';
import { PagePath } from '@/features/shell/page-path';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { useMessages, useT } from '@/lib/i18n';
import { currentStepIndex } from './phases';
import { type SupplierText, supplierMessages } from './supplier-messages';
import { SupplierScope } from './supplier-scope';
import { type SupplierTab, supplierTabs, tabHref, tabOf, tabPages } from './tabs';
import { useOverview } from './use-overview';

/**
 * Arbeitsbereich eines Lieferanten (NAV-10 1.1, Vorlage `SupplierBar.dc.html`): auf jeder Seite
 * oben der Lieferantenkopf mit „‹ Lieferanten“, Name, grauer Zeile (Segment, Warengruppe, Schritt
 * im Jahreszyklus), rundem Knopf „···“ für das Profil, den vier Bereichen und den Unterseiten des
 * aktiven Bereichs. Claims und Risiken erscheinen erst mit ihrem Modul (UX-20); bis dahin gibt es
 * keine Seiten dafür. Hier liegen auch Lade-, Fehler- und Nicht-gefunden-Zustand aller Seiten.
 */
export function SupplierWorkspace({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = useMessages(supplierMessages);
  const supplier = useSupplier(relationshipId);
  const overview = useOverview(relationshipId);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const root = { label: t.suppliers.title, href: '/beziehungen' };

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

  const { tab, page } = tabOf(pathname);
  const pages = tabPages[tab].map((entry) => ({
    key: entry.path,
    label: entry.key === 'profile' ? text.profile.title : t.workspace.pages[entry.key].title,
    href: `/lieferanten/${relationshipId}/${entry.path}`,
  }));

  return (
    <SupplierScope.Provider value={{ relationshipId }}>
      <SupplierHeader
        back={{ label: text.header.back, href: '/beziehungen' }}
        name={supplier.data.name}
        nameAs={tab === 'overview' && !page ? 'h1' : 'p'}
        meta={headerMeta(text, t.workspace.cycle.steps, supplier.data, overview.data)}
        areasLabel={text.header.areas}
        areas={supplierTabs.map((key: SupplierTab) => ({
          key,
          label: t.workspace.tabs[key],
          href: tabHref(relationshipId, key),
        }))}
        activeArea={tab === 'profile' ? undefined : tab}
        pagesLabel={text.header.pages}
        pages={pages}
        activePage={page?.path}
        profile={{
          label: text.header.profile,
          href: tabHref(relationshipId, 'profile'),
          active: tab === 'profile',
        }}
        renderLink={routerLink}
      />
      <Outlet />
    </SupplierScope.Provider>
  );
}

/** Graue Zeile: Segment (oder „nicht bewertet“), Haupt-Warengruppe und Schritt im Jahreszyklus */
function headerMeta(
  text: SupplierText,
  steps: Record<string, string>,
  supplier: SupplierDetail,
  overview: SupplierOverview | undefined,
) {
  const cycle = overview?.cycle ?? null;
  const index = cycle ? currentStepIndex(cycle) : -1;
  const step = cycle?.steps[index];
  return [
    overview?.head.isFocus ? text.header.focus : null,
    overview ? (overview.head.segment?.current ?? text.header.notRated) : null,
    supplier.materialGroups?.[0] ?? null,
    cycle && step ? text.header.step(index + 1, cycle.steps.length, steps[step.key] ?? '') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
