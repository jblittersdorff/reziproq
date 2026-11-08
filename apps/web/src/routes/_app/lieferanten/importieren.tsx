import { createFileRoute } from '@tanstack/react-router';
import { SupplierImportPage } from '@/features/suppliers/supplier-import-page';

export const Route = createFileRoute('/_app/lieferanten/importieren')({
  component: SupplierImportPage,
});
