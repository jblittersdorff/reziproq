import { createFileRoute } from '@tanstack/react-router';
import { IntegrationsPage } from '@/features/integrations/integration-pages';

export const Route = createFileRoute('/_app/einstellungen/anbindungen')({
  component: IntegrationsPage,
});
