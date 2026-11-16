import { createFileRoute } from '@tanstack/react-router';
import { HintSettingsPage } from '@/features/hints/hints-pages';

export const Route = createFileRoute('/_app/einstellungen/hinweise')({
  component: HintSettingsPage,
});
