import { createFileRoute } from '@tanstack/react-router';
import { QuestionSettingsPage } from '@/features/material-groups/settings-pages';

export const Route = createFileRoute('/_app/einstellungen/warengruppen/leitfragen')({
  component: QuestionSettingsPage,
});
