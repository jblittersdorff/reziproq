import { dueBuckets, focusArts } from '@reziproq/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useMe } from '@/features/auth/use-me';
import { SupplierStartPage } from '@/features/start/start-page';
import { TodayPage } from '@/features/today/today-page';

// NAV-10 2.0, HE-01 (K1-e): Heute mit den Ansichten Fokus und Alles (`?ansicht=alles`) und den
// Filtern der Ansicht Alles in der Adresse. Beim Lieferanten bis K5-b weiter der Start (LIF-02,
// LP-01). Unbekannte Werte fallen still weg, damit ein alter Link die Seite nicht bricht.
const search = z.object({
  ansicht: z.enum(['alles']).optional().catch(undefined),
  beziehung: z.uuid().optional().catch(undefined),
  warengruppe: z.string().trim().min(1).max(200).optional().catch(undefined),
  art: z.enum(focusArts).optional().catch(undefined),
  schwere: z.enum(['high', 'medium', 'low']).optional().catch(undefined),
  frist: z.enum(dueBuckets).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/heute')({
  validateSearch: search,
  component: function Today() {
    const { ansicht, ...filters } = Route.useSearch();
    const me = useMe();
    const supplierSide = Boolean(
      me.data?.permissions.viewCustomers && !me.data.permissions.viewBuyerAreas,
    );
    if (supplierSide) return <SupplierStartPage />;
    return <TodayPage view={ansicht === 'alles' ? 'all' : 'focus'} filters={filters} />;
  },
});
