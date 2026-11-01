import { createFileRoute } from '@tanstack/react-router';
import { NewSupplierPage } from '@/features/suppliers/new-supplier-page';

export const Route = createFileRoute('/_app/lieferanten/neu')({
  component: NewSupplierPage,
});
