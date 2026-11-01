import { createFileRoute } from '@tanstack/react-router';
import { CustomersPage } from '@/features/support/customers-page';

export const Route = createFileRoute('/_app/betreiber/kunden')({
  component: CustomersPage,
});
