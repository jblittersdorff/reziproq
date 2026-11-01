import { createFileRoute } from '@tanstack/react-router';
import { supplierSearchSchema } from '@/features/suppliers/search';
import { SuppliersPage } from '@/features/suppliers/suppliers-page';

export const Route = createFileRoute('/_app/lieferanten/')({
  validateSearch: supplierSearchSchema,
  component: SuppliersPage,
});
