import { createFileRoute } from '@tanstack/react-router';
import { RolesPage } from '@/features/settings/roles-page';

export const Route = createFileRoute('/_app/einstellungen/rollen')({
  component: RolesPage,
});
