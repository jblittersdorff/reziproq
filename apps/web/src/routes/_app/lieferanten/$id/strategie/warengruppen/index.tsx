import { createFileRoute } from '@tanstack/react-router';
import { SupplierCategoriesPage } from '@/features/material-groups/supplier-categories-page';

// WG-20: Zusammenführung der Warengruppen je Lieferant (nur Käufer)
export const Route = createFileRoute('/_app/lieferanten/$id/strategie/warengruppen/')({
  component: function SupplierCategories() {
    const { id } = Route.useParams();
    return <SupplierCategoriesPage key={id} relationshipId={id} />;
  },
});
