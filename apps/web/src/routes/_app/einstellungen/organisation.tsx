import { createFileRoute } from '@tanstack/react-router';
import { OrganizationPage } from '@/features/settings/organization-page';

export const Route = createFileRoute('/_app/einstellungen/organisation')({
  component: OrganizationPage,
});
