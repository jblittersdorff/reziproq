import { createFileRoute } from '@tanstack/react-router';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useCan } from '@/features/auth/use-permissions';
import { MatrixContent } from '@/features/portfolio/matrix-page';
import { PortfolioPage } from '@/features/portfolio/portfolio-page';
import { RoundsPage } from '@/features/rounds/rounds-page';
import { supplierSearchSchema } from '@/features/suppliers/search';
import { SuppliersPage } from '@/features/suppliers/suppliers-page';
import { useT } from '@/lib/i18n';

export const Route = createFileRoute('/_app/lieferanten/')({
  validateSearch: supplierSearchSchema,
  component: SupplierViews,
});

function SupplierViews() {
  const t = useT();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const rounds = useCan('runden.sehen');
  const view = search.ansicht === 'runde' && !rounds ? 'liste' : (search.ansicht ?? 'liste');
  return (
    <>
      <SegmentedControl<'liste' | 'matrix' | 'runde'>
        className="self-start"
        label={t.nav.suppliers}
        value={view}
        options={[
          { value: 'liste', label: t.nav.list },
          { value: 'matrix', label: t.portfolio.matrix.title },
          ...(rounds ? [{ value: 'runde' as const, label: t.rounds.title }] : []),
        ]}
        onChange={(value) =>
          void navigate({
            search: (prev) => ({ ...prev, ansicht: value === 'liste' ? undefined : value }),
          })
        }
      />
      {view === 'matrix' ? (
        <>
          <MatrixContent
            embedded
            search={{ bu: search.bu, wg: search.wg, ansicht: search.segmente }}
            update={(next) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  ...('bu' in next ? { bu: next.bu } : {}),
                  ...('wg' in next ? { wg: next.wg } : {}),
                  ...('ansicht' in next ? { segmente: next.ansicht } : {}),
                }),
                replace: true,
              })
            }
          />
          <PortfolioPage />
        </>
      ) : view === 'runde' ? (
        <RoundsPage />
      ) : (
        <SuppliersPage />
      )}
    </>
  );
}
