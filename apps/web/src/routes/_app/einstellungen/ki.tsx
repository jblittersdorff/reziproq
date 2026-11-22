import { createFileRoute } from '@tanstack/react-router';
import { AiSettingsPage } from '@/features/ai-gateway/ai-settings-page';

export const Route = createFileRoute('/_app/einstellungen/ki')({
  component: AiSettingsPage,
});
